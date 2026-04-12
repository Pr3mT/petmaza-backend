import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth';
import { upload, uploadPdf } from '../config/cloudinary';
import { uploadImage, uploadMultipleImages, deleteImage, uploadFile, convertSelectedLabReport } from '../controllers/uploadController';
import { compressUploadedImages } from '../middlewares/imageCompression';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ============================================
// Admin/Vendor: image uploads
// ============================================
router.post('/image', checkRole('admin', 'vendor'), upload.single('image'), compressUploadedImages('default'), uploadImage);
router.post('/images', checkRole('admin', 'vendor'), upload.array('images', 5), compressUploadedImages('default'), uploadMultipleImages);
router.post('/product/image', checkRole('admin', 'vendor'), upload.single('image'), compressUploadedImages('product'), uploadImage);
router.post('/product/images', checkRole('admin', 'vendor'), upload.array('images', 5), compressUploadedImages('product'), uploadMultipleImages);
router.post('/brand/image', checkRole('admin', 'vendor'), upload.single('image'), compressUploadedImages('brand'), uploadImage);
router.post('/banner/image', checkRole('admin', 'vendor'), upload.single('image'), compressUploadedImages('banner'), uploadImage);
router.post('/ad/image', checkRole('admin', 'vendor'), upload.single('image'), compressUploadedImages('ad'), uploadImage);
router.delete('/image', checkRole('admin', 'vendor'), deleteImage);

// ============================================
// Admin/Vendor: PDF lab report upload
// ============================================
router.post('/lab-report', checkRole('admin', 'vendor'), uploadPdf.single('file'), uploadFile);
router.post('/lab-report/convert-selected', checkRole('admin', 'vendor'), convertSelectedLabReport);

export default router;

