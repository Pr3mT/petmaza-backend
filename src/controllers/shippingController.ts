import { Response, NextFunction } from 'express';
import ShippingSettings from '../models/ShippingSettings';
import { ShippingService } from '../services/ShippingService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { clearCache } from '../middlewares/cache';

// Get shipping settings
export const getShippingSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await ShippingService.getSettings();
    
    res.status(200).json({
      success: true,
      data: { settings },
    });
  } catch (error: any) {
    next(error);
  }
};

// Update shipping settings (Admin only)
export const updateShippingSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      shippingEnabled,
      freeShippingThreshold,
      shippingChargesBelowThreshold,
      platformFeeEnabled,
      platformFeeThreshold,
      platformFeeAmount,
      // Petmaza Quick
      quickShippingEnabled,
      quickFreeShippingThreshold,
      quickShippingChargesBelowThreshold,
      quickPlatformFeeEnabled,
      quickPlatformFeeThreshold,
      quickPlatformFeeAmount,
    } = req.body;

    // Validate input
    if (freeShippingThreshold !== undefined && freeShippingThreshold < 0) {
      return next(new AppError('Free shipping threshold must be non-negative', 400));
    }

    if (shippingChargesBelowThreshold !== undefined && shippingChargesBelowThreshold < 0) {
      return next(new AppError('Shipping charges must be non-negative', 400));
    }

    if (platformFeeThreshold !== undefined && platformFeeThreshold < 0) {
      return next(new AppError('Platform fee threshold must be non-negative', 400));
    }

    if (platformFeeAmount !== undefined && platformFeeAmount < 0) {
      return next(new AppError('Platform fee amount must be non-negative', 400));
    }

    // Validate Petmaza Quick input
    if (quickFreeShippingThreshold !== undefined && quickFreeShippingThreshold < 0) {
      return next(new AppError('Quick free delivery threshold must be non-negative', 400));
    }

    if (quickShippingChargesBelowThreshold !== undefined && quickShippingChargesBelowThreshold < 0) {
      return next(new AppError('Quick delivery charge must be non-negative', 400));
    }

    if (quickPlatformFeeThreshold !== undefined && quickPlatformFeeThreshold < 0) {
      return next(new AppError('Quick platform fee threshold must be non-negative', 400));
    }

    if (quickPlatformFeeAmount !== undefined && quickPlatformFeeAmount < 0) {
      return next(new AppError('Quick platform fee amount must be non-negative', 400));
    }

    // Get existing settings or create new
    let settings = await ShippingSettings.findOne();
    
    if (!settings) {
      settings = await ShippingSettings.create({
        shippingEnabled: shippingEnabled ?? true,
        freeShippingThreshold: freeShippingThreshold ?? 300,
        shippingChargesBelowThreshold: shippingChargesBelowThreshold ?? 50,
        platformFeeEnabled: platformFeeEnabled ?? true,
        platformFeeThreshold: platformFeeThreshold ?? 0,
        platformFeeAmount: platformFeeAmount ?? 10,
        quickShippingEnabled: quickShippingEnabled ?? false,
        quickFreeShippingThreshold: quickFreeShippingThreshold ?? 199,
        quickShippingChargesBelowThreshold: quickShippingChargesBelowThreshold ?? 25,
        quickPlatformFeeEnabled: quickPlatformFeeEnabled ?? false,
        quickPlatformFeeThreshold: quickPlatformFeeThreshold ?? 0,
        quickPlatformFeeAmount: quickPlatformFeeAmount ?? 5,
        updatedBy: req.user._id,
      });
    } else {
      // Update existing settings
      if (shippingEnabled !== undefined) settings.shippingEnabled = shippingEnabled;
      if (freeShippingThreshold !== undefined) settings.freeShippingThreshold = freeShippingThreshold;
      if (shippingChargesBelowThreshold !== undefined) settings.shippingChargesBelowThreshold = shippingChargesBelowThreshold;
      if (platformFeeEnabled !== undefined) settings.platformFeeEnabled = platformFeeEnabled;
      if (platformFeeThreshold !== undefined) settings.platformFeeThreshold = platformFeeThreshold;
      if (platformFeeAmount !== undefined) settings.platformFeeAmount = platformFeeAmount;
      // Petmaza Quick
      if (quickShippingEnabled !== undefined) settings.quickShippingEnabled = quickShippingEnabled;
      if (quickFreeShippingThreshold !== undefined) settings.quickFreeShippingThreshold = quickFreeShippingThreshold;
      if (quickShippingChargesBelowThreshold !== undefined) settings.quickShippingChargesBelowThreshold = quickShippingChargesBelowThreshold;
      if (quickPlatformFeeEnabled !== undefined) settings.quickPlatformFeeEnabled = quickPlatformFeeEnabled;
      if (quickPlatformFeeThreshold !== undefined) settings.quickPlatformFeeThreshold = quickPlatformFeeThreshold;
      if (quickPlatformFeeAmount !== undefined) settings.quickPlatformFeeAmount = quickPlatformFeeAmount;
      settings.updatedBy = req.user._id;

      await settings.save();
    }

    // Clear cache — both the service-level settings cache and the cached
    // public /shipping/info response, so new fees apply immediately.
    ShippingService.clearCache();
    clearCache('/shipping/info');

    res.status(200).json({
      success: true,
      message: 'Shipping settings updated successfully',
      data: { settings },
    });
  } catch (error: any) {
    next(error);
  }
};

// Get shipping info (Public endpoint for frontend)
export const getShippingInfo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const info = await ShippingService.getShippingInfo();
    
    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error: any) {
    next(error);
  }
};
