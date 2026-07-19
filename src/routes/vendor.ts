import express from 'express';
import {
  getVendorProducts,
  getAvailableProducts,
  // updateVendorProductStock, // DEPRECATED - using isActive toggle only
  updateVendorProductStatus,
  getVendorStats,
  getOwnVendorDetails,
  updateOwnVendorDetails,
} from '../controllers/vendorController';
import { getVendorOrders } from '../controllers/orderController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// All routes require vendor authentication
router.use(verifyToken);
router.use(checkRole('vendor'));

router.get('/products/available', getAvailableProducts);
router.get('/products/my', getVendorProducts);
// Stock management removed - using isActive toggle only
// router.put('/products/my/:id/stock', updateVendorProductStock); // DEPRECATED
router.put('/products/my/:id/status', updateVendorProductStatus); // Update availability status
router.get('/orders', getVendorOrders); // Get vendor's orders
router.get('/stats', getVendorStats);
router.get('/details', getOwnVendorDetails); // Own shop profile (name, pickup address, serviceable pincodes)
router.put('/details', updateOwnVendorDetails);

export default router;
