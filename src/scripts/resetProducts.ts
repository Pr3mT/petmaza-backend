import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';

dotenv.config();

const resetProducts = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    console.log('✅ Cleared existing products, categories, and brands');

    // Create Categories
    const categories = await Category.insertMany([
      { name: 'Dog Food', description: 'Premium dog food and treats', isActive: true },
      { name: 'Cat Food', description: 'Premium cat food and treats', isActive: true },
      { name: 'Bird Food', description: 'Bird seeds and treats', isActive: true },
      { name: 'Dog Accessories', description: 'Toys, collars, leashes, and more for dogs', isActive: true },
      { name: 'Cat Accessories', description: 'Toys, scratchers, and accessories for cats', isActive: true },
      { name: 'Bird Accessories', description: 'Cages, perches, and toys for birds', isActive: true },
    ]);
    console.log('✅ Created categories');

    // Create Brands
    const brands = await Brand.insertMany([
      { name: 'Drools', description: 'Premium pet nutrition', isActive: true },
      { name: 'Pedigree', description: 'Complete nutrition for dogs', isActive: true },
      { name: 'Royal Canin', description: 'Tailored nutrition for pets', isActive: true },
      { name: 'Whiskas', description: 'Complete cat food', isActive: true },
      { name: 'Me-O', description: 'Premium cat food', isActive: true },
      { name: 'Trixie', description: 'Pet accessories and toys', isActive: true },
      { name: 'Pawzone', description: 'Quality pet products', isActive: true },
      { name: 'Foodie Puppies', description: 'Pet toys and accessories', isActive: true },
    ]);
    console.log('✅ Created brands');

    // Create Products with correct schema
    const products = [
      // DOG FOOD - Normal Products
      {
        name: 'Drools Adult Dog Food - 1kg',
        description: 'Premium adult dog food with chicken and rice. Complete nutrition for healthy growth.',
        category_id: categories[0]._id,
        brand_id: brands[0]._id,
        weight: 1000,
        mrp: 1000,
        sellingPercentage: 80,
        sellingPrice: 800,
        purchasePercentage: 60,
        purchasePrice: 600,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Drools+Dog+Food'],
        isActive: true,
      },
      {
        name: 'Pedigree Adult Dog Food - 3kg',
        description: 'Complete and balanced nutrition for adult dogs with real chicken.',
        category_id: categories[0]._id,
        brand_id: brands[1]._id,
        weight: 3000,
        mrp: 1500,
        sellingPercentage: 85,
        sellingPrice: 1275,
        purchasePercentage: 65,
        purchasePrice: 975,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Pedigree'],
        isActive: true,
      },
      {
        name: 'Grain-Free Dog Food - Salmon',
        description: 'Premium grain-free formula with real salmon for sensitive stomachs.',
        category_id: categories[0]._id,
        brand_id: brands[0]._id,
        weight: 2000,
        mrp: 1800,
        sellingPercentage: 80,
        sellingPrice: 1440,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Grain+Free'],
        isActive: true,
      },
      {
        name: 'Senior Dog Food - Joint Care',
        description: 'Specialized nutrition for senior dogs with glucosamine for joint health.',
        category_id: categories[0]._id,
        brand_id: brands[2]._id,
        weight: 2000,
        mrp: 1400,
        sellingPercentage: 80,
        sellingPrice: 1120,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Senior+Dog'],
        isActive: true,
      },
      {
        name: 'Puppy Food - Complete Nutrition',
        description: 'Specially formulated for puppies with DHA for brain development.',
        category_id: categories[0]._id,
        brand_id: brands[1]._id,
        weight: 1000,
        mrp: 800,
        sellingPercentage: 85,
        sellingPrice: 680,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Puppy+Food'],
        isActive: true,
      },
      {
        name: 'Dry Dog Food - Lamb & Vegetables',
        description: 'Dry dog food with lamb and fresh vegetables for balanced nutrition.',
        category_id: categories[0]._id,
        brand_id: brands[0]._id,
        weight: 2500,
        mrp: 1500,
        sellingPercentage: 80,
        sellingPrice: 1200,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Lamb+Food'],
        isActive: true,
      },

      // CAT FOOD - Normal Products
      {
        name: 'Whiskas Adult Cat Food - Ocean Fish',
        description: 'Complete cat food with real ocean fish. Rich in omega fatty acids.',
        category_id: categories[1]._id,
        brand_id: brands[3]._id,
        weight: 1200,
        mrp: 600,
        sellingPercentage: 85,
        sellingPrice: 510,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Whiskas'],
        isActive: true,
      },
      {
        name: 'Me-O Persian Cat Food',
        description: 'Specially formulated for Persian cats with hairball control.',
        category_id: categories[1]._id,
        brand_id: brands[4]._id,
        weight: 1500,
        mrp: 900,
        sellingPercentage: 80,
        sellingPrice: 720,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Me-O+Persian'],
        isActive: true,
      },
      {
        name: 'Kitten Food - Milk & Fish',
        description: 'Nutritious food for growing kittens with milk and fish formula.',
        category_id: categories[1]._id,
        brand_id: brands[3]._id,
        weight: 800,
        mrp: 450,
        sellingPercentage: 85,
        sellingPrice: 383,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Kitten+Food'],
        isActive: true,
      },

      // BIRD FOOD - Normal Products  
      {
        name: 'Bird Seed Mix - Premium',
        description: 'Premium seed mix for canaries, budgies, and other small birds.',
        category_id: categories[2]._id,
        brand_id: brands[5]._id,
        weight: 500,
        mrp: 600,
        sellingPercentage: 83,
        sellingPrice: 498,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Bird+Seed'],
        isActive: true,
      },

      // DOG ACCESSORIES - Normal Products
      {
        name: 'Bird Swing - Colorful',
        description: 'Fun and colorful swing for small to medium birds.',
        category_id: categories[5]._id,
        brand_id: brands[5]._id,
        weight: 100,
        mrp: 500,
        sellingPercentage: 80,
        sellingPrice: 400,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Bird+Swing'],
        isActive: true,
      },
      {
        name: 'Bird Feeder - Automatic',
        description: 'Automatic bird feeder that dispenses food as needed.',
        category_id: categories[5]._id,
        brand_id: brands[5]._id,
        weight: 300,
        mrp: 1200,
        sellingPercentage: 85,
        sellingPrice: 1020,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Bird+Feeder'],
        isActive: true,
      },
      {
        name: 'Bird Perch - Natural Wood',
        description: 'Natural wood perch for birds to rest and play.',
        category_id: categories[5]._id,
        brand_id: brands[5]._id,
        weight: 200,
        mrp: 800,
        sellingPercentage: 80,
        sellingPrice: 640,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Bird+Perch'],
        isActive: true,
      },
      {
        name: 'Bird Cage - Medium',
        description: 'Spacious cage suitable for small to medium birds.',
        category_id: categories[5]._id,
        brand_id: brands[5]._id,
        weight: 3000,
        mrp: 3000,
        sellingPercentage: 80,
        sellingPrice: 2400,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Bird+Cage'],
        isActive: true,
      },
      {
        name: 'Cat Toy - Feather Wand',
        description: 'Interactive feather wand toy to keep cats entertained.',
        category_id: categories[4]._id,
        brand_id: brands[7]._id,
        weight: 50,
        mrp: 600,
        sellingPercentage: 85,
        sellingPrice: 510,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Cat+Toy'],
        isActive: true,
      },
      {
        name: 'Cat Collar - Breakaway',
        description: 'Safe breakaway collar with bell for cats.',
        category_id: categories[4]._id,
        brand_id: brands[6]._id,
        weight: 30,
        mrp: 400,
        sellingPercentage: 80,
        sellingPrice: 320,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Cat+Collar'],
        isActive: true,
      },
      {
        name: 'Cat Litter Box - Covered',
        description: 'Covered litter box with odor control and easy cleaning.',
        category_id: categories[4]._id,
        brand_id: brands[6]._id,
        weight: 2000,
        mrp: 1500,
        sellingPercentage: 80,
        sellingPrice: 1200,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Litter+Box'],
        isActive: true,
      },
      {
        name: 'Dog Toy - Rope Tug',
        description: 'Durable rope toy for dogs to play tug-of-war.',
        category_id: categories[3]._id,
        brand_id: brands[7]._id,
        weight: 200,
        mrp: 500,
        sellingPercentage: 80,
        sellingPrice: 400,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Rope+Toy'],
        isActive: true,
      },
      {
        name: 'Dog Harness - Adjustable',
        description: 'Comfortable and adjustable harness for dogs of all sizes.',
        category_id: categories[3]._id,
        brand_id: brands[6]._id,
        weight: 250,
        mrp: 1200,
        sellingPercentage: 85,
        sellingPrice: 1020,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Dog+Harness'],
        isActive: true,
      },
      {
        name: 'Dog Collar - Leather',
        description: 'Premium leather collar for dogs with metal buckle.',
        category_id: categories[3]._id,
        brand_id: brands[6]._id,
        weight: 100,
        mrp: 800,
        sellingPercentage: 80,
        sellingPrice: 640,
        isPrime: false,
        images: ['https://via.placeholder.com/400x400?text=Dog+Collar'],
        isActive: true,
      },


    ];

    await Product.insertMany(products);
    console.log('✅ Created products');

    console.log('\n========================================');
    console.log('✅ DATABASE RESET SUCCESSFUL');
    console.log('========================================\n');
    console.log(`📦 Categories: ${categories.length}`);
    console.log(`🏷️  Brands: ${brands.length}`);
    console.log(`📦 Total Products: ${products.length}`);
    console.log(`   - All products are regular products`);
    console.log(`   - Prime Products can be added via admin panel`);
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

resetProducts();
