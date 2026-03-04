import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

/**
 * OPTION 2: Separate Gmail accounts for each role
 */
const updateEmailsSeparate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');
    console.log('🔧 OPTION 2: Setting up separate emails for each role...\n');
    console.log('Please enter email addresses for each role:\n');

    // Get emails from user
    const adminEmail = await question('Admin Email (e.g., petmaza.admin@gmail.com): ');
    const shopEmail = await question('Shop Manager Email (e.g., petmaza.shop@gmail.com): ');
    const warehouseEmail = await question('Warehouse Email (e.g., petmaza.warehouse@gmail.com): ');
    const primeEmail = await question('Prime Vendor Email (e.g., petmaza.prime@gmail.com): ');
    const customerEmail = await question('Your Customer Email (e.g., samrudhiamrutkar15@gmail.com): ');

    console.log('\n📝 Updating database...\n');

    // Update Admin
    const admin = await User.findOne({ email: 'admin@petmaza.com' });
    if (admin && adminEmail) {
      admin.email = adminEmail.trim();
      await admin.save();
      console.log(`✅ Admin email updated to: ${adminEmail}`);
    }

    // Update My Shop Manager
    const myShop = await User.findOne({ email: 'myshop@petmaza.com' });
    if (myShop && shopEmail) {
      myShop.email = shopEmail.trim();
      await myShop.save();
      console.log(`✅ My Shop email updated to: ${shopEmail}`);
    }

    // Update Warehouse Fulfiller
    const warehouse = await User.findOne({ email: 'fulfiller@petmaza.com' });
    if (warehouse && warehouseEmail) {
      warehouse.email = warehouseEmail.trim();
      await warehouse.save();
      console.log(`✅ Warehouse email updated to: ${warehouseEmail}`);
    }

    // Update Prime Vendor
    const prime = await User.findOne({ email: 'prime@petmaza.com' });
    if (prime && primeEmail) {
      prime.email = primeEmail.trim();
      await prime.save();
      console.log(`✅ Prime Vendor email updated to: ${primeEmail}`);
    }

    // Update Customer
    const customer = await User.findOne({ email: 'customer@petmaza.com' });
    if (customer && customerEmail) {
      customer.email = customerEmail.trim();
      await customer.save();
      console.log(`✅ Customer email updated to: ${customerEmail}`);
    }

    console.log('\n✅ ALL EMAILS UPDATED!\n');
    console.log('📧 Email Distribution:');
    console.log(`   Admin: ${adminEmail}`);
    console.log(`   Shop Manager: ${shopEmail}`);
    console.log(`   Warehouse: ${warehouseEmail}`);
    console.log(`   Prime Vendor: ${primeEmail}`);
    console.log(`   Customer: ${customerEmail}\n`);

    console.log('📝 UPDATE YOUR .env FILE:');
    console.log(`ADMIN_EMAILS=${adminEmail}\n`);

    console.log('⚠️  IMPORTANT: If using separate Gmail accounts,');
    console.log('you need to set up app passwords for EACH account');
    console.log('OR use a service like SendGrid/Mailgun for multiple sender addresses\n');

    rl.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
};

updateEmailsSeparate();
