import express from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import { verifyToken, checkRole, checkMyShopVendor } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Admin and MY_SHOP vendor can create
router.post('/', verifyToken, checkMyShopVendor, createCategory);

// Admin only routes for update/delete
router.put('/:id', verifyToken, checkRole('admin'), updateCategory);
router.delete('/:id', verifyToken, checkRole('admin'), deleteCategory);

export default router;

