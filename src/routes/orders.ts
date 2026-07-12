import express from 'express';
import {
  createOrder,
  createPrimeOrder,
  getCustomerOrders,
  getOrderById,
  updateOrder,
  getPendingOrders,
  acceptOrder,
  rejectOrder,
  getVendorOrders,
  getVendorOrderDetails,
  updateOrderStatus,
  adminUpdateOrderStatus,
  adminAssignOrderToVendor,
  getOrderShippingDetails,
  adminAddShippingDetails,
  getVendorOrderShippingDetails,
  adminProcessRefund,
} from '../controllers/orderController';
import { verifyToken, checkRole } from '../middlewares/auth';
import { validateCartPrices } from '../middlewares/validateCartPrices';
import { uploadReceipt } from '../config/cloudinary';

const router = express.Router();

// Customer routes
// validateCartPrices re-fetches all product prices from DB before order creation.
// Frontend-supplied prices are ignored — only DB-authoritative values are used.
router.post('/', verifyToken, checkRole('customer'), validateCartPrices, createOrder);
router.post('/prime', verifyToken, checkRole('customer'), validateCartPrices, createPrimeOrder);
router.get('/my', verifyToken, checkRole('customer'), getCustomerOrders);
router.put('/:id', verifyToken, updateOrder);
router.get('/:id', verifyToken, getOrderById);

// Vendor routes
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.get('/vendor/pending', verifyToken, checkRole('vendor'), getPendingOrders);
router.get('/vendor/my', verifyToken, checkRole('vendor'), getVendorOrders);
router.post('/vendor/:id/accept', verifyToken, checkRole('vendor'), acceptOrder);
router.post('/vendor/:id/reject', verifyToken, checkRole('vendor'), rejectOrder);
router.put('/vendor/:id/status', verifyToken, checkRole('vendor'), updateOrderStatus);
router.get('/vendor/:id/shipping-details', verifyToken, checkRole('vendor'), getVendorOrderShippingDetails);
// This route must come LAST - validation in controller will handle invalid IDs
router.get('/vendor/:id', verifyToken, checkRole('vendor'), getVendorOrderDetails);

// Admin routes - for order management
router.put('/admin/:id/status', verifyToken, checkRole('admin', 'sub_admin'), adminUpdateOrderStatus);
router.put('/admin/:id/assign', verifyToken, checkRole('admin', 'sub_admin'), adminAssignOrderToVendor);
router.post('/admin/:id/process-refund', verifyToken, checkRole('admin', 'sub_admin'), adminProcessRefund);
router.get('/admin/:id/shipping-details', verifyToken, checkRole('admin', 'sub_admin'), getOrderShippingDetails);
// Admin/sub-admin adds courier & tracking on the vendor's behalf (PACKED → READY_TO_SHIP).
router.post('/admin/:id/shipping-details', verifyToken, checkRole('admin', 'sub_admin'), uploadReceipt.single('receipt'), adminAddShippingDetails);

export default router;
