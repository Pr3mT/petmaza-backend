import { Server } from 'socket.io';
import logger from '../config/logger';

export const broadcastOrderToVendors = (
  io: Server,
  pincode: string,
  order: any,
  deadline: Date
) => {
  io.to(`vendor:pincode:${pincode}`).emit('order:broadcast', {
    order,
    deadline,
    message: 'New express order available',
  });
  logger.info(`Order broadcasted to vendors in pincode: ${pincode}`);
};

export const notifyVendorNewOrder = (
  io: Server,
  vendorId: string,
  order: any,
  deadline: Date
) => {
  io.to(`vendor:${vendorId}`).emit('vendor:order:new', {
    order,
    deadline,
    message: 'New standard order assigned',
  });
  logger.info(`New order notification sent to vendor: ${vendorId}`);
};

export const notifyCustomerOrderUpdate = (
  io: Server,
  customerId: string,
  orderId: string,
  status: string,
  message?: string
) => {
  io.to(`customer:${customerId}`).emit('order:status:update', {
    orderId,
    status,
    message: message || 'Order status updated',
  });
  logger.info(`Order status update sent to customer: ${customerId}`);
};

export const notifyCustomerPaymentLink = (
  io: Server,
  customerId: string,
  orderId: string,
  paymentLink: string
) => {
  io.to(`customer:${customerId}`).emit('payment:link:generated', {
    orderId,
    paymentLink,
    message: 'Payment link generated. Please complete payment.',
  });
  logger.info(`Payment link sent to customer: ${customerId}`);
};

