import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';

// Import all models
import User from './src/models/User';
import VendorDetails from './src/models/VendorDetails';
import Product from './src/models/Product';
import Category from './src/models/Category';
import Brand from './src/models/Brand';
import Order from './src/models/Order';
import VendorProductPricing from './src/models/VendorProductPricing';
import Transaction from './src/models/Transaction';
import Wallet from './src/models/Wallet';
import Billing from './src/models/Billing';
import Complaint from './src/models/Complaint';
import Review from './src/models/Review';
import ProductQuestion from './src/models/ProductQuestion';
import Invoice from './src/models/Invoice';
import Settlement from './src/models/Settlement';
import ServiceRequest from './src/models/ServiceRequest';
import SalesHistory from './src/models/SalesHistory';
import EmailLog from './src/models/EmailLog';
import Ad from './src/models/Ad';
import HeroBanner from './src/models/HeroBanner';
import ShippingSettings from './src/models/ShippingSettings';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

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

    // Show current database stats
    console.log('📊 CURRENT DATABASE STATISTICS:');
    console.log('-'.repeat(60));
    
    const stats = {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      orders: await Order.countDocuments(),
      transactions: await Transaction.countDocuments(),
      reviews: await Review.countDocuments(),
      complaints: await Complaint.countDocuments(),
      wallets: await Wallet.countDocuments(),
      invoices: await Invoice.countDocuments(),
      emailLogs: await EmailLog.countDocuments(),
      vendorDetails: await VendorDetails.countDocuments(),
      vendorProductPricing: await VendorProductPricing.countDocuments(),
    };

    console.log(`👥 Users: ${stats.users}`);
    console.log(`📦 Products: ${stats.products}`);
    console.log(`🏷️  Brands: ${stats.brands}`);
    console.log(`📂 Categories: ${stats.categories}`);
    console.log(`📋 Orders: ${stats.orders}`);
    console.log(`💳 Transactions: ${stats.transactions}`);
    console.log(`⭐ Reviews: ${stats.reviews}`);
    console.log(`📝 Complaints: ${stats.complaints}`);
    console.log(`💰 Wallets: ${stats.wallets}`);
    console.log(`📄 Invoices: ${stats.invoices}`);
    console.log(`📧 Email Logs: ${stats.emailLogs}`);
    console.log(`🏪 Vendor Details: ${stats.vendorDetails}`);
    console.log(`💲 Vendor Pricing: ${stats.vendorProductPricing}\n`);

    // Confirm deletion
    const answer = await question('⚠️  Are you sure you want to proceed? (type "YES" to continue): ');
    
    if (answer !== 'YES') {
      console.log('❌ Cleanup cancelled');
      await mongoose.disconnect();
      rl.close();
      return;
    }

    console.log('\n🗑️  Starting cleanup...\n');

    // ========================================
    // DELETE TRANSACTIONAL DATA
    // ========================================
    console.log('📋 Deleting Orders...');
    const deletedOrders = await Order.deleteMany({});
    console.log(`   ✅ Deleted ${deletedOrders.deletedCount} orders\n`);

    console.log('💳 Deleting Transactions...');
    const deletedTransactions = await Transaction.deleteMany({});
    console.log(`   ✅ Deleted ${deletedTransactions.deletedCount} transactions\n`);

    console.log('💰 Deleting Wallets...');
    const deletedWallets = await Wallet.deleteMany({});
    console.log(`   ✅ Deleted ${deletedWallets.deletedCount} wallets\n`);

    console.log('💼 Deleting Billing records...');
    const deletedBilling = await Billing.deleteMany({});
    console.log(`   ✅ Deleted ${deletedBilling.deletedCount} billing records\n`);

    console.log('📄 Deleting Invoices...');
    const deletedInvoices = await Invoice.deleteMany({});
    console.log(`   ✅ Deleted ${deletedInvoices.deletedCount} invoices\n`);

    console.log('💸 Deleting Settlements...');
    const deletedSettlements = await Settlement.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSettlements.deletedCount} settlements\n`);

    console.log('📊 Deleting Sales History...');
    const deletedSales = await SalesHistory.deleteMany({});
    console.log(`   ✅ Deleted ${deletedSales.deletedCount} sales records\n`);

    // ========================================
    // DELETE USER GENERATED CONTENT
    // ========================================
    console.log('⭐ Deleting Reviews...');
    const deletedReviews = await Review.deleteMany({});
    console.log(`   ✅ Deleted ${deletedReviews.deletedCount} reviews\n`);

    console.log('❓ Deleting Product Questions...');
    const deletedQuestions = await ProductQuestion.deleteMany({});
    console.log(`   ✅ Deleted ${deletedQuestions.deletedCount} questions\n`);

    console.log('📝 Deleting Complaints...');
    const deletedComplaints = await Complaint.deleteMany({});
    console.log(`   ✅ Deleted ${deletedComplaints.deletedCount} complaints\n`);

    console.log('🛠️  Deleting Service Requests...');
    const deletedServiceRequests = await ServiceRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedServiceRequests.deletedCount} service requests\n`);

    // ========================================
    // DELETE LOGS AND TEMPORARY DATA
    // ========================================
    console.log('📧 Deleting Email Logs...');
    const deletedEmailLogs = await EmailLog.deleteMany({});
    console.log(`   ✅ Deleted ${deletedEmailLogs.deletedCount} email logs\n`);

    // ========================================
    // OPTIONAL: Clean test users
    // ========================================
    console.log('👥 Checking for test users...');
    const testUserEmails = [
      'test@petmaza.com',
      'demo@petmaza.com',
      'sample@petmaza.com',
    ];
    
    const deletedTestUsers = await User.deleteMany({
      email: { $in: testUserEmails }
    });
    console.log(`   ✅ Deleted ${deletedTestUsers.deletedCount} test users\n`);

    // ========================================
    // RESET VENDOR STOCK COUNTS
    // ========================================
    console.log('📦 Resetting vendor product stock counts...');
    const resetStock = await VendorProductPricing.updateMany(
      {},
      {
        $set: {
          totalSoldWebsite: 0,
          totalSoldStore: 0,
        }
      }
    );
    console.log(`   ✅ Reset stock counts for ${resetStock.modifiedCount} vendor products\n`);

    // ========================================
    // FINAL STATISTICS
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 REMAINING DATA:');
    console.log('-'.repeat(60));
    
    const finalStats = {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      vendorDetails: await VendorDetails.countDocuments(),
      vendorProductPricing: await VendorProductPricing.countDocuments(),
      orders: await Order.countDocuments(),
      transactions: await Transaction.countDocuments(),
    };

    console.log(`✅ Users: ${finalStats.users}`);
    console.log(`✅ Products: ${finalStats.products}`);
    console.log(`✅ Brands: ${finalStats.brands}`);
    console.log(`✅ Categories: ${finalStats.categories}`);
    console.log(`✅ Vendor Details: ${finalStats.vendorDetails}`);
    console.log(`✅ Vendor Pricing: ${finalStats.vendorProductPricing}`);
    console.log(`📋 Orders: ${finalStats.orders} (should be 0)`);
    console.log(`💳 Transactions: ${finalStats.transactions} (should be 0)\n`);

    console.log('🎉 Your database is now ready for production!\n');
    console.log('💡 NEXT STEPS:');
    console.log('   1. Verify user accounts are correct');
    console.log('   2. Check product inventory and pricing');
    console.log('   3. Test the ordering flow');
    console.log('   4. Deploy to production\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    rl.close();
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
  }
};

// Run the cleanup
productionCleanup();
