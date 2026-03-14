import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
  getSubcategories,
  addSubcategoriesToBrand,
  removeSubcategoriesFromBrand,
} from '../controllers/brandController';
import { verifyToken, checkRole, checkMyShopVendor, optionalAuth } from '../middlewares/auth';
import { cacheResponse, cacheForCustomersOnly } from '../middlewares/cache';

const router = express.Router();

// Public routes - Cache for customers/public, but NOT for admins (admins need real-time data)
router.get('/', optionalAuth, cacheForCustomersOnly(300000), getAllBrands); // 5 min cache for customers only
router.get('/subcategories', cacheResponse(300000), getSubcategories); // 5 min cache for all
router.get('/:id', optionalAuth, cacheForCustomersOnly(300000), getBrandById); // 5 min cache for customers only

// Admin and MY_SHOP vendor can create
router.post('/', verifyToken, checkMyShopVendor, createBrand);

// Admin only routes for update/delete (support both PUT and PATCH)
router.put('/:id', verifyToken, checkRole('admin'), updateBrand);
router.patch('/:id', verifyToken, checkRole('admin'), updateBrand);
router.delete('/:id', verifyToken, checkRole('admin'), deleteBrand);

// Subcategory management routes (admin only)
router.post('/:id/subcategories/add', verifyToken, checkRole('admin'), addSubcategoriesToBrand);
router.post('/:id/subcategories/remove', verifyToken, checkRole('admin'), removeSubcategoriesFromBrand);

export default router;

