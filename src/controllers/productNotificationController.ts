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

    // Check if product is already in stock (use inStock field, fall back to isActive for legacy docs)
    const productInStock = product.inStock !== undefined ? product.inStock !== false : product.isActive !== false;
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
  try {
    // Find all customers waiting for this product who haven't been notified yet
    const notifications = await ProductNotification.find({
      product_id: productId,
      isNotified: false,
    });

    if (notifications.length === 0) {
      return;
    }

    console.log(`📧 Notifying ${notifications.length} customers about product: ${productName}`);

    // Send emails to all waiting customers
    const emailPromises = notifications.map(async (notification) => {
      try {
        await sendProductAvailableEmail({
          email: notification.email,
          name: notification.name || 'Customer',
          productName,
          productId,
          productImage,
        });

        // Mark as notified
        notification.isNotified = true;
        notification.notifiedAt = new Date();
        await notification.save();

        console.log(`✅ Notified: ${notification.email}`);
      } catch (error) {
        console.error(`❌ Failed to notify ${notification.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
    console.log(`📬 Notification process completed for product: ${productName}`);
  } catch (error) {
    console.error('Error notifying waiting customers:', error);
  }
};
