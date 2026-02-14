import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    // Check permissions: Admin or MY_SHOP vendor
    if (user.role !== 'admin' && user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Only Admin and MY_SHOP vendors can create products', 403));
    }
    
    console.log('Create Product Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Images received:', req.body.images);
    console.log('User role:', user.role, 'Vendor type:', user.vendorType);
    
    const product = await ProductService.createProduct(req.body);
    
    // If MY_SHOP vendor created the product, auto-create VendorProductPricing entry
    if (user.vendorType === 'MY_SHOP') {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      
      await VendorProductPricing.create({
        vendor_id: user._id,
        product_id: product._id,
        purchasePrice: req.body.purchasePrice || (product.mrp * (req.body.purchasePercentage || 60) / 100),
        purchasePercentage: req.body.purchasePercentage || 60,
        availableStock: req.body.availableStock || 0,
        totalSoldWebsite: 0,
        totalSoldStore: 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category_id, brand_id, isPrime, pincode, search } = req.query;

    const filters: any = {};
    if (category_id) filters.category_id = category_id as string;
    if (brand_id) {
      // Handle comma-separated brand_ids or array
      const brandIds = typeof brand_id === 'string' 
        ? brand_id.split(',').map(id => id.trim()).filter(id => id)
        : Array.isArray(brand_id) 
          ? brand_id 
          : [brand_id];
      filters.brand_id = brandIds.length === 1 ? brandIds[0] : brandIds;
    }
    if (isPrime !== undefined) filters.isPrime = isPrime === 'true';
    if (pincode) filters.pincode = pincode as string;
    if (search) filters.search = search as string;

    const products = await ProductService.getAllProducts(filters);
    res.status(200).json({
      success: true,
      data: { products },
    });
  } catch (error: any) {
    console.error('Error in getProducts:', error);
    next(error);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { pincode } = req.query;

    const result = await ProductService.getProductById(id, pincode as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    // Check permissions: Admin can update any, MY_SHOP can update their own
    if (user.role !== 'admin' && user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Only Admin and MY_SHOP vendors can update products', 403));
    }
    
    // If MY_SHOP vendor, verify they own this product
    if (user.vendorType === 'MY_SHOP') {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      const vendorProduct = await VendorProductPricing.findOne({
        vendor_id: user._id,
        product_id: req.params.id,
      });
      
      if (!vendorProduct) {
        return next(new AppError('You can only update products you created', 403));
      }
    }
    
    const product = await ProductService.updateProduct(req.params.id, req.body);
    
    // If MY_SHOP vendor and updating stock/pricing fields, update VendorProductPricing
    if (user.vendorType === 'MY_SHOP' && (req.body.availableStock !== undefined || req.body.purchasePrice !== undefined)) {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      const updateData: any = {};
      
      if (req.body.availableStock !== undefined) updateData.availableStock = req.body.availableStock;
      if (req.body.purchasePrice !== undefined) updateData.purchasePrice = req.body.purchasePrice;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      
      await VendorProductPricing.findOneAndUpdate(
        { vendor_id: user._id, product_id: req.params.id },
        updateData,
        { new: true }
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const product = await ProductService.deleteProduct(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};
