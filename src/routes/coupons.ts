import express from 'express';
import {
  getAllCoupons,
  getActiveCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  validateCoupon,
  getVendorsByType,
} from '../controllers/couponController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public routes - Get active coupons (for customers to browse)
router.get('/active', getActiveCoupons);

// Routes requiring authentication
router.use(verifyToken);

// Get vendors by type (for coupon creation)
router.get('/vendors', getVendorsByType);

// Validate coupon (any authenticated user)
router.post('/validate', validateCoupon);

// Get all coupons (Admin and Vendors with read-only access)
router.get('/', getAllCoupons);

// Admin-only routes - Full coupon management
router.post('/', checkRole('admin'), createCoupon);
router.put('/:id', checkRole('admin'), updateCoupon);
router.delete('/:id', checkRole('admin'), deleteCoupon);
router.patch('/:id/toggle-status', checkRole('admin'), toggleCouponStatus);

export default router;
