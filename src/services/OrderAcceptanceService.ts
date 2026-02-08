import Order from '../models/Order';
import VendorProductPricing from '../models/VendorProductPricing';
import { AppError } from '../middlewares/errorHandler';
import { SalesService } from './SalesService';

export class OrderAcceptanceService {
  // Get pending orders for vendor
  // Show all pending orders that vendor can fulfill (serves pincode and has products)
  static async getPendingOrders(vendor_id: string) {
    const mongoose = (await import('mongoose')).default;
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const Order = (await import('../models/Order')).default;
    
    console.log(`[getPendingOrders Service] Called with vendor_id: ${vendor_id} (type: ${typeof vendor_id})`);
    
    // Convert vendor_id to ObjectId - Mongoose can handle string/ObjectId, but let's be explicit
    let vendorObjectId: any;
    if (mongoose.Types.ObjectId.isValid(vendor_id)) {
      vendorObjectId = new mongoose.Types.ObjectId(vendor_id);
    } else {
      console.error(`[getPendingOrders Service] Invalid vendor_id: ${vendor_id}`);
      return [];
    }
    
    console.log(`[getPendingOrders Service] Converted to ObjectId: ${vendorObjectId}`);
    
    const vendorDetails = await VendorDetails.findOne({ 
      vendor_id: vendorObjectId, 
      isApproved: true 
    });
    
    if (!vendorDetails) {
      console.log(`[getPendingOrders] Vendor not found or not approved: ${vendor_id} (ObjectId: ${vendorObjectId})`);
      // Debug: Check if vendor exists at all
      const allVendors = await VendorDetails.find({});
      console.log(`[getPendingOrders] Total vendors in DB: ${allVendors.length}`);
      allVendors.forEach(v => {
        console.log(`[getPendingOrders]   Vendor ID: ${v.vendor_id}, Approved: ${v.isApproved}, Type: ${v.vendorType}`);
      });
      return [];
    }

    console.log(`[getPendingOrders] Vendor found: ${vendor_id}, Pincodes: ${vendorDetails.serviceablePincodes.join(', ')}`);

    // Get all pending orders (including ASSIGNED orders that are paid but not yet accepted)
    // ASSIGNED means payment is done but order is not yet accepted by a vendor
    // Query for orders that are PENDING or ASSIGNED and don't have an assignedVendorId
    const allPendingOrders = await Order.find({
      status: { $in: ['PENDING', 'ASSIGNED'] },
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
      .lean(); // Use lean() for better performance and to avoid Mongoose document issues

    console.log(`[getPendingOrders] Found ${allPendingOrders.length} total pending/assigned orders`);
    
    // Filter out orders that already have an assignedVendorId
    const unassignedOrders = allPendingOrders.filter(order => {
      // Check if assignedVendorId exists and is not null/undefined/empty
      const assignedVendorId = order.assignedVendorId;
      const hasVendor = assignedVendorId && 
                       assignedVendorId !== null && 
                       assignedVendorId !== undefined && 
                       String(assignedVendorId).trim() !== '' &&
                       String(assignedVendorId) !== 'null';
      
      if (hasVendor) {
        console.log(`[getPendingOrders] Order ${order._id} already assigned to vendor ${assignedVendorId}`);
      } else {
        console.log(`[getPendingOrders] Order ${order._id} is unassigned (assignedVendorId: ${assignedVendorId})`);
      }
      return !hasVendor;
    });

    console.log(`[getPendingOrders] Found ${unassignedOrders.length} unassigned orders`);
    if (unassignedOrders.length > 0) {
      console.log(`[getPendingOrders] Sample order: ${unassignedOrders[0]._id}, status: ${unassignedOrders[0].status}, pincode: ${unassignedOrders[0].customerPincode}`);
    }

    // Filter orders that:
    // 1. Vendor has all products in stock
    // 2. Order is not already accepted by another vendor
    // NOTE: Pincode filtering removed - vendors can now accept orders from any location
    const eligibleOrders = [];
    
    for (const order of unassignedOrders) {
      console.log(`[getPendingOrders] Checking order ${order._id}, pincode: ${order.customerPincode}, status: ${order.status}`);
      
      // Removed pincode check - vendors can accept orders from any pincode
      // if (!vendorDetails.serviceablePincodes.includes(order.customerPincode)) {
      //   console.log(`[getPendingOrders] Order ${order._id} skipped - vendor doesn't serve pincode ${order.customerPincode}`);
      //   continue;
      // }

      // For Prime vendors: 
      // 1. Check if all products are Prime products (Prime products must be ordered separately)
      // 2. Check if all products belong to brands they handle
      if (vendorDetails.vendorType === 'PRIME') {
        // First, check if all products are Prime products
        let allProductsArePrime = true;
        for (const item of order.items) {
          const product = item.product_id as any; // Type assertion for populated product
          if (!product || (typeof product === 'object' && !product.isPrime)) {
            const productId = typeof product === 'object' && product?._id ? product._id.toString() : 'unknown';
            const productName = typeof product === 'object' && product?.name ? product.name : 'unknown';
            console.log(`[getPendingOrders] Order ${order._id} skipped - Prime vendor can only handle Prime products, but product ${productId || productName || 'unknown'} is not Prime`);
            allProductsArePrime = false;
            break;
          }
        }
        
        if (!allProductsArePrime) {
          continue;
        }
        
        // Second, check if all products belong to brands the Prime vendor handles
        if (vendorDetails.brandsHandled && vendorDetails.brandsHandled.length > 0) {
          const vendorBrandIds = vendorDetails.brandsHandled.map(b => {
            // Handle both ObjectId and string formats
            return b.toString ? b.toString() : String(b);
          });
          
          let allProductsMatchBrand = true;
          
          for (const item of order.items) {
            const product = item.product_id as any; // Type assertion for populated product
            // Handle populated brand_id (object) or unpopulated (ObjectId/string)
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
              const productId = typeof product === 'object' && product?._id ? product._id.toString() : 'unknown';
              const productName = typeof product === 'object' && product?.name ? product.name : 'unknown';
              console.log(`[getPendingOrders] Order ${order._id} skipped - Prime vendor doesn't handle brand for product ${productId || productName || 'unknown'}`);
              allProductsMatchBrand = false;
              break;
            }
          }
          
          if (!allProductsMatchBrand) {
            continue;
          }
          
          console.log(`[getPendingOrders] Order ${order._id} passed Prime vendor checks (all Prime products, all match brands)`);
        } else {
          console.log(`[getPendingOrders] Order ${order._id} - Prime vendor has no brands configured, showing all Prime product orders`);
        }
      }
      
      // For Normal/MY_SHOP vendors: Ensure they don't see Prime product orders
      if (vendorDetails.vendorType === 'NORMAL' || vendorDetails.vendorType === 'MY_SHOP') {
        let hasPrimeProducts = false;
        for (const item of order.items) {
          const product = item.product_id as any; // Type assertion for populated product
          if (product && typeof product === 'object' && product.isPrime) {
            hasPrimeProducts = true;
            break;
          }
        }
        if (hasPrimeProducts) {
          console.log(`[getPendingOrders] Order ${order._id} skipped - Normal/MY_SHOP vendor cannot handle Prime products`);
          continue;
        }
      }

      // Check if vendor has all products available (active)
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      let hasAllProducts = true;
      
      for (const item of order.items) {
        // Use vendorObjectId for query - only check if product is active (available)
        const pricing = await VendorProductPricing.findOne({
          vendor_id: vendorObjectId,
          product_id: item.product_id,
          isActive: true,
        });
        
        if (!pricing) {
          console.log(`[getPendingOrders] Order ${order._id} skipped - vendor doesn't have product ${item.product_id} available`);
          hasAllProducts = false;
          break;
        }
      }

      if (!hasAllProducts) {
        continue;
      }
      
      console.log(`[getPendingOrders] Order ${order._id} is eligible for vendor ${vendor_id}`);

      // Calculate purchase price vendor will receive (earnings) and get product-wise details
      let totalPurchasePrice = 0;
      const itemsWithPricing = [];
      
      for (const item of order.items) {
        // Use vendorObjectId for query
        const pricing = await VendorProductPricing.findOne({
          vendor_id: vendorObjectId,
          product_id: item.product_id,
        });
        
        if (pricing) {
          const itemPurchasePrice = pricing.purchasePrice * item.quantity;
          totalPurchasePrice += itemPurchasePrice;
          
          // Get product name from populated product_id
          const product = item.product_id as any; // Type assertion for populated product
          const productName = (product && typeof product === 'object' && product.name) ? product.name : 'N/A';
          
          // Add product details with pricing
          itemsWithPricing.push({
            product_id: (product && typeof product === 'object' && product._id) ? product._id : item.product_id,
            product_name: productName,
            quantity: item.quantity,
            sellingPrice: item.sellingPrice || 0,
            purchasePrice: pricing.purchasePrice,
            purchaseSubtotal: itemPurchasePrice,
          });
        }
      }

      // Since we used .lean(), order is already a plain object
      eligibleOrders.push({
        ...order,
        earnings: totalPurchasePrice, // Total purchase price vendor will receive
        itemsWithPricing: itemsWithPricing, // Product-wise pricing details
      });
    }

    console.log(`[getPendingOrders] Returning ${eligibleOrders.length} eligible orders for vendor ${vendor_id}`);
    return eligibleOrders;
  }

  // Accept order - first come first serve
  static async acceptOrder(order_id: string, vendor_id: string) {
    console.log('[OrderAcceptanceService] acceptOrder called for order:', order_id, 'vendor:', vendor_id, '- NO DEADLINE CHECK');
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
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order_id,
        status: { $in: ['PENDING', 'ASSIGNED'] }, // Accept both pending and assigned (paid but not accepted)
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
        });
      } catch (error) {
        console.error(`Failed to record sale for product ${item.product_id}:`, error);
        // Continue even if sales history fails - order is already accepted
      }
    }

    // TODO: Trigger courier pickup notification
    // TODO: Notify other vendors that order is no longer available

    return updatedOrder;
  }

  // Reject order - vendors can ignore orders, no need to explicitly reject
  // This is kept for backward compatibility but orders remain PENDING for other vendors
  static async rejectOrder(order_id: string, vendor_id: string, reason?: string) {
    // Orders are now first-come-first-serve, so rejection is not needed
    // Vendors simply don't accept orders they can't fulfill
    // This method is kept for API compatibility but doesn't change order status
    const order = await Order.findById(order_id);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Order remains PENDING for other vendors to accept
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

