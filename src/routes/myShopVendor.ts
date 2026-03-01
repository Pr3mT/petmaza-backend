import { Router } from 'express';
import { protect } from '../middlewares/auth';
import * as myShopVendorController from '../controllers/myShopVendorController';

const router = Router();

// All routes require authentication
router.use(protect);

// Get all orders for MY_SHOP vendor
router.get('/orders', myShopVendorController.getMyShopOrders);

// Accept order
router.post('/orders/:orderId/accept', myShopVendorController.acceptOrder);

// Refund order (if cannot fulfill)
router.post('/orders/:orderId/refund', myShopVendorController.refundOrder);

// Update order status
router.post('/orders/:orderId/packed', myShopVendorController.markPacked);
router.post('/orders/:orderId/picked-up', myShopVendorController.markPickedUp);
router.post('/orders/:orderId/in-transit', myShopVendorController.markInTransit);
router.post('/orders/:orderId/delivered', myShopVendorController.markDelivered);

export default router;
