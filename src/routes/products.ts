import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getPrimeListingsForProduct,
  getPrimeProductsByCategory,
} from '../controllers/productController';
import { verifyToken, checkRole, optionalAuth } from '../middlewares/auth';
import { cacheResponse, cacheForCustomersOnly } from '../middlewares/cache';

const router = express.Router();

// Public routes - Cache for customers/public, but NOT for admins (admins need real-time data)
router.get('/', optionalAuth, cacheForCustomersOnly(120000), getProducts); // 2 min cache for customers only
router.get('/:id', optionalAuth, cacheForCustomersOnly(120000), getProduct); // 2 min cache for customers only

// Prime product routes (public) - Cache for customers only
router.get('/prime/category', optionalAuth, cacheForCustomersOnly(120000), getPrimeProductsByCategory);
router.get('/:productId/prime-listings', optionalAuth, cacheForCustomersOnly(120000), getPrimeListingsForProduct);

// Protected routes - Admin and MY_SHOP vendors can create/manage products
router.post('/', verifyToken, createProduct); // MY_SHOP vendors can create products
router.put('/:id', verifyToken, updateProduct); // MY_SHOP vendors can update their products
router.patch('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, checkRole('admin'), deleteProduct); // Only admin can delete

export default router;
