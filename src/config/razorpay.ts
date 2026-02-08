import Razorpay from 'razorpay';
import logger from './logger';

let razorpayInstance: Razorpay | null = null;

export const initializeRazorpay = (): Razorpay | null => {
  if (process.env.SKIP_PAYMENT === 'true' || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    logger.warn('Razorpay not configured. Payment operations will be skipped.');
    return null;
  }

  try {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    logger.info('Razorpay initialized successfully');
    return razorpayInstance;
  } catch (error) {
    logger.error('Failed to initialize Razorpay:', error);
    return null;
  }
};

export const getRazorpayInstance = (): Razorpay | null => {
  if (!razorpayInstance) {
    return initializeRazorpay();
  }
  return razorpayInstance;
};

