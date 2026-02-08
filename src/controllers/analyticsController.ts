import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AnalyticsService, TimePeriod } from '../services/AnalyticsService';
import { AppError } from '../middlewares/errorHandler';

/**
 * Get analytics data (revenue, profit, orders) for a time period
 */
export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as TimePeriod) || 'daily';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return next(new AppError('Invalid startDate format', 400));
    }

    if (endDate && isNaN(endDate.getTime())) {
      return next(new AppError('Invalid endDate format', 400));
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return next(new AppError('Invalid period. Must be: daily, weekly, monthly, or yearly', 400));
    }

    const data = await AnalyticsService.getAnalytics(period, startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        period,
        analytics: data,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get order-wise report
 */
export const getOrderReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const status = req.query.status as string | undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;

    if (startDate && isNaN(startDate.getTime())) {
      return next(new AppError('Invalid startDate format', 400));
    }

    if (endDate && isNaN(endDate.getTime())) {
      return next(new AppError('Invalid endDate format', 400));
    }

    const result = await AnalyticsService.getOrderReport(
      startDate,
      endDate,
      status,
      paymentStatus,
      limit,
      skip
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get summary statistics
 */
export const getSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return next(new AppError('Invalid startDate format', 400));
    }

    if (endDate && isNaN(endDate.getTime())) {
      return next(new AppError('Invalid endDate format', 400));
    }

    const summary = await AnalyticsService.getSummary(startDate, endDate);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    next(error);
  }
};

