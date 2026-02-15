import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController';
import { verifyToken, checkRole, checkMyShopVendor } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/', getAllBrands);
router.get('/:id', getBrandById);

// Admin and MY_SHOP vendor can create
router.post('/', verifyToken, checkMyShopVendor, createBrand);

// Admin only routes for update/delete
router.put('/:id', verifyToken, checkRole('admin'), updateBrand);
router.delete('/:id', verifyToken, checkRole('admin'), deleteBrand);

export default router;

