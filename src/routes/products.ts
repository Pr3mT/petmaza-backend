import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Protected routes - Admin and MY_SHOP vendors can create/manage products
router.post('/', verifyToken, createProduct); // MY_SHOP vendors can create products
router.put('/:id', verifyToken, updateProduct); // MY_SHOP vendors can update their products
router.patch('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, checkRole('admin'), deleteProduct); // Only admin can delete

export default router;
