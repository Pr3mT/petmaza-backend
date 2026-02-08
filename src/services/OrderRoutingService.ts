import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import VendorProductPricing from '../models/VendorProductPricing';
import { AppError } from '../middlewares/errorHandler';
import { IOrderItem } from '../types';

export class OrderRoutingService {
  /**
   * Route order based on business rules:
   * 1. Prime products → Prime Vendor only
   * 2. Normal products → Check My Shop first, then Normal Vendors
   * 3. Split shipments if My Shop has partial availability
   */
  static async routeOrder(data: {
    customer_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
    }>;
    customerPincode: string;
    customerAddress: {
      street: string;
      city: string;
      state: string;
      pincode: string;
    };
  }) {
    const { customer_id, items, customerPincode, customerAddress } = data;

    // Fetch all products
    const productIds = items.map((item) => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } });

    // Check if order contains prime products
    const hasPrimeProducts = products.some((p) => p.isPrime);
    const hasNormalProducts = products.some((p) => !p.isPrime);

    // Prime products cannot be mixed with normal products
    if (hasPrimeProducts && hasNormalProducts) {
      throw new AppError('Prime products cannot be mixed with normal products', 400);
    }

    // Prime products: route to Prime Vendor
    if (hasPrimeProducts) {
      return await this.routePrimeOrder(customer_id, items, customerPincode, customerAddress);
    }

    // Normal products: route with My Shop priority
    return await this.routeNormalOrder(customer_id, items, customerPincode, customerAddress);
  }

  /**
   * Route prime order to Prime Vendor
   */
  private static async routePrimeOrder(
    customer_id: string,
    items: Array<{ product_id: string; quantity: number }>,
    customerPincode: string,
    customerAddress: any
  ) {
    // Find Prime Vendor
    const primeVendor = await User.findOne({
      role: 'vendor',
      vendorType: 'PRIME',
      isApproved: true,
    });

    if (!primeVendor) {
      throw new AppError('No Prime Vendor available', 404);
    }

    // Build order items with pricing
    const orderItems = await this.buildOrderItems(items, primeVendor._id.toString());

    // Calculate totals
    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
    const totalProfit = total - totalPurchasePrice;

    // Create order - broadcast to all Prime vendors (first come first serve)
    const order = await Order.create({
      customer_id,
      items: orderItems,
      total,
      totalPurchasePrice,
      totalProfit,
      status: 'PENDING',
      isPrime: true,
      isSplitShipment: false,
      // Don't assign to specific vendor - let first vendor accept
      customerPincode,
      customerAddress,
    });

    return order;
  }

  /**
   * Route normal order with Warehouse priority and split shipment support
   */
  private static async routeNormalOrder(
    customer_id: string,
    items: Array<{ product_id: string; quantity: number }>,
    customerPincode: string,
    customerAddress: any
  ) {
    // Find Warehouse (try WAREHOUSE first, fallback to MY_SHOP for backward compatibility)
    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    const warehouseVendorId = warehouse?._id.toString();

    // Check Warehouse availability
    let warehouseItems: IOrderItem[] = [];
    let remainingItems: Array<{ product_id: string; quantity: number }> = [];

    if (warehouseVendorId) {
      const availability = await this.checkWarehouseAvailability(items, warehouseVendorId);
      warehouseItems = availability.availableItems;
      remainingItems = availability.remainingItems;
    } else {
      remainingItems = items;
    }

    // If Warehouse has all items, create single order
    if (remainingItems.length === 0 && warehouseItems.length > 0) {
      const total = warehouseItems.reduce((sum, item) => sum + item.subtotal, 0);
      const totalPurchasePrice = warehouseItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
      const totalProfit = total - totalPurchasePrice;

      const order = await Order.create({
        customer_id,
        items: warehouseItems,
        total,
        totalPurchasePrice,
        totalProfit,
        status: 'PENDING',
        isPrime: false,
        isSplitShipment: false,
        // Don't assign to specific vendor - let first vendor accept
        customerPincode,
        customerAddress,
      });

      return order;
    }

    // Split shipment: Warehouse + Normal Vendors
    const orders: any[] = [];

    // Create Warehouse order if items available
    if (warehouseItems.length > 0 && warehouseVendorId) {
      const total = warehouseItems.reduce((sum, item) => sum + item.subtotal, 0);
      const totalPurchasePrice = warehouseItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
      const totalProfit = total - totalPurchasePrice;

      const warehouseOrder = await Order.create({
        customer_id,
        items: warehouseItems,
        total,
        totalPurchasePrice,
        totalProfit,
        status: 'PENDING',
        isPrime: false,
        isSplitShipment: true,
        assignedVendorId: warehouseVendorId,
        customerPincode,
        customerAddress,
      });

      orders.push(warehouseOrder);
    }

    // Route remaining items to Normal Vendors
    if (remainingItems.length > 0) {
      const normalVendorOrder = await this.routeToNormalVendors(
        customer_id,
        remainingItems,
        customerPincode,
        customerAddress
      );

      if (normalVendorOrder) {
        normalVendorOrder.isSplitShipment = true;
        await normalVendorOrder.save();
        orders.push(normalVendorOrder);
      }
    }

    // If split shipment, create parent order record
    if (orders.length > 1) {
      const parentOrder = await Order.create({
        customer_id,
        items: [], // Parent order has no items
        total: orders.reduce((sum, o) => sum + o.total, 0),
        totalPurchasePrice: orders.reduce((sum, o) => sum + o.totalPurchasePrice, 0),
        totalProfit: orders.reduce((sum, o) => sum + o.totalProfit, 0),
        status: 'PENDING',
        isPrime: false,
        isSplitShipment: true,
        childOrderIds: orders.map((o) => o._id),
        customerPincode,
        customerAddress,
        deliveryCost: 50, // Extra delivery cost for split shipment
      });

      // Update child orders with parent reference
      await Order.updateMany(
        { _id: { $in: orders.map((o) => o._id) } },
        { parentOrderId: parentOrder._id }
      );

      return parentOrder;
    }

    return orders[0];
  }

  /**
   * Route to Normal Vendors (broadcast to all vendors - first come first serve)
   */
  private static async routeToNormalVendors(
    customer_id: string,
    items: Array<{ product_id: string; quantity: number }>,
    customerPincode: string,
    customerAddress: any
  ) {
    // Find Normal Vendors
    const vendorDetails = await VendorDetails.find({
      vendorType: 'NORMAL',
      isApproved: true,
    });

    if (vendorDetails.length === 0) {
      throw new AppError('No Normal Vendors available', 404);
    }

    // Check if at least one vendor has all products available
    let hasAvailableVendor = false;
    for (const vd of vendorDetails) {
      const vendorId = vd.vendor_id.toString();
      const hasAllProducts = await this.checkVendorHasAllProducts(items, vendorId);
      if (hasAllProducts) {
        hasAvailableVendor = true;
        break;
      }
    }

    if (!hasAvailableVendor) {
      throw new AppError('No vendor has all products available', 404);
    }

    // Build order items using first available vendor's pricing (for calculation)
    // Actual vendor will be determined when order is accepted
    const firstVendorId = vendorDetails[0].vendor_id.toString();
    const orderItems = await this.buildOrderItems(items, firstVendorId);

    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
    const totalProfit = total - totalPurchasePrice;

    // Create order - broadcast to all eligible vendors (first come first serve)
    // No assignedVendorId - any vendor who can fulfill can accept
    const order = await Order.create({
      customer_id,
      items: orderItems,
      total,
      totalPurchasePrice,
      totalProfit,
      status: 'PENDING',
      isPrime: false,
      isSplitShipment: false,
      // Don't assign to specific vendor - let first vendor accept
      customerPincode,
      customerAddress,
    });

    return order;
  }

  /**
   * Check Warehouse availability
   */
  private static async checkWarehouseAvailability(
    items: Array<{ product_id: string; quantity: number }>,
    warehouseVendorId: string
  ) {
    const availableItems: IOrderItem[] = [];
    const remainingItems: Array<{ product_id: string; quantity: number }> = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      
      if (!product) {
        remainingItems.push(item);
        continue;
      }

      // For MY_SHOP, check product.isActive directly
      let isAvailable = false;
      
      if (product.hasVariants && product.variants) {
        // For variant products, check if at least one variant is active
        isAvailable = product.isActive && product.variants.some((v: any) => v.isActive);
      } else {
        // For non-variant products, check product.isActive
        isAvailable = product.isActive === true;
      }

      if (isAvailable) {
        // Get pricing info - use variant pricing if available, otherwise product pricing
        let sellingPrice = product.sellingPrice || 0;
        let purchasePrice = product.purchasePrice || 0;
        
        if (product.hasVariants && product.variants && product.variants.length > 0) {
          // Use first active variant's pricing
          const activeVariant = product.variants.find((v: any) => v.isActive);
          if (activeVariant) {
            sellingPrice = activeVariant.sellingPrice || (activeVariant.mrp * ((activeVariant.sellingPercentage || 80) / 100));
            purchasePrice = activeVariant.purchasePrice || (activeVariant.mrp * ((activeVariant.purchasePercentage || 60) / 100));
          }
        }

        const orderItem = await this.buildOrderItem(
          item.product_id,
          item.quantity,
          warehouseVendorId,
          sellingPrice,
          purchasePrice
        );
        availableItems.push(orderItem);
      } else {
        remainingItems.push(item);
      }
    }

    return { availableItems, remainingItems };
  }

  /**
   * Check if vendor has all products
   */
  private static async checkVendorHasAllProducts(
    items: Array<{ product_id: string; quantity: number }>,
    vendorId: string
  ): Promise<boolean> {
    // Check if this is MY_SHOP vendor
    const vendor = await User.findById(vendorId);
    const isMyShop = vendor && ['WAREHOUSE', 'MY_SHOP'].includes(vendor.vendorType);

    if (isMyShop) {
      // For MY_SHOP, check product availability directly
      for (const item of items) {
        const product = await Product.findById(item.product_id);
        if (!product || !product.isActive) {
          return false;
        }
        
        // For variant products, check if at least one variant is active
        if (product.hasVariants && product.variants) {
          const hasActiveVariant = product.variants.some((v: any) => v.isActive);
          if (!hasActiveVariant) {
            return false;
          }
        }
      }
      return true;
    } else {
      // For other vendors, check VendorProductPricing
      for (const item of items) {
        const pricing = await VendorProductPricing.findOne({
          vendor_id: vendorId,
          product_id: item.product_id,
          isActive: true,
          availableStock: { $gte: item.quantity },
        });

        if (!pricing) {
          return false;
        }
      }
      return true;
    }
  }

  /**
   * Build order items with pricing
   */
  private static async buildOrderItems(
    items: Array<{ product_id: string; quantity: number }>,
    vendorId: string
  ): Promise<IOrderItem[]> {
    const orderItems: IOrderItem[] = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      if (!product) {
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }

      const pricing = await VendorProductPricing.findOne({
        vendor_id: vendorId,
        product_id: item.product_id,
        isActive: true,
      });

      if (!pricing) {
        throw new AppError(`Product ${item.product_id} not available from vendor`, 404);
      }

      if (pricing.availableStock < item.quantity) {
        throw new AppError(`Insufficient stock for product ${product.name}`, 400);
      }

      const orderItem = await this.buildOrderItem(
        item.product_id,
        item.quantity,
        vendorId,
        product.sellingPrice,
        pricing.purchasePrice
      );

      orderItems.push(orderItem);
    }

    return orderItems;
  }

  /**
   * Build single order item
   */
  private static async buildOrderItem(
    product_id: string,
    quantity: number,
    vendor_id: string,
    sellingPrice: number,
    purchasePrice: number
  ): Promise<IOrderItem> {
    const subtotal = sellingPrice * quantity;
    const purchaseSubtotal = purchasePrice * quantity;
    const profit = subtotal - purchaseSubtotal;
    const profitPercentage = (profit / subtotal) * 100;

    return {
      product_id: product_id.toString(),
      vendor_id: vendor_id.toString(),
      quantity,
      sellingPrice,
      purchasePrice,
      subtotal,
      purchaseSubtotal,
      profit,
      profitPercentage,
    };
  }
}

