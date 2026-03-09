import express from 'express';
import { protect } from '../middlewares/auth';
import * as warehouseFulfillerController from '../controllers/warehouseFulfillerController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get assigned orders
router.get('/orders', warehouseFulfillerController.getWarehouseFulfillerOrders);

// Accept order
router.post('/orders/:orderId/accept', warehouseFulfillerController.acceptOrder);

// Reject and reassign to MY_SHOP
router.post('/orders/:orderId/reject', warehouseFulfillerController.rejectAndReassign);

// Update order status stages
router.post('/orders/:orderId/packed', warehouseFulfillerController.markPacked);
router.post('/orders/:orderId/picked-up', warehouseFulfillerController.markPickedUp);
router.post('/orders/:orderId/in-transit', warehouseFulfillerController.markInTransit);
router.post('/orders/:orderId/delivered', warehouseFulfillerController.markDelivered);

export default router;
