import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth';
import {
  getWarehouse,
  getWarehouseInventory,
  addProductToWarehouse,
  updateWarehouseInventory,
  bulkAddToWarehouse,
  getWarehouseDashboard,
  getLowStockProducts,
  getProductsNotInWarehouse,
  recordStoreSale,
  getSalesHistory,
  getSalesAnalytics,
  getTopSellingProducts,
} from '../controllers/warehouseController';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken, checkRole('admin'));

// Get warehouse
router.get('/', getWarehouse);

// Get warehouse inventory
router.get('/inventory', getWarehouseInventory);

// Add product to warehouse
router.post('/inventory', addProductToWarehouse);

// Update warehouse inventory item
router.put('/inventory/:id', updateWarehouseInventory);

// Bulk add products to warehouse
router.post('/inventory/bulk', bulkAddToWarehouse);

// Get warehouse dashboard
router.get('/dashboard', getWarehouseDashboard);

// Get low stock products
router.get('/low-stock', getLowStockProducts);

// Get products not in warehouse
router.get('/available-products', getProductsNotInWarehouse);

// Record store sale (manual sale from physical store)
router.post('/sales/store', recordStoreSale);

// Get sales history
router.get('/sales/history', getSalesHistory);

// Get sales analytics
router.get('/sales/analytics', getSalesAnalytics);

// Get top selling products
router.get('/sales/top-products', getTopSellingProducts);

export default router;
