import express from 'express';
import {
  createPrimeListing,
  getMyPrimeListings,
  getPrimeListing,
  updatePrimeListing,
  toggleAvailability,
  deletePrimeListing,
  getPrimeDashboardStats,
  adminGetAllPrimeListings,
  getPrimeWalletStats,
} from '../controllers/primeProductController';
import { verifyToken, checkPrimeVendor, checkRole } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ── Admin-only routes ──────────────────────────────────────────────
router.get('/admin/all', checkRole('admin', 'sub_admin'), adminGetAllPrimeListings);

// ── Prime Vendor + Admin routes ────────────────────────────────────
router.use(checkPrimeVendor);

// Dashboard
router.get('/dashboard/stats', getPrimeDashboardStats);

// Wallet / Earnings
router.get('/wallet/stats', getPrimeWalletStats);

// CRUD Operations
router.post('/', createPrimeListing);
router.get('/my', getMyPrimeListings);
router.get('/:id', getPrimeListing);
router.patch('/:id/toggle-availability', toggleAvailability); // More specific route first
router.put('/:id', updatePrimeListing);
router.patch('/:id', updatePrimeListing); // Support PATCH as well
router.delete('/:id', deletePrimeListing);

export default router;
