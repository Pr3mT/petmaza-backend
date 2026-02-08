import { Request, Response, NextFunction } from 'express';
import { ComplaintService } from '../services/ComplaintService';
import { AuthRequest } from '../middlewares/auth';

export const createComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const complaint = await ComplaintService.createComplaint({
      ...req.body,
      customer_id: req.user._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCustomerComplaints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const complaints = await ComplaintService.getCustomerComplaints(req.user._id.toString());
    res.status(200).json({
      success: true,
      data: { complaints },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllComplaints = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, priority, vendor_id, customer_id } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (priority) filters.priority = priority as string;
    if (vendor_id) filters.vendor_id = vendor_id as string;
    if (customer_id) filters.customer_id = customer_id as string;

    const complaints = await ComplaintService.getAllComplaints(filters);

    res.status(200).json({
      success: true,
      data: { complaints },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getComplaintById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const complaint = await ComplaintService.getComplaintById(req.params.id);
    res.status(200).json({
      success: true,
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const assignComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const complaint = await ComplaintService.assignComplaint(
      req.params.id,
      req.user._id.toString()
    );
    res.status(200).json({
      success: true,
      message: 'Complaint assigned successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const resolveComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { resolution } = req.body;

    const complaint = await ComplaintService.resolveComplaint(
      req.params.id,
      req.user._id.toString(),
      resolution
    );

    res.status(200).json({
      success: true,
      message: 'Complaint resolved successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const closeComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const complaint = await ComplaintService.closeComplaint(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Complaint closed successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

