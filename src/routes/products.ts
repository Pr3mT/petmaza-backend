import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteVariant,
  patchVariantStatus,
  getPrimeListingsForProduct,
  getPrimeProductsByCategory,
} from '../controllers/productController';
import {
  bulkUploadProducts,
  generateBulkTemplate,
  getActivePrimeVendors,
} from '../controllers/bulkUploadController';
import {
  verifyToken, checkRole, optionalAuth, checkPrimeVendor,
} from '../middlewares/auth';
import { cacheResponse, cacheForCustomersOnly } from '../middlewares/cache';

const router = express.Router();

// Public routes - Cache for customers/public, but NOT for admins (admins need real-time data)
// Short cache duration (30s) ensures new products appear quickly after creation
router.get('/', optionalAuth, cacheForCustomersOnly(30000), getProducts); // 30 sec cache for customers only
router.get('/:id', optionalAuth, cacheForCustomersOnly(30000), getProduct); // 30 sec cache for customers only

// Prime product routes (public) - Cache for customers only
router.get('/prime/category', optionalAuth, cacheForCustomersOnly(30000), getPrimeProductsByCategory);
router.get('/:productId/prime-listings', optionalAuth, cacheForCustomersOnly(30000), getPrimeListingsForProduct);

// Bulk upload utilities (admin only)
router.get('/bulk/template', verifyToken, checkRole('admin', 'sub_admin'), generateBulkTemplate);
router.get('/bulk/prime-vendors', verifyToken, checkRole('admin', 'sub_admin'), getActivePrimeVendors);

// Protected routes - Admin and MY_SHOP vendors can create/manage products
router.post('/', verifyToken, createProduct);
router.post('/bulk-upload', verifyToken, checkRole('admin', 'sub_admin'), bulkUploadProducts);
router.put('/:id', verifyToken, updateProduct); // MY_SHOP vendors can update their products
router.patch('/:id', verifyToken, updateProduct);
router.patch('/:id/variants/:variantId/status', verifyToken, checkPrimeVendor, patchVariantStatus); // Admin + Prime Vendor: toggle variant in-stock / out-of-stock
router.delete('/:id/variants/:variantId', verifyToken, checkRole('admin', 'sub_admin'), deleteVariant); // Admin can delete a single variant
router.delete('/:id', verifyToken, checkRole('admin', 'sub_admin', 'vendor'), deleteProduct); // Admin/sub-admin can delete any, vendors can delete own

export default router;
