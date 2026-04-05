import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from './src/models/Complaint';
import Product from './src/models/Product';

dotenv.config();

const fixComplaintVendors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    // Get all complaints without vendor_id
    const complaintsToFix = await Complaint.find({
      $or: [
        { vendor_id: { $exists: false } },
        { vendor_id: null }
      ]
    });

    console.log(`\n📋 Found ${complaintsToFix.length} complaints without vendor_id\n`);

    for (const complaint of complaintsToFix) {
      const product: any = await Product.findById(complaint.product_id);
      
      if (product) {
        // Get vendor from product (primeVendor_id for prime products, addedBy for others)
        const vendor_id = product.primeVendor_id || product.addedBy;
        
        if (vendor_id) {
          complaint.vendor_id = vendor_id;
          await complaint.save();
          
          console.log(`✅ Updated complaint ${complaint._id}`);
          console.log(`   Product: ${product.name}`);
          console.log(`   Vendor ID: ${vendor_id}`);
          console.log(`   Source: ${product.primeVendor_id ? 'primeVendor_id' : 'addedBy'}`);
          console.log('');
        } else {
          console.log(`⚠️  No vendor found for complaint ${complaint._id}`);
          console.log(`   Product: ${product.name}`);
          console.log('');
        }
      } else {
        console.log(`❌ Product not found for complaint ${complaint._id}`);
        console.log('');
      }
    }

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

fixComplaintVendors();
