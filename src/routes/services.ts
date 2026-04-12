import express from 'express';
import {
  createBirdDNAService,
  getMyServiceRequests,
  getServiceRequest,
  getAllServiceRequests,
  updateServiceStatus,
  uploadLabReport,
  getSiteSettings,
  updateSiteSettings,
  getServiceAvailability,
  getLabReportDownloadUrl,
  verifyLabReportQr,
} from '../controllers/serviceController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public: check if service is enabled + price
router.get('/availability', getServiceAvailability);
router.get('/verify-report', verifyLabReportQr);

// Customer routes
router.post('/bird-dna', verifyToken, createBirdDNAService);
router.get('/my', verifyToken, getMyServiceRequests);
router.get('/:id/birds/:birdIndex/reports/:reportIndex/download-url', verifyToken, getLabReportDownloadUrl);
router.get('/:id', verifyToken, getServiceRequest);

// Admin / MY_SHOP Vendor routes
router.get('/admin/all', verifyToken, checkRole('admin', 'vendor'), getAllServiceRequests);
router.patch('/:id/status', verifyToken, checkRole('admin', 'vendor'), updateServiceStatus);
router.post('/:id/birds/:birdIndex/upload-report', verifyToken, checkRole('admin', 'vendor'), uploadLabReport);

// Admin-only: site settings
router.get('/admin/settings', verifyToken, checkRole('admin'), getSiteSettings);
router.patch('/admin/settings', verifyToken, checkRole('admin'), updateSiteSettings);

export default router;

