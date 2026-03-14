import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  getSubcategories,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { verifyToken, checkRole, checkMyShopVendor } from '../middlewares/auth';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public routes with 5-minute caching
router.get('/', cacheResponse(300000), getAllCategories);
router.get('/subcategories', cacheResponse(300000), getSubcategories);
router.get('/:id', cacheResponse(300000), getCategoryById);

// Admin and MY_SHOP vendor can create
router.post('/', verifyToken, checkMyShopVendor, createCategory);

// Admin only routes for update/delete
router.put('/:id', verifyToken, checkRole('admin'), updateCategory);
router.delete('/:id', verifyToken, checkRole('admin'), deleteCategory);

export default router;

