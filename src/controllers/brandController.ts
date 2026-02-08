import { Request, Response, NextFunction } from 'express';
import { BrandService } from '../services/BrandService';
import { AppError } from '../middlewares/errorHandler';

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.createBrand(req.body);
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const brands = await BrandService.getAllBrands(includeInactive);
    res.status(200).json({
      success: true,
      data: { brands },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getBrandById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.getBrandById(req.params.id);
    res.status(200).json({
      success: true,
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.updateBrand(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.deleteBrand(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

