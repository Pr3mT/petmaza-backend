import express from 'express';
import {
  getWallet,
  getVendorEarnings,
  adminGetVendorWallet,
  adminPayoutVendor,
} from '../controllers/walletController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// ── Vendor routes ──────────────────────────────────────────────────────────
// Prime vendors fetch their own wallet balance & earnings
router.get('/', verifyToken, checkRole('vendor'), getWallet);
router.get('/earnings', verifyToken, checkRole('vendor'), getVendorEarnings);

// ── Admin routes ───────────────────────────────────────────────────────────
// Admin views a specific vendor's wallet balance
router.get('/admin/:vendor_id', verifyToken, checkRole('admin'), adminGetVendorWallet);
// Admin clears wallet after transferring money to vendor
router.post('/admin/:vendor_id/payout', verifyToken, checkRole('admin'), adminPayoutVendor);

export default router;

