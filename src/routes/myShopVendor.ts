import { Router } from 'express';
import { protect } from '../middlewares/auth';
import * as myShopVendorController from '../controllers/myShopVendorController';
import Review from '../models/Review';
import Product from '../models/Product';

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

// Get reviews for vendor's products
router.get('/reviews', async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    
    // Find all products owned by this vendor
    const products = await Product.find({ myShopVendor_id: vendorId }).select('_id');
    const productIds = products.map(p => p._id);
    
    // Find reviews for these products
    const reviews = await Review.find({ product_id: { $in: productIds } })
      .populate('product_id', 'name images')
      .populate('customer_id', 'name')
      .sort('-createdAt')
      .limit(50);

    res.json({ success: true, reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
