import express from 'express';
import {
  generateWeeklyBill,
  markBillAsPaid,
  getVendorBills,
  getAllBills,
  getBillById,
} from '../controllers/billingController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Vendor routes
router.get('/vendor/:vendor_id', verifyToken, checkRole('vendor'), getVendorBills);
router.get('/vendor/my', verifyToken, checkRole('vendor'), getVendorBills);

// Admin routes
router.use(verifyToken);
router.use(checkRole('admin'));

router.post('/generate', generateWeeklyBill);
router.put('/:id/paid', markBillAsPaid);
router.get('/', getAllBills);
router.get('/:id', getBillById);

export default router;

