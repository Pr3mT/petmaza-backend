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
  downloadRequestPdf,
  setDnaResult,
  downloadResultCertificatePdf,
  createDnaPaymentOrder,
  updateServicePayment,
  verifyDnaResult,
  createManualDnaCard,
} from '../controllers/serviceController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public: check if service is enabled + price
router.get('/availability', getServiceAvailability);
router.get('/verify-report', verifyLabReportQr);
router.get('/verify-dna', verifyDnaResult);

// Admin / MY_SHOP Vendor routes — must be declared BEFORE /:id to avoid route conflicts
router.get('/admin/all', verifyToken, checkRole('admin', 'vendor'), getAllServiceRequests);

// Admin-only: site settings
router.get('/admin/settings', verifyToken, checkRole('admin', 'sub_admin'), getSiteSettings);
router.patch('/admin/settings', verifyToken, checkRole('admin', 'sub_admin'), updateSiteSettings);

// Admin-only: manually create a DNA card (no customer request / payment needed)
router.post('/admin/create-manual', verifyToken, checkRole('admin', 'sub_admin'), createManualDnaCard);

// Customer routes
router.post('/bird-dna', verifyToken, createBirdDNAService);
router.post('/create-payment-order', verifyToken, createDnaPaymentOrder);
router.patch('/:id/payment', verifyToken, updateServicePayment);
router.get('/my', verifyToken, getMyServiceRequests);

// PDF downloads (customer + admin)
router.get('/:id/request-pdf', verifyToken, downloadRequestPdf);
router.get('/:id/birds/:birdIndex/result-certificate', verifyToken, downloadResultCertificatePdf);
router.get('/:id/birds/:birdIndex/reports/:reportIndex/download-url', verifyToken, getLabReportDownloadUrl);

// Admin / MY_SHOP Vendor: manage requests
router.patch('/:id/status', verifyToken, checkRole('admin', 'vendor'), updateServiceStatus);
router.post('/:id/birds/:birdIndex/upload-report', verifyToken, checkRole('admin', 'vendor'), uploadLabReport);
router.patch('/:id/birds/:birdIndex/dna-result', verifyToken, checkRole('admin', 'vendor'), setDnaResult);

// Single request — must come after specific sub-paths
router.get('/:id', verifyToken, getServiceRequest);

export default router;

