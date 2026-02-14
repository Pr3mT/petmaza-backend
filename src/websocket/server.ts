import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import logger from '../config/logger';

export const initializeWebSocket = (io: Server) => {
  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info(`User connected: ${user.email} (${user.role})`);

    // Join user-specific room
    socket.join(`user:${user._id}`);

    // Join role-specific rooms
    if (user.role === 'customer') {
      socket.join(`customer:${user._id}`);
    } else if (user.role === 'vendor') {
      socket.join(`vendor:${user._id}`);
      // Prime vendors don't need pincode rooms
      // MY_SHOP vendors handle all normal orders directly
    }

    // Handle vendor joining pincode room (keeping for potential future use)
    socket.on('vendor:join:pincode', (pincode: string) => {
      if (user.role === 'vendor') {
        socket.join(`vendor:pincode:${pincode}`);
        logger.info(`Vendor ${user.email} joined pincode room: ${pincode}`);
      }
    });

    // Handle vendor leaving pincode room
    socket.on('vendor:leave:pincode', (pincode: string) => {
      socket.leave(`vendor:pincode:${pincode}`);
      logger.info(`Vendor ${user.email} left pincode room: ${pincode}`);
    });

    // Handle order acceptance (for real-time updates)
    socket.on('vendor:accept:order', (data: { orderId: string }) => {
      logger.info(`Vendor ${user.email} accepted order: ${data.orderId}`);
      // Order acceptance is handled by the API, this is just for real-time notification
    });

    // Handle status updates (for real-time updates)
    socket.on('vendor:update:status', (data: { orderId: string; status: string }) => {
      logger.info(`Vendor ${user.email} updated order ${data.orderId} status to ${data.status}`);
      // Status update is handled by the API, this is just for real-time notification
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${user.email}`);
    });

    // Send connection confirmation
    socket.emit('connected', {
      message: 'Connected to PET Marketplace WebSocket',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  });

  logger.info('WebSocket server initialized');
};

