import Billing from '../models/Billing';
import Wallet from '../models/Wallet';
import Order from '../models/Order';
import { AppError } from '../middlewares/errorHandler';

export class BillingService {
  // Generate weekly bill for vendor
  static async generateWeeklyBill(
    vendor_id: string,
    weekStart: Date,
    weekEnd: Date,
    admin_id: string
  ) {
    // Check if bill already exists
    const existingBill = await Billing.findOne({
      vendor_id,
      weekStart,
      weekEnd,
    });

    if (existingBill) {
      throw new AppError('Bill already exists for this week', 400);
    }

    // Get all delivered orders in this week
    const orders = await Order.find({
      $or: [
        { assignedVendorId: vendor_id },
        { assignedVendors: vendor_id },
      ],
      status: 'DELIVERED',
      updatedAt: {
        $gte: weekStart,
        $lte: weekEnd,
      },
    });

    // Calculate total amount (sum of purchase prices)
    const totalAmount = orders.reduce((sum, order) => {
      const vendorItems = order.items.filter(
        (item) => item.vendor_id?.toString() === vendor_id
      );
      return sum + vendorItems.reduce((s, item) => s + item.purchaseSubtotal, 0);
    }, 0);

    // Create bill
    const bill = await Billing.create({
      vendor_id,
      weekStart,
      weekEnd,
      orders: orders.map((o) => o._id),
      totalAmount,
      status: 'pending',
    });

    return bill;
  }

  // Mark bill as paid
  static async markBillAsPaid(
    bill_id: string,
    admin_id: string,
    paymentMethod?: string,
    notes?: string
  ) {
    const bill = await Billing.findById(bill_id);

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    if (bill.status === 'paid') {
      throw new AppError('Bill already paid', 400);
    }

    // Update bill
    bill.status = 'paid';
    bill.paidAt = new Date();
    bill.paidBy = admin_id;
    bill.paymentMethod = paymentMethod;
    bill.notes = notes;

    await bill.save();

    // Reset vendor wallet
    const WalletService = (await import('./WalletService')).WalletService;
    await WalletService.resetWallet(bill.vendor_id.toString());

    return bill;
  }

  // Get all bills for vendor
  static async getVendorBills(vendor_id: string) {
    const bills = await Billing.find({ vendor_id })
      .populate('paidBy', 'name email')
      .sort({ weekStart: -1 });

    return bills;
  }

  // Get all bills (admin)
  static async getAllBills(filters: {
    vendor_id?: string;
    status?: 'pending' | 'paid';
    weekStart?: Date;
    weekEnd?: Date;
  } = {}) {
    const query: any = {};

    if (filters.vendor_id) {
      query.vendor_id = filters.vendor_id;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.weekStart || filters.weekEnd) {
      query.weekStart = {};
      if (filters.weekStart) query.weekStart.$gte = filters.weekStart;
      if (filters.weekEnd) query.weekStart.$lte = filters.weekEnd;
    }

    const bills = await Billing.find(query)
      .populate('vendor_id', 'name email')
      .populate('paidBy', 'name email')
      .sort({ weekStart: -1 });

    return bills;
  }

  // Get bill by ID
  static async getBillById(bill_id: string) {
    const bill = await Billing.findById(bill_id)
      .populate('vendor_id', 'name email')
      .populate('paidBy', 'name email')
      .populate('orders');

    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    return bill;
  }
}

