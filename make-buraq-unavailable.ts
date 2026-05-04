import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import Product from './src/models/Product';

dotenv.config();

async function makeBuraqUnavailable() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Find the BURAQ prime vendor
    const vendor = await User.findOne({
      name: { $regex: 'BURAQ', $options: 'i' },
      role: 'vendor',
      vendorType: 'PRIME',
    }).select('_id name email');

    if (!vendor) {
      console.log('❌ BURAQ vendor not found. Listing all PRIME vendors:');
      const all = await User.find({ role: 'vendor', vendorType: 'PRIME' }).select('name email');
      all.forEach((v, i) => console.log(`  ${i + 1}. ${v.name} (${v.email})`));
      process.exit(1);
    }

    console.log(`Found vendor: ${vendor.name} (${vendor.email}) — ID: ${vendor._id}`);

    // Count products before update
    const total = await Product.countDocuments({ primeVendor_id: vendor._id, isPrime: true });
    const alreadyUnavailable = await Product.countDocuments({ primeVendor_id: vendor._id, isPrime: true, isAvailable: false });

    console.log(`\nTotal Products for BURAQ  : ${total}`);
    console.log(`Already unavailable       : ${alreadyUnavailable}`);
    console.log(`Will be updated           : ${total - alreadyUnavailable}\n`);

    // Set all to unavailable, out-of-stock, and inactive so they are hidden from the storefront
    const result = await Product.updateMany(
      { primeVendor_id: vendor._id, isPrime: true },
      { $set: { isAvailable: false, inStock: false, isActive: false } }
    );

    console.log(`✅ Updated ${result.modifiedCount} product(s) → isAvailable: false, inStock: false, isActive: false`);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

makeBuraqUnavailable();
