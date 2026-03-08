import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Brand from '../models/Brand';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

// Category mappings
const CATEGORIES = [
  {
    mainCategory: 'Dog',
    subcategories: ['Dog Food', 'Dog Accessories', 'Dog Medicine', 'Dog Toys']
  },
  {
    mainCategory: 'Cat',
    subcategories: ['Cat Food', 'Cat Accessories', 'Cat Medicine', 'Cat Toys']
  },
  {
    mainCategory: 'Fish',
    subcategories: ['Fish Food', 'Fish Accessories', 'Fish Medicine', 'Fish Tank Supplies']
  },
  {
    mainCategory: 'Bird',
    subcategories: ['Bird Food', 'Bird Accessories', 'Bird Medicine', 'Bird Toys']
  },
  {
    mainCategory: 'Small Animals',
    subcategories: ['Small Animal Food', 'Small Animal Accessories', 'Small Animal Medicine', 'Small Animal Toys']
  }
];

// Sample brands for each main category
const BRAND_NAMES = {
  'Dog': ['Pedigree', 'Royal Canin', 'Drools', 'Farmina', 'Brit'],
  'Cat': ['Whiskas', 'Royal Canin', 'Meo', 'Sheba', 'Purina'],
  'Fish': ['TetraMin', 'API', 'Hikari', 'Sera', 'Ocean Nutrition'],
  'Bird': ['Taiyo', 'Vitapol', 'Versele-Laga', 'Zupreem', 'Harrison'],
  'Small Animals': ['Oxbow', 'Vitakraft', 'Supreme', 'Beaphar', 'Trixie']
};

// Product templates for each subcategory type
const PRODUCT_TEMPLATES = {
  'Food': [
    { name: 'Premium Adult Food', base: 'High-quality nutrition for adult' },
    { name: 'Puppy/Junior Food', base: 'Complete nutrition for growing' },
    { name: 'Senior Food', base: 'Specially formulated for senior' },
    { name: 'Grain-Free Food', base: 'Natural grain-free formula' },
    { name: 'Organic Food', base: 'Certified organic ingredients' }
  ],
  'Accessories': [
    { name: 'Premium Collar', base: 'Durable and comfortable collar' },
    { name: 'Feeding Bowl Set', base: 'Stainless steel bowl set' },
    { name: 'Grooming Brush', base: 'Professional grooming tool' },
    { name: 'Carrier Bag', base: 'Safe and comfortable carrier' },
    { name: 'Leash & Harness', base: 'Strong and reliable leash' }
  ],
  'Medicine': [
    { name: 'Multivitamin Supplement', base: 'Essential vitamins and minerals' },
    { name: 'Deworming Tablet', base: 'Effective deworming solution' },
    { name: 'Joint Care Supplement', base: 'Supports joint health' },
    { name: 'Skin & Coat Oil', base: 'Promotes healthy skin and coat' },
    { name: 'Probiotic Powder', base: 'Digestive health support' }
  ],
  'Toys': [
    { name: 'Chew Toy Set', base: 'Durable and safe chew toys' },
    { name: 'Interactive Puzzle Toy', base: 'Mental stimulation toy' },
    { name: 'Plush Toy Collection', base: 'Soft and cuddly toys' },
    { name: 'Rope Toy', base: 'Strong rope for tug-of-war' },
    { name: 'Ball Set', base: 'Bouncy and fun ball set' }
  ],
  'Tank Supplies': [
    { name: 'Aquarium Filter', base: 'High-performance filtration' },
    { name: 'Water Conditioner', base: 'Safe water treatment' },
    { name: 'Gravel Substrate', base: 'Natural aquarium gravel' },
    { name: 'LED Aquarium Light', base: 'Energy-efficient lighting' },
    { name: 'Air Pump Kit', base: 'Oxygen supply system' }
  ]
};

