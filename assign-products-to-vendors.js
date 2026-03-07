const mongoose = require('mongoose');
require('dotenv').config();

// Simple schema definitions
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  vendorType: String,
  isActive: Boolean
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: String,
  mainCategory: String,
  subCategory: String,
  brand_id: mongoose.Schema.Types.ObjectId,
  mrp: Number,
  sellingPercentage: Number,
  purchasePercentage: Number,
  isActive: Boolean
}, { timestamps: true });

const vendorProductPricingSchema = new mongoose.Schema({
  vendor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  purchasePercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  purchasePrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  availableStock: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalSoldWebsite: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalSoldStore: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Ensure unique vendor-product combination
vendorProductPricingSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const VendorProductPricing = mongoose.model('VendorProductPricing', vendorProductPricingSchema);

const assignProductsToVendors = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all vendors (MyShop and Warehouse Fulfiller)
    const vendors = await User.find({
      role: 'vendor',
      isActive: true,
      vendorType: { $in: ['MY_SHOP', 'WAREHOUSE_FULFILLER'] }
    });

    if (vendors.length === 0) {
      console.log('❌ No active vendors found. Please create vendors first.');
      console.log('\n💡 You can create vendors from the admin panel:');
      console.log('   - Admin Dashboard → Vendors → Add Vendor');
      console.log('   - Set vendorType to MY_SHOP or WAREHOUSE_FULFILLER');
      return;
    }

    console.log(`📦 Found ${vendors.length} active vendor(s):`);
    vendors.forEach(v => {
      console.log(`   - ${v.name} (${v.email}) - Type: ${v.vendorType}`);
    });
    console.log('');

    // Get all active products
    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} active products\n`);

    let assignedCount = 0;
    let skippedCount = 0;

    for (const vendor of vendors) {
      console.log(`\n👤 Assigning products to: ${vendor.name} (${vendor.vendorType})`);
      
      for (const product of products) {
        try {
          // Check if already assigned
          const existing = await VendorProductPricing.findOne({
            vendor_id: vendor._id,
            product_id: product._id
          });

          if (existing) {
            skippedCount++;
            continue;
          }

          // Calculate purchase price from product's purchase percentage
          const purchasePercentage = product.purchasePercentage || 60;
          const purchasePrice = Math.round(product.mrp * (purchasePercentage / 100));

          // Assign random stock between 10-50 for initial inventory
          const initialStock = Math.floor(Math.random() * 41) + 10;

          // Create vendor product pricing
          await VendorProductPricing.create({
            vendor_id: vendor._id,
            product_id: product._id,
            purchasePercentage: purchasePercentage,
            purchasePrice: purchasePrice,
            availableStock: initialStock,
            totalSoldWebsite: 0,
            totalSoldStore: 0,
            isActive: true
          });

          assignedCount++;
          console.log(`   ✅ ${product.name} - Stock: ${initialStock}, Purchase: ₹${purchasePrice}`);
        } catch (error) {
          if (error.code === 11000) {
            skippedCount++;
          } else {
            console.error(`   ❌ Error assigning ${product.name}:`, error.message);
          }
        }
      }
    }

    console.log('\n============================================================');
    console.log('✨ Product Assignment Completed!');
    console.log(`✅ Newly Assigned: ${assignedCount} product-vendor combinations`);
    console.log(`⏭️  Skipped: ${skippedCount} (already assigned)`);
    console.log('============================================================\n');

    // Show summary by vendor
    console.log('📊 Summary by Vendor:\n');
    for (const vendor of vendors) {
      const count = await VendorProductPricing.countDocuments({
        vendor_id: vendor._id,
        isActive: true
      });
      const totalStock = await VendorProductPricing.aggregate([
        { $match: { vendor_id: vendor._id, isActive: true } },
        { $group: { _id: null, total: { $sum: '$availableStock' } } }
      ]);
      
      console.log(`${vendor.name} (${vendor.vendorType}):`);
      console.log(`   • Products: ${count}`);
      console.log(`   • Total Stock: ${totalStock[0]?.total || 0} units`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the script
assignProductsToVendors();
