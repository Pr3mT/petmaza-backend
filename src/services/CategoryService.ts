import Category from '../models/Category';
import { AppError } from '../middlewares/errorHandler';

export class CategoryService {
  // Create category
  static async createCategory(data: {
    name: string;
    description?: string;
    image?: string;
    parentCategoryId?: string;
  }) {
    const category = await Category.create(data);
    return category;
  }

  // Get all categories (with nested support)
  static async getAllCategories(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const categories = await Category.find(query).sort({ createdAt: -1 });
    
    // Build nested structure
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map
    categories.forEach((cat) => {
      categoryMap.set(cat._id.toString(), {
        ...cat.toObject(),
        children: [],
      });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const categoryObj = categoryMap.get(cat._id.toString());
      if (cat.parentCategoryId) {
        const parent = categoryMap.get(cat.parentCategoryId.toString());
        if (parent) {
          parent.children.push(categoryObj);
        } else {
          rootCategories.push(categoryObj);
        }
      } else {
        rootCategories.push(categoryObj);
      }
    });

    return rootCategories;
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }
    return category;
  }

  // Update category
  static async updateCategory(id: string, data: {
    name?: string;
    description?: string;
    image?: string;
    parentCategoryId?: string;
    isActive?: boolean;
  }) {
    const category = await Category.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }

  // Delete category (soft delete)
  static async deleteCategory(id: string) {
    const category = await Category.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }
}

