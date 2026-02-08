import { Request, Response, NextFunction } from 'express';
import ServiceRequest from '../models/ServiceRequest';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

const BIRD_DNA_PRICE_PER_BIRD = 200;

export const createBirdDNAService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      customerName,
      farm,
      address,
      birds,
      pickupAddress,
      extraNote,
      payment_id,
    } = req.body;

    if (!birds || birds.length === 0) {
      return next(new AppError('At least one bird is required', 400));
    }

    const totalAmount = birds.length * BIRD_DNA_PRICE_PER_BIRD;

    // Delivery address is partner lab (not exposed to customer)
    const deliveryAddress = {
      street: 'Lab Address',
      city: 'Lab City',
      state: 'Lab State',
      pincode: '123456',
    };

    const serviceRequest = await ServiceRequest.create({
      customerId: req.user._id,
      serviceType: 'bird_dna',
      customerName,
      farm,
      address,
      birds,
      pickupAddress,
      deliveryAddress,
      extraNote,
      payment_id: payment_id || undefined,
      payment_status: payment_id ? 'Paid' : 'Pending',
      totalAmount,
      status: 'pending',
    });

    await serviceRequest.populate('customerId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Bird DNA service request created successfully',
      data: {
        serviceRequest,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMyServiceRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const serviceRequests = await ServiceRequest.find({ customerId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        serviceRequests,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getServiceRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const serviceRequest = await ServiceRequest.findById(id)
      .populate('customerId', 'name email phone');

    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    // Check access
    if (serviceRequest.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Access denied', 403));
    }

    res.status(200).json({
      success: true,
      data: {
        serviceRequest,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

