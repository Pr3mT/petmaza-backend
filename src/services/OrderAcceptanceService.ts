import Order from '../models/Order';
import VendorProductPricing from '../models/VendorProductPricing';
import { AppError } from '../middlewares/errorHandler';
import { SalesService } from './SalesService';
import logger from '../config/logger';
import { sanitizeOrderForVendor, sanitizeOrdersForVendor } from '../utils/vendorOrderSanitizer';

export class OrderAcceptanceService {
  /**
   * Get pending orders for PRIME vendors only
   * MY_SHOP vendors dont see pending orders - their orders are directly assigned
   */
  static async getPendingOrders(vendor_id: string) {
    const mongoose = (await import('mongoose')).default;
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const Order = (await import('../models/Order')).default;
    const User = (await import('../models/User')).default;
    
    logger.info(`[getPendingOrders Service] Called with vendor_id: ${vendor_id}`);
    
    // Convert vendor_id to ObjectId
    let vendorObjectId: any;
    if (mongoose.Types.ObjectId.isValid(vendor_id)) {
      vendorObjectId = new mongoose.Types.ObjectId(vendor_id);
    } else {
      logger.error(`[getPendingOrders Service] Invalid vendor_id: ${vendor_id}`);
      return [];
    }
    
    // Get vendor details
    const vendorDetails = await VendorDetails.findOne({ 
      vendor_id: vendorObjectId, 
      isApproved: true 
    });
    
    if (!vendorDetails) {
      logger.info(`[getPendingOrders] Vendor not found or not approved: ${vendor_id}`);
      return [];
    }

    // MY_SHOP vendors don't see pending orders - all normal orders are directly assigned
    if (vendorDetails.vendorType === 'MY_SHOP') {
      logger.info(`[getPendingOrders] MY_SHOP vendor - no pending orders shown (orders are directly assigned)`);
      return [];
    }

    // WAREHOUSE_FULFILLER vendors see competitive broadcast orders
    if (vendorDetails.vendorType === 'WAREHOUSE_FULFILLER') {
      logger.info(`[getPendingOrders] WAREHOUSE_FULFILLER vendor - showing competitive broadcast orders`);
      
      // Get assigned subcategories for this fulfiller
      const assignedSubcategories = vendorDetails.assignedSubcategories || [];
      if (assignedSubcategories.length === 0) {
        logger.info(`[getPendingOrders] WAREHOUSE_FULFILLER has no assigned subcategories`);
        return [];
      }

      logger.info(`[getPendingOrders] Assigned subcategories:`, assignedSubcategories);

      // Find all products in these subcategories
      const Product = (await import('../models/Product')).default;
      const subcategoryProductIds = await Product.find({
        subCategory: { $in: assignedSubcategories },
      }).distinct('_id');

      logger.info(`[getPendingOrders] Found ${subcategoryProductIds.length} products in assigned subcategories`);

      // Get PENDING broadcast orders (assignedVendorId: null) with products from these subcategories
      const broadcastOrders = await Order.find({
        status: 'PENDING',
        payment_status: 'Paid',
        assignedVendorId: null, // Broadcast orders only
        'items.product_id': { $in: subcategoryProductIds },
      })
        .populate('customer_id', 'name email phone')
        .populate({
          path: 'items.product_id',
          select: 'name images subCategory',
        })
        .sort({ createdAt: -1 })
        .lean();

      logger.info(`[getPendingOrders] Found ${broadcastOrders.length} broadcast orders for WAREHOUSE_FULFILLER`);

      // Add acceptance deadline and competitor count info; strip vendor-hidden financial fields
      const eligibleOrders = sanitizeOrdersForVendor(broadcastOrders.map(order => ({
        ...order,
        acceptanceDeadline: order.acceptanceDeadline,
        isCompetitive: true,
      })));

      logger.info(`[getPendingOrders] Returning ${eligibleOrders.length} eligible broadcast orders`);
      return eligibleOrders;
    }

    // Only PRIME vendors see pending Prime orders
    logger.info(`[getPendingOrders] PRIME vendor - showing pending Prime orders`);

    // Get all PENDING Prime orders that are either:
    // 1. Not yet assigned (broadcast orders), OR
    // 2. Assigned to this specific vendor
    const allPendingOrders = await Order.find({
      status: 'PENDING',
      payment_status: 'Paid',
      isPrime: true,
      $or: [
        { assignedVendorId: { $exists: false } },
        { assignedVendorId: null },
        { assignedVendorId: vendorObjectId }  // Include orders assigned to this vendor
      ]
    })
      .populate('customer_id', 'name email phone')
      .populate({
        path: 'items.product_id',
        select: 'name images brand_id isPrime',
        populate: {
          path: 'brand_id',
          select: 'name _id'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`[getPendingOrders] Found ${allPendingOrders.length} pending Prime orders`);
    
    // Filter orders based on assignment and vendor details
    const eligibleOrders = [];
    
    for (const order of allPendingOrders) {
      logger.info(`[getPendingOrders] Checking order ${order._id}`);
      
      // If order is directly assigned to this vendor, skip all checks - it's theirs
      if (order.assignedVendorId && order.assignedVendorId.toString() === vendorObjectId.toString()) {
        logger.info(`[getPendingOrders] Order ${order._id} is directly assigned to this Prime vendor - adding to eligible orders`);
        eligibleOrders.push(order);
        continue; // Skip brand and availability checks
      }
      
      // For broadcast orders (not directly assigned), check brand assignments
      // For PRIME vendors: Check if all products belong to brands they handle
      if (vendorDetails.brandsHandled && vendorDetails.brandsHandled.length > 0) {
        const vendorBrandIds = vendorDetails.brandsHandled.map(b => 
          b.toString ? b.toString() : String(b)
        );
        
        let allProductsMatchBrand = true;
        
        for (const item of order.items) {
          const product = item.product_id as any;
          let productBrandId = null;
          
          if (product && typeof product === 'object') {
            if (product.brand_id) {
              if (typeof product.brand_id === 'object' && product.brand_id._id) {
                productBrandId = product.brand_id._id.toString();
              } else if (typeof product.brand_id === 'object' && product.brand_id.toString) {
                productBrandId = product.brand_id.toString();
              } else {
                productBrandId = String(product.brand_id);
              }
            }
          }
          
          if (!productBrandId || !vendorBrandIds.includes(productBrandId)) {
            const productName = typeof product === 'object' && product?.name ? product.name : 'unknown';
            logger.info(`[getPendingOrders] Order ${order._id} skipped - Prime vendor doesn't handle brand for product ${productName}`);
            allProductsMatchBrand = false;
            break;
          }
        }
        
        if (!allProductsMatchBrand) {
          continue;
        }
        
        logger.info(`[getPendingOrders] Order ${order._id} passed Prime vendor brand check`);
      } else {
        // No brands configured - show all Prime orders to this vendor
        logger.info(`[getPendingOrders] Order ${order._id} - Prime vendor has no brands configured, showing order`);
      }

      eligibleOrders.push(order);
    }

    logger.info(`[getPendingOrders] Returning ${eligibleOrders.length} eligible Prime orders after filtering`);
    return sanitizeOrdersForVendor(eligibleOrders);
  }

  // Accept order - first come first serve
  static async acceptOrder(order_id: string, vendor_id: string) {
    logger.info('[OrderAcceptanceService] acceptOrder called for order:', order_id, 'vendor:', vendor_id);
    const order = await Order.findById(order_id);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.payment_status !== 'Paid') {
      throw new AppError('Order cannot be accepted before successful payment', 400);
    }

    // Check if order is still pending or assigned (not already accepted)
    if (order.status !== 'PENDING' && order.status !== 'ASSIGNED') {
      throw new AppError('Order is not available for acceptance', 400);
    }
    
    // Check if order is already accepted by another vendor
    if (order.assignedVendorId) {
      throw new AppError('Order was already accepted by another vendor', 409);
    }

    // Check acceptance deadline for competitive orders
    if (order.acceptanceDeadline && new Date() > order.acceptanceDeadline) {
      throw new AppError('Acceptance deadline has expired', 400);
    }

    // Verify vendor can fulfill this order
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const vendorDetails = await VendorDetails.findOne({ vendor_id, isApproved: true });

    if (!vendorDetails) {
      throw new AppError('Vendor not found or not approved', 404);
    }

    // Removed pincode check - vendors can now accept orders from any pincode
    // if (!vendorDetails.serviceablePincodes.includes(order.customerPincode)) {
    //   throw new AppError('Vendor does not serve this pincode', 400);
    // }

    // Check if vendor has all products available
    if (order.isPrime) {
      // After unification, Product IS the prime listing — check directly
      const ProductModel = (await import('../models/Product')).default;
      for (const item of order.items) {
        const product = await ProductModel.findOne({
          _id: item.product_id,
          primeVendor_id: vendor_id,
          isPrime: true,
          isActive: true,
        });
        if (!product) {
          throw new AppError(`Product ${item.product_id} not available`, 400);
        }
      }
    } else {
      // Non-prime orders: validate via VendorProductPricing
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      for (const item of order.items) {
        const pricing = await VendorProductPricing.findOne({
          vendor_id,
          product_id: item.product_id,
          isActive: true,
        });

        if (!pricing) {
          throw new AppError(`Product ${item.product_id} not available`, 400);
        }
      }
    }

    // Recalculate order items with accepting vendor's pricing
    const Product = (await import('../models/Product')).default;
    const updatedItems = [];
    let newTotalPurchasePrice = 0;
    let newTotalProfit = 0;

    if (order.isPrime) {
      // After unification, Product IS the prime listing — read pricing directly
      const ProductModel = (await import('../models/Product')).default;
      for (const item of order.items) {
        const product = await ProductModel.findOne({
          _id: item.product_id,
          primeVendor_id: vendor_id,
          isPrime: true,
          isActive: true,
        });
        if (!product) {
          throw new AppError(`Product ${item.product_id} not available from vendor`, 404);
        }

        const sellingPrice = product.sellingPrice ?? 0;
        const purchasePrice = product.purchasePrice || 0;
        const subtotal = sellingPrice * item.quantity;
        const purchaseSubtotal = purchasePrice * item.quantity;
        const profit = subtotal - purchaseSubtotal;
        const profitPercentage = subtotal > 0 ? (profit / subtotal) * 100 : 0;

        updatedItems.push({
          product_id: item.product_id,
          vendor_id: vendor_id,
          quantity: item.quantity,
          sellingPrice,
          purchasePrice,
          subtotal,
          purchaseSubtotal,
          profit,
          profitPercentage,
        });

        newTotalPurchasePrice += purchaseSubtotal;
        newTotalProfit += profit;
      }
    } else {
      // Non-prime orders: use VendorProductPricing
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      for (const item of order.items) {
        const product = await Product.findById(item.product_id);
        if (!product) {
          throw new AppError(`Product ${item.product_id} not found`, 404);
        }

        const pricing = await VendorProductPricing.findOne({
          vendor_id,
          product_id: item.product_id,
          isActive: true,
        });

        if (!pricing) {
          throw new AppError(`Product ${item.product_id} not available from vendor`, 404);
        }

        // Recalculate with accepting vendor's pricing
        const subtotal = product.sellingPrice * item.quantity;
        const purchaseSubtotal = pricing.purchasePrice * item.quantity;
        const profit = subtotal - purchaseSubtotal;
        const profitPercentage = (profit / subtotal) * 100;

        updatedItems.push({
          product_id: item.product_id,
          vendor_id: vendor_id,
          quantity: item.quantity,
          sellingPrice: product.sellingPrice,
          purchasePrice: pricing.purchasePrice,
          subtotal,
          purchaseSubtotal,
          profit,
          profitPercentage,
        });

        newTotalPurchasePrice += purchaseSubtotal;
        newTotalProfit += profit;
      }
    }

    // Use atomic update to ensure only first vendor can accept
    // Accept both PENDING and ASSIGNED orders (ASSIGNED means payment is done but not yet accepted)
    // For competitive orders, also check that assignedVendorId is still null
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order_id,
        status: { $in: ['PENDING', 'ASSIGNED'] }, // Accept both pending and assigned (paid but not accepted)
        $or: [
          { assignedVendorId: null }, // Competitive order - must be unassigned
          { assignedVendorId: { $exists: false } }, // Legacy order without assignedVendorId field
        ],
      },
      {
        $set: {
          status: 'ACCEPTED',
          assignedVendorId: vendor_id,
          items: updatedItems,
          totalPurchasePrice: newTotalPurchasePrice,
          totalProfit: newTotalProfit,
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      throw new AppError('Order was already accepted by another vendor', 409);
    }

    // Record sales in history for each item
    for (const item of updatedOrder.items) {
      try {
        await SalesService.recordSale({
          vendor_id,
          product_id: item.product_id.toString(),
          quantity: item.quantity,
          saleType: 'WEBSITE',
          soldBy: vendor_id, // The vendor who accepted the order
          order_id: updatedOrder._id.toString(),
          sellingPrice: item.sellingPrice,
          selectedVariant: (item as any).selectedVariant,
        });
      } catch (error) {
        logger.error(`Failed to record sale for product ${item.product_id}:`, error);
        // Continue even if sales history fails - order is already accepted
      }
    }

    // TODO: Trigger courier pickup notification
    // Notify other vendors that order is no longer available
    try {
      // Get accepting vendor info
      const User = (await import('../models/User')).default;
      const acceptingVendor = await User.findById(vendor_id);
      const acceptingVendorName = acceptingVendor?.name || 'Another vendor';

      // Notify the winning fulfiller about the assignment (non-blocking)
      if (acceptingVendor?.email) {
        const { sendFulfillerDeliveryNotificationEmail } = await import('./emailer');
        sendFulfillerDeliveryNotificationEmail(
          acceptingVendor.email,
          acceptingVendorName,
          `#${updatedOrder._id.toString().slice(-8)}`,
          {
            totalAmount: updatedOrder.total,
            items: updatedOrder.items,
            customerAddress: updatedOrder.customerAddress,
          }
        ).catch((err: any) =>
          logger.error('[OrderAcceptanceService] Fulfiller assignment email failed:', err.message)
        );
      }

      // Find all other eligible fulfillers who were competing for this order
      const VendorDetails = (await import('../models/VendorDetails')).default;
      
      // Get all subcategories from the order items
      const Product = (await import('../models/Product')).default;
      const subcategories = new Set<string>();
      for (const item of updatedOrder.items) {
        const product = await Product.findById(item.product_id);
        if (product && product.subCategory) {
          // subCategory is an array in the schema, but some legacy docs store a plain string
          const subs = Array.isArray(product.subCategory)
            ? product.subCategory
            : [product.subCategory];
          subs.forEach((sub) => subcategories.add(sub));
        }
      }

      // Find all WAREHOUSE_FULFILLERs who can handle these subcategories
      const eligibleFulfillers = await VendorDetails.find({
        vendorType: 'WAREHOUSE_FULFILLER',
        isApproved: true,
        assignedSubcategories: { $in: Array.from(subcategories) },
        vendor_id: { $ne: vendor_id }, // Exclude the vendor who accepted
      }).populate('vendor_id', 'name email');

      logger.info(`[OrderAcceptanceService] Found ${eligibleFulfillers.length} other fulfillers to notify about order ${order_id}`);

      // Notify losers via WebSocket (if available)
      try {
        const io = (await import('../server')).io;
        for (const fulfiller of eligibleFulfillers) {
          const loserId = fulfiller.vendor_id.toString();
          io.to(`vendor:${loserId}`).emit('order:taken', {
            orderId: updatedOrder._id.toString(),
            winnerName: acceptingVendorName,
            message: `Order was accepted by ${acceptingVendorName}`,
          });
          logger.info(`📢 WebSocket notification sent to loser vendor ${loserId}`);
        }
      } catch (wsError) {
        logger.error('[OrderAcceptanceService] WebSocket notification failed:', wsError);
        // Continue even if WebSocket fails
      }

      // Send email notifications to losers
      const { sendOrderTakenNotificationEmail } = await import('./emailer');
      for (const fulfiller of eligibleFulfillers) {
        try {
          await sendOrderTakenNotificationEmail(
            (fulfiller.vendor_id as any).email,
            (fulfiller.vendor_id as any).name,
            updatedOrder._id.toString(),
            acceptingVendorName
          );
          logger.info(`📧 Order taken email sent to ${(fulfiller.vendor_id as any).email}`);
        } catch (emailError) {
          logger.error(`Failed to queue email for ${(fulfiller.vendor_id as any).email}:`, emailError);
          // Continue even if email fails
        }
      }
    } catch (notifyError) {
      logger.error('[OrderAcceptanceService] Failed to notify other vendors:', notifyError);
      // Don't fail the acceptance if notifications fail - order is already accepted
    }

    return updatedOrder;
  }

  // Reject order - vendors can ignore orders, no need to explicitly reject
  // This is kept for backward compatibility but orders remain PENDING for other vendors
  static async rejectOrder(order_id: string, vendor_id: string, reason?: string) {
    const mongoose = (await import('mongoose')).default;
    const order = await Order.findById(order_id)
      .populate('customer_id', 'name email');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if this vendor is assigned to the order
    const vendorObjectId = new mongoose.Types.ObjectId(vendor_id);
    const assignedVendorId = order.assignedVendorId?.toString();
    
    if (assignedVendorId !== vendor_id) {
      throw new AppError('You are not assigned to this order', 403);
    }

    // Update order status to REJECTED
    order.status = 'REJECTED';
    order.rejectionReason = reason || 'Vendor rejected the order';
    await order.save();

    logger.info(`[OrderAcceptanceService] Order ${order_id} rejected by vendor ${vendor_id}`);

    // Send rejection email with refund notification to customer
    try {
      const { sendOrderRejectionEmail } = await import('./emailer');
      const orderId = order._id.toString().slice(-8).toUpperCase();
      
      const customer = order.customer_id as any;
      const customerEmail = customer?.email;
      const customerName = customer?.name;
      
      logger.info(`[OrderAcceptanceService] Customer data - Email: ${customerEmail}, Name: ${customerName}`);
      
      if (customerEmail && customerName) {
        sendOrderRejectionEmail(
          customerEmail,
          customerName,
          orderId,
          reason || 'Vendor rejected the order',
          order.total || 0
        ).then(() => logger.info(`[OrderAcceptanceService] Rejection email sent for order ${orderId} to ${customerEmail}`))
         .catch((e: any) => logger.error(`[OrderAcceptanceService] Rejection email failed: ${e.message}`));
      } else {
        logger.error(`[OrderAcceptanceService] Cannot send rejection email - Missing customer data. Email: ${customerEmail}, Name: ${customerName}`);
      }
    } catch (emailError: any) {
      logger.error(`[OrderAcceptanceService] Error sending rejection email: ${emailError.message}`);
      // Don't fail the rejection if email fails
    }

    return order;
  }

  // Get order details for vendor
  static async getOrderDetails(order_id: string, vendor_id: string) {
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(order_id)) {
      throw new AppError('Invalid order ID format', 400);
    }
    const VendorDetails = (await import('../models/VendorDetails')).default;
    
    const order = await Order.findById(order_id)
      .populate('customer_id', 'name email phone address')
      .populate('items.product_id', 'name images weight')
      .populate('assignedVendorId', 'name email')
      .populate('assignedVendors', 'name email');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Convert vendor_id to ObjectId
    const vendorObjectId = mongoose.Types.ObjectId.isValid(vendor_id) 
      ? new mongoose.Types.ObjectId(vendor_id) 
      : vendor_id;

    // Check if order is assigned to a vendor
    // Handle both populated (object) and unpopulated (ObjectId/string/null) cases
    const assignedVendorIdValue = order.assignedVendorId as any;
    let assignedVendorId: string | null = null;
    
    if (assignedVendorIdValue) {
      if (assignedVendorIdValue._id) {
        assignedVendorId = assignedVendorIdValue._id.toString();
      } else if (assignedVendorIdValue.id) {
        assignedVendorId = assignedVendorIdValue.id.toString();
      } else if (typeof assignedVendorIdValue === 'string') {
        assignedVendorId = assignedVendorIdValue;
      } else if (assignedVendorIdValue.toString && typeof assignedVendorIdValue.toString === 'function') {
        const str = assignedVendorIdValue.toString();
        assignedVendorId = (str && str !== '[object Object]') ? str : null;
      }
    }
    
    // Clean up the assignedVendorId - remove any falsy values
    if (assignedVendorId === '' || assignedVendorId === 'null' || assignedVendorId === 'undefined' || assignedVendorId === '[object Object]') {
      assignedVendorId = null;
    }
    
    const isAssigned = assignedVendorId !== null && assignedVendorId !== undefined;

    logger.info(`[getOrderDetails] Order ${order_id}, status: ${order.status}, assignedVendorId: ${assignedVendorId}, isAssigned: ${isAssigned}, vendor_id: ${vendor_id}`);

    // If order is already accepted/assigned to a vendor, only that vendor can view
    if (isAssigned && (order.status === 'ACCEPTED' || order.status === 'ASSIGNED')) {
      if (assignedVendorId !== vendor_id) {
        logger.info(`[getOrderDetails] Order is assigned to ${assignedVendorId}, but vendor ${vendor_id} is trying to access`);
      throw new AppError('Order not assigned to this vendor', 403);
    }
    } 
    // If order is PENDING or ASSIGNED but not yet accepted, check if vendor is eligible
    else if (order.status === 'PENDING' || (order.status === 'ASSIGNED' && !isAssigned)) {
      logger.info(`[getOrderDetails] Order is pending/unassigned, checking vendor eligibility`);

      if (order.isPrime) {
        // After unification, Product IS the prime listing — check directly
        const ProductModel = (await import('../models/Product')).default;
        for (const item of order.items) {
          const product = await ProductModel.findOne({
            _id: item.product_id,
            primeVendor_id: vendorObjectId,
            isPrime: true,
            isActive: true,
          });
          if (!product) {
            throw new AppError(`Vendor does not have product ${item.product_id} available`, 403);
          }
        }
      } else {
        // Non-prime: check via VendorDetails + VendorProductPricing
        const vendorDetails = await VendorDetails.findOne({
          vendor_id: vendorObjectId,
          isApproved: true,
        });

        if (!vendorDetails) {
          throw new AppError('Vendor not found or not approved', 403);
        }

        // Check if vendor serves this pincode
        if (!vendorDetails.serviceablePincodes.includes(order.customerPincode)) {
          throw new AppError('Vendor does not serve this pincode', 403);
        }

        // Check if vendor has all products in stock
        const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
        for (const item of order.items) {
          const pricing = await VendorProductPricing.findOne({
            vendor_id: vendorObjectId,
            product_id: item.product_id,
            isActive: true,
          });

          if (!pricing) {
            throw new AppError(`Vendor does not have product ${item.product_id} available`, 403);
          }
        }
      }
    }

    // Calculate earnings (purchase price vendor will receive)
    let totalPurchasePrice = 0;

    if (order.isPrime) {
      // After unification, Product IS the prime listing — read purchasePrice directly
      const ProductModel = (await import('../models/Product')).default;
      for (const item of order.items) {
        const product = await ProductModel.findOne({
          _id: item.product_id,
          primeVendor_id: vendorObjectId,
          isPrime: true,
        });
        if (product) {
          totalPurchasePrice += (product.purchasePrice || 0) * item.quantity;
        }
      }
    } else {
      // Non-prime orders: use VendorProductPricing
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      for (const item of order.items) {
        const pricing = await VendorProductPricing.findOne({
          vendor_id: vendorObjectId,
          product_id: item.product_id,
        });
        if (pricing) {
          totalPurchasePrice += pricing.purchasePrice * item.quantity;
        }
      }
    }

    const earnings = totalPurchasePrice; // Purchase price vendor will receive

    // Strip customer-facing financial fields before returning to vendor
    return sanitizeOrderForVendor({
      ...order.toObject(),
      earnings,
      // Expose total vendor earnings clearly
      totalVendorEarnings: earnings,
    });
  }
}

