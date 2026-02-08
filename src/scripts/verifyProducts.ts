import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import VendorProductPricing from '../models/VendorProductPricing';
import VendorDetails from '../models/VendorDetails';
import User from '../models/User';

dotenv.config();

const verifyProducts = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const testPincode = '400001';

    // Check products
    const totalProducts = await Product.countDocuments({ isActive: true });
    console.log(`📦 Total active products: ${totalProducts}`);

    // Check vendors
    const totalVendors = await User.countDocuments({ role: 'vendor', isApproved: true });
    console.log(`👥 Total approved vendors: ${totalVendors}`);

    // Check vendor details
    const vendorDetails = await VendorDetails.find({ isApproved: true });
    console.log(`\n📍 Vendors and their serviceable pincodes:`);
    for (const vd of vendorDetails) {
      const vendor = await User.findById(vd.vendor_id);
      const servesPincode = vd.serviceablePincodes.includes(testPincode);
      console.log(`   ${vendor?.name || 'Unknown'} (${vd.vendorType}):`);
      console.log(`     Pincodes: ${vd.serviceablePincodes.join(', ')}`);
      console.log(`     Serves ${testPincode}: ${servesPincode ? '✅' : '❌'}`);
    }

    // Check vendor product pricing
    const totalPricing = await VendorProductPricing.countDocuments({ isActive: true });
    console.log(`\n💰 Total active vendor product pricing entries: ${totalPricing}`);

    const pricingWithStock = await VendorProductPricing.countDocuments({
      isActive: true,
      availableStock: { $gt: 0 },
    });
    console.log(`💰 Pricing entries with stock > 0: ${pricingWithStock}`);

    // Check products available for pincode
    const productIds = (await Product.find({ isActive: true })).map((p) => p._id);
    const vendorPricing = await VendorProductPricing.find({
      product_id: { $in: productIds },
      isActive: true,
      availableStock: { $gt: 0 },
    });

    const vendorIds = vendorPricing.map((vp) => vp.vendor_id);
    const vendorsForPincode = await VendorDetails.find({
      vendor_id: { $in: vendorIds },
      serviceablePincodes: testPincode,
      isApproved: true,
    });

    const availableVendorIds = vendorsForPincode.map((vd) => vd.vendor_id.toString());
    const availableProductIds = vendorPricing
      .filter((vp) => availableVendorIds.includes(vp.vendor_id.toString()))
      .map((vp) => vp.product_id.toString());

    const availableProducts = productIds.filter((pid) =>
      availableProductIds.includes(pid.toString())
    );

    console.log(`\n📊 Products available for pincode ${testPincode}: ${availableProducts.length}`);
    console.log(`   Expected: ${totalProducts} products`);

    if (availableProducts.length === 0) {
      console.log(`\n❌ ISSUE FOUND: No products are available for pincode ${testPincode}`);
      console.log(`\nPossible causes:`);
      if (totalPricing === 0) {
        console.log(`   - No vendor product pricing entries exist`);
        console.log(`   - Solution: Run 'npm run seed:products-pricing'`);
      }
      if (pricingWithStock === 0) {
        console.log(`   - All vendor pricing entries have stock = 0`);
        console.log(`   - Solution: Run 'npm run seed:products-pricing' to update stock`);
      }
      if (vendorsForPincode.length === 0) {
        console.log(`   - No vendors serve pincode ${testPincode}`);
        console.log(`   - Solution: Run 'npm run seed:products-pricing' to update vendor pincodes`);
      }
    } else {
      console.log(`\n✅ Products are available!`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

verifyProducts();

