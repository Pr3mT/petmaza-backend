import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  
  // Find vendors
  const vendors = await User.find({ role: 'vendor' }).select('name email vendorType _id').lean();
  console.log('\n=== ALL VENDORS ===');
  vendors.forEach((v: any) => console.log(v.name, '|', v.email, '|', v.vendorType, '| ID:', v._id.toString()));
  
  // Find recent non-prime products
  const products = await Product.find({ isPrime: false }).select('name addedBy createdAt').sort({ createdAt: -1 }).limit(20).lean();
  console.log('\n=== RECENT NON-PRIME PRODUCTS ===');
  products.forEach((p: any) => console.log(p.name, '| addedBy:', p.addedBy?.toString() || 'NOT SET', '| created:', new Date(p.createdAt).toLocaleDateString()));
  
  // Check which products would each WAREHOUSE_FULFILLER vendor see
  const whVendors = vendors.filter((v: any) => v.vendorType === 'WAREHOUSE_FULFILLER');
  for (const v of whVendors) {
    const vProducts = await Product.find({ isPrime: false, addedBy: (v as any)._id }).select('name').lean();
    console.log(`\n=== Products for ${(v as any).name} (${(v as any)._id}) ===`);
    vProducts.forEach((p: any) => console.log(' -', p.name));
    console.log(`Total: ${vProducts.length}`);
  }
  
  // Also check products WITHOUT addedBy
  const noAddedBy = await Product.find({ isPrime: false, addedBy: { $exists: false } }).select('name').lean();
  const nullAddedBy = await Product.find({ isPrime: false, addedBy: null }).select('name').lean();
  console.log(`\n=== Products with NO addedBy field: ${noAddedBy.length} ===`);
  noAddedBy.forEach((p: any) => console.log(' -', p.name));
  console.log(`\n=== Products with NULL addedBy: ${nullAddedBy.length} ===`);
  
  await mongoose.disconnect();
}
check().catch(console.error);
