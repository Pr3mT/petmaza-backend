import express from 'express';
import {
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} from '../controllers/brandController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.get('/', getAllBrands);
router.get('/:id', getBrandById);

// Admin only routes
router.use(verifyToken);
router.use(checkRole('admin'));

router.post('/', createBrand);
router.put('/:id', updateBrand);
router.delete('/:id', deleteBrand);

export default router;

