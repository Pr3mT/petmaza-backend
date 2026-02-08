import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';

// Load environment variables
dotenv.config();

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing users (optional - comment out if you want to keep existing users)
    await User.deleteMany({});
    await VendorDetails.deleteMany({});
    console.log('Cleared existing users and vendor details');

    const defaultPassword = 'Password123!';

    // 1. Create Admin User
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@petmaza.com',
      password: defaultPassword,
      phone: '9876543210',
      role: 'admin',
      isApproved: true,
      address: {
        street: 'Admin Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });
    console.log('✅ Admin user created');

    // 2. Create Customer User
    const customer = await User.create({
      name: 'Customer User',
      email: 'customer@petmaza.com',
      password: defaultPassword,
      phone: '9876543211',
      role: 'customer',
      isApproved: true,
      address: {
        street: 'Customer Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });
    console.log('✅ Customer user created');

    // 3. Create My Shop Vendor
    const myShopVendor = await User.create({
      name: 'My Shop Vendor',
      email: 'myshop@petmaza.com',
      password: defaultPassword,
      phone: '9876543212',
      role: 'vendor',
      vendorType: 'MY_SHOP',
      pincodesServed: ['400001', '400002', '400003', '400004', '400005'],
      isApproved: true,
      address: {
        street: 'My Shop Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });

    await VendorDetails.create({
      vendor_id: myShopVendor._id,
      vendorType: 'MY_SHOP',
      shopName: 'My Pet Shop',
      panCard: 'ABCDE1234F',
      aadharCard: '123456789012',
      bankDetails: {
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
        bankName: 'State Bank of India',
        accountHolderName: 'My Shop Vendor',
      },
      billingDetails: {
        gstNumber: '27ABCDE1234F1Z5',
        billingAddress: 'My Shop Street, Mumbai, Maharashtra, 400001',
      },
      pickupAddress: {
        street: 'My Shop Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      serviceablePincodes: ['400001', '400002', '400003', '400004', '400005'],
      isApproved: true,
      approvedBy: admin._id,
      approvedAt: new Date(),
    });
    console.log('✅ My Shop vendor created');

    // 4. Create Normal Vendor
    const normalVendor = await User.create({
      name: 'Normal Vendor',
      email: 'normal@petmaza.com',
      password: defaultPassword,
      phone: '9876543213',
      role: 'vendor',
      vendorType: 'NORMAL',
      pincodesServed: ['400010', '400011', '400012', '400013', '400014'],
      isApproved: true,
      address: {
        street: 'Normal Vendor Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400010',
      },
    });

    await VendorDetails.create({
      vendor_id: normalVendor._id,
      vendorType: 'NORMAL',
      shopName: 'Normal Pet Store',
      panCard: 'FGHIJ5678K',
      aadharCard: '987654321098',
      bankDetails: {
        accountNumber: '0987654321',
        ifscCode: 'HDFC0005678',
        bankName: 'HDFC Bank',
        accountHolderName: 'Normal Vendor',
      },
      billingDetails: {
        gstNumber: '27FGHIJ5678K2Z6',
        billingAddress: 'Normal Vendor Street, Mumbai, Maharashtra, 400010',
      },
      pickupAddress: {
        street: 'Normal Vendor Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400010',
      },
      serviceablePincodes: ['400010', '400011', '400012', '400013', '400014'],
      isApproved: true,
      approvedBy: admin._id,
      approvedAt: new Date(),
    });
    console.log('✅ Normal vendor created');

    // 5. Create Prime Vendor
    const primeVendor = await User.create({
      name: 'Prime Vendor',
      email: 'prime@petmaza.com',
      password: defaultPassword,
      phone: '9876543214',
      role: 'vendor',
      vendorType: 'PRIME',
      pincodesServed: ['400020', '400021', '400022', '400023', '400024'],
      isApproved: true,
      address: {
        street: 'Prime Vendor Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400020',
      },
    });

    await VendorDetails.create({
      vendor_id: primeVendor._id,
      vendorType: 'PRIME',
      shopName: 'Prime Pet Warehouse',
      panCard: 'KLMNO9012P',
      aadharCard: '112233445566',
      bankDetails: {
        accountNumber: '1122334455',
        ifscCode: 'ICIC0009012',
        bankName: 'ICICI Bank',
        accountHolderName: 'Prime Vendor',
      },
      billingDetails: {
        gstNumber: '27KLMNO9012P3Z7',
        billingAddress: 'Prime Vendor Street, Mumbai, Maharashtra, 400020',
      },
      pickupAddress: {
        street: 'Prime Vendor Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400020',
      },
      serviceablePincodes: ['400020', '400021', '400022', '400023', '400024'],
      isApproved: true,
      approvedBy: admin._id,
      approvedAt: new Date(),
    });
    console.log('✅ Prime vendor created');

    // Display all created users
    console.log('\n========================================');
    console.log('USER CREDENTIALS');
    console.log('========================================\n');
    console.log('Default Password for ALL users: ' + defaultPassword);
    console.log('\n--- ADMIN ---');
    console.log('Email: admin@petmaza.com');
    console.log('Password: ' + defaultPassword);
    console.log('Role: Admin');
    console.log('\n--- CUSTOMER ---');
    console.log('Email: customer@petmaza.com');
    console.log('Password: ' + defaultPassword);
    console.log('Role: Customer');
    console.log('\n--- MY SHOP VENDOR ---');
    console.log('Email: myshop@petmaza.com');
    console.log('Password: ' + defaultPassword);
    console.log('Role: Vendor (MY_SHOP)');
    console.log('Pincodes: 400001, 400002, 400003, 400004, 400005');
    console.log('\n--- NORMAL VENDOR ---');
    console.log('Email: normal@petmaza.com');
    console.log('Password: ' + defaultPassword);
    console.log('Role: Vendor (NORMAL)');
    console.log('Pincodes: 400010, 400011, 400012, 400013, 400014');
    console.log('\n--- PRIME VENDOR ---');
    console.log('Email: prime@petmaza.com');
    console.log('Password: ' + defaultPassword);
    console.log('Role: Vendor (PRIME)');
    console.log('Pincodes: 400020, 400021, 400022, 400023, 400024');
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed function
seedUsers();
