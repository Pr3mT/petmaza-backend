import { Request, Response, NextFunction } from 'express';
import { BillingService } from '../services/BillingService';
import { AuthRequest } from '../middlewares/auth';

export const generateWeeklyBill = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vendor_id, weekStart, weekEnd } = req.body;

    if (!vendor_id || !weekStart || !weekEnd) {
      return res.status(400).json({
        success: false,
        message: 'vendor_id, weekStart, and weekEnd are required',
      });
    }

    const bill = await BillingService.generateWeeklyBill(
      vendor_id,
      new Date(weekStart),
      new Date(weekEnd),
      req.user._id.toString()
    );

    res.status(201).json({
      success: true,
      message: 'Bill generated successfully',
      data: { bill },
    });
  } catch (error: any) {
    next(error);
  }
};

export const markBillAsPaid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentMethod, notes } = req.body;

    const bill = await BillingService.markBillAsPaid(
      req.params.id,
      req.user._id.toString(),
      paymentMethod,
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Bill marked as paid successfully',
      data: { bill },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getVendorBills = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor_id = req.params.vendor_id || req.user._id.toString();
    const bills = await BillingService.getVendorBills(vendor_id);

    res.status(200).json({
      success: true,
      data: { bills },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllBills = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { vendor_id, status, weekStart, weekEnd } = req.query;

    const filters: any = {};
    if (vendor_id) filters.vendor_id = vendor_id as string;
    if (status) filters.status = status as string;
    if (weekStart) filters.weekStart = new Date(weekStart as string);
    if (weekEnd) filters.weekEnd = new Date(weekEnd as string);

    const bills = await BillingService.getAllBills(filters);

    res.status(200).json({
      success: true,
      data: { bills },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getBillById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bill = await BillingService.getBillById(req.params.id);
    res.status(200).json({
      success: true,
      data: { bill },
    });
  } catch (error: any) {
    next(error);
  }
};

