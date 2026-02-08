import express from 'express';
import {
  createReview,
  getProductReviews,
  getCustomerReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  respondToReview,
  getReviewableProducts,
} from '../controllers/reviewController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Customer routes
router.post('/', verifyToken, checkRole('customer'), createReview);
router.get('/my-reviews', verifyToken, checkRole('customer'), getCustomerReviews);
router.get('/reviewable', verifyToken, checkRole('customer'), getReviewableProducts);
router.put('/:reviewId', verifyToken, checkRole('customer'), updateReview);
router.delete('/:reviewId', verifyToken, checkRole('customer'), deleteReview);

// Public routes
router.get('/product/:productId', getProductReviews);
router.post('/:reviewId/helpful', markReviewHelpful);

// Vendor routes
router.post('/:reviewId/respond', verifyToken, checkRole('vendor', 'admin'), respondToReview);

export default router;
