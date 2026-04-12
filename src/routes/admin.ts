import express from 'express';
import {
  getUsers,
  getUserById,
  approveVendor,
  getAdminStats,
  getAllOrders,
  assignBrandsToVendor,
  assignProductsToVendor,
  getVendorAssignments,
  updateVendorProductPricing,
  removeVendorProductAssignment,
  cleanupVariantProducts,
  reseedVariantProduct,
  createFulfiller,
  getFulfillers,
  updateFulfiller,
  deleteFulfiller,
  getVendorBilling,
} from '../controllers/adminController';
import {
  getAnalytics,
  getOrderReport,
  getSummary,
} from '../controllers/analyticsController';
import {
  getShippingSettings,
  updateShippingSettings,
} from '../controllers/shippingController';
import { verifyToken, checkRole } from '../middlewares/auth';
import Review from '../models/Review';

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/users', getUsers);
router.put('/users/:id/approve', approveVendor);
router.get('/users/:id', getUserById);
router.get('/stats', getAdminStats);
router.get('/orders', getAllOrders);

// Vendor-Product Assignment routes
router.post('/vendors/:id/assign-brands', assignBrandsToVendor);
router.post('/vendors/:id/assign-products', assignProductsToVendor);
router.get('/vendors/:id/assignments', getVendorAssignments);
router.put('/vendors/:id/products/:productId/pricing', updateVendorProductPricing);
router.delete('/vendors/:id/products/:productId', removeVendorProductAssignment);

// Cleanup variant products
router.post('/cleanup-variants', cleanupVariantProducts);
router.post('/reseed-product', reseedVariantProduct);

// Analytics routes
router.get('/analytics', getAnalytics);
router.get('/analytics/summary', getSummary);
router.get('/analytics/orders', getOrderReport);

// Shipping settings routes
router.get('/shipping-settings', getShippingSettings);
router.put('/shipping-settings', updateShippingSettings);

// Fulfiller management routes
router.post('/fulfillers', createFulfiller);
router.get('/fulfillers', getFulfillers);
router.put('/fulfillers/:id', updateFulfiller);
router.delete('/fulfillers/:id', deleteFulfiller);

// Vendor billing route
router.get('/vendor-billing', getVendorBilling);

// Reviews routes
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('product_id', 'name images')
      .populate('customer_id', 'name email')
      .sort('-createdAt')
      .limit(100);

    res.json({ success: true, reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/reviews/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, review });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

