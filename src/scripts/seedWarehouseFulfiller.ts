import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';

// Load environment variables
dotenv.config();

const seedWarehouseFulfiller = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const defaultPassword = 'Password123!';

    // Check if warehouse fulfiller already exists
    const existingFulfiller = await User.findOne({
      email: 'fulfiller@petmaza.com',
    });

    if (existingFulfiller) {
      console.log('⚠️  Warehouse Fulfiller already exists');
      console.log('\n📋 LOGIN CREDENTIALS:');
      console.log('═══════════════════════════════════════');
      console.log('Email: fulfiller@petmaza.com');
      console.log('Password: Password123!');
      console.log('Role: Vendor (Warehouse Fulfiller)');
      console.log('═══════════════════════════════════════\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create Warehouse Fulfiller User
    const warehouseFulfiller = await User.create({
      name: 'Warehouse Fulfiller',
      email: 'fulfiller@petmaza.com',
      password: defaultPassword,
      phone: '9876543215',
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
      pincodesServed: ['400001', '400002', '400003', '400004', '400005', '400006'],
      isApproved: true,
      address: {
        street: 'Near Wholesale Market, Crawford Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });

    await VendorDetails.create({
      vendor_id: warehouseFulfiller._id,
      vendorType: 'WAREHOUSE_FULFILLER',
      shopName: 'Wholesale Fulfillment Center',
      panCard: 'WFCDE1234F',
      aadharCard: '987654321098',
      bankDetails: {
        accountNumber: '9876543210',
        ifscCode: 'HDFC0001234',
        bankName: 'HDFC Bank',
        accountHolderName: 'Warehouse Fulfiller',
      },
      billingDetails: {
        gstNumber: '27WFCDE1234F1Z5',
        billingAddress: 'Near Wholesale Market, Crawford Road, Mumbai, Maharashtra, 400001',
      },
      pickupAddress: {
        street: 'Near Wholesale Market, Crawford Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      serviceablePincodes: ['400001', '400002', '400003', '400004', '400005', '400006'],
      isApproved: true,
      approvedBy: null,
    });

    console.log('✅ Warehouse Fulfiller created successfully!');
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════');
    console.log('Email: fulfiller@petmaza.com');
    console.log('Password: Password123!');
    console.log('Role: Vendor (Warehouse Fulfiller)');
    console.log('Name: Warehouse Fulfiller');
    console.log('Phone: 9876543215');
    console.log('Location: Near Wholesale Market, Mumbai');
    console.log('═══════════════════════════════════════\n');
    console.log('\n🚀 HOW TO USE:');
    console.log('1. Login with the credentials above');
    console.log('2. You will be redirected to /warehouse-fulfiller/dashboard');
    console.log('3. View and manage orders from the Orders page');
    console.log('4. Accept orders that you can fulfill from wholesale suppliers');
    console.log('5. Reject orders that you cannot fulfill (they will go to shop vendor)');
    console.log('6. Track fulfillment stages: Picked → Packed → Picked Up → Delivered\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding warehouse fulfiller:', error);
    process.exit(1);
  }
};

// Run the seed function
seedWarehouseFulfiller();
