import { Request, Response, NextFunction } from 'express';
import { WalletService } from '../services/WalletService';
import { AuthRequest } from '../middlewares/auth';

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