// Weight variants for products
const WEIGHT_VARIANTS = [
  { weight: 100, unit: 'g', displayWeight: '100g' },
  { weight: 200, unit: 'g', displayWeight: '200g' },
  { weight: 500, unit: 'g', displayWeight: '500g' },
  { weight: 1, unit: 'kg', displayWeight: '1kg' }
];

// Sample images (you can replace with actual Cloudinary URLs)
const SAMPLE_IMAGES = [
  'https://via.placeholder.com/400x400/FF6B6B/ffffff?text=Product+Image',
  'https://via.placeholder.com/400x400/4ECDC4/ffffff?text=Product+Image',
  'https://via.placeholder.com/400x400/FFE66D/333333?text=Product+Image'
];

async function createBrands() {
  console.log('Creating brands...');
  const brands: any = {};

  for (const [category, brandNames] of Object.entries(BRAND_NAMES)) {
    brands[category] = [];
    for (const brandName of brandNames) {
      let brand = await Brand.findOne({ name: brandName });
      if (!brand) {
        brand = await Brand.create({
          name: brandName,
          description: `Premium ${category.toLowerCase()} products`,
          isActive: true
        });
        console.log(`Created brand: ${brandName}`);
      }
      brands[category].push(brand._id);
    }
  }

  return brands;
}

function getProductTemplate(subcategory: string) {
  if (subcategory.includes('Food')) return PRODUCT_TEMPLATES['Food'];
  if (subcategory.includes('Accessories')) return PRODUCT_TEMPLATES['Accessories'];
  if (subcategory.includes('Medicine')) return PRODUCT_TEMPLATES['Medicine'];
  if (subcategory.includes('Toys')) return PRODUCT_TEMPLATES['Toys'];
  if (subcategory.includes('Tank Supplies')) return PRODUCT_TEMPLATES['Tank Supplies'];
  return PRODUCT_TEMPLATES['Accessories']; // default
}

async function seedProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create brands first
    const brands = await createBrands();

    console.log('\nClearing existing products...');
    await Product.deleteMany({});
    console.log('Cleared existing products');

    console.log('\nCreating products with variants...\n');
    let totalProducts = 0;

    for (const category of CATEGORIES) {
      const { mainCategory, subcategories } = category;
      const categoryBrands = brands[mainCategory];

      for (const subCategory of subcategories) {
        const templates = getProductTemplate(subCategory);

        for (let i = 0; i < 5; i++) {
          const template = templates[i];
          const brandId = categoryBrands[i % categoryBrands.length];

          // Generate MRP between 200-1000 based on variant
          const baseMRP = 200 + (i * 150);

          // Create variants with different prices
          const variants = WEIGHT_VARIANTS.map((variant, index) => {
            const variantMRP = baseMRP + (index * 100); // Increase price with size
            return {
              weight: variant.weight,
              unit: variant.unit,
              displayWeight: variant.displayWeight,
              mrp: variantMRP,
              sellingPercentage: 80, // 80% of MRP
              purchasePercentage: 60, // 60% of MRP
              sellingPrice: variantMRP * 0.80,
              purchasePrice: variantMRP * 0.60,
              isActive: true
            };
          });

          const product = await Product.create({
            name: `${template.name}`,
            description: `${template.base} ${mainCategory.toLowerCase()}s. High-quality formula with premium ingredients. Suitable for all breeds and ages. Trusted by pet owners worldwide.`,
            brand_id: brandId,
            mainCategory,
            subCategory,
            hasVariants: true,
            variants,
            images: SAMPLE_IMAGES,
            isActive: true,
            stock: 100,
            tags: [mainCategory.toLowerCase(), subCategory.toLowerCase(), 'premium', 'quality']
          });

          totalProducts++;
          console.log(`✓ Created: ${product.name} (${mainCategory} > ${subCategory}) - ${variants.length} variants`);
        }
      }
    }

    console.log(`\n✅ Successfully created ${totalProducts} products with variants!`);
    console.log(`Total variants: ${totalProducts * 4}`);

  } catch (error) {
    console.error('Error seeding products:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

seedProducts();
