import Order from '../models/Order';
import { AppError } from '../middlewares/errorHandler';

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AnalyticsData {
  period: string;
  revenue: number;
  profit: number;
  orders: number;
  averageOrderValue: number;
}

export interface OrderReport {
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderDate: Date;
  status: string;
  paymentStatus: string;
  revenue: number;
  profit: number;
  items: number;
}

export class AnalyticsService {
  /**
   * Get analytics data for a specific time period
   */
  static async getAnalytics(period: TimePeriod, startDate?: Date, endDate?: Date): Promise<AnalyticsData[]> {
    const dateRange = this.getDateRange(period, startDate, endDate);
    const { start, end, groupFormat } = dateRange;

    // Query orders within date range and with payment status 'Paid'
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
      payment_status: 'Paid', // Only count paid orders
    }).sort({ createdAt: 1 });

    // Group orders by period
    const groupedData = new Map<string, {
      revenue: number;
      profit: number;
      orders: number;
    }>();

    orders.forEach(order => {
      const periodKey = this.getPeriodKey(order.createdAt, groupFormat);
      
      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, { revenue: 0, profit: 0, orders: 0 });
      }

      const data = groupedData.get(periodKey)!;
      data.revenue += order.total || 0;
      data.profit += order.totalProfit || 0;
      data.orders += 1;
    });

    // Convert to array and format
    const result: AnalyticsData[] = [];
    const periods = this.generatePeriods(start, end, period);

    periods.forEach(periodKey => {
      const data = groupedData.get(periodKey) || { revenue: 0, profit: 0, orders: 0 };
      result.push({
        period: this.formatPeriodLabel(periodKey, period),
        revenue: Math.round(data.revenue * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
        orders: data.orders,
        averageOrderValue: data.orders > 0 
          ? Math.round((data.revenue / data.orders) * 100) / 100 
          : 0,
      });
    });

    return result;
  }

  /**
   * Get order-wise report
   */
  static async getOrderReport(
    startDate?: Date,
    endDate?: Date,
    status?: string,
    paymentStatus?: string,
    limit: number = 100,
    skip: number = 0
  ): Promise<{ orders: OrderReport[]; total: number }> {
    const query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.payment_status = paymentStatus;
    }

    const orders = await Order.find(query)
      .populate('customer_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    const orderReports: OrderReport[] = orders.map((order: any) => {
      const customer = order.customer_id || {};
      return {
        orderId: order._id.toString(),
        customerName: customer.name || 'N/A',
        customerEmail: customer.email || 'N/A',
        orderDate: order.createdAt,
        status: order.status,
        paymentStatus: order.payment_status,
        revenue: order.total || 0,
        profit: order.totalProfit || 0,
        items: order.items?.length || 0,
      };
    });

    return { orders: orderReports, total };
  }

  /**
   * Get summary statistics
   */
  static async getSummary(startDate?: Date, endDate?: Date) {
    const query: any = {
      payment_status: 'Paid',
    };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const orders = await Order.find(query).lean();

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalProfit = orders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Status breakdown
    const statusBreakdown = orders.reduce((acc: any, order: any) => {
      const status = order.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      statusBreakdown,
    };
  }

  /**
   * Get date range for period
   */
  private static getDateRange(period: TimePeriod, startDate?: Date, endDate?: Date) {
    const now = new Date();
    let start: Date;
    let end: Date = endDate || now;
    let groupFormat: string;

    if (startDate) {
      start = startDate;
    } else {
      // Default to last period based on type
      switch (period) {
        case 'daily':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          groupFormat = 'YYYY-MM-DD';
          break;
        case 'weekly':
          start = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // Last 12 weeks
          groupFormat = 'YYYY-WW';
          break;
        case 'monthly':
          start = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // Last 12 months
          groupFormat = 'YYYY-MM';
          break;
        case 'yearly':
          start = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000); // Last 5 years
          groupFormat = 'YYYY';
          break;
        default:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupFormat = 'YYYY-MM-DD';
      }
    }

    return { start, end, groupFormat };
  }

  /**
   * Get period key from date
   */
  private static getPeriodKey(date: Date, format: string): string {
    const d = new Date(date);
    const pad = (n: number) => n < 10 ? '0' + n : String(n);
    
    if (format === 'YYYY-MM-DD') {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } else if (format === 'YYYY-WW') {
      const week = this.getWeekNumber(d);
      return `${d.getFullYear()}-W${pad(week)}`;
    } else if (format === 'YYYY-MM') {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    } else if (format === 'YYYY') {
      return `${d.getFullYear()}`;
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate all periods in range
   */
  private static generatePeriods(start: Date, end: Date, period: TimePeriod): string[] {
    const periods: string[] = [];
    const current = new Date(start);
    const groupFormat = this.getDateRange(period, start, end).groupFormat;

    while (current <= end) {
      periods.push(this.getPeriodKey(current, groupFormat));
      
      // Increment based on period
      if (period === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (period === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (period === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      } else if (period === 'yearly') {
        current.setFullYear(current.getFullYear() + 1);
      }
    }

    return periods;
  }

  /**
   * Format period label for display
   */
  private static formatPeriodLabel(periodKey: string, period: TimePeriod): string {
    if (period === 'daily') {
      const [year, month, day] = periodKey.split('-');
      return `${day}/${month}/${year}`;
    } else if (period === 'weekly') {
      return periodKey.replace('-W', ' Week ');
    } else if (period === 'monthly') {
      const [year, month] = periodKey.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    } else if (period === 'yearly') {
      return periodKey;
    }
    return periodKey;
  }

  /**
   * Get week number of year
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

