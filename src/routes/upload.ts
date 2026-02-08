import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth';
import { upload } from '../config/cloudinary';
import { uploadImage, uploadMultipleImages, deleteImage } from '../controllers/uploadController';

const router = express.Router();

// All routes require authentication and admin/vendor role
router.use(verifyToken);
router.use(checkRole('admin', 'vendor'));

// Upload single image
router.post('/image', upload.single('image'), uploadImage);

// Upload multiple images (max 5)
router.post('/images', upload.array('images', 5), uploadMultipleImages);

// Delete image
router.delete('/image', deleteImage);

export default router;
