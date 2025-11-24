
import { logger } from './logger';

// Configuration
const R2_ACCOUNT_ID = '097b8d1b5351a9c3ba748f58324981eb';
const ACCESS_KEY_ID = 'f7982bb866202a7e114fcc6592e0f91a';
const SECRET_ACCESS_KEY = '180d3af0ab44340104a1a62f68f262b89ebf1ffa09a325c63cf3f9aa0ca69210';
const ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// IMPORTANT: 请确保你在 Cloudflare R2 控制台创建的桶名称是这个，或者修改这里
export const R2_BUCKET_NAME = 'solo-board-images-01';

// --- Crypto Helpers for AWS SigV4 (Browser Native) ---

const encoder = new TextEncoder();

async function hmacSha256(key: CryptoKey | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const keyData = key instanceof ArrayBuffer ? key : key;
    const cryptoKey = await crypto.subtle.importKey(
        'raw', 
        keyData as BufferSource, 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
    const msgBuffer = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return bufferToHex(hashBuffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// --- SigV4 Implementation ---

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
    const kDate = await hmacSha256(encoder.encode('AWS4' + key), dateStamp);
    const kRegion = await hmacSha256(kDate, regionName);
    const kService = await hmacSha256(kRegion, serviceName);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    return kSigning;
}

// Helper to generate presigned URL for any method
// This moves authentication from Headers to Query Parameters, avoiding many CORS issues.
async function generatePresignedUrl(
    bucket: string, 
    key: string, 
    method: string = 'GET', 
    expiresIn: number = 86400
) {
    const path = `/${bucket}/${key}`;
    const region = 'auto';
    const service = 's3';
    
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);
    const host = new URL(ENDPOINT).host;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    // Only sign the host header to keep it simple and robust against browser header injection
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';

    const queryParams: Record<string, string> = {
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': `${ACCESS_KEY_ID}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': signedHeaders,
    };

    const canonicalUri = path;
    const sortedQueryKeys = Object.keys(queryParams).sort();
    const canonicalQueryString = sortedQueryKeys
        .map(k => `${k}=${encodeURIComponent(queryParams[k])}`)
        .join('&');
    
    // For Presigned URLs, we use UNSIGNED-PAYLOAD
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
    ].join('\n');

    const signingKey = await getSignatureKey(SECRET_ACCESS_KEY, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = bufferToHex(signatureBuffer);

    return `${ENDPOINT}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// --- R2 Operations ---

export async function uploadToR2(base64Data: string): Promise<string> {
    try {
        const bucketName = R2_BUCKET_NAME;
        
        // Prepare File
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 string');
        }
        const mimeType = matches[1];
        const binaryString = atob(matches[2]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const filename = `upload-${crypto.randomUUID()}.${mimeType.split('/')[1]}`;
        
        // 1. Generate Presigned PUT URL
        // giving it a short window (600s = 10min) just for the upload
        const putUrl = await generatePresignedUrl(bucketName, filename, 'PUT', 600);

        // 2. Upload using standard fetch with the Presigned URL
        // We do NOT add Authorization header here, as it's in the URL.
        const res = await fetch(putUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': mimeType
            },
            body: bytes
        });

        if (!res.ok) {
            throw new Error(`R2 Response: ${res.status} ${res.statusText}`);
        }

        // 3. Generate Presigned GET URL for display (valid for 24h)
        const displayUrl = await generatePresignedUrl(bucketName, filename, 'GET', 86400);
        
        return displayUrl;

    } catch (e: any) {
        const isCors = e.message.includes('Failed to fetch') || e.message.includes('403');
        logger.error("Upload Error", { error: e.message, likelyCors: isCors });
        if (isCors) {
            throw new Error(`R2 连接被拒绝 (CORS)。您的桶配置已看起来正确，请确保网络未拦截 PUT 请求。`);
        }
        throw new Error(`图片上传失败: ${e.message}`);
    }
}
