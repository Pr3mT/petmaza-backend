import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import Product from './src/models/Product';

dotenv.config();

async function restockPrimeVendor1() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Find Prime Vendor 1
    const vendor = await User.findOne({
      email: 'prime@petmaza.com',
      role: 'vendor',
      vendorType: 'PRIME',
    }).lean();

    if (!vendor) {
      console.log('❌ Prime Vendor 1 (prime@petmaza.com) not found.');
      console.log('\n📋 All Prime Vendors in database:');
      const allPrime = await User.find({ role: 'vendor', vendorType: 'PRIME' })
        .select('name email isApproved')
        .lean();
      allPrime.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.name} (${v.email}) - Approved: ${v.isApproved}`);
      });
      process.exit(1);
    }

    console.log(`🏪 Found Prime Vendor 1: ${vendor.name} (${vendor.email})`);

    // Count products before update
    const totalProducts = await Product.countDocuments({
      isPrime: true,
      primeVendor_id: vendor._id,
    });

    console.log(`📦 Total prime products assigned to this vendor: ${totalProducts}`);

    if (totalProducts === 0) {
      console.log('⚠️  No products found for this vendor.');
      process.exit(0);
    }

    // Update all products: set stock=100, isAvailable=true, inStock=true, isActive=true
    const result = await Product.updateMany(
      { isPrime: true, primeVendor_id: vendor._id },
      {
        $set: {
          stock: 100,
          isAvailable: true,
          inStock: true,
          isActive: true,
        },
      }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} / ${totalProducts} products.`);
    console.log('   stock = 100, isAvailable = true, inStock = true, isActive = true');

    // Show updated products
    const updatedProducts = await Product.find({
      isPrime: true,
      primeVendor_id: vendor._id,
    })
      .select('name stock isAvailable inStock isActive sellingPrice mrp')
      .lean();

    console.log('\n📋 Products now in stock:');
    updatedProducts.forEach((p, i) => {
      console.log(
        `  ${i + 1}. ${p.name} | Stock: ${p.stock} | Available: ${p.isAvailable} | Active: ${p.isActive} | Price: ₹${p.sellingPrice}`
      );
    });

    console.log('\n🎉 Done! All products for Prime Vendor 1 are now in stock.\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

restockPrimeVendor1();
