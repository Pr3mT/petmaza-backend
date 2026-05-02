import express from 'express';
import {
  getPrimeVendorOrders,
  getPrimeOrderDetails,
  acceptPrimeOrder,
  rejectPrimeOrder,
  updatePrimeOrderStatus,
  markNotAvailable,
  initiateRefund,
  addShippingDetails,
} from '../controllers/primeVendorController';
import { verifyToken, checkPrimeVendor } from '../middlewares/auth';
import { uploadReceipt } from '../config/cloudinary';

const router = express.Router();

// All routes require Prime Vendor authentication
router.use(verifyToken);
router.use(checkPrimeVendor);

// Order Management
router.get('/orders', getPrimeVendorOrders);
router.get('/orders/:id', getPrimeOrderDetails);
router.post('/orders/:id/accept', acceptPrimeOrder);
router.post('/orders/:id/reject', rejectPrimeOrder);
router.post('/orders/:id/not-available', markNotAvailable);
router.post('/orders/:id/refund', initiateRefund);
router.put('/orders/:id/status', updatePrimeOrderStatus);
router.post('/orders/:id/shipping-details', uploadReceipt.single('receipt'), addShippingDetails);

export default router;
