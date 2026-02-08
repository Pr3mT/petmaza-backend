import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import VendorProductPricing from '../models/VendorProductPricing';

// Load environment variables
dotenv.config();

/**
 * Product Seeding Script
 * 
 * This script creates products with:
 * - MRP (Maximum Retail Price)
 * - Selling Percentage (determines selling price = MRP * sellingPercentage / 100)
 * 
 * Workflow:
 * 1. Admin creates products with MRP and Selling Percentage
 * 2. Selling Price = MRP * (Selling Percentage / 100)
 * 3. Vendors add their own Purchase Percentage when they register/have the product
 * 4. Purchase Price = MRP * (Purchase Percentage / 100)
 * 5. Profit = Selling Price - Purchase Price
 * 
 * Example:
 * - Product: Drools 1kg
 * - MRP: ₹1000
 * - Selling Percentage: 80% → Selling Price = ₹800 (customer pays this)
 * - Vendor sets Purchase Percentage: 50% → Purchase Price = ₹500 (vendor pays this)
 * - Profit = ₹800 - ₹500 = ₹300 (30% profit margin)
 */

// Product data templates for each category
const getProductTemplates = (categoryName: string) => {
  const templates: any = {
    'Dog Food': [
      { name: 'Drools Adult Dog Food - 1kg', weight: 1000, mrp: 1000, sellingPercentage: 80, isPrime: false },
      { name: 'Premium Dog Food - Chicken & Rice', weight: 2000, mrp: 1200, sellingPercentage: 85, isPrime: false },
      { name: 'Dry Dog Food - Lamb & Vegetables', weight: 3000, mrp: 1500, sellingPercentage: 80, isPrime: false },
      { name: 'Puppy Food - Complete Nutrition', weight: 1000, mrp: 800, sellingPercentage: 85, isPrime: false },
      { name: 'Senior Dog Food - Joint Care', weight: 2000, mrp: 1400, sellingPercentage: 82, isPrime: false },
    ],
    'Cat Food': [
      { name: 'Premium Cat Food - Tuna & Chicken', weight: 1500, mrp: 1000, sellingPercentage: 85, isPrime: false },
      { name: 'Dry Cat Food - Ocean Fish', weight: 2000, mrp: 1200, sellingPercentage: 80, isPrime: false },
      { name: 'Kitten Food - Growth Formula', weight: 1000, mrp: 900, sellingPercentage: 85, isPrime: false },
      { name: 'Indoor Cat Food - Weight Management', weight: 1500, mrp: 1100, sellingPercentage: 82, isPrime: false },
    ],
    'Bird Food': [
      { name: 'Premium Bird Seed Mix', weight: 1000, mrp: 600, sellingPercentage: 85, isPrime: false },
      { name: 'Parrot Food - Nut Mix', weight: 1500, mrp: 1200, sellingPercentage: 80, isPrime: false },
      { name: 'Canary Food - Special Blend', weight: 500, mrp: 400, sellingPercentage: 85, isPrime: false },
      { name: 'Cockatiel Food - Complete Diet', weight: 1000, mrp: 800, sellingPercentage: 82, isPrime: false },
    ],
    'Dog Accessories': [
      { name: 'Dog Leash - Retractable', weight: 300, mrp: 1500, sellingPercentage: 80, isPrime: false },
      { name: 'Dog Collar - Leather', weight: 200, mrp: 800, sellingPercentage: 85, isPrime: false },
      { name: 'Dog Harness - Adjustable', weight: 400, mrp: 1200, sellingPercentage: 80, isPrime: false },
      { name: 'Dog Toy - Rope Tug', weight: 150, mrp: 500, sellingPercentage: 85, isPrime: false },
    ],
    'Cat Accessories': [
      { name: 'Cat Scratching Post', weight: 5000, mrp: 2500, sellingPercentage: 80, isPrime: false },
      { name: 'Cat Litter Box - Covered', weight: 2000, mrp: 1500, sellingPercentage: 85, isPrime: false },
      { name: 'Cat Collar - Breakaway', weight: 50, mrp: 400, sellingPercentage: 85, isPrime: false },
      { name: 'Cat Toy - Feather Wand', weight: 100, mrp: 600, sellingPercentage: 85, isPrime: false },
    ],
    'Bird Accessories': [
      { name: 'Bird Cage - Medium', weight: 5000, mrp: 3000, sellingPercentage: 80, isPrime: false },
      { name: 'Bird Perch - Natural Wood', weight: 300, mrp: 800, sellingPercentage: 85, isPrime: false },
      { name: 'Bird Feeder - Automatic', weight: 500, mrp: 1200, sellingPercentage: 80, isPrime: false },
      { name: 'Bird Swing - Colorful', weight: 200, mrp: 500, sellingPercentage: 85, isPrime: false },
    ],
  };

  return templates[categoryName] || [];
};

