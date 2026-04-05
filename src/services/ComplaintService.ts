import Complaint from '../models/Complaint';
import Order from '../models/Order';
import Product from '../models/Product';
import VendorDetails from '../models/VendorDetails';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';

export class ComplaintService {
  // Create complaint
  static async createComplaint(data: {
    customer_id: string;
    order_id?: string; // Optional
    product_id: string;
    subject: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    issueType?: 'product_quality' | 'damaged_defective' | 'incorrect_product' | 'missing_items' | 'description_mismatch' | 'other';
  }) {
    console.log('📋 ===== COMPLAINT SERVICE - START =====');
    console.log('📥 Received data:', JSON.stringify(data, null, 2));
    
    let vendor_id;
    let fulfiller_id;
    let finalOrderId = undefined;

    // STRICT CHECK: Only process order_id if it's a non-empty string
    const shouldValidateOrder = Boolean(
      data.order_id && 
      typeof data.order_id === 'string' && 
      data.order_id.trim().length > 10 // MongoDB ObjectId is 24 chars, but at least 10
    );

    console.log('🔍 Should validate order?', shouldValidateOrder);
    console.log('📦 order_id value:', data.order_id, '| type:', typeof data.order_id);

    if (shouldValidateOrder) {
      try {
        console.log('✅ VALIDATING ORDER:', data.order_id);
        const order = await Order.findById(data.order_id);
        if (!order) {
          console.log('❌ Order not found with ID:', data.order_id);
          throw new AppError('Order not found', 404);
        }

        console.log('✅ Order found:', order._id);

        if (order.customer_id.toString() !== data.customer_id) {
          throw new AppError('Order does not belong to this customer', 403);
        }

        // Validate product exists in the order
        const productInOrder = order.items.find(
          (item: any) => item.product_id.toString() === data.product_id
        );

        if (!productInOrder) {
          throw new AppError('Product not found in this order', 404);
        }

        // Get vendor and fulfiller from order
        vendor_id = productInOrder.vendor_id || order.assignedVendorId || order.assignedVendors?.[0];
        fulfiller_id = (order as any).fulfiller_id; // fulfiller assigned to this order if any
        finalOrderId = data.order_id;
        
        console.log('✅ Order validation complete. Vendor:', vendor_id, '| Fulfiller:', fulfiller_id);
      } catch (error) {
        console.error('❌ Order validation failed:', error);
        throw error;
      }
    } else {
      console.log('⏭️  SKIPPING ORDER VALIDATION - Creating complaint without order');
    }

    // Get product details
    console.log('📦 Fetching product with ID:', data.product_id);
    const product = await Product.findById(data.product_id);
    if (!product) {
      console.log('❌ Product not found with ID:', data.product_id);
      throw new AppError('Product not found', 404);
    }
    console.log('✅ Product found:', product.name);

    // If no order, get vendor from product
    if (!shouldValidateOrder && !vendor_id) {
      // Check for primeVendor_id (for prime products) or addedBy (for regular products)
      vendor_id = product.primeVendor_id || product.addedBy;
      if (vendor_id) {
        console.log('🏪 Using vendor from product:', vendor_id);
        console.log('   - isPrime:', product.isPrime);
        console.log('   - primeVendor_id:', product.primeVendor_id);
        console.log('   - addedBy:', product.addedBy);
      } else {
        console.log('⚠️ No vendor found for product');
      }
    }

    const complaintData: any = {
      customer_id: data.customer_id,
      product_id: data.product_id,
      subject: data.subject,
      description: data.description,
      productName: product.name,
      status: 'pending',
      priority: data.priority || 'medium',
      issueType: data.issueType || 'other',
    };

    // Only add optional fields if they exist
    if (finalOrderId) {
      complaintData.order_id = finalOrderId;
    }
    if (vendor_id) {
      complaintData.vendor_id = vendor_id;
    }
    if (fulfiller_id) {
      complaintData.fulfiller_id = fulfiller_id;
    }

    console.log('💾 Creating complaint with cleaned data:');
    console.log(JSON.stringify(complaintData, null, 2));

    const complaint = await Complaint.create(complaintData);

    console.log('✅ ===== COMPLAINT CREATED SUCCESSFULLY =====');
    console.log('🎉 Complaint ID:', complaint._id);
    console.log('');
    
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
      .populate('order_id', 'orderId total status')
      .populate('product_id', 'name images')
      .populate('vendor_id', 'name email')
      .populate('fulfiller_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    return complaints;
  }

  // Get complaints for fulfiller
  static async getFulfillerComplaints(fulfiller_id: string) {
    console.log('🚚 ===== GET FULFILLER COMPLAINTS =====');
    console.log('📥 Fulfiller ID:', fulfiller_id);

    // 1. Get fulfiller's assigned subcategories
    const vendorDetails = await VendorDetails.findOne({ vendor_id: fulfiller_id });
    const assignedSubcategories = vendorDetails?.assignedSubcategories || [];
    console.log('📦 Assigned subcategories:', assignedSubcategories);

    // 2. Find products in those subcategories
    let productIdsInSubcategories: any[] = [];
    if (assignedSubcategories.length > 0) {
      const products = await Product.find({ subCategory: { $in: assignedSubcategories } }).select('_id');
      productIdsInSubcategories = products.map(p => p._id);
    }
    console.log(`📦 Products in subcategories: ${productIdsInSubcategories.length}`);

    // 3. Query: fulfiller_id matches OR product is in fulfiller's subcategories
    const query: any = {
      $or: [
        { fulfiller_id },
        ...(productIdsInSubcategories.length > 0 ? [{ product_id: { $in: productIdsInSubcategories } }] : []),
      ],
    };

    const complaints = await Complaint.find(query)
      .populate('customer_id', 'name email phone')
      .populate('order_id', 'orderId total status')
      .populate('product_id', 'name images')
      .populate('vendor_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${complaints.length} complaints for fulfiller`);
    console.log('');

    return complaints;
  }

  // Get complaints for vendor (prime/myshop)
  static async getVendorComplaints(vendor_id: string) {
    console.log('🏪 ===== GET VENDOR COMPLAINTS =====');
    console.log('📥 Vendor ID:', vendor_id);
    
    const complaints = await Complaint.find({ vendor_id })
      .populate('customer_id', 'name email phone')
      .populate('order_id', 'orderId total status')
      .populate('product_id', 'name images')
      .populate('fulfiller_id', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${complaints.length} complaints for vendor`);
    console.log('');
    
    return complaints;
  }

  // Get complaints for customer
  static async getCustomerComplaints(customer_id: string) {
    const complaints = await Complaint.find({ customer_id })
      .populate('order_id', 'orderId total status')
      .populate('product_id', 'name images')
      .populate('vendor_id', 'name email')
      .populate('fulfiller_id', 'name email')
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

  // Helper: verify vendor/fulfiller owns this complaint
  private static async verifyVendorOwnership(complaint: any, user_id: string): Promise<void> {
    const isVendor = complaint.vendor_id && complaint.vendor_id.toString() === user_id;
    const isFulfiller = complaint.fulfiller_id && complaint.fulfiller_id.toString() === user_id;

    if (isVendor || isFulfiller) return; // fast path

    // Fallback: check via product ownership (handles old complaints where vendor_id may not be set)
    const product = await Product.findById(complaint.product_id);
    if (product) {
      const isProductVendor =
        (product.primeVendor_id && product.primeVendor_id.toString() === user_id) ||
        (product.addedBy && product.addedBy.toString() === user_id);
      if (isProductVendor) return;

      // Fallback for warehouse fulfiller: check if this product's subcategory
      // is in the fulfiller's assigned subcategories
      const fulfillerDetails = await VendorDetails.findOne({ vendor_id: user_id });
      if (
        fulfillerDetails &&
        fulfillerDetails.vendorType === 'WAREHOUSE_FULFILLER' &&
        fulfillerDetails.assignedSubcategories.includes((product as any).subCategory)
      ) {
        return;
      }
    }

    throw new AppError('You are not authorized to perform this action on this complaint', 403);
  }

  // Resolve complaint (by vendor/fulfiller who owns the product/order)
  static async resolveComplaintByVendor(
    complaint_id: string,
    user_id: string,
    resolution: string
  ) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    await ComplaintService.verifyVendorOwnership(complaint, user_id);

    if (complaint.status === 'resolved' || complaint.status === 'closed') {
      throw new AppError('Complaint is already resolved or closed', 400);
    }

    complaint.status = 'resolved';
    complaint.resolution = resolution;
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = user_id;
    await complaint.save();

    return complaint;
  }

  // Resolve complaint (legacy admin method — kept for compatibility)
  static async resolveComplaint(
    complaint_id: string,
    admin_id: string,
    resolution: string
  ) {
    return ComplaintService.resolveComplaintByVendor(complaint_id, admin_id, resolution);
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

  // Delete complaint (only customers can delete their own pending complaints)
  static async deleteComplaint(complaint_id: string, customer_id: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    // Verify the complaint belongs to the customer
    if (complaint.customer_id.toString() !== customer_id) {
      throw new AppError('You can only delete your own complaints', 403);
    }

    // Only allow deletion of pending complaints
    if (complaint.status !== 'pending') {
      throw new AppError('Only pending complaints can be deleted', 400);
    }

    await Complaint.findByIdAndDelete(complaint_id);

    return { message: 'Complaint deleted successfully' };
  }

  // Acknowledge complaint (vendor/fulfiller)
  static async acknowledgeComplaint(complaint_id: string, user_id: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    // Verify the user is the vendor or fulfiller for this complaint
    const isVendor = complaint.vendor_id && complaint.vendor_id.toString() === user_id;
    const isFulfiller = complaint.fulfiller_id && complaint.fulfiller_id.toString() === user_id;

    if (!isVendor && !isFulfiller) {
      throw new AppError('You are not authorized to acknowledge this complaint', 403);
    }

    // Only allow acknowledging pending complaints
    if (complaint.status !== 'pending') {
      throw new AppError('Only pending complaints can be acknowledged. For in-progress complaints, use Add Notes.', 400);
    }

    complaint.status = 'in_progress';
    complaint.vendorNotified = true;
    await complaint.save();

    return complaint;
  }

  // Add vendor notes to complaint
  static async addVendorNotes(complaint_id: string, user_id: string, notes: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    await ComplaintService.verifyVendorOwnership(complaint, user_id);

    // Can only add notes to pending or in_progress complaints
    if (complaint.status === 'resolved' || complaint.status === 'closed') {
      throw new AppError('Cannot add notes to a resolved or closed complaint', 400);
    }

    complaint.vendorNotes = notes;
    // Status stays as-is — only admin can change the status
    await complaint.save();

    return complaint;
  }

  // Reject complaint (vendor/fulfiller)
  static async rejectComplaint(complaint_id: string, user_id: string, reason: string) {
    const complaint = await Complaint.findById(complaint_id);

    if (!complaint) {
      throw new AppError('Complaint not found', 404);
    }

    await ComplaintService.verifyVendorOwnership(complaint, user_id);

    if (complaint.status === 'resolved' || complaint.status === 'closed') {
      throw new AppError('Cannot reject a complaint that is already resolved or closed', 400);
    }

    complaint.status = 'rejected';
    complaint.vendorNotes = reason || complaint.vendorNotes;
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

