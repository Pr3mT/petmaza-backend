import express from 'express';
import {
  assignProductToVendor,
  getVendorProducts,
  getProductVendors,
  updateVendorProductPricing,
  removeProductFromVendor,
} from '../controllers/vendorProductPricingController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public route
router.get('/product/:product_id/vendors', getProductVendors);

// Admin routes
router.use(verifyToken);
router.use(checkRole('admin'));

router.post('/assign', assignProductToVendor);
router.put('/:vendor_id/:product_id', updateVendorProductPricing);
router.delete('/:vendor_id/:product_id', removeProductFromVendor);

// Vendor routes
router.get('/vendor/:vendor_id', verifyToken, checkRole('vendor'), getVendorProducts);
router.get('/vendor/my', verifyToken, checkRole('vendor'), getVendorProducts);

export default router;

