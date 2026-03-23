import express from 'express';
import { registerForNotification } from '../controllers/productNotificationController';

const router = express.Router();

// Public route - anyone can register for notifications
router.post('/:productId/notify-me', registerForNotification);

export default router;
