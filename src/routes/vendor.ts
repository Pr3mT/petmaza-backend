import express from 'express';
import {
  getVendorProducts,
  getAvailableProducts,
  updateVendorProductStock,
  updateVendorProductStatus,
  getVendorStats,
} from '../controllers/vendorController';
import { getVendorOrders } from '../controllers/orderController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// All routes require vendor authentication
router.use(verifyToken);
router.use(checkRole('vendor'));

router.get('/products/available', getAvailableProducts);
router.get('/products/my', getVendorProducts);
router.put('/products/my/:id/stock', updateVendorProductStock); // Update stock quantity
router.put('/products/my/:id/status', updateVendorProductStatus); // Update availability status
router.get('/orders', getVendorOrders); // Get vendor's orders
router.get('/stats', getVendorStats);

export default router;
