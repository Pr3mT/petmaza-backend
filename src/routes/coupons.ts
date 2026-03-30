import express from 'express';
import {
  getAllCoupons,
  getActiveCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  validateCoupon,
} from '../controllers/couponController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public routes - Get active coupons (for customers to browse)
router.get('/active', getActiveCoupons);

// Customer routes - Validate coupon
router.post('/validate', verifyToken, validateCoupon);

// Admin routes - Full coupon management
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getAllCoupons);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.patch('/:id/toggle-status', toggleCouponStatus);

export default router;
