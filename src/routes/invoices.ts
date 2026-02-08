import express from 'express';
import {
  createInvoice,
  getInvoice,
  getInvoiceByOrderId,
  getCustomerInvoices,
  getAllInvoices,
  sendInvoiceEmail,
} from '../controllers/invoiceController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Customer routes
router.post('/', verifyToken, checkRole('customer', 'admin'), createInvoice);
router.get('/my-invoices', verifyToken, checkRole('customer'), getCustomerInvoices);
router.get('/:invoiceId', verifyToken, getInvoice);
router.get('/order/:orderId', verifyToken, getInvoiceByOrderId);

// Admin routes
router.get('/', verifyToken, checkRole('admin'), getAllInvoices);
router.post('/:invoiceId/send-email', verifyToken, checkRole('admin', 'customer'), sendInvoiceEmail);

export default router;
