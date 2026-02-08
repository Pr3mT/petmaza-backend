import { Request, Response } from 'express';
import Invoice from '../models/Invoice';
import Order from '../models/Order';
import User from '../models/User';
import emailService from '../services/emailService';

// Generate invoice number
const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp}-${random}`;
};

// Create invoice for an order
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Find the order
    const order = await Order.findById(orderId).populate('items.product_id customer_id');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Authorization check
    if (userRole === 'customer' && order.customer_id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to create invoice for this order' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ order_id: orderId });
    if (existingInvoice) {
      return res.status(400).json({ message: 'Invoice already exists for this order' });
    }

    // Get customer details
    const customer = await User.findById(order.customer_id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Prepare invoice items
    const invoiceItems = order.items.map((item: any) => ({
      productName: item.product_id.name,
      quantity: item.quantity,
      unitPrice: item.sellingPrice,
      subtotal: item.subtotal,
    }));

    // Calculate totals
    const subtotal = order.total;
    const taxPercentage = 0; // No GST as per requirement
    const tax = 0;
    const deliveryCharge = order.deliveryCost || 0;
    const totalAmount = subtotal + tax + deliveryCharge;

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber: generateInvoiceNumber(),
      order_id: orderId,
      customer_id: order.customer_id,
      invoiceDate: new Date(),
      items: invoiceItems,
      subtotal,
      tax,
      taxPercentage,
      deliveryCharge,
      totalAmount,
      billingAddress: {
        name: customer.name,
        street: order.customerAddress.street,
        city: order.customerAddress.city,
        state: order.customerAddress.state,
        pincode: order.customerAddress.pincode,
        phone: customer.phone,
      },
      shippingAddress: order.customerAddress,
      paymentMethod: order.payment_gateway || 'razorpay',
      paymentStatus: order.payment_status,
      notes: `Order #${orderId}`,
    });

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice,
    });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Failed to create invoice', error: error.message });
  }
};

// Get invoice by ID
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const invoice = await Invoice.findById(invoiceId)
      .populate('order_id')
      .populate('customer_id', 'name email phone');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Authorization check
    if (userRole === 'customer' && invoice.customer_id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    res.status(200).json({ invoice });
  } catch (error: any) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Failed to fetch invoice', error: error.message });
  }
};

// Get invoice by order ID
export const getInvoiceByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const invoice = await Invoice.findOne({ order_id: orderId })
      .populate('order_id')
      .populate('customer_id', 'name email phone');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found for this order' });
    }

    // Authorization check
    if (userRole === 'customer' && invoice.customer_id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    res.status(200).json({ invoice });
  } catch (error: any) {
    console.error('Get invoice by order error:', error);
    res.status(500).json({ message: 'Failed to fetch invoice', error: error.message });
  }
};

// Get customer invoices
export const getCustomerInvoices = async (req: Request, res: Response) => {
  try {
    const customer_id = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const invoices = await Invoice.find({ customer_id })
      .sort('-invoiceDate')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Invoice.countDocuments({ customer_id });

    res.status(200).json({
      invoices,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get customer invoices error:', error);
    res.status(500).json({ message: 'Failed to fetch invoices', error: error.message });
  }
};

// Get all invoices (admin)
export const getAllInvoices = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .populate('customer_id', 'name email')
      .sort('-invoiceDate')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Invoice.countDocuments(filter);

    res.status(200).json({
      invoices,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ message: 'Failed to fetch invoices', error: error.message });
  }
};

// Send invoice via email
export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate('customer_id', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const customer: any = invoice.customer_id;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .invoice-details { padding: 20px; }
          .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>INVOICE</h1>
          </div>
          <div class="invoice-details">
            <div class="invoice-info">
              <div>
                <strong>Invoice Number:</strong> ${invoice.invoiceNumber}<br>
                <strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}<br>
                <strong>Payment Status:</strong> ${invoice.paymentStatus}
              </div>
              <div>
                <strong>Bill To:</strong><br>
                ${invoice.billingAddress.name}<br>
                ${invoice.billingAddress.street}<br>
                ${invoice.billingAddress.city}, ${invoice.billingAddress.state}<br>
                ${invoice.billingAddress.pincode}<br>
                ${invoice.billingAddress.phone}
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.unitPrice.toFixed(2)}</td>
                    <td>₹${item.subtotal.toFixed(2)}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td colspan="3" style="text-align: right;"><strong>Subtotal:</strong></td>
                  <td>₹${invoice.subtotal.toFixed(2)}</td>
                </tr>
                ${invoice.deliveryCharge > 0 ? `
                <tr>
                  <td colspan="3" style="text-align: right;"><strong>Delivery Charge:</strong></td>
                  <td>₹${invoice.deliveryCharge.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right;"><strong>Total Amount:</strong></td>
                  <td>₹${invoice.totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>© 2024 PET Marketplace. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: customer.email,
      subject: `Invoice ${invoice.invoiceNumber} - PET Marketplace`,
      html,
    });

    res.status(200).json({
      message: 'Invoice sent successfully',
    });
  } catch (error: any) {
    console.error('Send invoice email error:', error);
    res.status(500).json({ message: 'Failed to send invoice', error: error.message });
  }
};
