import mongoose from 'mongoose';
import Product from '../models/Product';

const MONGO_URI = 'mongodb://localhost:27017/pet-marketplace';

async function revertToVariantSystem() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all products that were created from variants (have parentProduct field)
    const variantProducts = await Product.find({ 
      parentProduct: { $exists: true, $ne: null }
    });

    console.log(`Found ${variantProducts.length} variant products to delete`);

    // Get unique parent product IDs
    const parentIds = [...new Set(variantProducts.map(p => p.parentProduct?.toString()))];

    // Delete all variant products
    await Product.deleteMany({ 
      parentProduct: { $exists: true, $ne: null }
    });
    console.log(`✓ Deleted ${variantProducts.length} variant products`);

    // Reactivate parent products
    for (const parentId of parentIds) {
      const result = await Product.updateOne(
        { _id: parentId },
        { $set: { isActive: true } }
      );
      
      const parent = await Product.findById(parentId);
      console.log(`✓ Reactivated parent product: ${parent?.name}`);
    }

    console.log('\n✅ Successfully reverted to variant system!');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error during revert:', error);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(1);
  }
}

revertToVariantSystem();
