const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const removeTestCustomer = async () => {
  try {
    console.log('🗑️  Removing test customer account...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find and display the test account first
    const testCustomer = await usersCollection.findOne({
      email: 'customer@petmaza.com'
    });

    if (!testCustomer) {
      console.log('⚠️  Test customer account not found.');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Test Customer Account:');
    console.log('-'.repeat(60));
    console.log(`Name: ${testCustomer.name}`);
    console.log(`Email: ${testCustomer.email}`);
    console.log(`Phone: ${testCustomer.phone}`);
    console.log(`Role: ${testCustomer.role}\n`);

    // Delete the test account
    const result = await usersCollection.deleteOne({
      email: 'customer@petmaza.com'
    });

    if (result.deletedCount > 0) {
      console.log('✅ Test customer account deleted successfully!\n');
      
      // Show updated count
      const totalCustomers = await usersCollection.countDocuments({
        role: 'customer'
      });
      console.log(`Remaining customer accounts: ${totalCustomers}\n`);
    } else {
      console.log('⚠️  No account was deleted.\n');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

removeTestCustomer();
