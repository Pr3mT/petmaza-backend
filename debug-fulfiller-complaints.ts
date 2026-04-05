import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';
import Product from './src/models/Product';
import Complaint from './src/models/Complaint';

dotenv.config();

const debug = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected\n');

  // 1. Find Divesh Doke (warehouseFulfiller)
  const fulfiller = await User.findOne({ name: /divesh/i });
  if (!fulfiller) { console.log('❌ Divesh not found'); process.exit(1); }
  console.log(`👤 Fulfiller: ${fulfiller.name} | ID: ${fulfiller._id} | Role: ${fulfiller.role} | vendorType: ${fulfiller.vendorType}`);

  // 2. Check VendorDetails
  const details = await VendorDetails.findOne({ vendor_id: fulfiller._id });
  console.log(`\n📋 VendorDetails:`, details ? {
    shopName: details.shopName,
    vendorType: details.vendorType,
    assignedSubcategories: details.assignedSubcategories,
  } : '❌ NOT FOUND');

  const assignedSubcategories = details?.assignedSubcategories || [];

  // 3. Find products in those subcategories
  const products = assignedSubcategories.length > 0
    ? await Product.find({ subCategory: { $in: assignedSubcategories } }).select('_id name subCategory')
    : [];
  console.log(`\n📦 Products in assigned subcategories (${assignedSubcategories}):`, products.map(p => `${p.name} [${(p as any).subCategory}]`));

  // 4. All complaints in DB
  const allComplaints = await Complaint.find({}).select('productName product_id status fulfiller_id vendor_id createdAt');
  console.log(`\n🗂️  ALL Complaints (${allComplaints.length} total):`);
  for (const c of allComplaints) {
    console.log(`  - ${c.productName} | status: ${c.status} | product_id: ${c.product_id} | fulfiller_id: ${c.fulfiller_id} | vendor_id: ${c.vendor_id}`);
    // Check if this product is in fulfiller's subcategories
    const productIds = products.map(p => p._id.toString());
    const matches = c.product_id && productIds.includes(c.product_id.toString());
    const directMatch = c.fulfiller_id && c.fulfiller_id.toString() === fulfiller._id.toString();
    console.log(`    → fulfiller_id match: ${directMatch} | subcategory product match: ${matches}`);
  }

  // 5. Run the actual query
  const productIdsInSubcategories = products.map(p => p._id);
  const query: any = {
    $or: [
      { fulfiller_id: fulfiller._id },
      ...(productIdsInSubcategories.length > 0 ? [{ product_id: { $in: productIdsInSubcategories } }] : []),
    ],
  };
  const result = await Complaint.find(query);
  console.log(`\n✅ Query result: ${result.length} complaints found for fulfiller`);

  await mongoose.disconnect();
};

debug().catch(err => { console.error(err); process.exit(1); });
