import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'vendor' | 'customer';
  vendorType?: 'PRIME' | 'NORMAL' | 'MY_SHOP';
  pincodesServed?: string[];
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWeightVariant {
  _id?: Types.ObjectId | string; // Unique ID for each variant
  weight: number; // in grams (e.g., 200, 500, 1000, 5000)
  unit: string; // e.g., 'g', 'kg'
  displayWeight: string; // e.g., '200g', '1kg', '5kg'
  mrp: number;
  sellingPercentage: number; // e.g., 80 means 80% of MRP
  sellingPrice: number; // auto-calculated: MRP * (sellingPercentage / 100)
  discount: number; // auto-calculated: ((MRP - sellingPrice) / MRP) * 100
  purchasePercentage: number; // e.g., 60 means 60% of MRP (your cost)
  purchasePrice: number; // auto-calculated: MRP * (purchasePercentage / 100)
  isActive: boolean;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  category_id: Types.ObjectId | string;
  brand_id: Types.ObjectId | string;
  // Single weight product fields
  weight?: number; // in grams
  unit?: string; // 'g', 'kg', 'ml', 'l'
  mrp?: number;
  sellingPercentage?: number;
  sellingPrice?: number;
  discount?: number;
  purchasePercentage?: number;
  purchasePrice?: number;
  // Variant system (DEPRECATED - keeping for backward compatibility)
  hasVariants: boolean;
  variants: IWeightVariant[];
  // New separate product approach for variants
  parentProduct?: Types.ObjectId | string; // Link to parent product if this is a variant
  variantInfo?: {
    weight: number;
    unit: string;
    displayWeight: string;
  };
  isPrime: boolean; // Prime products: Buy Now only, no cart
  primeVendor_id?: Types.ObjectId | string; // Prime vendor who handles this product
  images: string[];
  isActive: boolean;
  inStock?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  product_id: Types.ObjectId | string;
  vendor_id?: Types.ObjectId | string;
  quantity: number;
  // Weight variant information
  selectedWeight?: number; // weight in grams (e.g., 500, 1000)
  selectedVariant?: {
    weight: number;
    unit: string;
    displayWeight: string;
  };
  sellingPrice: number; // Global selling price
  purchasePrice: number; // Vendor-specific purchase price
  subtotal: number; // quantity * sellingPrice
  purchaseSubtotal: number; // quantity * purchasePrice
  profit: number; // subtotal - purchaseSubtotal
  profitPercentage: number; // (profit / subtotal) * 100
}

export type OrderStatus = 
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PACKED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export interface IOrder extends Document {
  customer_id: Types.ObjectId | string;
  items: IOrderItem[];
  total: number; // Total selling price
  totalPurchasePrice: number; // Total vendor purchase price
  totalProfit: number; // Total profit
  status: OrderStatus;
  isPrime: boolean; // True if order contains only prime products
  isSplitShipment: boolean; // True if order is split across vendors
  parentOrderId?: Types.ObjectId | string; // For split shipments, link to parent order
  childOrderIds?: (Types.ObjectId | string)[]; // For parent orders, list of child orders
  payment_status: PaymentStatus;
  payment_gateway?: string;
  payment_id?: string;
  payment_link?: string;
  courier?: {
    name?: string;
    tracking_id?: string;
    status?: string;
  };
  assignedVendorId?: Types.ObjectId | string; // For single vendor orders
  assignedVendors?: (Types.ObjectId | string)[]; // For split shipments
  acceptanceDeadline?: Date;
  customerPincode: string;
  customerAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  deliveryCost?: number; // Extra delivery cost for split shipments
  createdAt: Date;
  updatedAt: Date;
}

// Vendor variant stock tracking
export interface IVendorVariantStock {
  weight: number;
  unit: string;
  displayWeight: string;
  availableStock: number;
  totalSoldWebsite: number;
  totalSoldStore: number;
  isActive: boolean;
}

// Vendor-wise product pricing (CRITICAL: Different purchase rates per vendor)
export interface IVendorProductPricing extends Document {
  vendor_id: Types.ObjectId | string;
  product_id: Types.ObjectId | string;
  purchasePercentage: number; // e.g., 50 means 50% of MRP (legacy for single-weight products)
  purchasePrice: number; // auto-calculated: MRP * (purchasePercentage / 100) (legacy)
  availableStock: number; // legacy for single-weight products
  totalSoldWebsite: number; // legacy
  totalSoldStore: number; // legacy
  isActive: boolean; // legacy for single-weight products
  
