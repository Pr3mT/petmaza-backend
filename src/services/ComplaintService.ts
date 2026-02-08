import Complaint from '../models/Complaint';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';

export class ComplaintService {
  // Create complaint
  static async createComplaint(data: {
    customer_id: string;
    order_id: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }) {
    // Validate order exists and belongs to customer
    const order = await Order.findById(data.order_id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.customer_id.toString() !== data.customer_id) {
      throw new AppError('Order does not belong to this customer', 403);
    }

    // Get vendor from order
    const vendor_id = order.assignedVendorId || order.assignedVendors?.[0];

    const complaint = await Complaint.create({
      ...data,
      vendor_id,
      status: 'pending',
      priority: data.priority || 'medium',
    });

    return complaint;
  }

  // Get all complaints (admin)
  static async getAllComplaints(filters: {
    status?: string;
    priority?: string;
    vendor_id?: string;
    customer_id?: string;
  } = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.vendor_id) {
      query.vendor_id = filters.vendor_id;
    }

    if (filters.customer_id) {
      query.customer_id = filters.customer_id;
    }

    const complaints = await Complaint.find(query)
      .populate('customer_id', 'name email')
      .populate('order_id', 'total status')
      .populate('vendor_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    return complaints;
  }

  // Get complaints for customer
  static async getCustomerComplaints(customer_id: string) {
    const complaints = await Complaint.find({ customer_id })
      .populate('order_id', 'total status')
      .populate('vendor_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    return complaints;
  }

  // Get complaint by ID
  static async getComplaintById(complaint_id: string) {
    const complaint = await Complaint.findById(complaint_id)
      .populate('customer_id', 'name email')
      .populate('order_id')
      .populate('vendor_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email');

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    return complaint;
  }

  // Assign complaint to admin
  static async assignComplaint(complaint_id: string, admin_id: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    complaint.assignedTo = admin_id;
    complaint.status = 'in_progress';

    await complaint.save();

    return complaint;
  }

  // Resolve complaint
  static async resolveComplaint(
    complaint_id: string,
    admin_id: string,
    resolution: string
  ) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    complaint.status = 'resolved';
    complaint.resolution = resolution;
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = admin_id;

    await complaint.save();

    return complaint;
  }

  // Close complaint
  static async closeComplaint(complaint_id: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    complaint.status = 'closed';
    await complaint.save();

    return complaint;
  }

  // Notify vendor (if needed)
  static async notifyVendor(complaint_id: string) {
    const complaint = await Complaint.findById(complaint_id).populate('vendor_id');

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    if (complaint.vendor_id && !complaint.vendorNotified) {
      complaint.vendorNotified = true;
      await complaint.save();

      // TODO: Send notification via WebSocket or email
    }

    return complaint;
  }
}

