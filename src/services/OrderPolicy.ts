import Product from '../models/Product';
import { IProduct } from '../types';

export class OrderPolicy {
  /**
   * Validate that all products in cart are of the same type
   */
  static validateProductTypes(products: IProduct[]): { valid: boolean; orderType?: 'express' | 'standard'; error?: string } {
    if (products.length === 0) {
      return { valid: false, error: 'Cart cannot be empty' };
    }

    const firstProductType = products[0].type;
    const allSameType = products.every(p => p.type === firstProductType);

    if (!allSameType) {
      return {
        valid: false,
        error: 'Cannot mix basic and special products in one order',
      };
    }

    const orderType = firstProductType === 'basic' ? 'express' : 'standard';

    return {
      valid: true,
      orderType,
    };
  }

  /**
   * Get acceptance deadline based on order type
   */
  static getAcceptanceDeadline(orderType: 'express' | 'standard'): Date {
    const now = new Date();
    if (orderType === 'express') {
      // 5 minutes for express orders
      return new Date(now.getTime() + 5 * 60 * 1000);
    } else {
      // 12 hours for standard orders
      return new Date(now.getTime() + 12 * 60 * 60 * 1000);
    }
  }

  /**
   * Get initial order status based on order type
   */
  static getInitialStatus(orderType: 'express' | 'standard', paymentStatus: string): string {
    if (orderType === 'express') {
      return 'PENDING_BROADCAST';
    } else {
      if (paymentStatus === 'Paid') {
        return 'TO_BE_ASSIGNED_TO_SPECIAL_VENDOR';
      }
      return 'TO_BE_ASSIGNED_TO_SPECIAL_VENDOR';
    }
  }

  /**
   * Check if order can be accepted (deadline not passed)
   */
  static canAcceptOrder(deadline?: Date): boolean {
    if (!deadline) return false;
    return new Date() < deadline;
  }
}

