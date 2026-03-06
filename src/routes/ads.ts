import express from 'express';
import {
  getActiveAds,
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
  permanentDeleteAd,
  reorderAds,
  trackImpression,
  trackClick,
} from '../controllers/adController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public routes - Get active ads and track analytics
router.get('/active', getActiveAds);
router.post('/:id/impression', trackImpression);
router.post('/:id/click', trackClick);

// Admin routes - Require authentication and admin role
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getAllAds);
router.get('/:id', getAdById);
router.post('/', createAd);
router.put('/:id', updateAd);
router.delete('/:id', deleteAd);
router.delete('/:id/permanent', permanentDeleteAd);
router.post('/reorder', reorderAds);

export default router;
