import { Request, Response, NextFunction } from 'express';
import { AnimalAdService } from '../services/AnimalAdService';
import { AuthRequest } from '../middlewares/auth';
import { AnimalCategory } from '../models/AnimalAd';

// Public — fetch active ads for a single animal category (used by category pages)
export const getActiveAdsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mainCategory } = req.params;
    const ads = await AnimalAdService.getActiveAdsByCategory(mainCategory as AnimalCategory);
    res.status(200).json({ success: true, data: { ads } });
  } catch (error: any) {
    next(error);
  }
};

// Admin — list all ads (optional category filter + includeInactive)
export const getAllAds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mainCategory = req.query.mainCategory as AnimalCategory | undefined;
    const includeInactive = req.query.includeInactive === 'true';
    const ads = await AnimalAdService.getAllAds({ mainCategory, includeInactive });
    res.status(200).json({ success: true, data: { ads } });
  } catch (error: any) {
    next(error);
  }
};

export const getAdById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AnimalAdService.getAdById(req.params.id);
    res.status(200).json({ success: true, data: { ad } });
  } catch (error: any) {
    next(error);
  }
};

export const createAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AnimalAdService.createAd(req.body);
    res.status(201).json({
      success: true,
      message: 'Animal ad created successfully',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AnimalAdService.updateAd(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Animal ad updated successfully',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await AnimalAdService.deleteAd(req.params.id);
    res.status(200).json({ success: true, message: 'Animal ad deleted successfully' });
  } catch (error: any) {
    next(error);
  }
};

export const reorderAds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { adOrders } = req.body; // [{ id, displayOrder }]
    const ads = await AnimalAdService.reorderAds(adOrders);
    res.status(200).json({
      success: true,
      message: 'Ads reordered successfully',
      data: { ads },
    });
  } catch (error: any) {
    next(error);
  }
};
