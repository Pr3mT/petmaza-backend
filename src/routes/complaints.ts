import express from 'express';
import {
  createComplaint,
  getCustomerComplaints,
  getFulfillerComplaints,
  getVendorComplaints,
  getAllComplaints,
  getComplaintById,
  deleteComplaint,
  acknowledgeComplaint,
  addVendorNotes,
  rejectComplaint,
  resolveComplaintByVendor,
} from '../controllers/complaintController';
import { verifyToken, checkRole, checkWarehouseFulfiller } from '../middlewares/auth';

const router = express.Router();

// Customer routes
router.post('/', verifyToken, checkRole('customer'), createComplaint);
router.get('/my', verifyToken, checkRole('customer'), getCustomerComplaints);
router.delete('/:id', verifyToken, checkRole('customer'), deleteComplaint);

// Vendor routes
router.get('/vendor/my', verifyToken, checkRole('vendor'), getVendorComplaints);
router.put('/:id/vendor-notes', verifyToken, checkRole('vendor'), addVendorNotes);
router.put('/:id/vendor-reject', verifyToken, checkRole('vendor'), rejectComplaint);
router.put('/:id/vendor-resolve', verifyToken, checkRole('vendor'), resolveComplaintByVendor);

// Fulfiller routes
router.get('/fulfiller/my', verifyToken, checkWarehouseFulfiller, getFulfillerComplaints);
router.put('/:id/fulfiller-notes', verifyToken, checkWarehouseFulfiller, addVendorNotes);
router.put('/:id/fulfiller-reject', verifyToken, checkWarehouseFulfiller, rejectComplaint);
router.put('/:id/fulfiller-resolve', verifyToken, checkWarehouseFulfiller, resolveComplaintByVendor);

// Common routes (requires authentication)
router.get('/:id', verifyToken, getComplaintById);

// Admin routes — read-only view
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getAllComplaints);

export default router;

