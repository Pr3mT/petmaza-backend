import Order from '../models/Order';
import VendorProductPricing from '../models/VendorProductPricing';
import { AppError } from '../middlewares/errorHandler';
import { SalesService } from './SalesService';
import logger from '../config/logger';

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
    
    console.log(`[getPendingOrders Service] Called with vendor_id: ${vendor_id}`);
    
    // Convert vendor_id to ObjectId
    let vendorObjectId: any;
    if (mongoose.Types.ObjectId.isValid(vendor_id)) {
      vendorObjectId = new mongoose.Types.ObjectId(vendor_id);
    } else {
      console.error(`[getPendingOrders Service] Invalid vendor_id: ${vendor_id}`);
      return [];
    }
    
    // Get vendor details
    const vendorDetails = await VendorDetails.findOne({ 
      vendor_id: vendorObjectId, 
      isApproved: true 
    });
    
    if (!vendorDetails) {
      console.log(`[getPendingOrders] Vendor not found or not approved: ${vendor_id}`);
      return [];
    }

    // MY_SHOP vendors don't see pending orders - all normal orders are directly assigned
    if (vendorDetails.vendorType === 'MY_SHOP') {
      console.log(`[getPendingOrders] MY_SHOP vendor - no pending orders shown (orders are directly assigned)`);
      return [];
    }

    // WAREHOUSE_FULFILLER vendors see competitive broadcast orders
    if (vendorDetails.vendorType === 'WAREHOUSE_FULFILLER') {
      console.log(`[getPendingOrders] WAREHOUSE_FULFILLER vendor - showing competitive broadcast orders`);
      
      // Get assigned subcategories for this fulfiller
      const assignedSubcategories = vendorDetails.assignedSubcategories || [];
      if (assignedSubcategories.length === 0) {
        console.log(`[getPendingOrders] WAREHOUSE_FULFILLER has no assigned subcategories`);
        return [];
      }

      console.log(`[getPendingOrders] Assigned subcategories:`, assignedSubcategories);

      // Find all products in these subcategories
      const Product = (await import('../models/Product')).default;
      const subcategoryProductIds = await Product.find({
        subCategory: { $in: assignedSubcategories },
      }).distinct('_id');

      console.log(`[getPendingOrders] Found ${subcategoryProductIds.length} products in assigned subcategories`);

      // Get PENDING broadcast orders (assignedVendorId: null) with products from these subcategories
      const broadcastOrders = await Order.find({
        status: 'PENDING',
        assignedVendorId: null, // Broadcast orders only
        'items.product_id': { $in: subcategoryProductIds },
      })
        .populate('customer_id', 'name email phone')
        .populate({
          path: 'items.product_id',
          select: 'name images mrp sellingPrice subCategory',
        })
        .sort({ createdAt: -1 })
        .lean();

      console.log(`[getPendingOrders] Found ${broadcastOrders.length} broadcast orders for WAREHOUSE_FULFILLER`);

      // Add acceptance deadline and competitor count info
      const eligibleOrders = broadcastOrders.map(order => ({
        ...order,
        acceptanceDeadline: order.acceptanceDeadline,
        isCompetitive: true,
      }));

      console.log(`[getPendingOrders] Returning ${eligibleOrders.length} eligible broadcast orders`);
      return eligibleOrders;
    }

    // Only PRIME vendors see pending Prime orders
    console.log(`[getPendingOrders] PRIME vendor - showing pending Prime orders`);

    // Get all PENDING Prime orders that are either:
    // 1. Not yet assigned (broadcast orders), OR
    // 2. Assigned to this specific vendor
    const allPendingOrders = await Order.find({
      status: 'PENDING',
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
        select: 'name images mrp sellingPrice brand_id isPrime',
        populate: {
          path: 'brand_id',
          select: 'name _id'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`[getPendingOrders] Found ${allPendingOrders.length} pending Prime orders`);
    
    // Filter orders based on assignment and vendor details
    const eligibleOrders = [];
    
    for (const order of allPendingOrders) {
      console.log(`[getPendingOrders] Checking order ${order._id}`);
      
      // If order is directly assigned to this vendor, skip all checks - it's theirs
      if (order.assignedVendorId && order.assignedVendorId.toString() === vendorObjectId.toString()) {
        console.log(`[getPendingOrders] Order ${order._id} is directly assigned to this Prime vendor - adding to eligible orders`);
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
            console.log(`[getPendingOrders] Order ${order._id} skipped - Prime vendor doesn't handle brand for product ${productName}`);
            allProductsMatchBrand = false;
            break;
          }
        }
        
        if (!allProductsMatchBrand) {
          continue;
        }
        
        console.log(`[getPendingOrders] Order ${order._id} passed Prime vendor brand check`);
      } else {
        // No brands configured - show all Prime orders to this vendor
        console.log(`[getPendingOrders] Order ${order._id} - Prime vendor has no brands configured, showing order`);
      }

      eligibleOrders.push(order);
    }

    console.log(`[getPendingOrders] Returning ${eligibleOrders.length} eligible Prime orders after filtering`);
    return eligibleOrders;
  }

  // Accept order - first come first serve
  static async acceptOrder(order_id: string, vendor_id: string) {
    console.log('[OrderAcceptanceService] acceptOrder called for order:', order_id, 'vendor:', vendor_id);
    const order = await Order.findById(order_id);

    if (!order) {
      throw new AppError('Order not found', 404);
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

    // Recalculate order items with accepting vendor's pricing
    const Product = (await import('../models/Product')).default;
    const updatedItems = [];
    let newTotalPurchasePrice = 0;
    let newTotalProfit = 0;

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
        console.error(`Failed to record sale for product ${item.product_id}:`, error);
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
          console.error('[OrderAcceptanceService] Fulfiller assignment email failed:', err.message)
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
          subcategories.add(product.subCategory);
        }
      }

      // Find all WAREHOUSE_FULFILLERs who can handle these subcategories
      const eligibleFulfillers = await VendorDetails.find({
        vendorType: 'WAREHOUSE_FULFILLER',
        isApproved: true,
        assignedSubcategories: { $in: Array.from(subcategories) },
        vendor_id: { $ne: vendor_id }, // Exclude the vendor who accepted
      }).populate('vendor_id', 'name email');

      console.log(`[OrderAcceptanceService] Found ${eligibleFulfillers.length} other fulfillers to notify about order ${order_id}`);

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
          console.log(`📢 WebSocket notification sent to loser vendor ${loserId}`);
        }
      } catch (wsError) {
        console.error('[OrderAcceptanceService] WebSocket notification failed:', wsError);
        // Continue even if WebSocket fails
      }

      // Send email notifications to losers (optional - using existing email queue)
      const { queueOrderTakenNotificationEmail } = await import('./emailer');
      for (const fulfiller of eligibleFulfillers) {
        try {
          await queueOrderTakenNotificationEmail({
            vendorEmail: (fulfiller.vendor_id as any).email,
            vendorName: (fulfiller.vendor_id as any).name,
            orderId: updatedOrder._id.toString(),
            winnerName: acceptingVendorName,
          });
          console.log(`📧 Order taken email queued for ${(fulfiller.vendor_id as any).email}`);
        } catch (emailError) {
          console.error(`Failed to queue email for ${(fulfiller.vendor_id as any).email}:`, emailError);
          // Continue even if email fails
        }
      }
    } catch (notifyError) {
      console.error('[OrderAcceptanceService] Failed to notify other vendors:', notifyError);
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
      const { queueOrderRejectionEmail } = await import('./emailer');
      const orderId = order._id.toString().slice(-8).toUpperCase();
      
      const customer = order.customer_id as any;
      const customerEmail = customer?.email;
      const customerName = customer?.name;
      
      logger.info(`[OrderAcceptanceService] Customer data - Email: ${customerEmail}, Name: ${customerName}`);
      
      if (customerEmail && customerName) {
        queueOrderRejectionEmail(
          customerEmail,
          customerName,
          orderId,
          reason || 'Vendor rejected the order',
          order.total || 0
        );
        logger.info(`[OrderAcceptanceService] Rejection email queued successfully for order ${orderId} to ${customerEmail}`);
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

    console.log(`[getOrderDetails] Order ${order_id}, status: ${order.status}, assignedVendorId: ${assignedVendorId}, isAssigned: ${isAssigned}, vendor_id: ${vendor_id}`);

    // If order is already accepted/assigned to a vendor, only that vendor can view
    if (isAssigned && (order.status === 'ACCEPTED' || order.status === 'ASSIGNED')) {
      if (assignedVendorId !== vendor_id) {
        console.log(`[getOrderDetails] Order is assigned to ${assignedVendorId}, but vendor ${vendor_id} is trying to access`);
      throw new AppError('Order not assigned to this vendor', 403);
    }
    } 
    // If order is PENDING or ASSIGNED but not yet accepted, check if vendor is eligible
    else if (order.status === 'PENDING' || (order.status === 'ASSIGNED' && !isAssigned)) {
      console.log(`[getOrderDetails] Order is pending/unassigned, checking vendor eligibility`);
      // Check if vendor is eligible to view this order (serves pincode and has products)
      const vendorDetails = await VendorDetails.findOne({ 
        vendor_id: vendorObjectId, 
        isApproved: true 
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

    // Calculate earnings (profit for vendor)
    const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
    let totalPurchasePrice = 0;
    
    for (const item of order.items) {
      const pricing = await VendorProductPricing.findOne({
        vendor_id: vendorObjectId,
        product_id: item.product_id,
      });
      if (pricing) {
        totalPurchasePrice += pricing.purchasePrice * item.quantity;
      }
    }

    const earnings = totalPurchasePrice; // Purchase price vendor will receive

    return {
      ...order.toObject(),
      earnings,
    };
  }
}

