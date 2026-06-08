import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import ProductNotification from '../models/ProductNotification';
import Product from '../models/Product';
import { AppError } from '../middlewares/errorHandler';
import { sendProductAvailableEmail } from '../services/emailer';

export const registerForNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const { email, phone, name } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new AppError('Invalid email format', 400));
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Product is in stock only if BOTH isActive and inStock are not false
    // (admin marks products unavailable via isActive:false; inStock:false is set explicitly for stock-outs)
    const productInStock = product.isActive !== false && product.inStock !== false;
    if (productInStock) {
      return res.status(200).json({
        success: true,
        message: 'Product is already in stock!',
      });
    }

    // Check if user already registered for this product
    const existingNotification = await ProductNotification.findOne({
      product_id: productId,
      email: email.toLowerCase(),
    });

    if (existingNotification) {
      return res.status(200).json({
        success: true,
        message: 'You are already registered for notifications',
      });
    }

    // Create notification entry
    await ProductNotification.create({
      product_id: productId,
      email: email.toLowerCase(),
      phone,
      name,
      isNotified: false,
    });

    res.status(201).json({
      success: true,
      message: 'You will be notified when the product is back in stock',
    });
  } catch (error: any) {
    next(error);
  }
};

export const notifyWaitingCustomers = async (productId: string, productName: string, productImage?: string) => {
  // Find all customers waiting for this product who haven't been notified yet
  const notifications = await ProductNotification.find({
    product_id: productId,
    isNotified: false,
  });

  if (notifications.length === 0) {
    logger.info(`📭 [Notify Me] No pending subscribers for product "${productName}" (${productId})`);
    return;
  }

  logger.info(`📧 [Notify Me] Sending notifications to ${notifications.length} subscriber(s) for "${productName}"`);

  let successCount = 0;
  let failCount = 0;

  // Send emails sequentially to avoid rate-limiting issues with ZeptoMail
  for (const notification of notifications) {
    try {
      logger.info(`📨 [Notify Me] Emailing: ${notification.email}`);
      await sendProductAvailableEmail({
        email: notification.email,
        name: notification.name || 'Customer',
        productName,
        productId,
        productImage,
      });

      // Mark as notified only after successful email delivery
      notification.isNotified = true;
      notification.notifiedAt = new Date();
      await notification.save();

      logger.info(`✅ [Notify Me] Notified: ${notification.email}`);
      successCount++;
    } catch (error: any) {
      logger.error(`❌ [Notify Me] Failed to notify ${notification.email}:`, error?.message || error);
      failCount++;
      // Continue to next subscriber even if this one fails
    }
  }

  logger.info(`📬 [Notify Me] Done for "${productName}": ${successCount} sent, ${failCount} failed`);
};
