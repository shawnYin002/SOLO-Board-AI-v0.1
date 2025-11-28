
import { ModelType, AspectRatio, Resolution } from '../types';
import { getModelConfig } from '../models';
import { logger } from './logger';
import { uploadToR2 } from './r2';
import { DEFAULT_KIE_API_KEY } from '../config';

const KIE_BASE_URL = 'https://api.kie.ai/api/v1/jobs';

// Helper: Robust Error Message Extraction
const extractErrorMessage = (data: any, defaultMsg: string): string => {
    try {
        if (!data) return defaultMsg;
        if (typeof data === 'string') return data;
        
        if (data.message) return data.message;
        if (data.msg) return data.msg;
        
        if (data.error) {
            if (typeof data.error === 'string') return data.error;
            if (data.error.message) return data.error.message;
            if (data.error.msg) return data.error.msg;
        }

        if (data.failMsg) return data.failMsg;
        if (data.fail_msg) return data.fail_msg;
        if (data.reason) return data.reason;
        if (data.failure_reason) return data.failure_reason;
        
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            return data.errors[0].message || JSON.stringify(data.errors);
        }

        return defaultMsg;
    } catch (e) {
        return defaultMsg;
    }
};

// Helper to get keys
const getKeys = () => {
  let kieKey = localStorage.getItem('kie_api_key') || '';
  
  // Check default key if local is empty
  if (!kieKey && DEFAULT_KIE_API_KEY) {
      kieKey = DEFAULT_KIE_API_KEY;
  }

  if (kieKey.toLowerCase().startsWith('bearer ')) {
    kieKey = kieKey.substring(7).trim();
  }
  return { kieKey: kieKey.trim() };
};

interface GenerateImageParams {
  prompt: string;
  model: ModelType;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  inputImages?: string[]; 
  batchSize: number;
}

const POLL_INTERVAL = 2000;

// Helper to pre-upload images using R2
const prepareInputImages = async (inputImages: string[]): Promise<string[]> => {
    if (!inputImages || inputImages.length === 0) return [];
    
    const processedImages: string[] = [];
    
    for (let i = 0; i < inputImages.length; i++) {
        const img = inputImages[i];
        
        // Check if it is a local base64 image
        if (img.startsWith('data:image')) {
            const head = img.indexOf(',');
            const sizeInBytes = Math.ceil((img.length - head - 1) * 3 / 4);
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
            
            logger.info(`[R2] 正在上传图片 ${i+1}/${inputImages.length}... (Size: ${sizeInMB}MB)`);
            
            try {
                // Upload to Cloudflare R2
                const uploadedUrl = await uploadToR2(img);
                logger.success(`R2 上传成功`, { url: uploadedUrl });
                processedImages.push(uploadedUrl);
            } catch (e: any) {
                logger.error("R2 上传失败", { message: e.message });
                throw e;
            }
        } else {
            // Already a URL
            processedImages.push(img);
        }
    }
    return processedImages;
};