const seedProductsWithVendorPricing = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all active categories
    const categories = await Category.find({ isActive: true });
    if (categories.length === 0) {
      console.error('❌ No categories found. Please create categories first.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📦 Found ${categories.length} categories\n`);

    // Get or create brands
    const brandNames = ['PetCare Pro', 'CleanPaws', 'WalkSafe', 'ScratchMaster', 'FeatherFeed', 'PetHaven', 'CatParadise', 'AviaryPro', 'ComfortPaws', 'FeedTech'];
    const brands: any[] = [];

    for (const brandName of brandNames) {
      let brand = await Brand.findOne({ name: brandName });
      if (!brand) {
        brand = await Brand.create({
          name: brandName,
          description: `Premium ${brandName} products for pets`,
          isActive: true,
        });
        console.log(`✅ Created brand: ${brandName}`);
      } else {
        console.log(`ℹ️  Brand already exists: ${brandName}`);
      }
      brands.push(brand);
    }

    console.log(`\n📋 Total brands available: ${brands.length}\n`);

    // Create products for each category
    let totalProductsCreated = 0;
    const createdProducts: any[] = [];

    // Helper function to generate generic products for categories without templates
    const generateGenericProducts = (categoryName: string, count: number = 5) => {
      const genericProducts = [];
      const basePrices = [500, 800, 1200, 1500, 2000];
      const baseWeights = [500, 1000, 2000, 3000, 5000];
      
      for (let i = 1; i <= count; i++) {
        genericProducts.push({
          name: `${categoryName} Product ${i} - Premium Quality`,
          weight: baseWeights[i - 1] || 1000,
          mrp: basePrices[i - 1] || 1000,
          sellingPercentage: i === count ? 80 : 85, // Last one is Prime
          isPrime: i === count,
        });
      }
      return genericProducts;
    };

    for (const category of categories) {
      let productTemplates = getProductTemplates(category.name);
      
      // If no specific templates, generate generic products
      if (productTemplates.length === 0) {
        console.log(`📝 Generating generic products for category: ${category.name}`);
        productTemplates = generateGenericProducts(category.name);
      }

      console.log(`\n📦 Creating products for category: ${category.name}`);
      
      for (let i = 0; i < productTemplates.length; i++) {
        const template = productTemplates[i];
        const brand = brands[i % brands.length]; // Cycle through brands

        // Check if product already exists
        const existingProduct = await Product.findOne({
          name: template.name,
          category_id: category._id,
        });

        if (existingProduct) {
          console.log(`   ℹ️  Product already exists: ${template.name}`);
          createdProducts.push(existingProduct);
          continue;
        }

        // Calculate selling price: MRP * (sellingPercentage / 100)
        const sellingPrice = template.mrp * (template.sellingPercentage / 100);

        const product = await Product.create({
          name: template.name,
          description: `${template.name} - High quality product for your pet`,
          category_id: category._id,
          brand_id: brand._id,
          weight: template.weight,
          mrp: template.mrp,
          sellingPercentage: template.sellingPercentage,
          sellingPrice: sellingPrice,
          isPrime: template.isPrime,
          images: [],
          isActive: true,
        });

        console.log(`   ✅ Created: ${template.name} (MRP: ₹${template.mrp}, Selling: ${template.sellingPercentage}% = ₹${sellingPrice}, Weight: ${template.weight}g)`);
        createdProducts.push(product);
        totalProductsCreated++;
      }
    }

    console.log(`\n✅ Total products created: ${totalProductsCreated}`);
    console.log(`📊 Total products available: ${createdProducts.length}\n`);

    // Get all products (including existing ones)
    const allProducts = await Product.find({ isActive: true });
    console.log(`📦 Total active products in database: ${allProducts.length}\n`);

    // Get all approved vendors
    const vendors = await User.find({ role: 'vendor', isApproved: true });
    console.log(`👥 Found ${vendors.length} approved vendors\n`);

    // Update all vendors to include common serviceable pincodes (so products are visible to customers)
    const commonPincodes = ['400001', '400002', '400003', '400004', '400005', '400010', '400011', '400012', '400013', '400014', '400020', '400021', '400022', '400023', '400024'];
    console.log('📍 Updating vendor serviceable pincodes to include common pincodes...\n');
    
    for (const vendor of vendors) {
      const vendorDetails = await VendorDetails.findOne({ vendor_id: vendor._id });
      if (vendorDetails) {
        // Merge existing pincodes with common pincodes (avoid duplicates)
        const existingPincodes = vendorDetails.serviceablePincodes || [];
        const allPincodes = [...new Set([...existingPincodes, ...commonPincodes])];
        
        if (allPincodes.length !== existingPincodes.length) {
          vendorDetails.serviceablePincodes = allPincodes;
          await vendorDetails.save();
          console.log(`   ✅ Updated ${vendor.name}: Added ${allPincodes.length - existingPincodes.length} pincodes (Total: ${allPincodes.length})`);
        }
      }
    }
    console.log('');

    // Create vendor product pricing for all vendors and all products
    if (vendors.length > 0 && allProducts.length > 0) {
      console.log('💰 Creating vendor product pricing for all vendors...\n');
      
      let totalPricingCreated = 0;
      let totalPricingSkipped = 0;
      let totalPricingUpdated = 0;

      // Helper function to generate product-specific purchase percentage
      // Each product gets a unique purchase percentage based on its index and MRP
      const getPurchasePercentage = (productIndex: number, mrp: number, vendorType?: string) => {
        // Base percentage varies by product (45-60% range)
        // Higher MRP products typically have higher purchase percentages
        const basePercent = 45 + (productIndex % 15); // 45-59%
        
        // Adjust slightly based on MRP (higher MRP = slightly higher percentage)
        const mrpAdjustment = Math.floor((mrp / 1000) % 5); // 0-4% adjustment
        
        // Vendor type adjustment (optional - can be removed if not needed)
        let vendorAdjustment = 0;
        if (vendorType === 'PRIME') {
          vendorAdjustment = 5; // Prime vendors get 5% more
        } else if (vendorType === 'NORMAL') {
          vendorAdjustment = 0;
        } else if (vendorType === 'MY_SHOP') {
          vendorAdjustment = -5; // Shop vendors get 5% less
        }
        
        const finalPercent = Math.min(70, Math.max(40, basePercent + mrpAdjustment + vendorAdjustment));
        return finalPercent;
      };

      for (const vendor of vendors) {
        // Get vendor type from VendorDetails
        const vendorDetails = await VendorDetails.findOne({ vendor_id: vendor._id });
        const vendorType = vendorDetails?.vendorType || vendor.vendorType || 'NORMAL';
        
        console.log(`   Processing vendor: ${vendor.name} (${vendorType})`);

        for (let i = 0; i < allProducts.length; i++) {
          const product = allProducts[i];
          
          // Check if pricing already exists
          const existingPricing = await VendorProductPricing.findOne({
            vendor_id: vendor._id,
            product_id: product._id,
          });

          if (existingPricing) {
            // Update existing pricing with new percentage if needed
            const newPurchasePercentage = getPurchasePercentage(i, product.mrp, vendorType);
            let needsUpdate = false;
            
            if (existingPricing.purchasePercentage !== newPurchasePercentage) {
              existingPricing.purchasePercentage = newPurchasePercentage;
              existingPricing.purchasePrice = product.mrp * (newPurchasePercentage / 100);
              needsUpdate = true;
            }
            
            // Ensure stock is > 0 so products are visible to customers
            if (existingPricing.availableStock <= 0) {
              existingPricing.availableStock = Math.floor(Math.random() * 100) + 10;
              needsUpdate = true;
            }
            
            // Ensure isActive is true
            if (!existingPricing.isActive) {
              existingPricing.isActive = true;
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              await existingPricing.save();
              totalPricingUpdated++;
            } else {
              totalPricingSkipped++;
            }
            continue;
          }

          // Generate purchase percentage for this product-vendor combination
          const purchasePercentage = getPurchasePercentage(i, product.mrp, vendorType);
          const purchasePrice = product.mrp * (purchasePercentage / 100);

          // Create vendor product pricing
          await VendorProductPricing.create({
            vendor_id: vendor._id,
            product_id: product._id,
            purchasePercentage: purchasePercentage,
            purchasePrice: purchasePrice,
            availableStock: Math.floor(Math.random() * 100) + 10, // Random stock between 10-110
            isActive: true,
          });

          totalPricingCreated++;
        }
      }

      console.log(`\n✅ Vendor Product Pricing Summary:`);
      console.log(`   Created: ${totalPricingCreated} new pricing entries`);
      if (totalPricingUpdated > 0) {
        console.log(`   Updated: ${totalPricingUpdated} existing pricing entries`);
      }
      if (totalPricingSkipped > 0) {
        console.log(`   Skipped: ${totalPricingSkipped} unchanged pricing entries`);
      }
      console.log(`   Total: ${totalPricingCreated + totalPricingUpdated + totalPricingSkipped} pricing entries processed\n`);
    } else {
      if (vendors.length === 0) {
        console.log('⚠️  No approved vendors found. Skipping vendor pricing creation.\n');
      }
      if (allProducts.length === 0) {
        console.log('⚠️  No products found. Skipping vendor pricing creation.\n');
      }
    }

    // Display summary
    console.log('\n========================================');
    console.log('PRODUCTS SEEDED SUCCESSFULLY');
    console.log('========================================\n');
    console.log(`Categories processed: ${categories.length}`);
    console.log(`Total products in database: ${allProducts.length}`);
    console.log(`New products created: ${totalProductsCreated}`);
    console.log(`\n📊 Product Pricing Structure:`);
    console.log(`  - Each product has MRP (Maximum Retail Price)`);
    console.log(`  - Each product has Selling Percentage (determines selling price)`);
    console.log(`  - Selling Price = MRP × (Selling Percentage / 100)`);
    console.log(`\n💡 Pricing Structure:`);
    console.log(`  - Each product has unique Purchase Percentage per vendor`);
    console.log(`  - Purchase Price = MRP × (Purchase Percentage / 100)`);
    console.log(`  - Profit = Selling Price - Purchase Price`);
    if (vendors.length > 0 && allProducts.length > 0) {
      console.log(`  - Vendor pricing has been created for all ${vendors.length} vendors and ${allProducts.length} products`);
    }
    console.log(`\nExample:`);
    console.log(`  Product: Drools 1kg`);
    console.log(`  MRP: ₹1000`);
    console.log(`  Selling Percentage: 80% → Selling Price: ₹800`);
    console.log(`  Vendor Purchase Percentage: 50% → Purchase Price: ₹500`);
    console.log(`  Profit: ₹800 - ₹500 = ₹300 (30% margin)`);
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedProductsWithVendorPricing();

