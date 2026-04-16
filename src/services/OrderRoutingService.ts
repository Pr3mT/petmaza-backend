import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';
import { IOrderItem } from '../types';
import { sendVendorOrderNotificationEmail } from './emailer';
import logger from '../config/logger';

export class OrderRoutingService {
  /**
   * UPDATED Route order logic:
   * 1. Prime products → Prime Vendor (direct assignment to vendor who added product)
   * 2. Normal products → MY_SHOP/WAREHOUSE_FULFILLER (based on subcategory)
   * 3. Mixed orders (prime + normal) → Split into separate orders per vendor type
   * 4. Multiple prime vendors → Split into separate orders per vendor
   */
  static async routeOrder(data: {
    customer_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
      selectedVariant?: any;
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

    // Create product map for easy lookup
    const productMap = new Map();
    products.forEach(p => productMap.set(p._id.toString(), p));

    // Separate items into prime and normal
    const primeItems: Array<{ product_id: string; quantity: number; selectedVariant?: any }> = [];
    const normalItems: Array<{ product_id: string; quantity: number; selectedVariant?: any }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }
      
      if (product.isPrime) {
        primeItems.push(item);
      } else {
        normalItems.push(item);
      }
    }

    const createdOrders = [];

    // Handle prime products (may create multiple orders for different vendors)
    if (primeItems.length > 0) {
      const primeOrders = await this.routePrimeOrders(customer_id, primeItems, customerPincode, customerAddress, productMap);
      createdOrders.push(...(Array.isArray(primeOrders) ? primeOrders : [primeOrders]));
    }

    // Handle normal products
    if (normalItems.length > 0) {
      const normalOrders = await this.routeNormalOrderToMyShop(customer_id, normalItems, customerPincode, customerAddress);
      createdOrders.push(...(Array.isArray(normalOrders) ? normalOrders : [normalOrders]));
    }

