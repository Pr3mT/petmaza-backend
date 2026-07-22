import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AnalyticsService, TimePeriod } from '../services/AnalyticsService';
import { AppError } from '../middlewares/errorHandler';

const ORDER_TYPES = ['NORMAL', 'PRIME', 'QUICK'];

/** Read + validate the optional channel filter. Empty/absent = all channels. */
const readOrderType = (req: AuthRequest): string | undefined => {
  const orderType = (req.query.orderType as string) || '';
  if (!orderType || orderType === 'ALL') return undefined;
  if (!ORDER_TYPES.includes(orderType)) {
    throw new AppError('Invalid orderType. Must be: NORMAL, PRIME or QUICK', 400);
  }
  return orderType;
};

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

    const orderType = readOrderType(req);
    const data = await AnalyticsService.getAnalytics(period, startDate, endDate, orderType);

    res.status(200).json({
      success: true,
      data: {
        period,
        orderType: orderType || 'ALL',
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
      skip,
      readOrderType(req)
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

    const summary = await AnalyticsService.getSummary(startDate, endDate, readOrderType(req));

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    next(error);
  }
};

