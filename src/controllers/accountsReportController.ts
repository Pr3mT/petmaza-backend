/**
 * accountsReportController
 *
 * The weekly accounts report: Sunday→Saturday (IST), one CSV per week.
 * All the costing lives in WeeklyAccountsService — this only shapes responses.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import {
  buildWeekIndex,
  buildWeeklyReport,
  toCsv,
  csvFileName,
  GATEWAY_FEE_PERCENT,
  GATEWAY_FEE_GST_PERCENT,
} from '../services/WeeklyAccountsService';

/**
 * GET /admin/accounts/weeks?weeks=26
 * The index the report screen lists: one summary per week, newest first.
 */
export const getAccountWeeks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const weeks = await buildWeekIndex(Number(req.query.weeks) || 26);
    res.status(200).json({
      success: true,
      data: {
        weeks,
        gateway: { feePercent: GATEWAY_FEE_PERCENT, gstPercent: GATEWAY_FEE_GST_PERCENT },
      },
    });
  } catch (error: any) {
    logger.error('[getAccountWeeks] Error:', error);
    next(error);
  }
};

/**
 * GET /admin/accounts/weekly?weekStart=YYYY-MM-DD
 * The same week on screen — every order row plus its totals. Any date inside a
 * week resolves to that week, so the caller never has to find the Sunday.
 */
export const getWeeklyAccountReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows, summary } = await buildWeeklyReport(req.query.weekStart as string);
    res.status(200).json({
      success: true,
      data: {
        summary,
        orders: rows,
        gateway: { feePercent: GATEWAY_FEE_PERCENT, gstPercent: GATEWAY_FEE_GST_PERCENT },
      },
    });
  } catch (error: any) {
    if (/Invalid weekStart/.test(error?.message)) return next(new AppError(error.message, 400));
    logger.error('[getWeeklyAccountReport] Error:', error);
    next(error);
  }
};

/**
 * GET /admin/accounts/weekly.csv?weekStart=YYYY-MM-DD
 * The download. Sent as text/csv with a filename so the browser saves it
 * straight from the client's fetch.
 */
export const downloadWeeklyAccountCsv = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { weekStart, rows, summary } = await buildWeeklyReport(req.query.weekStart as string);
    const csv = toCsv(rows, summary);
    const filename = csvFileName(weekStart);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // The client reads the filename off this header — server.ts exposes it to CORS.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

    logger.info(`[downloadWeeklyAccountCsv] ${filename} — ${rows.length} order(s) by ${req.user?._id}`);
  } catch (error: any) {
    if (/Invalid weekStart/.test(error?.message)) return next(new AppError(error.message, 400));
    logger.error('[downloadWeeklyAccountCsv] Error:', error);
    next(error);
  }
};
