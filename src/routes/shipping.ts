import express from 'express';
import { getShippingInfo } from '../controllers/shippingController';

const router = express.Router();

// Public route - get shipping info for frontend
router.get('/info', getShippingInfo);

export default router;
