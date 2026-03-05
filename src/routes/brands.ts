import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController';
import { verifyToken, checkRole, checkMyShopVendor } from '../middlewares/auth';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public routes with 5-minute caching
router.get('/', cacheResponse(300000), getAllBrands);
router.get('/:id', cacheResponse(300000), getBrandById);

// Admin and MY_SHOP vendor can create
router.post('/', verifyToken, checkMyShopVendor, createBrand);

// Admin only routes for update/delete
router.put('/:id', verifyToken, checkRole('admin'), updateBrand);
router.delete('/:id', verifyToken, checkRole('admin'), deleteBrand);

export default router;