    // Return single order if only one, array if split
    return createdOrders.length === 1 ? createdOrders[0] : createdOrders;
  }

  /**
   * Route prime orders - supports multiple prime vendors (creates split orders)
   * Orders start as PENDING and must be accepted by vendor (like fulfiller flow)
   */
  private static async routePrimeOrders(
    customer_id: string,
    items: Array<{ product_id: string; quantity: number; selectedVariant?: any }>,
    customerPincode: string,
    customerAddress: any,
    productMap: Map<string, any>
  ) {
    // Group items by prime vendor
    const vendorItemsMap = new Map<string, Array<{ product_id: string; quantity: number; selectedVariant?: any }>>();

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product || !product.primeVendor_id) {
        throw new AppError(`Prime product ${item.product_id} has no assigned vendor`, 400);
      }

      const vendorId = product.primeVendor_id.toString();
      
      if (!vendorItemsMap.has(vendorId)) {
        vendorItemsMap.set(vendorId, []);
      }
      vendorItemsMap.get(vendorId)!.push(item);
    }

    const createdOrders = [];
    const isSplitShipment = vendorItemsMap.size > 1;

    // Create one order per vendor
    for (const [vendorId, vendorItems] of vendorItemsMap) {
      // Build order items with pricing
      const orderItems = await this.buildOrderItems(vendorItems, vendorId);

      // Calculate totals
      const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
      const totalProfit = total - totalPurchasePrice;

      // Create order - PENDING status (vendor must accept, like fulfiller flow)
      const order = await Order.create({
        customer_id,
        assignedVendorId: vendorId,
        items: orderItems,
        total,
        totalPurchasePrice,
        totalProfit,
        status: 'PENDING',  // ✅ Prime vendor must accept order (like fulfiller flow)
        isPrime: true,
        isSplitShipment,
        customerPincode,
        customerAddress,
      });

      createdOrders.push(order);
      logger.info(`[routePrimeOrders] ✅ Prime order ${order._id} created for vendor ${vendorId} (status: PENDING)`);

      // Send vendor notification
      try {
        const vendor = await User.findById(vendorId);
        const customer = await User.findById(customer_id);
        
        if (vendor) {
          sendVendorOrderNotificationEmail(
            vendor.email,
            vendor.name || 'Prime Vendor',
            `#${order._id.toString().slice(-8)}`,
            {
              customerName: customer?.name || 'Customer',
              totalAmount: order.total,
              customerAddress,
              customerPincode,
              items: orderItems,
            }
          ).then(() => logger.info('[routePrimeOrders] 📧 Vendor notification sent'))
           .catch((e: any) => logger.error('[routePrimeOrders] Failed to send vendor notification:', e.message));
        }
      } catch (emailError: any) {
        logger.error('[routePrimeOrders] Failed to send vendor notification:', emailError.message);
      }
    }

    return createdOrders.length === 1 ? createdOrders[0] : createdOrders;
  }

  /**
   * Route normal order to WAREHOUSE_FULFILLER based on assigned subcategories
   * NEW: Broadcast to ALL fulfillers handling each subcategory (first-come-first-serve)
   * Supports multiple fulfillers per subcategory for competitive acceptance
   */
  private static async routeNormalOrderToMyShop(
    customer_id: string,
    items: Array<{ product_id: string; quantity: number; selectedVariant?: any }>,
    customerPincode: string,
    customerAddress: any
  ) {
    // Fetch all products with subcategory information
    const productIds = items.map((item) => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    // Create product map for easy lookup
    const productMap = new Map();
    products.forEach(p => productMap.set(p._id.toString(), p));

    // Get all subcategories in this order
    const orderSubcategories = [...new Set(products.map(p => p.subCategory).filter(Boolean))];
    logger.info(`[routeNormalOrderToMyShop] Order contains subcategories:`, orderSubcategories);

    // Find all active WAREHOUSE_FULFILLER users
    const warehouseFulfillers = await User.find({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
      isApproved: true,
    }).lean();

    if (warehouseFulfillers.length > 0) {
      // Get vendor details with assigned subcategories
      const fulfillerIds = warehouseFulfillers.map(f => f._id);
      const vendorDetailsArray = await VendorDetails.find({
        vendor_id: { $in: fulfillerIds },
      }).lean();

      // NEW: Group items by SUBCATEGORY (not by individual fulfiller)
      // Multiple fulfillers can compete for same subcategory
      const subcategoryItemsMap = new Map(); // subcategory -> { items, eligibleFulfillers }
      const unassignedItems = [];

      // First, group items by subcategory and find ALL eligible fulfillers for each
      for (const item of items) {
        const product = productMap.get(item.product_id);
        if (!product || !product.subCategory) {
          logger.warn(`[routeNormalOrderToMyShop] Product ${item.product_id} has no subcategory, will route to MY_SHOP`);
          unassignedItems.push(item);
          continue;
        }

        const subcategory = product.subCategory;

        // Find ALL fulfillers who can handle this subcategory
        const eligibleFulfillers = [];
        for (const fulfiller of warehouseFulfillers) {
          const details = vendorDetailsArray.find(
            vd => vd.vendor_id.toString() === fulfiller._id.toString()
          );

          if (details && details.assignedSubcategories && 
              details.assignedSubcategories.includes(subcategory)) {
            eligibleFulfillers.push(fulfiller);
          }
        }

        if (eligibleFulfillers.length > 0) {
          if (!subcategoryItemsMap.has(subcategory)) {
            subcategoryItemsMap.set(subcategory, {
              items: [],
              eligibleFulfillers: eligibleFulfillers,
            });
          }
          subcategoryItemsMap.get(subcategory).items.push(item);
          logger.info(`[routeNormalOrderToMyShop] ${product.name} (${subcategory}) → ${eligibleFulfillers.length} eligible fulfiller(s)`);
        } else {
          logger.warn(`[routeNormalOrderToMyShop] No fulfiller handles ${subcategory}, will route to MY_SHOP`);
          unassignedItems.push(item);
        }
      }

      // NEW: Create broadcast orders per SUBCATEGORY (not per fulfiller)
      // Multiple fulfillers compete for each order (first-come-first-serve)
      const createdOrders = [];
      const isSplitShipment = subcategoryItemsMap.size > 1 || (subcategoryItemsMap.size > 0 && unassignedItems.length > 0);

      // Create one order per subcategory group - broadcast to all eligible fulfillers
      for (const [subcategory, { items: subcategoryItems, eligibleFulfillers }] of subcategoryItemsMap) {
        logger.info(`[routeNormalOrderToMyShop] Creating broadcast order for ${subcategory} (${eligibleFulfillers.length} eligible fulfillers)`);

        // Build order items with pricing - use first fulfiller for price calculation
        const orderItems = await this.buildOrderItems(subcategoryItems, eligibleFulfillers[0]._id.toString());

        // Calculate totals
        const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
        const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
        const totalProfit = total - totalPurchasePrice;

        // Calculate acceptance deadline (5 minutes from now)
        const acceptanceDeadline = new Date(Date.now() + 5 * 60 * 1000);

        // Create order - NOT assigned to specific fulfiller (competitive acceptance)
        const order = await Order.create({
          customer_id,
          items: orderItems,
          total,
          totalPurchasePrice,
          totalProfit,
          status: 'PENDING', // Warehouse fulfiller needs to accept
          isPrime: false,
          isSplitShipment,
          assignedVendorId: null, // NOT assigned yet - first to accept gets it
          acceptanceDeadline, // Deadline for acceptance
          customerPincode,
          customerAddress,
        });

        createdOrders.push(order);
        logger.info(`[routeNormalOrderToMyShop] ✅ Broadcast order ${order._id} created for ${subcategory} (${eligibleFulfillers.length} competing fulfillers)`);

        // Broadcast notification to ALL eligible fulfillers for this subcategory
        try {
          const populatedOrder = await order.populate('customer_id');
          const customer = populatedOrder.customer_id as any;

          for (const fulfiller of eligibleFulfillers) {
            try {
              sendVendorOrderNotificationEmail(
                fulfiller.email,
                fulfiller.name || 'Warehouse Fulfiller',
                `#${order._id.toString().slice(-8)}`,
                {
                  customerName: customer?.name || 'Customer',
                  totalAmount: order.total,
                  customerAddress: customerAddress,
                  customerPincode: customerPincode,
                  items: orderItems,
                  isCompetitive: true,
                  competitorCount: eligibleFulfillers.length,
                  acceptanceDeadline: acceptanceDeadline.toISOString(),
                }
              ).then(() => logger.info(`[routeNormalOrderToMyShop] 📢 Broadcast notification sent to ${fulfiller.name} (${fulfiller.email})`))
               .catch((e: any) => logger.error(`[routeNormalOrderToMyShop] Failed to notify ${fulfiller.email}:`, e.message));
            } catch (emailError: any) {
              logger.error(`[routeNormalOrderToMyShop] Failed to notify ${fulfiller.email}:`, emailError.message);
            }
          }
        } catch (emailError: any) {
          logger.error('[routeNormalOrderToMyShop] Failed to broadcast order notifications:', emailError.message);
        }
      }

      // Handle unassigned items - route to MY_SHOP
      if (unassignedItems.length > 0) {
        logger.info(`[routeNormalOrderToMyShop] ${unassignedItems.length} unassigned items, routing to MY_SHOP vendor`);
        
        const myShopVendor = await User.findOne({
          role: 'vendor',
          vendorType: 'MY_SHOP',
          isApproved: true,
        });

        if (myShopVendor) {
          const orderItems = await this.buildOrderItems(unassignedItems, myShopVendor._id.toString());
          const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
          const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
          const totalProfit = total - totalPurchasePrice;

          const order = await Order.create({
            customer_id,
            items: orderItems,
            total,
            totalPurchasePrice,
            totalProfit,
            status: 'ACCEPTED', // MY_SHOP auto-accepts
            isPrime: false,
            isSplitShipment,
            assignedVendorId: myShopVendor._id,
            customerPincode,
            customerAddress,
          });

          createdOrders.push(order);
          logger.info(`[routeNormalOrderToMyShop] ✅ MY_SHOP order ${order._id} created (${unassignedItems.length} items, ₹${total})`);

          // Record sales for MY_SHOP items
          const { SalesService } = await import('./SalesService');
          for (const item of order.items) {
            try {
              await SalesService.recordSale({
                vendor_id: myShopVendor._id.toString(),
                product_id: (item.product_id as any)._id.toString(),
                quantity: item.quantity,
                salePrice: item.price,
                purchasePrice: item.purchasePrice,
                profit: item.profit,
                customer_id,
                order_id: order._id.toString(),
              });
            } catch (error: any) {
              logger.error('[routeNormalOrderToMyShop] Failed to record sale:', error.message);
            }
          }
        }
      }

      // Return ALL created orders (for split shipment handling)
      if (createdOrders.length > 0) {
        logger.info(`[routeNormalOrderToMyShop] ✅ Split order completed: ${createdOrders.length} separate orders created`);
        // Return array of orders if split, single order if not
        return createdOrders.length > 1 ? createdOrders : createdOrders[0];
      }
    }

    // Fallback: If no warehouse fulfillers exist at all, route everything to MY_SHOP vendor
    logger.info('[routeNormalOrderToMyShop] No warehouse fulfillers available, routing entire order to MY_SHOP vendor');
    
    const myShopVendor = await User.findOne({
      role: 'vendor',
      vendorType: 'MY_SHOP',
      isApproved: true,
    });

    if (!myShopVendor) {
      throw new AppError('No fulfillment partner or shop vendor available. Please contact admin.', 404);
    }

    // Build order items with pricing (using product's own pricing)
    const orderItems = await this.buildOrderItems(items, myShopVendor._id.toString());

    // Calculate totals
    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalPurchasePrice = orderItems.reduce((sum, item) => sum + item.purchaseSubtotal, 0);
    const totalProfit = total - totalPurchasePrice;

    // Create order - directly assigned to MY_SHOP, status ACCEPTED (no pending)
    const order = await Order.create({
      customer_id,
      items: orderItems,
      total,
      totalPurchasePrice,
      totalProfit,
      status: 'ACCEPTED', // Directly accepted by MY_SHOP, no waiting
      isPrime: false,
      isSplitShipment: false,
      assignedVendorId: myShopVendor._id, // Direct assignment
      customerPincode,
      customerAddress,
    });

    // Import SalesService at runtime to avoid circular dependency
    const { SalesService } = await import('./SalesService');

    // Record sales in history for each item and reduce stock
    for (const item of order.items) {
      try {
        await SalesService.recordSale({
          vendor_id: myShopVendor._id.toString(),
          product_id: item.product_id.toString(),
          quantity: item.quantity,
          saleType: 'WEBSITE',
          soldBy: myShopVendor._id.toString(), // MY_SHOP vendor
          order_id: order._id.toString(),
          sellingPrice: item.sellingPrice,
          selectedVariant: item.selectedVariant,
        });
      } catch (error) {
        logger.error(`Failed to record sale for product ${item.product_id}:`, error);
        // Log error but allow order creation to continue
        // Stock reduction failure shouldn't block the order
      }
    }

    logger.info(`Order ${order._id} routed directly to MY_SHOP ${myShopVendor._id}`);
    return order;
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
    items: Array<{ product_id: string; quantity: number; selectedVariant?: any }>,
    warehouseVendorId: string
  ) {
    const availableItems: IOrderItem[] = [];
    const remainingItems: Array<{ product_id: string; quantity: number; selectedVariant?: any }> = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      
      if (!product) {
        remainingItems.push(item);
        continue;
      }

      // Check if product/variant is available
      let isAvailable = false;
      let sellingPrice = 0;
      let purchasePrice = 0;
      
      if (item.selectedVariant && product.hasVariants && product.variants) {
        // Check specific variant availability (support size or weight+unit)
        const variant = product.variants.find((v: any) => {
          if (item.selectedVariant.size && v.size) return v.size === item.selectedVariant.size;
          if (item.selectedVariant.weight !== undefined && item.selectedVariant.unit) return v.weight === item.selectedVariant.weight && v.unit === item.selectedVariant.unit;
          return false;
        });
        
        if (variant && variant.isActive && product.isActive) {
          isAvailable = true;
          sellingPrice = variant.sellingPrice || Math.round((variant.mrp * (variant.sellingPercentage / 100)) * 100) / 100;
          purchasePrice = Math.round((variant.mrp * (variant.purchasePercentage / 100)) * 100) / 100;
        }
      } else if (product.hasVariants && product.variants && product.variants.length > 0) {
        // No specific variant selected, check if any variant is active
        const activeVariant = product.variants.find((v: any) => v.isActive);
        if (activeVariant && product.isActive) {
          isAvailable = true;
          sellingPrice = activeVariant.sellingPrice || Math.round((activeVariant.mrp * (activeVariant.sellingPercentage / 100)) * 100) / 100;
          purchasePrice = Math.round((activeVariant.mrp * (activeVariant.purchasePercentage / 100)) * 100) / 100;
        }
      } else {
        // Non-variant product
        if (product.isActive) {
          isAvailable = true;
          sellingPrice = product.sellingPrice || 
            (product.mrp && product.sellingPercentage 
              ? Math.round(product.mrp * (product.sellingPercentage / 100))
              : 0);
          purchasePrice = product.purchasePrice ||
            (product.mrp && product.purchasePercentage
              ? Math.round(product.mrp * (product.purchasePercentage / 100))
              : 0);
        }
      }

      if (isAvailable && sellingPrice > 0) {
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
   * In simplified flow, just checks if products exist and are active
   */
  private static async checkVendorHasAllProducts(
    items: Array<{ product_id: string; quantity: number }>,
    vendorId: string
  ): Promise<boolean> {
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
  }

  /**
   * Build order items with pricing
   */
  private static async buildOrderItems(
    items: Array<{ product_id: string; quantity: number; selectedVariant?: any }>,
    vendorId: string
  ): Promise<IOrderItem[]> {
    const orderItems: IOrderItem[] = [];

    // OPTIMIZATION: Fetch all products at once instead of sequential queries
    const productIds = items.map(item => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } });
    
    // Create a map for quick product lookup
    const productMap = new Map();
    products.forEach(product => {
      productMap.set(product._id.toString(), product);
    });

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }

      // Use product's own pricing (set by admin)
      // Calculate sellingPrice from mrp and sellingPercentage if not directly set
      let sellingPrice: number;
      let purchasePrice: number;
      
      if (item.selectedVariant && product.hasVariants) {
        // Use variant pricing - support size-based variants or weight+unit
        const variant = product.variants?.find(v => {
          if (item.selectedVariant.size && v.size) return v.size === item.selectedVariant.size;
          if (item.selectedVariant.weight !== undefined && item.selectedVariant.unit) return v.weight === item.selectedVariant.weight && v.unit === item.selectedVariant.unit;
          return false;
        });

        if (!variant) {
          throw new AppError(`Variant not found for product ${product.name}`, 404);
        }

        sellingPrice = variant.sellingPrice || Math.round((variant.mrp * (variant.sellingPercentage / 100)) * 100) / 100;
        purchasePrice = Math.round((variant.mrp * (variant.purchasePercentage / 100)) * 100) / 100;
      } else {
        // Use product-level pricing
        sellingPrice = product.sellingPrice || 
          (product.mrp && product.sellingPercentage 
            ? Math.round((product.mrp * (product.sellingPercentage / 100)) * 100) / 100
            : 0);
        
        purchasePrice = product.purchasePrice ||
          (product.mrp && product.purchasePercentage
            ? Math.round((product.mrp * (product.purchasePercentage / 100)) * 100) / 100
            : 0);
      }

      if (sellingPrice === 0) {
        throw new AppError(`Product ${product.name} has invalid pricing`, 400);
      }

      const orderItem = await this.buildOrderItem(
        item.product_id,
        item.quantity,
        vendorId,
        sellingPrice,
        purchasePrice,
        item.selectedVariant
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
    purchasePrice: number,
    selectedVariant?: any
  ): Promise<IOrderItem> {
    const subtotal = sellingPrice * quantity;
    const purchaseSubtotal = purchasePrice * quantity;
    const profit = subtotal - purchaseSubtotal;
    const profitPercentage = subtotal > 0 ? (profit / subtotal) * 100 : 0;

    const orderItem: IOrderItem = {
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

    // Include variant info if provided
    if (selectedVariant) {
      if (selectedVariant.size) {
        orderItem.selectedVariant = {
          size: selectedVariant.size,
          displayWeight: selectedVariant.displayWeight,
        };
      } else if (selectedVariant.weight !== undefined && selectedVariant.unit) {
        orderItem.selectedVariant = {
          weight: selectedVariant.weight,
          unit: selectedVariant.unit,
          displayWeight: selectedVariant.displayWeight,
        };
      }
    }

    return orderItem;
  }
}

