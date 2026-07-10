import Wallet from '../models/Wallet';
import Order from '../models/Order';
import ShippingDetails from '../models/ShippingDetails';
import { AppError } from '../middlewares/errorHandler';

export class WalletService {
  // Get or create wallet for vendor
  static async getOrCreateWallet(vendor_id: string) {
    let wallet = await Wallet.findOne({ vendor_id });

    if (!wallet) {
      wallet = await Wallet.create({
        vendor_id,
        balance: 0,
        totalEarnings: 0,
      });
    }

    return wallet;
  }

  // Add earnings to wallet (called after order delivery)
  static async addEarnings(vendor_id: string, order_id: string, amount: number) {
    const wallet = await this.getOrCreateWallet(vendor_id);

    wallet.balance += amount;
    wallet.totalEarnings += amount;

    await wallet.save();

    return wallet;
  }

  // Get wallet balance
  static async getWalletBalance(vendor_id: string) {
    const wallet = await this.getOrCreateWallet(vendor_id);
    return wallet;
  }

  // Reset wallet after billing
  static async resetWallet(vendor_id: string) {
    const wallet = await this.getOrCreateWallet(vendor_id);

    wallet.balance = 0;
    wallet.lastBillingDate = new Date();

    await wallet.save();

    return wallet;
  }

  // Get vendor earnings from orders
  static async getVendorEarnings(vendor_id: string, startDate?: Date, endDate?: Date) {
    const query: any = {
      $or: [
        { assignedVendorId: vendor_id },
        { assignedVendors: vendor_id },
      ],
      status: 'DELIVERED',
    };

    if (startDate || endDate) {
      query.deliveredAt = {};
      if (startDate) query.deliveredAt.$gte = startDate;
      if (endDate) query.deliveredAt.$lte = endDate;
    }

    const orders = await Order.find(query);

    // Earnings = accepted purchase prices + the courier costs the vendor
    // submitted in shipping details (reimbursed like the order screens show).
    const shippingDocs = await ShippingDetails.find({
      order_id: { $in: orders.map((o) => o._id) },
      vendor_id,
    })
      .select('shipping_cost')
      .lean();
    const deliveryTotal = shippingDocs.reduce((s, sd) => s + (Number(sd.shipping_cost) || 0), 0);

    const totalEarnings = orders.reduce((sum, order) => {
      const vendorItems = order.items.filter(
        (item) => item.vendor_id?.toString() === vendor_id
      );
      return sum + vendorItems.reduce((s, item) => s + item.purchaseSubtotal, 0);
    }, 0) + deliveryTotal;

    return {
      orders: orders.length,
      totalEarnings,
      ordersList: orders,
    };
  }
}

