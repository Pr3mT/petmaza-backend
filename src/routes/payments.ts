import express from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  generatePaymentLink,
  completePayment,
} from '../controllers/paymentController';
import { verifyToken } from '../middlewares/auth';

const router = express.Router();

router.post('/create-order', verifyToken, createPaymentOrder);
router.post('/verify', verifyToken, verifyPayment);
router.post('/generate-link', verifyToken, generatePaymentLink);
router.post('/complete', verifyToken, completePayment);

export default router;

