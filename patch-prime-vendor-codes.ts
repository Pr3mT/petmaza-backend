/**
 * One-time script: assign primeVendorCode to all PRIME vendors that don't have one yet.
 * Run with: npx ts-node --transpile-only patch-prime-vendor-codes.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '';

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  vendorType: String,
  primeVendorCode: { type: Number, sparse: true },
  isApproved: Boolean,
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Get the current max code
  const highest = await User.findOne({ primeVendorCode: { $exists: true, $ne: null } })
    .sort({ primeVendorCode: -1 })
    .lean() as any;
  let nextCode = (highest?.primeVendorCode || 0) + 1;

  // Find all PRIME vendors without a code
  const vendors = await User.find({
    vendorType: 'PRIME',
    $or: [
      { primeVendorCode: { $exists: false } },
      { primeVendorCode: null },
    ]
  }).lean() as any[];

  if (vendors.length === 0) {
    console.log('All PRIME vendors already have codes. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${vendors.length} PRIME vendor(s) without a code:`);
  for (const vendor of vendors) {
    await User.updateOne({ _id: vendor._id }, { $set: { primeVendorCode: nextCode } });
    console.log(`  ✓ ${vendor.name} (${vendor.email}) → Prime Vendor ID: ${nextCode}`);
    nextCode++;
  }

  console.log('\nDone! Codes assigned.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
