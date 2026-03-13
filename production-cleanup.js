const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const productionCleanup = async () => {
  try {
    console.log('🚀 PETMAZA PRODUCTION CLEANUP');
    console.log('='.repeat(60));
    console.log('⚠️  WARNING: This will delete transactional data!');
    console.log('✅ Will KEEP: Users, Products, Brands, Categories');
    console.log('❌ Will DELETE: Orders, Transactions, Reviews, etc.\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📊 CURRENT DATABASE COLLECTIONS:');
    console.log('-'.repeat(60));
    
    for (const name of collectionNames) {
      const count = await db.collection(name).countDocuments();
      console.log(`${name}: ${count} documents`);
    }
    console.log();

    // Check for confirmation argument
    const confirmed = process.argv.includes('--confirm') || process.argv.includes('YES');
    
    if (!confirmed) {
      console.log('❌ Cleanup cancelled. Run with --confirm flag to proceed.');
      console.log('   Example: node production-cleanup.js --confirm\n');
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Proceeding with cleanup...\n');
    console.log('🗑️  Starting cleanup...\n');

    // Collections to KEEP (preserve data)
    const collectionsToKeep = [
      'users',
      'products',
      'brands',
      'categories',
      'vendordetails',
      'vendorproductpricings',
      'shippingsettings',
      'herobanners',
      'ads'
    ];

    // Collections to DELETE (remove all data)
    const collectionsToDelete = [
      'orders',
      'transactions',
      'wallets',
      'billings',
      'invoices',
      'settlements',
      'saleshistories',
      'reviews',
      'productquestions',
      'complaints',
      'servicerequests',
      'emaillogs',
      'primeproducts',
      'vendorproducts'
    ];

    // Delete specified collections
    for (const collectionName of collectionsToDelete) {
      if (collectionNames.includes(collectionName)) {
        console.log(`🗑️  Deleting ${collectionName}...`);
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`   ✅ Deleted ${result.deletedCount} documents from ${collectionName}\n`);
      }
    }

    // Reset vendor stock counts if vendorproductpricings exists
    if (collectionNames.includes('vendorproductpricings')) {
      console.log('📦 Resetting vendor product stock counts...');
      const result = await db.collection('vendorproductpricings').updateMany(
        {},
        {
          $set: {
            totalSoldWebsite: 0,
            totalSoldStore: 0,
          }
        }
      );
      console.log(`   ✅ Reset stock counts for ${result.modifiedCount} vendor products\n`);
    }

    // Delete test users
    if (collectionNames.includes('users')) {
      console.log('👥 Removing test users...');
      const testUserEmails = [
        'test@petmaza.com',
        'demo@petmaza.com',
        'sample@petmaza.com',
      ];
      
      const result = await db.collection('users').deleteMany({
        email: { $in: testUserEmails }
      });
      console.log(`   ✅ Deleted ${result.deletedCount} test users\n`);
    }

    // ========================================
    // FINAL STATISTICS
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 REMAINING DATA:');
    console.log('-'.repeat(60));
    
    for (const collectionName of collectionsToKeep) {
      if (collectionNames.includes(collectionName)) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`✅ ${collectionName}: ${count} documents`);
      }
    }

    console.log('\n📋 DELETED COLLECTIONS (should be 0):');
    console.log('-'.repeat(60));
    for (const collectionName of collectionsToDelete) {
      if (collectionNames.includes(collectionName)) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`${count === 0 ? '✅' : '⚠️'} ${collectionName}: ${count} documents`);
      }
    }

    console.log('\n🎉 Your database is now ready for production!\n');
    console.log('💡 NEXT STEPS:');
    console.log('   1. Verify user accounts are correct');
    console.log('   2. Check product inventory and pricing');
    console.log('   3. Test the ordering flow');
    console.log('   4. Deploy to production\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the cleanup
productionCleanup();
