import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';

// Load environment variables
dotenv.config();

const seedProducts = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing products and categories
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log('Cleared existing products and categories');

    // Drop slug index if it exists
    try {
      await Category.collection.dropIndex('slug_1');
      console.log('Dropped slug index');
    } catch (error) {
      // Index doesn't exist, that's fine
    }

    // Create Categories one by one to avoid slug conflicts
    const categoryData = [
      { name: 'Dog Food', description: 'Food and treats for dogs', isActive: true },
      { name: 'Cat Food', description: 'Food and treats for cats', isActive: true },
      { name: 'Bird Food', description: 'Food and treats for birds', isActive: true },
      { name: 'Dog Accessories', description: 'Accessories for dogs', isActive: true },
      { name: 'Cat Accessories', description: 'Accessories for cats', isActive: true },
      { name: 'Bird Accessories', description: 'Accessories for birds', isActive: true },
    ];

    const createdCategories = [];
    for (const catData of categoryData) {
      const category = await Category.create(catData);
      createdCategories.push(category);
    }
    console.log('✅ Categories created');

    // Create Products
    const products = [
      // Basic Products (Express Delivery)
      {
        name: 'Premium Dog Food - Chicken & Rice',
        category_id: createdCategories[0]._id,
        brand: 'PetCare Pro',
        description: 'High-quality dog food with real chicken and rice. Perfect for adult dogs.',
        type: 'basic',
        mrp: 1200,
        sale_price: 999,
        vendorMargin: 15,
        vendor_price: 849,
        images: ['https://via.placeholder.com/400x400?text=Dog+Food+1'],
        quantity: 100,
        weightGrams: 2000,
        dimensionsCm: { l: 30, w: 20, h: 10 },
        expressEligible: true,
        isActive: true,
      },
      {
        name: 'Cat Litter - Clumping',
        category_id: createdCategories[1]._id,
        brand: 'CleanPaws',
        description: 'Premium clumping cat litter with odor control.',
        type: 'basic',
        mrp: 800,
        sale_price: 650,
        vendorMargin: 15,
        vendor_price: 553,
        images: ['https://via.placeholder.com/400x400?text=Cat+Litter'],
        quantity: 50,
        weightGrams: 5000,
        dimensionsCm: { l: 40, w: 30, h: 15 },
        expressEligible: true,
        isActive: true,
      },
      {
        name: 'Dog Leash - Retractable',
        category_id: createdCategories[3]._id,
        brand: 'WalkSafe',
        description: 'Durable retractable leash for dogs up to 50kg.',
        type: 'basic',
        mrp: 1500,
        sale_price: 1199,
        vendorMargin: 15,
        vendor_price: 1019,
        images: ['https://via.placeholder.com/400x400?text=Dog+Leash'],
        quantity: 30,
        weightGrams: 300,
        dimensionsCm: { l: 5, w: 5, h: 15 },
        expressEligible: true,
        isActive: true,
      },
      {
        name: 'Cat Scratching Post',
        category_id: createdCategories[4]._id,
        brand: 'ScratchMaster',
        description: 'Tall scratching post with multiple levels for cats.',
        type: 'basic',
        mrp: 2500,
        sale_price: 1999,
        vendorMargin: 15,
        vendor_price: 1699,
        images: ['https://via.placeholder.com/400x400?text=Scratching+Post'],
        quantity: 20,
        weightGrams: 5000,
        dimensionsCm: { l: 50, w: 50, h: 100 },
        expressEligible: true,
        isActive: true,
      },
      {
        name: 'Bird Seed Mix - Premium',
        category_id: createdCategories[2]._id,
        brand: 'FeatherFeed',
        description: 'Premium seed mix for all types of birds.',
        type: 'basic',
        mrp: 600,
        sale_price: 499,
        vendorMargin: 15,
        vendor_price: 424,
        images: ['https://via.placeholder.com/400x400?text=Bird+Seed'],
        quantity: 75,
        weightGrams: 1000,
        dimensionsCm: { l: 20, w: 15, h: 10 },
        expressEligible: true,
        isActive: true,
      },
      // Special Products (Standard Delivery)
      {
        name: 'Large Dog House - Weatherproof',
        category_id: createdCategories[3]._id,
        brand: 'PetHaven',
        description: 'Large weatherproof dog house for outdoor use. Perfect for large breeds.',
        type: 'special',
        mrp: 8000,
        sale_price: 6999,
        vendorMargin: 20,
        vendor_price: 5599,
        images: ['https://via.placeholder.com/400x400?text=Dog+House'],
        quantity: 10,
        weightGrams: 15000,
        dimensionsCm: { l: 120, w: 80, h: 100 },
        expressEligible: false,
        isActive: true,
      },
      {
        name: 'Cat Tree - Multi-Level',
        category_id: createdCategories[4]._id,
        brand: 'CatParadise',
        description: 'Large multi-level cat tree with multiple platforms and scratching posts.',
        type: 'special',
        mrp: 12000,
        sale_price: 9999,
        vendorMargin: 20,
        vendor_price: 7999,
        images: ['https://via.placeholder.com/400x400?text=Cat+Tree'],
        quantity: 8,
        weightGrams: 20000,
        dimensionsCm: { l: 100, w: 80, h: 150 },
        expressEligible: false,
        isActive: true,
      },
      {
        name: 'Bird Cage - Large',
        category_id: createdCategories[5]._id,
        brand: 'AviaryPro',
        description: 'Large bird cage suitable for multiple birds or large parrots.',
        type: 'special',
        mrp: 15000,
        sale_price: 12999,
        vendorMargin: 20,
        vendor_price: 10399,
        images: ['https://via.placeholder.com/400x400?text=Bird+Cage'],
        quantity: 5,
        weightGrams: 10000,
        dimensionsCm: { l: 80, w: 60, h: 120 },
        expressEligible: false,
        isActive: true,
      },
      {
        name: 'Dog Bed - Orthopedic',
        category_id: createdCategories[3]._id,
        brand: 'ComfortPaws',
        description: 'Large orthopedic dog bed for senior dogs or dogs with joint issues.',
        type: 'special',
        mrp: 5000,
        sale_price: 3999,
        vendorMargin: 20,
        vendor_price: 3199,
        images: ['https://via.placeholder.com/400x400?text=Dog+Bed'],
        quantity: 15,
        weightGrams: 3000,
        dimensionsCm: { l: 100, w: 80, h: 20 },
        expressEligible: false,
        isActive: true,
      },
      {
        name: 'Automatic Cat Feeder',
        category_id: createdCategories[4]._id,
        brand: 'FeedTech',
        description: 'Programmable automatic cat feeder with portion control.',
        type: 'special',
        mrp: 3500,
        sale_price: 2999,
        vendorMargin: 20,
        vendor_price: 2399,
        images: ['https://via.placeholder.com/400x400?text=Cat+Feeder'],
        quantity: 12,
        weightGrams: 2000,
        dimensionsCm: { l: 30, w: 25, h: 35 },
        expressEligible: false,
        isActive: true,
      },
    ];

    await Product.insertMany(products);
    console.log('✅ Products created');

    console.log('\n========================================');
    console.log('PRODUCTS SEEDED SUCCESSFULLY');
    console.log('========================================\n');
    console.log(`Created ${createdCategories.length} categories`);
    console.log(`Created ${products.length} products`);
    console.log(`- ${products.filter(p => p.type === 'basic').length} Basic products (Express delivery)`);
    console.log(`- ${products.filter(p => p.type === 'special').length} Special products (Standard delivery)`);
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedProducts();

