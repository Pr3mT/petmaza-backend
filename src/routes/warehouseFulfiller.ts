import express from 'express';
import { protect } from '../middlewares/auth';
import * as warehouseFulfillerController from '../controllers/warehouseFulfillerController';
import Review from '../models/Review';
import Order from '../models/Order';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get assigned orders
router.get('/orders', warehouseFulfillerController.getWarehouseFulfillerOrders);

// Save market collection data
router.post('/market-collection', warehouseFulfillerController.saveMarketCollection);

// Accept order
router.post('/orders/:orderId/accept', warehouseFulfillerController.acceptOrder);

// Reject and reassign to MY_SHOP
router.post('/orders/:orderId/reject', warehouseFulfillerController.rejectAndReassign);

// Update order status stages
router.post('/orders/:orderId/packed', warehouseFulfillerController.markPacked);
router.post('/orders/:orderId/picked-up', warehouseFulfillerController.markPickedUp);
router.post('/orders/:orderId/in-transit', warehouseFulfillerController.markInTransit);
router.post('/orders/:orderId/delivered', warehouseFulfillerController.markDelivered);

// Get reviews for fulfilled products
router.get('/reviews', async (req: any, res) => {
  try {
    const fulfillerId = req.user.id;
    
    // Find all delivered orders fulfilled by this warehouse
    const orders = await Order.find({ 
      assigned_to: fulfillerId,
      status: 'DELIVERED'
    }).select('items');
    
    // Extract product IDs
    const productIds = orders.flatMap(order => 
      order.items.map((item: any) => item.product_id)
    );
    
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
