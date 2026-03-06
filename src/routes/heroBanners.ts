import express from 'express';
import {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
} from '../controllers/heroBannerController';
import { verifyToken, checkRole } from '../middlewares/auth';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public route - Get active banners for homepage (with 5-minute caching)
router.get('/active', cacheResponse(300000), getActiveBanners);

// Admin routes - Require authentication and admin role
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getAllBanners);
router.get('/:id', getBannerById);
router.post('/', createBanner);
router.put('/:id', updateBanner);
router.delete('/:id', deleteBanner);
router.post('/reorder', reorderBanners);

export default router;
