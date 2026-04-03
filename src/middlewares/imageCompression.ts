import sharp from 'sharp';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Image compression configuration for different types
 */
export interface CompressionConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Predefined compression presets for different image types
 */
export const COMPRESSION_PRESETS: Record<string, CompressionConfig> = {
  // Product images - high quality, larger size
  product: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 85,
    format: 'webp',
    fit: 'inside',
  },
  
  // Brand logos - maintain transparency, smaller size
  brand: {
    maxWidth: 500,
    maxHeight: 500,
    quality: 90,
    format: 'png',
    fit: 'inside',
  },
  
  // Hero banners - wide format, good quality
  banner: {
    maxWidth: 1920,
    maxHeight: 800,
    quality: 85,
    format: 'webp',
    fit: 'inside',
  },
  
  // Promotional ads - medium size, good quality
  ad: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 80,
    format: 'webp',
    fit: 'inside',
  },
  
  // Default - balanced settings
  default: {
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 80,
    format: 'webp',
    fit: 'inside',
  },
};

/**
 * Compress a single image buffer using sharp
 * @param buffer - Original image buffer
 * @param config - Compression configuration
 * @returns Compressed image buffer
 */
export const compressImage = async (
  buffer: Buffer,
  config: CompressionConfig = COMPRESSION_PRESETS.default
): Promise<Buffer> => {
  try {
    const {
      maxWidth = 1000,
      maxHeight = 1000,
      quality = 80,
      format = 'webp',
      fit = 'inside',
    } = config;

    let sharpInstance = sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit,
        withoutEnlargement: true, // Don't upscale smaller images
      })
      .rotate(); // Auto-rotate based on EXIF orientation

    // Apply format-specific compression
    switch (format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality, effort: 4 });
        break;
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true, mozjpeg: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality, effort: 4 });
    }

    const compressedBuffer = await sharpInstance.toBuffer();
    
    // Log compression stats
    const originalSize = buffer.length;
    const compressedSize = compressedBuffer.length;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${savings}% savings)`);
    
    return compressedBuffer;
  } catch (error: any) {
    console.error('Image compression error:', error);
    throw new Error(`Failed to compress image: ${error.message}`);
  }
};

/**
 * Express middleware to compress uploaded images
 * @param preset - Compression preset name or custom config
 */
export const compressUploadedImages = (preset: string | CompressionConfig = 'default') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get compression config
      const config: CompressionConfig = 
        typeof preset === 'string' 
          ? COMPRESSION_PRESETS[preset] || COMPRESSION_PRESETS.default
          : preset;

      // Handle single file upload
      if (req.file) {
        console.log(`Compressing single image: ${req.file.originalname}`);
        req.file.buffer = await compressImage(req.file.buffer, config);
        
        // Update mimetype to match the compressed format
        if (config.format === 'webp') {
          req.file.mimetype = 'image/webp';
        } else if (config.format === 'jpeg') {
          req.file.mimetype = 'image/jpeg';
        } else if (config.format === 'png') {
          req.file.mimetype = 'image/png';
        }
      }

      // Handle multiple files upload
      if (req.files && Array.isArray(req.files)) {
        console.log(`Compressing ${req.files.length} images`);
        const compressionPromises = req.files.map(async (file) => {
          file.buffer = await compressImage(file.buffer, config);
          
          // Update mimetype
          if (config.format === 'webp') {
            file.mimetype = 'image/webp';
          } else if (config.format === 'jpeg') {
            file.mimetype = 'image/jpeg';
          } else if (config.format === 'png') {
            file.mimetype = 'image/png';
          }
        });

        await Promise.all(compressionPromises);
      }

      next();
    } catch (error: any) {
      next(new AppError(`Image compression failed: ${error.message}`, 500));
    }
  };
};

/**
 * Get image metadata without loading entire image
 * @param buffer - Image buffer
 * @returns Image metadata
 */
export const getImageMetadata = async (buffer: Buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
    };
  } catch (error: any) {
    throw new Error(`Failed to read image metadata: ${error.message}`);
  }
};

/**
 * Validate image dimensions and size
 * @param buffer - Image buffer
 * @param options - Validation options
 */
export const validateImage = async (
  buffer: Buffer,
  options: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxSize?: number; // in bytes
  } = {}
) => {
  const metadata = await getImageMetadata(buffer);
  const errors: string[] = [];

  if (options.minWidth && metadata.width && metadata.width < options.minWidth) {
    errors.push(`Image width must be at least ${options.minWidth}px (got ${metadata.width}px)`);
  }

  if (options.minHeight && metadata.height && metadata.height < options.minHeight) {
    errors.push(`Image height must be at least ${options.minHeight}px (got ${metadata.height}px)`);
  }

  if (options.maxWidth && metadata.width && metadata.width > options.maxWidth) {
    errors.push(`Image width must not exceed ${options.maxWidth}px (got ${metadata.width}px)`);
  }

  if (options.maxHeight && metadata.height && metadata.height > options.maxHeight) {
    errors.push(`Image height must not exceed ${options.maxHeight}px (got ${metadata.height}px)`);
  }

  if (options.maxSize && metadata.size > options.maxSize) {
    errors.push(
      `Image size must not exceed ${(options.maxSize / 1024 / 1024).toFixed(1)}MB (got ${(metadata.size / 1024 / 1024).toFixed(1)}MB)`
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return metadata;
};
