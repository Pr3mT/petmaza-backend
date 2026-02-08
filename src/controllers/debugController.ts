import { Request, Response, NextFunction } from 'express';
import Product from '../models/Product';

export const debugProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all products
    const allProducts = await Product.find({}).select('name hasVariants variants isActive parentProduct variantInfo').lean();
    
    // Separate by type
    const variantProducts = allProducts.filter(p => p.hasVariants);
    const separateProducts = allProducts.filter(p => p.parentProduct);
    const normalProducts = allProducts.filter(p => !p.hasVariants && !p.parentProduct);
    
    res.json({
      success: true,
      data: {
        total: allProducts.length,
        variantProducts: {
          count: variantProducts.length,
          products: variantProducts.map(p => ({
            _id: p._id,
            name: p.name,
            isActive: p.isActive,
            variantsCount: p.variants?.length || 0,
            variants: p.variants?.map(v => ({
              weight: v.weight,
              unit: v.unit,
              displayWeight: v.displayWeight,
              mrp: v.mrp,
              sellingPercentage: v.sellingPercentage,
              isActive: v.isActive
            }))
          }))
        },
        separateVariantProducts: {
          count: separateProducts.length,
          products: separateProducts.map(p => ({
            _id: p._id,
            name: p.name,
            parentProduct: p.parentProduct,
            variantInfo: p.variantInfo
          }))
        },
        normalProducts: {
          count: normalProducts.length,
          products: normalProducts.map(p => ({ _id: p._id, name: p.name }))
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
