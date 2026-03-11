import express from 'express';
import {
  getPrimeVendorOrders,
  getPrimeOrderDetails,
  acceptPrimeOrder,
  rejectPrimeOrder,
  updatePrimeOrderStatus,
} from '../controllers/primeVendorController';
import { verifyToken, checkPrimeVendor } from '../middlewares/auth';

const router = express.Router();

// All routes require Prime Vendor authentication
router.use(verifyToken);
router.use(checkPrimeVendor);

// Order Management
router.get('/orders', getPrimeVendorOrders);
router.get('/orders/:id', getPrimeOrderDetails);
router.post('/orders/:id/accept', acceptPrimeOrder);
router.post('/orders/:id/reject', rejectPrimeOrder);
router.put('/orders/:id/status', updatePrimeOrderStatus);

export default router;
