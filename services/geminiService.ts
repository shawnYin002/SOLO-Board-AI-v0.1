
import { ModelType, AspectRatio, Resolution } from '../types';
import { logger } from './logger';

const KIE_BASE_URL = 'https://api.kie.ai/api/v1/jobs';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const GITHUB_API_URL = 'https://api.github.com';

// Helper to get keys
const getKeys = () => {
  let kieKey = localStorage.getItem('kie_api_key') || '';
  if (kieKey.toLowerCase().startsWith('bearer ')) {
    kieKey = kieKey.substring(7).trim();
  }
  
  const imgbbKey = localStorage.getItem('imgbb_api_key') || '';
  
  const ghToken = localStorage.getItem('gh_token') || '';
  const ghUser = localStorage.getItem('gh_user') || '';
  const ghRepo = localStorage.getItem('gh_repo') || '';
  
  return { 
      kieKey: kieKey.trim(), 
      imgbbKey: imgbbKey.trim(),
      github: { token: ghToken.trim(), user: ghUser.trim(), repo: ghRepo.trim() }
  };
};

// --- ImgBB Upload ---
const uploadToImgBB = async (base64Str: string, apiKey: string): Promise<string> => {
    const formData = new FormData();
    const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, '');
    formData.append('image', cleanBase64);
    
    try {
        const res = await fetch(`${IMGBB_UPLOAD_URL}?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error?.message || 'ImgBB Upload Failed');
        }
    } catch (e: any) {
        throw new Error(`图床上传失败: ${e.message}`);
    }
};

// --- GitHub Upload ---
const uploadToGitHub = async (base64Str: string, config: { token: string, user: string, repo: string }): Promise<string> => {
    const { token, user, repo } = config;
    const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, '');
    
    // Generate unique filename using UUID to prevent race conditions
    const filename = `solo_${crypto.randomUUID()}.png`;
    const path = `uploads/${filename}`;
    
    const body = {
        message: `Upload via SoloBoardAI: ${filename}`,
        content: cleanBase64
    };
    
    try {
        const res = await fetch(`${GITHUB_API_URL}/repos/${user}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'GitHub API Error');
        }
        
        // Construct jsDelivr URL for fast CDN access
        // https://fastly.jsdelivr.net/gh/user/repo/path
        return `https://fastly.jsdelivr.net/gh/${user}/${repo}/${path}`;

    } catch (e: any) {
        throw new Error(`GitHub 上传失败: ${e.message}`);
    }
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

// Helper to pre-upload images before starting tasks
const prepareInputImages = async (inputImages: string[]): Promise<string[]> => {
    if (!inputImages || inputImages.length === 0) return [];
    
    const { imgbbKey, github } = getKeys();
    const processedImages: string[] = [];
    
    logger.info("正在预处理/上传输入图片...", { count: inputImages.length });

    for (let i = 0; i < inputImages.length; i++) {
        const img = inputImages[i];
        
        // Check if it is a local base64 image
        if (img.startsWith('data:image')) {
            let uploadedUrl = '';
            
            // Priority 1: GitHub
            if (github.token && github.user && github.repo) {
                 logger.info(`[GitHub] 正在上传图片 ${i+1}/${inputImages.length}...`);
                 try {
                     uploadedUrl = await uploadToGitHub(img, github);
                     logger.success(`GitHub 上传成功`, { url: uploadedUrl });
                 } catch (e: any) {
                     logger.error("GitHub 上传失败", e);
                     throw e;
                 }
            } 
            // Priority 2: ImgBB
            else if (imgbbKey) {
                logger.info(`[ImgBB] 正在上传图片 ${i+1}/${inputImages.length}...`);
                try {
                    uploadedUrl = await uploadToImgBB(img, imgbbKey);
                    logger.success(`ImgBB 上传成功`, { url: uploadedUrl });
                } catch (e: any) {
                    logger.error("ImgBB 上传失败", e);
                    throw e;
                }
            } 
            else {
                const errMsg = "本地图片必须配置图床。请在设置中配置 GitHub (推荐) 或 ImgBB。";
                logger.error("缺少图床配置");
                throw new Error(errMsg);
            }
            
            processedImages.push(uploadedUrl);
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
  // Receive already processed URLs
  processedInputImages: string[]
): Promise<string> => {
  const { kieKey } = getKeys();
  if (!kieKey) {
      throw new Error("请配置 Kie API Key");
  }

  const inputPayload: any = {
    prompt: prompt,
    resolution: resolution, 
    output_format: "png"
  };

  // Only add aspect_ratio if it's not 'default'
  if (aspectRatio !== 'default') {
      inputPayload.aspect_ratio = aspectRatio;
  }

  if (processedInputImages.length > 0) {
    inputPayload.image_input = processedInputImages;
  }

  const requestBody = JSON.stringify({
    model: model,
    input: inputPayload
  });

  const payloadSizeKB = (new TextEncoder().encode(requestBody).length / 1024).toFixed(2);
  logger.info(`发送任务请求`, { model, payloadSize: `${payloadSizeKB} KB` });

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
      if (errData.msg) errorMsg = errData.msg;
      if (errData.message) errorMsg = errData.message;
      
      logger.error("API 报错", errData);
    } catch (e) {}
    
    throw new Error(errorMsg);
  }

  const createData = await createRes.json();
  if (createData.code !== 200 || !createData.data?.taskId) {
    logger.error("创建任务失败", createData);
    throw new Error(createData.message || createData.msg || "任务创建失败");
  }

  const taskId = createData.data.taskId;
  // logger.success(`任务创建成功`, { taskId }); // Reduce noise for batch

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
        
        // Reduce logging noise for polling
        if (state !== 'processing' && attempts % 5 === 0) {
             // logger.info(`任务状态: ${state} (${attempts})`);
        }

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
          reject(new Error(infoData.data?.failMsg || "生成失败"));
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
  
  // 1. Upload/Prepare images ONCE before starting tasks
  let readyImages: string[] = [];
  try {
      readyImages = await prepareInputImages(params.inputImages || []);
  } catch (e: any) {
      throw e; // Stop if upload fails
  }

  // 2. Run tasks in parallel using the SAME uploaded URLs
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
