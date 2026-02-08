import express from 'express';
import {
  getPersonalizedRecommendations,
  getSimilarProducts,
  getTrendingProducts,
  getTopRatedProducts,
  getFrequentlyBoughtTogether,
  getHomepageRecommendations,
} from '../controllers/recommendationController';
import { verifyToken } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/trending', getTrendingProducts);
router.get('/top-rated', getTopRatedProducts);
router.get('/homepage', getHomepageRecommendations);
router.get('/similar/:productId', getSimilarProducts);
router.get('/frequently-bought/:productId', getFrequentlyBoughtTogether);

// Authenticated routes
router.get('/personalized', verifyToken, getPersonalizedRecommendations);

export default router;