  // New: For variant products
  variantStock?: IVendorVariantStock[]; // Stock tracking per weight variant
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IVendorDetails extends Document {
  vendor_id: Types.ObjectId | string;
  vendorType: 'PRIME' | 'NORMAL' | 'MY_SHOP';
  shopName: string;
  brandsHandled: (Types.ObjectId | string)[]; // Brand IDs
  pickupAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  serviceablePincodes: string[];
  panCard?: string;
  aadharCard?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    accountHolderName: string;
  };
  billingDetails?: {
    gstNumber?: string;
    billingAddress?: string;
  };
  isApproved: boolean;
  approvedBy?: Types.ObjectId | string; // Admin user ID
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Nested categories support
export interface ICategory extends Document {
  name: string;
  description?: string;
  image?: string;
  parentCategoryId?: string; // For nested categories
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBrand extends Document {
  name: string;
  description?: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceRequest extends Document {
  customerId: Types.ObjectId | string;
  serviceType: 'bird_dna';
  customerName: string;
  farm: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  birds: Array<{
    ringId: string;
    species: string;
    collectionDateTime: Date;
    notes?: string;
  }>;
  pickupAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  extraNote?: string;
  status: 'pending' | 'pickup_scheduled' | 'picked_up' | 'delivered' | 'completed';
  pickupRequestId?: string;
  payment_id?: string;
  payment_status: PaymentStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = 
  | 'express_delivery'
  | 'standard_delivery'
  | 'prime_product'
  | 'bird_dna_service'
  | 'other_service';

export interface ITransaction extends Document {
  transactionId: string;
  customerId: Types.ObjectId | string;
  orderId?: string;
  serviceRequestId?: string;
  transactionType: TransactionType;
  amount: number;
  payment_id: string;
  payment_gateway: string;
  payment_status: PaymentStatus;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Wallet system for vendors
export interface IWallet extends Document {
  vendor_id: Types.ObjectId | string;
  balance: number; // Current wallet balance
  totalEarnings: number; // Total earnings (never resets)
  lastBillingDate?: Date; // Last time wallet was reset
  createdAt: Date;
  updatedAt: Date;
}

// Weekly billing system
export interface IBilling extends Document {
  vendor_id: Types.ObjectId | string;
  weekStart: Date;
  weekEnd: Date;
  orders: (Types.ObjectId | string)[]; // Order IDs included in this billing
  totalAmount: number; // Total amount to be paid
  status: 'pending' | 'paid';
  paidAt?: Date;
  paidBy?: Types.ObjectId | string; // Admin user ID
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Complaints & Support
export interface IComplaint extends Document {
  customer_id: Types.ObjectId | string;
  order_id: Types.ObjectId | string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: Types.ObjectId | string; // Admin user ID
  vendorNotified?: boolean;
  vendor_id?: Types.ObjectId | string; // If complaint involves vendor
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId | string; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

// Settlement
export interface ISettlement extends Document {
  vendorId: Types.ObjectId | string;
  weekStart: Date;
  orders: (Types.ObjectId | string)[];
  totalDue: number;
  status: 'pending' | 'processed' | 'paid';
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Vendor Product
export interface IVendorProductVariantStock {
  weight: number; // in grams
  quantity: number;
  status: 'active' | 'inactive';
}

export interface IVendorProduct extends Document {
  vendor_id: Types.ObjectId | string;
  product_id: Types.ObjectId | string;
  warehouse_cost: number;
  shop_cost: number;
  // Legacy single quantity (for products without variants)
  quantity: number;
  status: 'active' | 'inactive';
  // New variant stock management
  variantStock: IVendorProductVariantStock[];
  createdAt: Date;
  updatedAt: Date;
}

// Product Reviews
export interface IReview extends Document {
  product_id: Types.ObjectId | string;
  customer_id: Types.ObjectId | string;
  order_id: Types.ObjectId | string;
  rating: number; // 1-5 stars
  title?: string;
  comment?: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  status: 'pending' | 'approved' | 'rejected';
  moderatedBy?: Types.ObjectId | string;
  moderatedAt?: Date;
  vendorResponse?: {
    comment: string;
    respondedAt: Date;
    respondedBy: Types.ObjectId | string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Product Q&A
export interface IAnswer {
  answeredBy: Types.ObjectId | string;
  answerText: string;
  isVendorAnswer: boolean;
  helpfulCount: number;
  createdAt: Date;
}

export interface IProductQuestion extends Document {
  product_id: Types.ObjectId | string;
  customer_id: Types.ObjectId | string;
  questionText: string;
  answers: IAnswer[];
  status: 'pending' | 'answered' | 'closed';
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice
export interface IInvoice extends Document {
  invoiceNumber: string;
  order_id: Types.ObjectId | string;
  customer_id: Types.ObjectId | string;
  invoiceDate: Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  taxPercentage: number;
  deliveryCharge: number;
  totalAmount: number;
  billingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

