import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/CategoryService';
import { AppError } from '../middlewares/errorHandler';

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await CategoryService.createCategory(req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await CategoryService.getAllCategories(includeInactive);
    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await CategoryService.getCategoryById(req.params.id);
    res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await CategoryService.updateCategory(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await CategoryService.deleteCategory(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

