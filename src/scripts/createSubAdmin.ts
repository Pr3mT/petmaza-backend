import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const createSubAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const email = 'subadmin@petmaza.com';

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('⚠️  Sub Admin user already exists with email:', email);
      await mongoose.connection.close();
      process.exit(0);
    }

    await User.create({
      name: 'Sub Admin',
      email,
      password: 'Password123!',
      phone: '9876543215',
      role: 'sub_admin',
      isApproved: true,
      isEmailVerified: true,
      address: {
        street: 'Admin Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
    });

    console.log('\n========================================');
    console.log('SUB ADMIN CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('Email   : subadmin@petmaza.com');
    console.log('Password: Password123!');
    console.log('Role    : sub_admin');
    console.log('========================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating sub admin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createSubAdmin();
