import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('Create Product Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Images received:', req.body.images);
    const product = await ProductService.createProduct(req.body);
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
    const product = await ProductService.updateProduct(req.params.id, req.body);
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
