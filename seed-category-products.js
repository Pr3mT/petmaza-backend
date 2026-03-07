const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Simple schema definitions (avoiding TypeScript import issues)
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  category_id: mongoose.Schema.Types.ObjectId,
  brand_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  mainCategory: String,
  subCategory: String,
  weight: Number,
  unit: String,
  displayWeight: String,
  mrp: Number,
  sellingPercentage: Number,
  sellingPrice: Number,
  discount: Number,
  purchasePercentage: Number,
  purchasePrice: Number,
  isPrime: Boolean,
  primeVendor_id: mongoose.Schema.Types.ObjectId,
  images: [String],
  isActive: Boolean
}, { timestamps: true });

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Brand = mongoose.model('Brand', brandSchema);
const Category = mongoose.model('Category', categorySchema);

const PRODUCTS_DATA = [
  // ========== DOG PRODUCTS ==========
  // Dog Food
  {
    name: 'Pedigree Adult Dry Dog Food - Chicken & Vegetables 3kg',
    description: 'Complete nutrition for adult dogs with real chicken and vegetables. Supports healthy digestion and strong immunity.',
    mainCategory: 'Dog',
    subCategory: 'Dog Food',
    brand: 'Pedigree',
    weight: 3000,
    unit: 'g',
    displayWeight: '3kg',
    mrp: 950,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Royal Canin Medium Adult Dog Food 10kg',
    description: 'Premium nutrition specially formulated for medium breed adult dogs. Enhanced with vitamins and minerals.',
    mainCategory: 'Dog',
    subCategory: 'Dog Food',
    brand: 'Royal Canin',
    weight: 10000,
    unit: 'g',
    displayWeight: '10kg',
    mrp: 5500,
    sellingPercentage: 82,
    purchasePercentage: 62,
    images: ['https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Dog Accessories
  {
    name: 'Adjustable Nylon Dog Collar - Medium Size',
    description: 'Durable nylon collar with quick-release buckle. Perfect for daily walks and training.',
    mainCategory: 'Dog',
    subCategory: 'Dog Accessories',
    brand: 'Trixie',
    mrp: 450,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Retractable Dog Leash 5m - Heavy Duty',
    description: 'Strong retractable leash with comfortable grip handle. Suitable for dogs up to 50kg.',
    mainCategory: 'Dog',
    subCategory: 'Dog Accessories',
    brand: 'PetSafe',
    mrp: 1200,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Dog Medicine
  {
    name: 'Deworming Tablet for Dogs - 10 Tablets',
    description: 'Effective deworming treatment for dogs. Eliminates intestinal worms and parasites.',
    mainCategory: 'Dog',
    subCategory: 'Dog Medicine',
    brand: 'Himalaya',
    mrp: 250,
    sellingPercentage: 85,
    purchasePercentage: 65,
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Skin Care Shampoo for Dogs 200ml',
    description: 'Medicated shampoo for dogs with sensitive skin. Anti-fungal and anti-bacterial formula.',
    mainCategory: 'Dog',
    subCategory: 'Dog Medicine',
    brand: 'Himalaya',
    weight: 200,
    unit: 'ml',
    displayWeight: '200ml',
    mrp: 350,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Dog Toys
  {
    name: 'Rubber Chew Toy Bone - Large',
    description: 'Durable rubber bone for aggressive chewers. Helps clean teeth and massage gums.',
    mainCategory: 'Dog',
    subCategory: 'Dog Toys',
    brand: 'Trixie',
    mrp: 380,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Interactive Rope Tug Toy',
    description: 'Cotton rope toy perfect for tug-of-war games. Strengthens bond between pet and owner.',
    mainCategory: 'Dog',
    subCategory: 'Dog Toys',
    brand: 'PetSafe',
    mrp: 280,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1603003405754-f8f8ca5e1165?w=500'],
    isPrime: false,
    isActive: true
  },

  // ========== CAT PRODUCTS ==========
  // Cat Food
  {
    name: 'Whiskas Adult Dry Cat Food - Ocean Fish 1.2kg',
    description: 'Complete and balanced nutrition for adult cats with real ocean fish flavor.',
    mainCategory: 'Cat',
    subCategory: 'Cat Food',
    brand: 'Whiskas',
    weight: 1200,
    unit: 'g',
    displayWeight: '1.2kg',
    mrp: 450,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1589652717521-10c0d092dea9?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Meo Persian Adult Cat Food 1kg',
    description: 'Specially formulated for Persian cats. Promotes healthy skin and shiny coat.',
    mainCategory: 'Cat',
    subCategory: 'Cat Food',
    brand: 'Meo',
    weight: 1000,
    unit: 'g',
    displayWeight: '1kg',
    mrp: 520,
    sellingPercentage: 82,
    purchasePercentage: 62,
    images: ['https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Cat Accessories
  {
    name: 'Cat Litter Box with Cover - Large',
    description: 'Enclosed litter box for privacy and odor control. Easy to clean and maintain.',
    mainCategory: 'Cat',
    subCategory: 'Cat Accessories',
    brand: 'PetSafe',
    mrp: 2500,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Cardboard Cat Scratcher Post',
    description: 'Protects furniture from scratching. Includes catnip to attract cats.',
    mainCategory: 'Cat',
    subCategory: 'Cat Accessories',
    brand: 'Trixie',
    mrp: 800,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Cat Medicine
  {
    name: 'Anti-Tick & Flea Spot-On for Cats',
    description: 'Effective protection against ticks and fleas for 30 days. Easy to apply.',
    mainCategory: 'Cat',
    subCategory: 'Cat Medicine',
    brand: 'Himalaya',
    mrp: 380,
    sellingPercentage: 85,
    purchasePercentage: 65,
    images: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Hairball Control Paste 100g',
    description: 'Helps prevent and eliminate hairballs. Improves digestive health.',
    mainCategory: 'Cat',
    subCategory: 'Cat Medicine',
    brand: 'Himalaya',
    weight: 100,
    unit: 'g',
    displayWeight: '100g',
    mrp: 420,
    sellingPercentage: 82,
    purchasePercentage: 62,
    images: ['https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Cat Toys
  {
    name: 'Interactive Feather Wand Toy',
    description: 'Engaging feather toy on a stick. Stimulates natural hunting instincts.',
    mainCategory: 'Cat',
    subCategory: 'Cat Toys',
    brand: 'Trixie',
    mrp: 220,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1516750484197-8e6a3e5e7e2f?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Catnip Stuffed Mouse Toy - Pack of 3',
    description: 'Soft plush mice filled with premium catnip. Keeps cats entertained for hours.',
    mainCategory: 'Cat',
    subCategory: 'Cat Toys',
    brand: 'PetSafe',
    mrp: 180,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1501820434261-5bb046afcf6b?w=500'],
    isPrime: false,
    isActive: true
  },

  // ========== FISH PRODUCTS ==========
  // Fish Food
  {
    name: 'TetraMin Tropical Fish Flakes 100g',
    description: 'Complete diet for all tropical fish. Enhances color and vitality.',
    mainCategory: 'Fish',
    subCategory: 'Fish Food',
    brand: 'Tetra',
    weight: 100,
    unit: 'g',
    displayWeight: '100g',
    mrp: 320,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Goldfish Pellets Premium Food 250g',
    description: 'Specially formulated pellets for goldfish. Promotes growth and vibrant colors.',
    mainCategory: 'Fish',
    subCategory: 'Fish Food',
    brand: 'Taiyo',
    weight: 250,
    unit: 'g',
    displayWeight: '250g',
    mrp: 280,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Fish Accessories
  {
    name: 'Aquarium Fish Net - Medium Size',
    description: 'Soft mesh net for safely catching fish. Comfortable grip handle.',
    mainCategory: 'Fish',
    subCategory: 'Fish Accessories',
    brand: 'Aqua One',
    mrp: 120,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Automatic Fish Feeder Timer',
    description: 'Programmable auto feeder for when you\'re away. Holds 200g of food.',
    mainCategory: 'Fish',
    subCategory: 'Fish Accessories',
    brand: 'Aqua One',
    mrp: 1800,
    sellingPercentage: 82,
    purchasePercentage: 62,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Fish Medicine
  {
    name: 'Anti-Fungal Treatment for Fish 50ml',
    description: 'Treats fungal infections in aquarium fish. Safe for all freshwater species.',
    mainCategory: 'Fish',
    subCategory: 'Fish Medicine',
    brand: 'Tetra',
    weight: 50,
    unit: 'ml',
    displayWeight: '50ml',
    mrp: 280,
    sellingPercentage: 85,
    purchasePercentage: 65,
    images: ['https://images.unsplash.com/photo-1522720833375-7e0f8419d2e3?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Water Conditioner & Dechlorinator 100ml',
    description: 'Makes tap water safe for fish. Removes chlorine and heavy metals.',
    mainCategory: 'Fish',
    subCategory: 'Fish Medicine',
    brand: 'Tetra',
    weight: 100,
    unit: 'ml',
    displayWeight: '100ml',
    mrp: 320,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1512850183-6d7990f42385?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Fish Tank Supplies
  {
    name: 'LED Aquarium Light 30cm',
    description: 'Energy-efficient LED lighting for aquariums. Promotes plant growth.',
    mainCategory: 'Fish',
    subCategory: 'Fish Tank Supplies',
    brand: 'Aqua One',
    mrp: 1200,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Aquarium Air Pump with Accessories',
    description: 'Quiet air pump for oxygenation. Includes tubing and air stone.',
    mainCategory: 'Fish',
    subCategory: 'Fish Tank Supplies',
    brand: 'Aqua One',
    mrp: 850,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },

  // ========== BIRD PRODUCTS ==========
  // Bird Food
  {
    name: 'Premium Budgie Bird Food Mix 500g',
    description: 'Nutritious seed mix for budgies and small parrots. Vitamin enriched.',
    mainCategory: 'Bird',
    subCategory: 'Bird Food',
    brand: 'Taiyo',
    weight: 500,
    unit: 'g',
    displayWeight: '500g',
    mrp: 180,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Parrot Food Pellets 1kg',
    description: 'Complete nutrition pellets for medium to large parrots. Fruit flavored.',
    mainCategory: 'Bird',
    subCategory: 'Bird Food',
    brand: 'Vitapol',
    weight: 1000,
    unit: 'g',
    displayWeight: '1kg',
    mrp: 450,
    sellingPercentage: 82,
    purchasePercentage: 62,
    images: ['https://images.unsplash.com/photo-1444464666168-49d633b86797?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Bird Accessories
  {
    name: 'Bird Cage Swing Perch',
    description: 'Natural wood swing for birds. Provides exercise and entertainment.',
    mainCategory: 'Bird',
    subCategory: 'Bird Accessories',
    brand: 'Trixie',
    mrp: 220,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Stainless Steel Bird Food & Water Bowl Set',
    description: 'Set of 2 bowls with cage clips. Easy to clean and rust-proof.',
    mainCategory: 'Bird',
    subCategory: 'Bird Accessories',
    brand: 'PetSafe',
    mrp: 180,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1535946897-6923da2359ce?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Bird Medicine
  {
    name: 'Bird Vitamin Supplement Drops 30ml',
    description: 'Essential vitamins and minerals for birds. Boosts immunity and energy.',
    mainCategory: 'Bird',
    subCategory: 'Bird Medicine',
    brand: 'Himalaya',
    weight: 30,
    unit: 'ml',
    displayWeight: '30ml',
    mrp: 180,
    sellingPercentage: 85,
    purchasePercentage: 65,
    images: ['https://images.unsplash.com/photo-1535946897-6923da2359ce?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Anti-Mite Spray for Birds 100ml',
    description: 'Effective against mites and lice. Safe for all bird species.',
    mainCategory: 'Bird',
    subCategory: 'Bird Medicine',
    brand: 'Himalaya',
    weight: 100,
    unit: 'ml',
    displayWeight: '100ml',
    mrp: 250,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1444464666168-49d633b86797?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Bird Toys
  {
    name: 'Colorful Bird Bell Toy',
    description: 'Hanging bell toy with colorful beads. Stimulates play and exercise.',
    mainCategory: 'Bird',
    subCategory: 'Bird Toys',
    brand: 'Trixie',
    mrp: 150,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1520990269108-4f3e3e1a03c2?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Bird Mirror with Perch',
    description: 'Mirror toy keeps birds entertained. Includes perch for sitting.',
    mainCategory: 'Bird',
    subCategory: 'Bird Toys',
    brand: 'PetSafe',
    mrp: 120,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1535946897-6923da2359ce?w=500'],
    isPrime: false,
    isActive: true
  },

  // ========== SMALL ANIMALS PRODUCTS ==========
  // Small Animal Food
  {
    name: 'Premium Rabbit Food Pellets 1kg',
    description: 'Complete nutrition for rabbits. High in fiber with timothy hay.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Food',
    brand: 'Vitapol',
    weight: 1000,
    unit: 'g',
    displayWeight: '1kg',
    mrp: 380,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Hamster & Gerbil Mix Food 500g',
    description: 'Balanced diet for hamsters and gerbils. Contains seeds, grains, and vegetables.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Food',
    brand: 'Vitapol',
    weight: 500,
    unit: 'g',
    displayWeight: '500g',
    mrp: 220,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Small Animal Accessories
  {
    name: 'Small Animal Water Bottle 250ml',
    description: 'Leak-proof water bottle with metal spout. Easy to attach to cage.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Accessories',
    brand: 'Trixie',
    weight: 250,
    unit: 'ml',
    displayWeight: '250ml',
    mrp: 180,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Rabbit Hay Feeder Rack',
    description: 'Keeps hay clean and fresh. Attaches easily to any cage.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Accessories',
    brand: 'PetSafe',
    mrp: 280,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Small Animal Medicine
  {
    name: 'Small Pet Vitamin Drops 50ml',
    description: 'Essential vitamins for rabbits, hamsters, and guinea pigs. Supports overall health.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Medicine',
    brand: 'Himalaya',
    weight: 50,
    unit: 'ml',
    displayWeight: '50ml',
    mrp: 220,
    sellingPercentage: 85,
    purchasePercentage: 65,
    images: ['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Anti-Diarrheal Supplement for Small Animals',
    description: 'Helps control digestive issues. Safe for all small mammals.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Medicine',
    brand: 'Himalaya',
    mrp: 180,
    sellingPercentage: 80,
    purchasePercentage: 60,
    images: ['https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500'],
    isPrime: false,
    isActive: true
  },
  
  // Small Animal Toys
  {
    name: 'Wooden Chew Toy Set for Rabbits',
    description: 'Natural wood chew toys. Helps maintain healthy teeth.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Toys',
    brand: 'Trixie',
    mrp: 220,
    sellingPercentage: 75,
    purchasePercentage: 55,
    images: ['https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=500'],
    isPrime: false,
    isActive: true
  },
  {
    name: 'Hamster Exercise Wheel - Silent',
    description: 'Quiet running wheel for hamsters and gerbils. Encourages exercise.',
    mainCategory: 'Small Animals',
    subCategory: 'Small Animal Toys',
    brand: 'PetSafe',
    mrp: 380,
    sellingPercentage: 78,
    purchasePercentage: 58,
    images: ['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=500'],
    isPrime: false,
    isActive: true
  }
];

async function seedProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get existing brands and categories
    const brands = await Brand.find();
    const categories = await Category.find();
    
    console.log(`📦 Found ${brands.length} brands and ${categories.length} categories`);
    
    // Create brand map
    const brandMap = {};
    brands.forEach(brand => {
      brandMap[brand.name] = brand._id;
    });
    
    // Create missing brands
    const existingBrandNames = brands.map(b => b.name);
    const requiredBrands = ['Pedigree', 'Royal Canin', 'Trixie', 'PetSafe', 'Himalaya', 
                           'Whiskas', 'Meo', 'Tetra', 'Taiyo', 'Aqua One', 'Vitapol'];
    
    for (const brandName of requiredBrands) {
      if (!existingBrandNames.includes(brandName)) {
        console.log(`➕ Creating brand: ${brandName}`);
        const newBrand = await Brand.create({ name: brandName, isActive: true });
        brandMap[brandName] = newBrand._id;
      }
    }

    // Get a default category for backward compatibility (optional)
    const defaultCategory = categories[0]?._id || null;

    console.log('\n🌱 Starting to seed products...\n');

    let addedCount = 0;
    let skippedCount = 0;

    for (const productData of PRODUCTS_DATA) {
      // Check if product already exists
      const existingProduct = await Product.findOne({ 
        name: productData.name 
      });

      if (existingProduct) {
        console.log(`⏭️  Skipped: ${productData.name} (already exists)`);
        skippedCount++;
        continue;
      }

      // Get brand ID
      const brandId = brandMap[productData.brand];
      if (!brandId) {
        console.log(`❌ Skipped: ${productData.name} (brand not found: ${productData.brand})`);
        skippedCount++;
        continue;
      }

      // Prepare product data
      const newProduct = {
        ...productData,
        brand_id: brandId,
        category_id: defaultCategory, // Optional backward compatibility
      };

      // Remove the string brand name (we have brand_id now)
      delete newProduct.brand;

      // Calculate prices
      newProduct.sellingPrice = (newProduct.mrp * (newProduct.sellingPercentage / 100)).toFixed(2);
      newProduct.purchasePrice = (newProduct.mrp * (newProduct.purchasePercentage / 100)).toFixed(2);
      newProduct.discount = Math.round(((newProduct.mrp - newProduct.sellingPrice) / newProduct.mrp) * 100);

      // Create product
      await Product.create(newProduct);
      console.log(`✅ Added: ${productData.name} (${productData.mainCategory} - ${productData.subCategory})`);
      addedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Seeding completed!`);
    console.log(`✅ Added: ${addedCount} products`);
    console.log(`⏭️  Skipped: ${skippedCount} products (already exist)`);
    console.log('='.repeat(60) + '\n');

    // Show summary by category
    console.log('📊 Products by Category:\n');
    const categoryCounts = await Product.aggregate([
      { $match: { mainCategory: { $exists: true } } },
      { $group: { 
          _id: { main: '$mainCategory', sub: '$subCategory' }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { '_id.main': 1, '_id.sub': 1 } }
    ]);

    let currentMain = '';
    categoryCounts.forEach(cat => {
      if (currentMain !== cat._id.main) {
        if (currentMain) console.log('');
        currentMain = cat._id.main;
        console.log(`\n🐾 ${cat._id.main}:`);
      }
      console.log(`   • ${cat._id.sub}: ${cat.count} products`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    process.exit(1);
  }
}

// Run the seed function
seedProducts();