const runSingleTask = async (
  prompt: string, 
  model: ModelType, 
  aspectRatio: AspectRatio, 
  resolution: Resolution,
  processedInputImages: string[]
): Promise<string> => {
  const { kieKey } = getKeys();
  if (!kieKey) {
      throw new Error("请先登录 (缺少登录码/API Key)");
  }

  // Get configuration to check capabilities
  const modelConfig = getModelConfig(model);

  // Construct Input Payload based on API Docs
  const inputPayload: any = {
    prompt: prompt,
    output_format: "png"
  };
  
  // Determine API Model (may change based on input inputs for standard mode)
  let apiModel = modelConfig.apiValue;

  // ---------------------------------------------------------
  // PARAMETER MAPPING LOGIC
  // ---------------------------------------------------------
  
  if (modelConfig.paramMode === 'pro') {
      // === PRO Model Strategy ===
      // Uses 'aspect_ratio' + 'resolution' + 'image_input' (array)
      
      if (aspectRatio !== 'default') {
          inputPayload.aspect_ratio = aspectRatio;
      }
      // Always send resolution for Pro
      inputPayload.resolution = resolution;

      // Img2Img for Pro
      if (processedInputImages.length > 0) {
          inputPayload.image_input = processedInputImages; // string[]
      }

  } else {
      // === STANDARD Model Strategy (Nano Banana) ===
      // Uses 'image_size'
      
      if (aspectRatio === 'default') {
          // Map default to 'auto' for standard model
          inputPayload.image_size = "auto";
      } else {
          inputPayload.image_size = aspectRatio;
      }
      // Note: Do NOT send 'resolution' for Standard model

      // Img2Img for Standard
      if (processedInputImages.length > 0) {
          // Switch to Edit model for reference generation
          apiModel = 'google/nano-banana-edit';
          // Use 'image_urls' (List of URLs)
          inputPayload.image_urls = processedInputImages; 
      }
  }

  const requestBody = JSON.stringify({
    model: apiModel,
    input: inputPayload
  });

  const payloadSizeKB = (new TextEncoder().encode(requestBody).length / 1024).toFixed(2);
  logger.info(`发送任务请求`, { 
      modelName: model, 
      apiModel: apiModel, 
      mode: modelConfig.paramMode,
      inputKeys: Object.keys(inputPayload),
      payloadSize: `${payloadSizeKB} KB` 
  });

  // Create Task
  let createRes;
  try {
    createRes = await fetch(`${KIE_BASE_URL}/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieKey}`
      },
      body: requestBody
    });
  } catch (e: any) {
    logger.error("网络请求失败", { error: e.toString() });
    throw new Error(`网络连接失败: ${e.message}`);
  }

  if (!createRes.ok) {
    let errorMsg = `HTTP 错误 ${createRes.status}`;
    try {
      const errData = await createRes.json();
      errorMsg = extractErrorMessage(errData, errorMsg);
      logger.error("API 报错", errData);
    } catch (e) {}
    
    // Check for specific R2 permission errors that might be proxied
    if (errorMsg.includes("access permissions")) {
         errorMsg += " (可能是 R2 链接失效或 API Key 权限不足)";
    }

    throw new Error(errorMsg);
  }

  const createData = await createRes.json();
  if (createData.code !== 200 || !createData.data?.taskId) {
    logger.error("创建任务失败", createData);
    const msg = extractErrorMessage(createData, "任务创建失败");
    throw new Error(msg);
  }

  const taskId = createData.data.taskId;
  
  // Poll
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const infoRes = await fetch(`${KIE_BASE_URL}/recordInfo?taskId=${taskId}`, {
          headers: { 'Authorization': `Bearer ${kieKey}` }
        });
        
        if (!infoRes.ok) { 
            reject(new Error("轮询请求失败")); 
            return; 
        }
        
        const infoData = await infoRes.json();
        const state = infoData.data?.state;
        
        if (state === 'success') {
          try {
            const resultObj = JSON.parse(infoData.data.resultJson);
            if (resultObj.resultUrls?.length > 0) {
               resolve(resultObj.resultUrls[0]);
            } else {
               reject(new Error("未返回图片 URL"));
            }
          } catch (e) { 
              reject(new Error("结果解析失败")); 
          }
        } else if (state === 'fail') {
          logger.error("任务失败", infoData.data);
          const failReason = extractErrorMessage(infoData.data, "生成失败");
          reject(new Error(failReason));
        } else {
          setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err: any) {
        reject(err);
      }
    };
    poll();
  });
};

export const generateImageContent = async (params: GenerateImageParams): Promise<string[]> => {
  logger.info(`开始生成任务 (x${params.batchSize})...`);
  
  let readyImages: string[] = [];
  try {
      readyImages = await prepareInputImages(params.inputImages || []);
  } catch (e: any) {
      throw e; 
  }

  const promises = [];
  for (let i = 0; i < params.batchSize; i++) {
    promises.push(runSingleTask(
        params.prompt, 
        params.model, 
        params.aspectRatio, 
        params.resolution, 
        readyImages
    ));
  }
  
  return await Promise.all(promises);
};
