import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus, PaymentStatus } from '../types';

const orderItemSchema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    profit: {
      type: Number,
      required: true,
    },
    profitPercentage: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: any[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPurchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalProfit: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ASSIGNED',
        'ACCEPTED',
        'REJECTED',
        'PACKED',
        'PICKED_UP',
        'IN_TRANSIT',
        'DELIVERED',
        'CANCELLED',
      ],
      default: 'PENDING',
      required: true,
    },
    isPrime: {
      type: Boolean,
      default: false,
    },
    isSplitShipment: {
      type: Boolean,
      default: false,
    },
    parentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    childOrderIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Order',
      default: [],
    },
    payment_status: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    payment_gateway: {
      type: String,
      default: 'razorpay',
    },
    payment_id: {
      type: String,
    },
    payment_link: {
      type: String,
    },
    courier: {
      name: String,
      tracking_id: String,
      status: String,
    },
    assignedVendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedVendors: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    acceptanceDeadline: {
      type: Date,
    },
    customerPincode: {
      type: String,
      required: true,
    },
    customerAddress: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
        required: true,
      },
    },
    deliveryCost: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderSchema.index({ customer_id: 1 });
orderSchema.index({ assignedVendorId: 1 });
orderSchema.index({ assignedVendors: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ isPrime: 1 });
orderSchema.index({ customerPincode: 1 });
orderSchema.index({ acceptanceDeadline: 1 });
orderSchema.index({ parentOrderId: 1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
