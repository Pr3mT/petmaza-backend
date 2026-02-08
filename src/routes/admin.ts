import express from 'express';
import {
  getUsers,
  approveVendor,
  getAdminStats,
  getAllOrders,
  assignBrandsToVendor,
  assignProductsToVendor,
  getVendorAssignments,
  updateVendorProductPricing,
  removeVendorProductAssignment,
  cleanupVariantProducts,
  reseedVariantProduct,
} from '../controllers/adminController';
import {
  getAnalytics,
  getOrderReport,
  getSummary,
} from '../controllers/analyticsController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/users', getUsers);
router.get('/vendors', getUsers); // Alias for fetching vendors with vendorType filter
router.put('/users/:id/approve', approveVendor);
router.get('/stats', getAdminStats);
router.get('/orders', getAllOrders);

// Vendor-Product Assignment routes
router.post('/vendors/:id/assign-brands', assignBrandsToVendor);
router.post('/vendors/:id/assign-products', assignProductsToVendor);
router.get('/vendors/:id/assignments', getVendorAssignments);
router.put('/vendors/:id/products/:productId/pricing', updateVendorProductPricing);
router.delete('/vendors/:id/products/:productId', removeVendorProductAssignment);

// Cleanup variant products
router.post('/cleanup-variants', cleanupVariantProducts);
router.post('/reseed-product', reseedVariantProduct);

// Analytics routes
router.get('/analytics', getAnalytics);
router.get('/analytics/summary', getSummary);
router.get('/analytics/orders', getOrderReport);

export default router;

