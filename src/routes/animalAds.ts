import express from 'express';
import {
  getActiveAdsByCategory,
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
  reorderAds,
} from '../controllers/animalAdController';
import { verifyToken, checkRole } from '../middlewares/auth';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public — active ads for a single category, cached 5 minutes
router.get('/active/:mainCategory', cacheResponse(300000), getActiveAdsByCategory);

// Admin routes — auth required
router.use(verifyToken);
router.use(checkRole('admin', 'sub_admin'));

router.get('/', getAllAds);
router.get('/:id', getAdById);
router.post('/', createAd);
router.put('/:id', updateAd);
router.delete('/:id', deleteAd);
router.post('/reorder', reorderAds);

export default router;
