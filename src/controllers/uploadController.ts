import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';

/**
 * Upload single image to Cloudinary
 */
export const uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    // Upload to Cloudinary using stream
    // Note: Image is already compressed by imageCompression middleware
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'petmaza/products',
          resource_type: 'image',
          // Removed transformations as images are already compressed
          // This prevents double compression and maintains quality
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    const result: any = await uploadPromise;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error uploading image', 500));
  }
};

/**
 * Upload multiple images to Cloudinary
 */
export const uploadMultipleImages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next(new AppError('No files uploaded', 400));
    }

    // Note: Images are already compressed by imageCompression middleware
    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'petmaza/products',
            resource_type: 'image',
            // Removed transformations as images are already compressed
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    });

    const results: any[] = await Promise.all(uploadPromises);

    const uploadedImages = results.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));

    res.status(200).json({
      success: true,
      message: `${uploadedImages.length} images uploaded successfully`,
      data: { images: uploadedImages },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error uploading images', 500));
  }
};

/**
 * Delete image from Cloudinary
 */
export const deleteImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return next(new AppError('Public ID is required', 400));
    }

    await cloudinary.uploader.destroy(publicId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error deleting image', 500));
  }
};
