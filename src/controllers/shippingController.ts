import { Response, NextFunction } from 'express';
import ShippingSettings from '../models/ShippingSettings';
import { ShippingService } from '../services/ShippingService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

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
      settings.updatedBy = req.user._id;
      
      await settings.save();
    }

    // Clear cache
    ShippingService.clearCache();

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
