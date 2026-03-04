const mongoose = require('mongoose');
require('dotenv').config();

async function resetSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Clear existing settings
    const db = mongoose.connection.db;
    await db.collection('shippingsettings').deleteMany({});
    console.log('✅ Cleared existing shipping settings');
    
    // Create new settings with correct values
    await db.collection('shippingsettings').insertOne({
      shippingEnabled: true,
      freeShippingThreshold: 300,
      shippingChargesBelowThreshold: 50,
      platformFeeEnabled: true,
      platformFeeThreshold: 0,
      platformFeeAmount: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Created new shipping settings:');
    console.log('   - Free shipping threshold: ₹300');
    console.log('   - Shipping charges below threshold: ₹50');
    console.log('   - Platform fee threshold: ₹0 (applies to all orders)');
    console.log('   - Platform fee amount: ₹10');
    console.log('\n🎉 All done! Restart your backend server now.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetSettings();
