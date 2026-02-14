import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';
import Order from '../models/Order';
import VendorProductPricing from '../models/VendorProductPricing';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';
import Billing from '../models/Billing';
import Complaint from '../models/Complaint';
import Review from '../models/Review';
import ProductQuestion from '../models/ProductQuestion';
import Invoice from '../models/Invoice';
import Settlement from '../models/Settlement';
import ServiceRequest from '../models/ServiceRequest';
import SalesHistory from '../models/SalesHistory';

// Load environment variables
dotenv.config();

const DEFAULT_PASSWORD = 'Password123!';

const freshStart = async () => {
  try {
    console.log('🚀 PETMAZA FRESH START - Database Reset & Seed');
    console.log('================================================\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // ========================================
    // STEP 1: DELETE ALL COLLECTIONS
    // ========================================
    console.log('🗑️  STEP 1: Deleting all collections...');
    
    await User.deleteMany({});
    await VendorDetails.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Order.deleteMany({});
    await VendorProductPricing.deleteMany({});
    await Transaction.deleteMany({});
    await Wallet.deleteMany({});
    await Billing.deleteMany({});
    await Complaint.deleteMany({});
    await Review.deleteMany({});
    await ProductQuestion.deleteMany({});
    await Invoice.deleteMany({});
    await Settlement.deleteMany({});
    await ServiceRequest.deleteMany({});
    await SalesHistory.deleteMany({});
    
    console.log('✅ All collections cleared\n');

    // ========================================
    // STEP 2: CREATE USERS
    // ========================================
    console.log('👥 STEP 2: Creating users...');

    // 1. Admin User
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@petmaza.com',
      password: DEFAULT_PASSWORD,
      phone: '9876543210',
      role: 'admin',
      isApproved: true,
      address: {
        street: 'Admin Street, Andheri',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });
    console.log('   ✅ Admin created');

    // 2. Customer User
    const customer = await User.create({
      name: 'John Customer',
      email: 'customer@petmaza.com',
      password: DEFAULT_PASSWORD,
      phone: '9876543211',
      role: 'customer',
      isApproved: true,
      address: {
        street: 'Customer Street, Bandra',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
      },
    });
    console.log('   ✅ Customer created');

    // 3. MY_SHOP Vendor (Your Shop Manager)
    const myShopVendor = await User.create({
      name: 'My Shop Manager',
      email: 'myshop@petmaza.com',
      password: DEFAULT_PASSWORD,
      phone: '9876543212',
      role: 'vendor',
      vendorType: 'MY_SHOP',
      pincodesServed: ['400001', '400050', '400051', '400052'],
      isApproved: true,
      address: {
        street: 'Main Shop, Dadar',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });

    await VendorDetails.create({
      vendor_id: myShopVendor._id,
      vendorType: 'MY_SHOP',
      shopName: 'Petmaza Main Shop',
      panCard: 'ABCDE1234F',
      aadharCard: '123456789012',
      bankDetails: {
        accountNumber: '1234567890123456',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        accountHolderName: 'My Shop Manager',
      },
      billingDetails: {
        gstNumber: '27ABCDE1234F1Z5',
        billingAddress: 'Main Shop, Dadar, Mumbai, Maharashtra, 400001',
      },
      pickupAddress: {
        street: 'Main Shop, Dadar',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      serviceablePincodes: ['400001', '400050', '400051', '400052'],
      brandsHandled: [],
      isApproved: true,
      approvedBy: admin._id,
      approvedAt: new Date(),
    });
    console.log('   ✅ MY_SHOP vendor created');

    // 4. Prime Vendor (Brand Manufacturer)
    const primeVendor = await User.create({
      name: 'Pedigree India',
      email: 'prime@petmaza.com',
      password: DEFAULT_PASSWORD,
      phone: '9876543214',
      role: 'vendor',
      vendorType: 'PRIME',
      pincodesServed: [],
      isApproved: true,
      address: {
        street: 'Pedigree Warehouse, Thane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400601',
      },
    });

    console.log('   ✅ PRIME vendor created\n');

    // ========================================
    // STEP 3: CREATE CATEGORIES
    // ========================================
    console.log('📁 STEP 3: Creating categories...');

    const categories = await Category.create([
      { name: 'Dog Food', description: 'Premium dog food and treats', isActive: true },
      { name: 'Cat Food', description: 'Premium cat food and treats', isActive: true },
      { name: 'Bird Food', description: 'Seeds and food for birds', isActive: true },
      { name: 'Dog Accessories', description: 'Collars, leashes, toys', isActive: true },
      { name: 'Cat Accessories', description: 'Toys, scratchers, litter boxes', isActive: true },
      { name: 'Bird Accessories', description: 'Cages, feeders, toys', isActive: true },
      { name: 'Pet Healthcare', description: 'Medicines, supplements, grooming', isActive: true },
    ]);

    console.log(`   ✅ ${categories.length} categories created\n`);

    // ========================================
    // STEP 4: CREATE BRANDS
    // ========================================
    console.log('🏷️  STEP 4: Creating brands...');

    const brands = await Brand.create([
      { name: 'Pedigree', description: 'Premium dog food brand', isActive: true },
      { name: 'Royal Canin', description: 'Professional pet nutrition', isActive: true },
      { name: 'Whiskas', description: 'Cat food brand', isActive: true },
      { name: 'Drools', description: 'Indian pet food brand', isActive: true },
      { name: 'PetSafe', description: 'Pet accessories', isActive: true },
      { name: 'Trixie', description: 'Pet toys and accessories', isActive: true },
    ]);

    console.log(`   ✅ ${brands.length} brands created\n`);

    // Link Pedigree brand to Prime Vendor
    const pedigreeBrand = brands.find(b => b.name === 'Pedigree');
    await VendorDetails.create({
      vendor_id: primeVendor._id,
      vendorType: 'PRIME',
      shopName: 'Pedigree India Official Store',
      panCard: 'KLMNO9012P',
      aadharCard: '112233445566',
      bankDetails: {
        accountNumber: '9876543210987654',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        accountHolderName: 'Pedigree India',
      },
      billingDetails: {
        gstNumber: '27KLMNO9012P3Z7',
        billingAddress: 'Pedigree Warehouse, Thane, Mumbai, Maharashtra, 400601',
      },
      pickupAddress: {
        street: 'Pedigree Warehouse, Thane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400601',
      },
      serviceablePincodes: [],
      brandsHandled: [pedigreeBrand!._id],
      isApproved: true,
      approvedBy: admin._id,
      approvedAt: new Date(),
    });
    console.log('   ✅ Pedigree brand linked to PRIME vendor\n');

    // ========================================
    // STEP 5: CREATE NORMAL PRODUCTS (MY_SHOP)
    // ========================================
    console.log('📦 STEP 5: Creating normal products for MY_SHOP...');

    const dogFoodCat = categories.find(c => c.name === 'Dog Food');
    const catFoodCat = categories.find(c => c.name === 'Cat Food');
    const dogAccessoriesCat = categories.find(c => c.name === 'Dog Accessories');
    const catAccessoriesCat = categories.find(c => c.name === 'Cat Accessories');
    const healthcareCat = categories.find(c => c.name === 'Pet Healthcare');

    const royalCaninBrand = brands.find(b => b.name === 'Royal Canin');
    const whiskasBrand = brands.find(b => b.name === 'Whiskas');
    const droolsBrand = brands.find(b => b.name === 'Drools');
    const petSafeBrand = brands.find(b => b.name === 'PetSafe');
    const trixieBrand = brands.find(b => b.name === 'Trixie');

    const normalProducts = await Product.create([
      // Dog Food
      {
        name: 'Royal Canin Medium Adult Dog Food 10kg',
        description: 'Complete and balanced nutrition for medium breed dogs',
        category_id: dogFoodCat!._id,
        brand_id: royalCaninBrand!._id,
        mrp: 5500,
        sellingPercentage: 82,
        purchasePercentage: 65,
        images: ['https://picsum.photos/seed/dog1/400/400'],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Drools Chicken & Egg Adult Dog Food 3kg',
        description: 'High protein dog food with real chicken',
        category_id: dogFoodCat!._id,
        brand_id: droolsBrand!._id,
        mrp: 1200,
        sellingPercentage: 85,
        purchasePercentage: 68,
        images: ['https://picsum.photos/seed/dog2/400/400'],
        isPrime: false,
        isActive: true,
      },
      // Cat Food
      {
        name: 'Whiskas Ocean Fish Cat Food 1.2kg',
        description: 'Delicious ocean fish flavor for adult cats',
        category_id: catFoodCat!._id,
        brand_id: whiskasBrand!._id,
        mrp: 450,
        sellingPercentage: 88,
        purchasePercentage: 70,
        images: ['https://picsum.photos/seed/cat1/400/400'],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Whiskas Tuna in Jelly Cat Food 85g (Pack of 12)',
        description: 'Wet cat food with real tuna chunks',
        category_id: catFoodCat!._id,
        brand_id: whiskasBrand!._id,
        mrp: 600,
        sellingPercentage: 90,
        purchasePercentage: 72,
        images: ['https://picsum.photos/seed/cat2/400/400'],
        isPrime: false,
        isActive: true,
      },
      // Dog Accessories
      {
        name: 'PetSafe Retractable Dog Leash 5m',
        description: 'Durable retractable leash for dogs up to 50kg',
        category_id: dogAccessoriesCat!._id,
        brand_id: petSafeBrand!._id,
        mrp: 1200,
        sellingPercentage: 80,
        purchasePercentage: 60,
        images: ['https://picsum.photos/seed/leash1/400/400'],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'Trixie Dog Collar - Adjustable',
        description: 'Comfortable adjustable collar for all breeds',
        category_id: dogAccessoriesCat!._id,
        brand_id: trixieBrand!._id,
        mrp: 400,
        sellingPercentage: 85,
        purchasePercentage: 65,
        images: ['https://picsum.photos/seed/collar1/400/400'],
        isPrime: false,
        isActive: true,
      },
      // Cat Accessories
      {
        name: 'Trixie Cat Scratcher Post',
        description: 'Natural sisal scratching post',
        category_id: catAccessoriesCat!._id,
        brand_id: trixieBrand!._id,
        mrp: 1800,
        sellingPercentage: 78,
        purchasePercentage: 58,
        images: ['https://picsum.photos/seed/scratch1/400/400'],
        isPrime: false,
        isActive: true,
      },
      {
        name: 'PetSafe Cat Litter Box with Cover',
        description: 'Enclosed litter box for privacy',
        category_id: catAccessoriesCat!._id,
        brand_id: petSafeBrand!._id,
        mrp: 2500,
        sellingPercentage: 80,
        purchasePercentage: 62,
        images: ['https://picsum.photos/seed/litter1/400/400'],
        isPrime: false,
        isActive: true,
      },
    ]);

    console.log(`   ✅ ${normalProducts.length} normal products created`);

    // Create VendorProductPricing for MY_SHOP vendor
    for (const product of normalProducts) {
      await VendorProductPricing.create({
        vendor_id: myShopVendor._id,
        product_id: product._id,
        purchasePercentage: product.purchasePercentage,
        purchasePrice: product.purchasePrice,
        availableStock: Math.floor(Math.random() * 50) + 10, // Random stock 10-60
        totalSoldWebsite: 0,
        totalSoldStore: 0,
        isActive: true,
      });
    }
    console.log('   ✅ VendorProductPricing entries created for MY_SHOP\n');

    // ========================================
    // STEP 6: CREATE PRIME PRODUCTS
    // ========================================
    console.log('⭐ STEP 6: Creating Prime products (Pedigree brand)...');

    const primeProducts = await Product.create([
      {
        name: 'Pedigree Adult Dry Dog Food - Chicken & Vegetables 10kg',
        description: 'Complete nutrition for adult dogs with real chicken',
        category_id: dogFoodCat!._id,
        brand_id: pedigreeBrand!._id,
        mrp: 3500,
        sellingPercentage: 85,
        purchasePercentage: 65,
        images: ['https://picsum.photos/seed/pedigree1/400/400'],
        isPrime: true,
        primeVendor_id: primeVendor._id,
        isActive: true,
      },
      {
        name: 'Pedigree Puppy Dry Dog Food - Chicken & Milk 3kg',
        description: 'Specially formulated for growing puppies',
        category_id: dogFoodCat!._id,
        brand_id: pedigreeBrand!._id,
        mrp: 1200,
        sellingPercentage: 88,
        purchasePercentage: 68,
        images: ['https://picsum.photos/seed/pedigree2/400/400'],
        isPrime: true,
        primeVendor_id: primeVendor._id,
        isActive: true,
      },
      {
        name: 'Pedigree Dentastix Daily Dental Care 28 Sticks',
        description: 'Daily dental treats for dogs',
        category_id: dogFoodCat!._id,
        brand_id: pedigreeBrand!._id,
        mrp: 850,
        sellingPercentage: 90,
        purchasePercentage: 70,
        images: ['https://picsum.photos/seed/pedigree3/400/400'],
        isPrime: true,
        primeVendor_id: primeVendor._id,
        isActive: true,
      },
      {
        name: 'Pedigree Gravy Adult Dog Food - Chicken Chunks 80g (Pack of 15)',
        description: 'Wet dog food with real chicken chunks in gravy',
        category_id: dogFoodCat!._id,
        brand_id: pedigreeBrand!._id,
        mrp: 750,
        sellingPercentage: 92,
        purchasePercentage: 72,
        images: ['https://picsum.photos/seed/pedigree4/400/400'],
        isPrime: true,
        primeVendor_id: primeVendor._id,
        isActive: true,
      },
    ]);

    console.log(`   ✅ ${primeProducts.length} Prime products created`);

    // Create VendorProductPricing for Prime vendor
    for (const product of primeProducts) {
      await VendorProductPricing.create({
        vendor_id: primeVendor._id,
        product_id: product._id,
        purchasePercentage: product.purchasePercentage,
        purchasePrice: product.purchasePrice,
        availableStock: Math.floor(Math.random() * 100) + 50, // Random stock 50-150
        totalSoldWebsite: 0,
        totalSoldStore: 0,
        isActive: true,
      });
    }
    console.log('   ✅ VendorProductPricing entries created for PRIME vendor\n');

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n================================================');
    console.log('✨ FRESH START COMPLETED SUCCESSFULLY!');
    console.log('================================================\n');

    console.log('📊 DATABASE SUMMARY:');
    console.log(`   Users: ${await User.countDocuments()}`);
    console.log(`   Vendors: ${await VendorDetails.countDocuments()}`);
    console.log(`   Categories: ${await Category.countDocuments()}`);
    console.log(`   Brands: ${await Brand.countDocuments()}`);
    console.log(`   Products: ${await Product.countDocuments()}`);
    console.log(`   - Normal Products: ${normalProducts.length}`);
    console.log(`   - Prime Products: ${primeProducts.length}`);
    console.log(`   VendorProductPricing: ${await VendorProductPricing.countDocuments()}\n`);

    console.log('🔑 USER CREDENTIALS:');
    console.log('='.repeat(60));
    console.log('\n📌 DEFAULT PASSWORD FOR ALL USERS: ' + DEFAULT_PASSWORD);
    console.log('\n' + '─'.repeat(60));
    console.log('\n👨‍💼 ADMIN:');
    console.log('   Email: admin@petmaza.com');
    console.log('   Password: ' + DEFAULT_PASSWORD);
    console.log('   Role: Admin');
    console.log('\n' + '─'.repeat(60));
    console.log('\n🛍️  CUSTOMER:');
    console.log('   Email: customer@petmaza.com');
    console.log('   Password: ' + DEFAULT_PASSWORD);
    console.log('   Role: Customer');
    console.log('\n' + '─'.repeat(60));
    console.log('\n🏪 MY_SHOP VENDOR (Your Shop Manager):');
    console.log('   Email: myshop@petmaza.com');
    console.log('   Password: ' + DEFAULT_PASSWORD);
    console.log('   Role: Vendor (MY_SHOP)');
    console.log('   Manages: ALL Normal Products');
    console.log('   Products: ' + normalProducts.length + ' items');
    console.log('\n' + '─'.repeat(60));
    console.log('\n⭐ PRIME VENDOR (Pedigree India):');
    console.log('   Email: prime@petmaza.com');
    console.log('   Password: ' + DEFAULT_PASSWORD);
    console.log('   Role: Vendor (PRIME)');
    console.log('   Brand: Pedigree');
    console.log('   Products: ' + primeProducts.length + ' items');
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('✅ You can now login and start using the system!');
    console.log('🌐 Frontend URL: http://localhost:3000');
    console.log('🔌 Backend URL: http://localhost:6969\n');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during fresh start:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the fresh start
freshStart();
