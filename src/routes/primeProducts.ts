import express from 'express';
import {
  createPrimeListing,
  getMyPrimeListings,
  getPrimeListing,
  updatePrimeListing,
  toggleAvailability,
  deletePrimeListing,
  getPrimeDashboardStats,
} from '../controllers/primeProductController';
import { verifyToken, checkPrimeVendor } from '../middlewares/auth';

const router = express.Router();

// All routes require Prime Vendor authentication
router.use(verifyToken);
router.use(checkPrimeVendor);

// Dashboard
router.get('/dashboard/stats', getPrimeDashboardStats);

// CRUD Operations
router.post('/', createPrimeListing);
router.get('/my', getMyPrimeListings);
router.get('/:id', getPrimeListing);
router.patch('/:id/toggle-availability', toggleAvailability); // More specific route first
router.put('/:id', updatePrimeListing);
router.patch('/:id', updatePrimeListing); // Support PATCH as well
router.delete('/:id', deletePrimeListing);

export default router;
