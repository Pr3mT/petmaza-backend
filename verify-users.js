const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const verifyUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('👥 ALL USERS IN DATABASE:');
    console.log('='.repeat(80));
    
    const users = await usersCollection.find({}).toArray();
    
    console.log(`\nTotal Users: ${users.length}\n`);
    
    const usersByRole = {
      admin: [],
      vendor: [],
      customer: []
    };
    
    users.forEach(user => {
      usersByRole[user.role].push(user);
    });
    
    // Display Admins
    console.log('🔑 ADMIN ACCOUNTS (' + usersByRole.admin.length + '):');
    console.log('-'.repeat(80));
    usersByRole.admin.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   Approved: ${user.isApproved ? '✅' : '❌'}`);
      console.log();
    });
    
    // Display Vendors
    console.log('🏪 VENDOR ACCOUNTS (' + usersByRole.vendor.length + '):');
    console.log('-'.repeat(80));
    usersByRole.vendor.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   Vendor Type: ${user.vendorType || 'N/A'}`);
      console.log(`   Approved: ${user.isApproved ? '✅' : '❌'}`);
      console.log();
    });
    
    // Display Customers
    console.log('👤 CUSTOMER ACCOUNTS (' + usersByRole.customer.length + '):');
    console.log('-'.repeat(80));
    usersByRole.customer.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log();
    });
    
    // Check for test/demo accounts
    console.log('\n⚠️  CHECKING FOR TEST/DEMO ACCOUNTS:');
    console.log('-'.repeat(80));
    const testPatterns = ['test', 'demo', 'sample', 'dummy', 'example'];
    const possibleTestUsers = users.filter(user => 
      testPatterns.some(pattern => 
        user.email.toLowerCase().includes(pattern) || 
        user.name.toLowerCase().includes(pattern)
      )
    );
    
    if (possibleTestUsers.length > 0) {
      console.log(`Found ${possibleTestUsers.length} possible test accounts:`);
      possibleTestUsers.forEach((user, i) => {
        console.log(`${i + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
      console.log('\n💡 Consider removing these before production if they are test accounts.');
    } else {
      console.log('✅ No obvious test accounts found.');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

verifyUsers();
