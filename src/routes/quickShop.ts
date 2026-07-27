import express from 'express';
import * as quickShopController from '../controllers/quickShopController';
import { verifyToken, checkQuickShopVendor } from '../middlewares/auth';
import { geocodeLimiter } from '../middlewares/rateLimiter';
import { uploadReceipt } from '../config/cloudinary';

const router = express.Router();

// ── Customer-facing (public browse, auth required to order) ────────────────
// Both browse endpoints take the customer's coordinates (?lat=&lng=) — Quick is
// a dark-store network, so a pincode is too coarse to answer "can we reach you".
// `?pincode=` is still accepted, but only matches shops that have no store pin
// yet; see QuickServiceabilityService.
router.get('/availability', quickShopController.getAvailability);
router.get('/products', quickShopController.getQuickProducts);
// Address → coordinates, for customers whose browser can't locate them
// accurately (any desktop, effectively). Rate-limited harder than the rest
// because it spends OpenStreetMap's budget, not ours.
router.get('/geocode', geocodeLimiter, quickShopController.searchAddress);
// Coordinates → area name, so a GPS fix can be shown back as a place the
// customer recognises rather than as "your current location".
router.get('/reverse-geocode', geocodeLimiter, quickShopController.reverseGeocode);
router.post('/orders', verifyToken, quickShopController.createQuickOrder);

// ── Shop Admin (QUICK_SHOP vendor) ──────────────────────────────────────────
router.use('/vendor', verifyToken, checkQuickShopVendor);
router.get('/vendor/catalog', quickShopController.getCatalog);
router.get('/vendor/listings', quickShopController.getMyListings);
router.post('/vendor/listings', quickShopController.upsertListing);
router.delete('/vendor/listings/:product_id', quickShopController.deleteListing);

// Shop's own products (not in the Petmaza catalog — private to this shop)
router.post('/vendor/my-products', quickShopController.createOwnProduct);
router.put('/vendor/my-products/:productId', quickShopController.updateOwnProduct);
router.delete('/vendor/my-products/:productId', quickShopController.deleteOwnProduct);

router.get('/vendor/wallet/stats', quickShopController.getQuickWalletStats);

router.get('/vendor/orders', quickShopController.getQuickShopOrders);
router.post('/vendor/orders/:orderId/accept', quickShopController.acceptOrder);
router.post('/vendor/orders/:orderId/reject', quickShopController.rejectOrder);
router.post('/vendor/orders/:orderId/packed', quickShopController.markPacked);
router.post('/vendor/orders/:orderId/shipping-details', uploadReceipt.single('receipt'), quickShopController.addShippingDetails);
router.post('/vendor/orders/:orderId/picked-up', quickShopController.markPickedUp);
router.post('/vendor/orders/:orderId/in-transit', quickShopController.markInTransit);
router.post('/vendor/orders/:orderId/delivered', quickShopController.markDelivered);

export default router;
