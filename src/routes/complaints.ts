import express from 'express';
import {
  createComplaint,
  getCustomerComplaints,
  getAllComplaints,
  getComplaintById,
  assignComplaint,
  resolveComplaint,
  closeComplaint,
} from '../controllers/complaintController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Customer routes
router.post('/', verifyToken, checkRole('customer'), createComplaint);
router.get('/my', verifyToken, checkRole('customer'), getCustomerComplaints);
router.get('/:id', verifyToken, getComplaintById);

// Admin routes
router.use(verifyToken);
router.use(checkRole('admin'));

router.get('/', getAllComplaints);
router.put('/:id/assign', assignComplaint);
router.put('/:id/resolve', resolveComplaint);
router.put('/:id/close', closeComplaint);

export default router;

