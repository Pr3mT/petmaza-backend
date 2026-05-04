import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { AuthRequest } from '../middlewares/auth';

// Vendor: get their own wallet balance
export const getWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await WalletService.getWalletBalance(req.user._id.toString());
    res.status(200).json({
      success: true,
      data: { wallet },
    });
  } catch (error: any) {
    next(error);
  }
};

// Vendor: get earnings history with optional date filter
export const getVendorEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const earnings = await WalletService.getVendorEarnings(
      req.user._id.toString(),
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.status(200).json({
      success: true,
      data: earnings,
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin: get any vendor's wallet by vendor_id
export const adminGetVendorWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vendor_id } = req.params;
    const wallet = await WalletService.getWalletBalance(vendor_id);
    res.status(200).json({
      success: true,
      data: { wallet },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin: manually pay out (clear) a vendor's wallet after transferring their money
export const adminPayoutVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vendor_id } = req.params;
    const wallet = await WalletService.resetWallet(vendor_id);
    res.status(200).json({
      success: true,
      message: 'Vendor wallet cleared — payout recorded.',
      data: { wallet },
    });
  } catch (error: any) {
    next(error);
  }
};

