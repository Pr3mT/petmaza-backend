/**
 * Product Subcategories organized by Main Category
 * These are used across the application for brand tagging and product categorization
 */

export const SUBCATEGORIES_BY_MAIN_CATEGORY = {
  'Dog': [
    'Dog Food',
    'Dog Toys',
    'Dog Accessories',
    'Dog Medicine',
    'Dog Grooming',
    'Dog Health',
    'Dog Treats',
    'Dog Bowls & Feeders',
    'Dog Beds & Furniture',
    'Dog Collars & Leashes',
    'Dog Training & Behavior',
  ],
  'Cat': [
    'Cat Food',
    'Cat Toys',
    'Cat Accessories',
    'Cat Medicine',
    'Cat Grooming',
    'Cat Litter',
    'Cat Treats',
    'Cat Bowls & Feeders',
    'Cat Beds & Furniture',
    'Cat Scratchers',
  ],
  'Fish': [
    'Fish Food',
    'Aquarium Tanks',
    'Aquarium Filters',
    'Aquarium Decor',
    'Aquarium Lights',
    'Aquarium Accessories',
    'Fish Medicine',
    'Water Treatment',
    'Air Pumps',
  ],
  'Bird': [
    'Bird Food',
    'Bird Cages',
    'Bird Toys',
    'Bird Accessories',
    'Bird Medicine',
    'Bird Perches',
    'Bird Treats',
    'Bird Baths',
  ],
  'Small Animals': [
    'Small Animal Food',
    'Small Animal Cages',
    'Small Animal Toys',
    'Small Animal Accessories',
    'Small Animal Medicine',
    'Small Animal Bedding',
    'Small Animal Treats',
  ],
};

// Flattened list of all subcategories
export const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES_BY_MAIN_CATEGORY).flat();

// Helper function to get subcategories for a main category
export const getSubcategoriesForMainCategory = (mainCategory: string): string[] => {
  return SUBCATEGORIES_BY_MAIN_CATEGORY[mainCategory as keyof typeof SUBCATEGORIES_BY_MAIN_CATEGORY] || [];
};

// Helper function to validate subcategory
export const isValidSubcategory = (subcategory: string): boolean => {
  return ALL_SUBCATEGORIES.includes(subcategory);
};

// Helper function to get main category from subcategory
export const getMainCategoryFromSubcategory = (subcategory: string): string | null => {
  for (const [mainCategory, subcategories] of Object.entries(SUBCATEGORIES_BY_MAIN_CATEGORY)) {
    if (subcategories.includes(subcategory)) {
      return mainCategory;
    }
  }
  return null;
};
