import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = (mongoose.connection as any).db;

  // Find Ramesh
  const user = await db.collection('users').findOne({ name: /ramesh/i, role: 'vendor' });
  console.log('RAMESH USER:', JSON.stringify({ _id: user?._id, name: user?.name, vendorType: user?.vendorType }, null, 2));

  if (!user) { await mongoose.disconnect(); return; }

  // Check non-prime products with addedBy = Ramesh
  const byAddedBy = await db.collection('products').find({ isPrime: false, addedBy: user._id }).toArray();
  console.log('\nProducts with addedBy=Ramesh:', byAddedBy.length);
  byAddedBy.forEach((p: any) => console.log(' -', p.name, '| subCat:', p.subCategory));

  // Check ALL non-prime products and their addedBy
  const allNonPrime = await db.collection('products').find({ isPrime: false }).toArray();
  console.log('\nALL non-prime products:', allNonPrime.length);
  allNonPrime.forEach((p: any) => console.log(' -', p.name, '| addedBy:', p.addedBy?.toString() || 'NULL', '| subCat:', p.subCategory));

  // Check VendorDetails for Ramesh
  const vd = await db.collection('vendordetails').findOne({ vendor_id: user._id });
  console.log('\nVendorDetails.assignedSubcategories:', vd?.assignedSubcategories || 'NONE');

  // Check CategoryFulfillerMapping for Ramesh
  const cfm = await db.collection('categoryfulfilleermappings').find({ fulfiller_id: user._id }).toArray();
  console.log('\nCategoryFulfillerMapping entries:', cfm.length);
  cfm.forEach((m: any) => console.log(' -', m.subCategory, '| isActive:', m.isActive));

  await mongoose.disconnect();
}
diagnose().catch(console.error);
