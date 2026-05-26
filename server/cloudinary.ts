import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import fs from 'fs';

/**
 * Initialize and configure Cloudinary
 * @returns boolean indicating successful configuration
 */
export const initCloudinary = (): boolean => {
  try {
    // Configure Cloudinary with environment variables
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
    
    // Verify configuration is valid
    return !!process.env.CLOUDINARY_CLOUD_NAME && 
           !!process.env.CLOUDINARY_API_KEY && 
           !!process.env.CLOUDINARY_API_SECRET;
  } catch (error) {
    console.error('Error initializing Cloudinary:', error);
    return false;
  }
};

/**
 * Upload a file to Cloudinary
 * @param file Base64 encoded file or file path
 * @param folder Folder to store the file in
 * @param resourceType Type of resource (image, video, etc.)
 * @returns Promise with upload result
 */
export const uploadImage = async (file: string, folder = 'urban-culture/explore-page', resourceType = 'image') => {
  return uploadImageWithProgress(file, folder, resourceType);
};

/**
 * Upload a file to Cloudinary with real-time byte progress.
 * onProgress(pct) is called 0–100 as bytes are streamed for local video files.
 */
export const uploadImageWithProgress = async (
  file: string,
  folder = 'urban-culture/explore-page',
  resourceType = 'image',
  onProgress?: (pct: number) => void,
): Promise<{ success: boolean; url?: string; imageUrl?: string; publicId?: string; result?: any; error?: string }> => {
  try {
    console.log(`Uploading to Cloudinary with folder: ${folder}, resourceType: ${resourceType}`);

    const uploadOptions: Record<string, any> = {
      folder,
      resource_type: resourceType,
    };

    const isLocalPath = file.startsWith('/') || file.startsWith('./');
    const isVideo     = resourceType === 'video';

    let result: any;
    if (isLocalPath && isVideo) {
      if (!fs.existsSync(file)) {
        throw new Error(`Compressed video file not found: ${file}`);
      }
      const totalBytes = fs.statSync(file).size;
      console.log(`[Cloudinary] Streaming local video → Cloudinary (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);

      result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { ...uploadOptions, timeout: 300_000 },
          (error: any, cloudResult: any) => {
            if (error) return reject(new Error(error.message || 'Cloudinary upload failed'));
            resolve(cloudResult);
          }
        );

        let uploadedBytes = 0;
        const readStream = fs.createReadStream(file);
        readStream.on('error', (err) => reject(new Error(`File read error: ${err.message}`)));
        readStream.on('data', (chunk: Buffer) => {
          uploadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress(Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)));
          }
        });
        readStream.pipe(stream);
      });
    } else {
      result = await cloudinary.uploader.upload(file, uploadOptions);
    }

    console.log('Cloudinary upload successful, returning URL:', result.secure_url);

    return {
      success: true,
      url: result.secure_url,
      imageUrl: result.secure_url,
      publicId: result.public_id,
      result
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Upload a Buffer directly to Cloudinary using upload_stream (no base64).
 * Use this for large videos from multer memoryStorage to avoid 413 errors.
 */
export const uploadBuffer = (
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<{ success: boolean; url?: string; publicId?: string; error?: string }> =>
  new Promise(resolve => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, timeout: 300_000 },
      (error: any, result: any) => {
        if (error || !result) {
          console.error('[Cloudinary] upload_stream error:', error?.message);
          resolve({ success: false, error: error?.message || 'Upload failed' });
        } else {
          resolve({ success: true, url: result.secure_url, publicId: result.public_id });
        }
      },
    );
    stream.end(buffer);
  });

/**
 * Extract the Cloudinary public_id from a full Cloudinary URL.
 * Handles both versioned (v1234567890/...) and unversioned URLs.
 * Returns null if the URL is not a Cloudinary URL.
 *
 * Example:
 *   https://res.cloudinary.com/demo/image/upload/v1234/urban-culture/profiles/abc.jpg
 *   → "urban-culture/profiles/abc"
 */
export function extractCloudinaryPublicId(url: string | null | undefined): string | null {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}

/**
 * Delete a Cloudinary asset by its full URL (convenience wrapper).
 * Safe to call with any URL — non-Cloudinary URLs are silently ignored.
 */
export const deleteImageByUrl = async (url: string | null | undefined, resourceType: 'image' | 'video' | 'raw' = 'image') => {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return { success: false, skipped: true };
  return deleteImage(publicId, resourceType);
};

/**
 * Delete an image from Cloudinary by public ID
 * @param publicId The public ID of the image to delete
 * @returns Promise with deletion result
 */
export const deleteImage = async (publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return {
      success: result.result === 'ok',
      result
    };
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Generate a signed URL for an image with transformations
 * @param publicId The public ID of the image
 * @param transformations Object with transformation parameters
 * @returns URL string for the transformed image
 */
export const buildImageUrl = (publicId: string, transformations: Record<string, any> = {}) => {
  try {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformations
    });
  } catch (error) {
    console.error('Error building image URL:', error);
    return '';
  }
};

/**
 * Generate a signature for secure direct upload
 * @param params Parameters to sign
 * @param timestamp Timestamp for the signature
 * @returns Object with signature, apiKey, and other needed information for Cloudinary upload
 */
export const generateUploadSignature = (params: Record<string, any>, timestamp: number) => {
  try {
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    
    if (!apiSecret || !apiKey || !cloudName) {
      console.error('Missing Cloudinary environment variables');
      return null;
    }
    
    // Make sure timestamp is included in the params for signing
    const paramsToSign = { ...params, timestamp };
    
    // Create a string of key=value pairs sorted by key
    const signatureString = Object.keys(paramsToSign)
      .sort()
      .map(key => `${key}=${paramsToSign[key]}`)
      .join('&') + apiSecret;
    
    // Generate SHA-1 hash
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');
    
    return signature;
  } catch (error) {
    console.error('Error generating upload signature:', error);
    return null;
  }
};

export default cloudinary;