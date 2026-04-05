import { Request, Response, NextFunction } from 'express';
import { ComplaintService } from '../services/ComplaintService';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';

export const createComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🎯 CreateComplaint - Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID:', req.user._id.toString());
    
    // Clean the request body - remove any empty or undefined order_id
    const cleanedBody = { ...req.body };
    if (cleanedBody.order_id === '' || cleanedBody.order_id === null || cleanedBody.order_id === undefined) {
      delete cleanedBody.order_id;
      console.log('🧹 Removed empty/null/undefined order_id from request');
    }
    
    const complaint = await ComplaintService.createComplaint({
      ...cleanedBody,
      customer_id: req.user._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: { complaint },
    });
  } catch (error: any) {
    console.error('❌ Error creating complaint:', error.message);
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

export const getFulfillerComplaints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const complaints = await ComplaintService.getFulfillerComplaints(req.user._id.toString());
    res.status(200).json({
      success: true,
      data: { complaints },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getVendorComplaints = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const complaints = await ComplaintService.getVendorComplaints(req.user._id.toString());
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

export const deleteComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await ComplaintService.deleteComplaint(
      req.params.id,
      req.user._id.toString()
    );
    res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const acknowledgeComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const complaint = await ComplaintService.acknowledgeComplaint(
      req.params.id,
      req.user._id.toString()
    );
    res.status(200).json({
      success: true,
      message: 'Complaint acknowledged successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const addVendorNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { notes } = req.body;
    
    if (!notes || !notes.trim()) {
      throw new AppError('Notes are required', 400);
    }

    const complaint = await ComplaintService.addVendorNotes(
      req.params.id,
      req.user._id.toString(),
      notes
    );
    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const rejectComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      throw new AppError('A rejection reason is required', 400);
    }

    const complaint = await ComplaintService.rejectComplaint(
      req.params.id,
      req.user._id.toString(),
      reason
    );
    res.status(200).json({
      success: true,
      message: 'Complaint rejected',
      data: { complaint },
    });
  } catch (error: any) {
    next(error);
  }
};

export const resolveComplaintByVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { resolution } = req.body;

    if (!resolution || !resolution.trim()) {
      throw new AppError('A resolution description is required', 400);
    }

    const complaint = await ComplaintService.resolveComplaintByVendor(
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

