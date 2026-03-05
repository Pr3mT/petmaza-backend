import express from 'express';
import { getShippingInfo } from '../controllers/shippingController';
import { cacheResponse } from '../middlewares/cache';

const router = express.Router();

// Public route - get shipping info for frontend (5-minute cache)
router.get('/info', cacheResponse(300000), getShippingInfo);

export default router;
