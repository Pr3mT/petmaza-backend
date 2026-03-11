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
import { verifyToken, checkRole } from '../middlewares/auth';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public routes with 2-minute caching for products (shorter due to frequent updates)
router.get('/', cacheResponse(120000), getProducts);
router.get('/:id', cacheResponse(120000), getProduct);

// Prime product routes (public)
router.get('/prime/category', cacheResponse(120000), getPrimeProductsByCategory);
router.get('/:productId/prime-listings', cacheResponse(120000), getPrimeListingsForProduct);

// Protected routes - Admin and MY_SHOP vendors can create/manage products
router.post('/', verifyToken, createProduct); // MY_SHOP vendors can create products
router.put('/:id', verifyToken, updateProduct); // MY_SHOP vendors can update their products
router.patch('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, checkRole('admin'), deleteProduct); // Only admin can delete

export default router;
