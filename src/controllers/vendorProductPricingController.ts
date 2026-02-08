import { Request, Response, NextFunction } from 'express';
import { VendorProductPricingService } from '../services/VendorProductPricingService';
import { AuthRequest } from '../middlewares/auth';

export const assignProductToVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pricing = await VendorProductPricingService.assignProductToVendor(req.body);
    res.status(201).json({
      success: true,
      message: 'Product assigned to vendor successfully',
      data: { pricing },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getVendorProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor_id = req.params.vendor_id || req.user._id.toString();
    const products = await VendorProductPricingService.getVendorProducts(vendor_id);
    res.status(200).json({
      success: true,
      data: { products },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProductVendors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    const { pincode } = req.query;

    const vendors = await VendorProductPricingService.getProductVendors(
      product_id,
      pincode as string
    );
    res.status(200).json({
      success: true,
      data: { vendors },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateVendorProductPricing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { vendor_id, product_id } = req.params;
    const pricing = await VendorProductPricingService.updateVendorProductPricing(
      vendor_id,
      product_id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Vendor product pricing updated successfully',
      data: { pricing },
    });
  } catch (error: any) {
    next(error);
  }
};

export const removeProductFromVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { vendor_id, product_id } = req.params;
    const pricing = await VendorProductPricingService.removeProductFromVendor(
      vendor_id,
      product_id
    );
    res.status(200).json({
      success: true,
      message: 'Product removed from vendor successfully',
      data: { pricing },
    });
  } catch (error: any) {
    next(error);
  }
};

