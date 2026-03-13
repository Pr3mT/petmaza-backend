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
import PrimeProduct from './src/models/PrimeProduct';

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

const productionCleanupV2 = async () => {
  try {
    console.log('🚀 PETMAZA PRODUCTION CLEANUP V2 (Updated Architecture)');
    console.log('='.repeat(70));
    console.log('⚠️  WARNING: This will delete transactional data!');
    console.log('✅ Will KEEP: Users, Products, Brands, Categories, VendorDetails');
    console.log('❌ Will DELETE: Orders, Transactions, Reviews, VendorProductPricing, etc.');
    console.log('🔄 Will RESET: Product sales counters to 0\n');

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
    console.log('-'.repeat(70));
    
    const stats = {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      primeProducts: await PrimeProduct.countDocuments(),
      orders: await Order.countDocuments(),
      transactions: await Transaction.countDocuments(),
      reviews: await Review.countDocuments(),
      complaints: await Complaint.countDocuments(),
      wallets: await Wallet.countDocuments(),
      invoices: await Invoice.countDocuments(),
      emailLogs: await EmailLog.countDocuments(),
      vendorDetails: await VendorDetails.countDocuments(),
      vendorProductPricing: await VendorProductPricing.countDocuments(),
      salesHistory: await SalesHistory.countDocuments(),
    };

    console.log(`👥 Users: ${stats.users}`);
    console.log(`📦 Products: ${stats.products}`);
    console.log(`🏷️  Brands: ${stats.brands}`);
    console.log(`📂 Categories: ${stats.categories}`);
    console.log(`⭐ Prime Products: ${stats.primeProducts}`);
    console.log(`📋 Orders: ${stats.orders}`);
    console.log(`💳 Transactions: ${stats.transactions}`);
    console.log(`⭐ Reviews: ${stats.reviews}`);
    console.log(`📝 Complaints: ${stats.complaints}`);
    console.log(`💰 Wallets: ${stats.wallets}`);
    console.log(`📄 Invoices: ${stats.invoices}`);
    console.log(`📧 Email Logs: ${stats.emailLogs}`);
    console.log(`🏪 Vendor Details: ${stats.vendorDetails}`);
    console.log(`💲 Vendor Pricing (DEPRECATED): ${stats.vendorProductPricing}`);
    console.log(`📊 Sales History: ${stats.salesHistory}\n`);

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
    const deletedServices = await ServiceRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedServices.deletedCount} service requests\n`);

    console.log('📧 Deleting Email Logs...');
    const deletedEmails = await EmailLog.deleteMany({});
    console.log(`   ✅ Deleted ${deletedEmails.deletedCount} email logs\n`);

    // ========================================
    // DELETE DEPRECATED COLLECTION
    // ========================================
    console.log('🚨 Deleting VendorProductPricing (DEPRECATED COLLECTION)...');
    const deletedVPP = await VendorProductPricing.deleteMany({});
    console.log(`   ✅ Deleted ${deletedVPP.deletedCount} vendor pricing records\n`);

    // ========================================
    // RESET PRODUCT SALES COUNTERS
    // ========================================
    console.log('🔄 Resetting Product sales counters...');
    const resetProducts = await Product.updateMany(
      {},
      {
        $set: {
          totalSoldWebsite: 0,
          totalSoldStore: 0,
        }
      }
    );
    console.log(`   ✅ Reset sales counters for ${resetProducts.modifiedCount} products\n`);

    // Reset variant sales counters
    console.log('🔄 Resetting Product variant sales counters...');
    const productsWithVariants = await Product.find({ hasVariants: true, variants: { $exists: true, $ne: [] } });
    
    let variantResetCount = 0;
    for (const product of productsWithVariants) {
      if (product.variants && product.variants.length > 0) {
        product.variants = product.variants.map((variant: any) => ({
          ...variant,
          totalSoldWebsite: 0,
          totalSoldStore: 0,
        }));
        product.markModified('variants');
        await product.save();
        variantResetCount += product.variants.length;
      }
    }
    console.log(`   ✅ Reset sales counters for ${variantResetCount} product variants\n`);

    // ========================================
    // RESET PRIME PRODUCT COUNTERS
    // ========================================
    console.log('🔄 Resetting Prime Product counters...');
    const resetPrimeProducts = await PrimeProduct.updateMany(
      {},
      {
        $set: {
          views: 0,
          ordersCount: 0,
          soldQuantity: 0,
        }
      }
    );
    console.log(`   ✅ Reset counters for ${resetPrimeProducts.modifiedCount} prime products\n`);

    // ========================================
    // FINAL STATISTICS
    // ========================================
    console.log('='.repeat(70));
    console.log('✅ CLEANUP COMPLETE!\n');
    console.log('📊 FINAL DATABASE STATISTICS:');
    console.log('-'.repeat(70));
    
    const finalStats = {
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      primeProducts: await PrimeProduct.countDocuments(),
      vendorDetails: await VendorDetails.countDocuments(),
      orders: await Order.countDocuments(),
      transactions: await Transaction.countDocuments(),
      reviews: await Review.countDocuments(),
      vendorProductPricing: await VendorProductPricing.countDocuments(),
      salesHistory: await SalesHistory.countDocuments(),
    };

    console.log(`✅ Users: ${finalStats.users}`);
    console.log(`✅ Products: ${finalStats.products} (sales reset to 0)`);
    console.log(`✅ Brands: ${finalStats.brands}`);
    console.log(`✅ Categories: ${finalStats.categories}`);
    console.log(`✅ Prime Products: ${finalStats.primeProducts} (counters reset)`);
    console.log(`✅ Vendor Details: ${finalStats.vendorDetails}`);
    console.log(`✅ VendorProductPricing: ${finalStats.vendorProductPricing} (should be 0)`);
    console.log(`✅ Orders: ${finalStats.orders} (should be 0)`);
    console.log(`✅ Transactions: ${finalStats.transactions} (should be 0)`);
    console.log(`✅ Reviews: ${finalStats.reviews} (should be 0)`);
    console.log(`✅ Sales History: ${finalStats.salesHistory} (should be 0)\n`);

    const totalDeleted = 
      deletedOrders.deletedCount +
      deletedTransactions.deletedCount +
      deletedWallets.deletedCount +
      deletedBilling.deletedCount +
      deletedInvoices.deletedCount +
      deletedSettlements.deletedCount +
      deletedSales.deletedCount +
      deletedReviews.deletedCount +
      deletedQuestions.deletedCount +
      deletedComplaints.deletedCount +
      deletedServices.deletedCount +
      deletedEmails.deletedCount +
      deletedVPP.deletedCount;

    console.log(`🗑️  Total documents deleted: ${totalDeleted}`);
    console.log(`🔄 Total products reset: ${resetProducts.modifiedCount}`);
    console.log(`🔄 Total variants reset: ${variantResetCount}`);
    console.log(`🔄 Total prime products reset: ${resetPrimeProducts.modifiedCount}\n`);

    console.log('✅ Database is now clean and ready for production!');
    console.log('🚀 New architecture: Products collection has sales tracking');
    console.log('🚀 VendorProductPricing collection removed');
    console.log('🚀 PrimeProduct collection kept for marketplace\n');

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

productionCleanupV2();
