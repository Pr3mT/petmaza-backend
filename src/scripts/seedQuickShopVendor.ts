import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';

dotenv.config();

const EMAIL = 'quickshop@petmaza.com';
const PASSWORD = 'Password123!';
const SERVICEABLE_PINCODES = ['410206', '410221', '410222']; // Panvel area — edit to match your test pincode

const seedQuickShopVendor = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const printCreds = () => {
      console.log('\n📋 LOGIN CREDENTIALS (Shop Admin — Petmaza Quick):');
      console.log('═══════════════════════════════════════');
      console.log(`Email: ${EMAIL}`);
      console.log(`Password: ${PASSWORD}`);
      console.log('Role: Vendor (QUICK_SHOP / Shop Admin)');
      console.log(`Serviceable pincodes: ${SERVICEABLE_PINCODES.join(', ')}`);
      console.log('═══════════════════════════════════════\n');
    };

    const existing = await User.findOne({ email: EMAIL });
    if (existing) {
      console.log('⚠️  Shop Admin already exists — resetting password so you can log in.');
      existing.password = PASSWORD; // pre-save hook re-hashes
      await existing.save();
      printCreds();
      await mongoose.disconnect();
      process.exit(0);
    }

    const shopAdmin = await User.create({
      name: 'Panvel Pet Corner',
      email: EMAIL,
      password: PASSWORD,
      phone: '9876543299',
      role: 'vendor',
      vendorType: 'QUICK_SHOP',
      isApproved: true,
      isEmailVerified: true,
      address: {
        street: 'Shop 4, Sector 12 Market',
        city: 'Panvel',
        state: 'Maharashtra',
        pincode: '410206',
      },
    });

    await VendorDetails.create({
      vendor_id: shopAdmin._id,
      vendorType: 'QUICK_SHOP',
      shopName: 'Panvel Pet Corner',
      pickupAddress: {
        street: 'Shop 4, Sector 12 Market',
        city: 'Panvel',
        state: 'Maharashtra',
        pincode: '410206',
      },
      serviceablePincodes: SERVICEABLE_PINCODES,
      isApproved: true,
    });

    console.log('✅ Shop Admin created successfully!');
    printCreds();
    console.log('🚀 HOW TO USE:');
    console.log('1. Log in with the credentials above in the petmaza app');
    console.log('2. You land on the Petmaza Quick Shop Admin dashboard');
    console.log('3. Go to "My Products" → "Add Products" tab → add a product with your price/stock');
    console.log('4. As a customer, open Home → "Petmaza Quick" and enter one of the serviceable pincodes above');
    console.log('5. Add the product to cart and place the order — it will land in this Shop Admin\'s Orders tab\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Quick Shop vendor:', error);
    process.exit(1);
  }
};

seedQuickShopVendor();
