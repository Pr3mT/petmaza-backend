const mongoose = require('mongoose');
require('dotenv').config();

async function quickCheck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check vendors
    const users = await db.collection('users').find({ role: 'vendor' }).toArray();
    console.log('=== VENDORS ===');
    console.log('Total vendors:', users.length);
    
    if (users.length > 0) {
      console.log('\nVendor details:');
      users.forEach(u => {
        console.log(`- ${u.name} (${u.email})`);
        console.log(`  vendorType: ${u.vendorType || 'NOT SET'}`);
        console.log(`  role: ${u.role}`);
      });
    }

    // Check orders
    const orders = await db.collection('orders').find({}).limit(5).toArray();
    console.log(`\n=== ORDERS ===`);
    console.log('Total orders:', await db.collection('orders').countDocuments());
    
    if (orders.length > 0) {
      console.log('\nSample orders:');
      orders.forEach(o => {
        console.log(`- Order ${o._id}`);
        console.log(`  Status: ${o.status}`);
        console.log(`  Total: ₹${o.total}`);
        console.log(`  AssignedVendorId: ${o.assignedVendorId || 'NONE'}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
