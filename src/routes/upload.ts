import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth';
import { upload } from '../config/cloudinary';
import { uploadImage, uploadMultipleImages, deleteImage } from '../controllers/uploadController';
import { compressUploadedImages } from '../middlewares/imageCompression';

const router = express.Router();

// All routes require authentication and admin/vendor role
router.use(verifyToken);
router.use(checkRole('admin', 'vendor'));

// ============================================
// Generic image upload (default compression)
// ============================================
router.post('/image', upload.single('image'), compressUploadedImages('default'), uploadImage);

// ============================================
// Multiple images upload (default compression)
// ============================================
router.post('/images', upload.array('images', 5), compressUploadedImages('default'), uploadMultipleImages);

// ============================================
// Specialized upload routes with optimized compression
// ============================================

// Product images - high quality, larger size
router.post('/product/image', upload.single('image'), compressUploadedImages('product'), uploadImage);
router.post('/product/images', upload.array('images', 5), compressUploadedImages('product'), uploadMultipleImages);

// Brand logos - maintain quality, smaller size, PNG format for transparency
router.post('/brand/image', upload.single('image'), compressUploadedImages('brand'), uploadImage);

// Hero banners - wide format, optimized for banners
router.post('/banner/image', upload.single('image'), compressUploadedImages('banner'), uploadImage);

// Promotional ads - medium size, good quality
router.post('/ad/image', upload.single('image'), compressUploadedImages('ad'), uploadImage);

// ============================================
// Delete image
// ============================================
router.delete('/image', deleteImage);

export default router;
