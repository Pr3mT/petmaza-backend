const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/pet-marketplace').then(async () => {
  const db = mongoose.connection.db;
  
  // Delete variant products
  const result1 = await db.collection('products').deleteMany({ 
    parentProduct: { $exists: true, $ne: null } 
  });
  
  // Reactivate parent products
  const result2 = await db.collection('products').updateMany(
    { hasVariants: true }, 
    { $set: { isActive: true } }
  );
  
  console.log('✓ Deleted', result1.deletedCount, 'variant products');
  console.log('✓ Reactivated', result2.modifiedCount, 'parent products');
  console.log('\n✅ Successfully reverted to variant system!');
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
