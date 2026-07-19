import express from 'express';
import * as quickShopController from '../controllers/quickShopController';
import { verifyToken, checkQuickShopVendor } from '../middlewares/auth';

const router = express.Router();

// ── Customer-facing (public browse, auth required to order) ────────────────
router.get('/availability', quickShopController.getAvailability);
router.get('/products', quickShopController.getQuickProducts);
router.post('/orders', verifyToken, quickShopController.createQuickOrder);

// ── Shop Admin (QUICK_SHOP vendor) ──────────────────────────────────────────
router.use('/vendor', verifyToken, checkQuickShopVendor);
router.get('/vendor/catalog', quickShopController.getCatalog);
router.get('/vendor/listings', quickShopController.getMyListings);
router.post('/vendor/listings', quickShopController.upsertListing);
router.delete('/vendor/listings/:product_id', quickShopController.deleteListing);

router.get('/vendor/orders', quickShopController.getQuickShopOrders);
router.post('/vendor/orders/:orderId/accept', quickShopController.acceptOrder);
router.post('/vendor/orders/:orderId/reject', quickShopController.rejectOrder);
router.post('/vendor/orders/:orderId/packed', quickShopController.markPacked);
router.post('/vendor/orders/:orderId/picked-up', quickShopController.markPickedUp);
router.post('/vendor/orders/:orderId/in-transit', quickShopController.markInTransit);
router.post('/vendor/orders/:orderId/delivered', quickShopController.markDelivered);

export default router;
