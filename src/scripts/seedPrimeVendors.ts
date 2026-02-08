import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import Brand from '../models/Brand';

dotenv.config();

const seedPrimeVendors = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get some brands for the vendors
    const brands = await Brand.find({}).limit(5);
    if (brands.length === 0) {
      console.log('⚠️ No brands found. Please run resetProducts.ts first.');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Prime Vendors Data
    const primeVendorsData = [
      // Bangalore Vendors
      {
        user: {
          name: 'PetCare Hub Bangalore',
          email: 'petcare.bangalore@primepets.com',
          password: hashedPassword,
          phone: '9876543210',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'PetCare Hub - Koramangala',
          brandsHandled: [brands[0]._id, brands[1]._id],
          pickupAddress: {
            street: '45, 5th Block, Koramangala',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560034',
          },
          serviceablePincodes: ['560001', '560002', '560034', '560095', '560100'],
          bankDetails: {
            accountNumber: '1234567890',
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            accountHolderName: 'PetCare Hub Bangalore',
          },
          isApproved: true,
        },
      },
      {
        user: {
          name: 'Premium Pets Bangalore',
          email: 'premium.bangalore@primepets.com',
          password: hashedPassword,
          phone: '9876543211',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'Premium Pets - Whitefield',
          brandsHandled: [brands[2]._id, brands[3]._id],
          pickupAddress: {
            street: '123, ITPL Main Road, Whitefield',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560066',
          },
          serviceablePincodes: ['560048', '560066', '560037', '560087'],
          bankDetails: {
            accountNumber: '2234567890',
            ifscCode: 'ICIC0002234',
            bankName: 'ICICI Bank',
            accountHolderName: 'Premium Pets Bangalore',
          },
          isApproved: true,
        },
      },

      // Kolkata Vendors
      {
        user: {
          name: 'Pet Paradise Kolkata',
          email: 'petparadise.kolkata@primepets.com',
          password: hashedPassword,
          phone: '9876543212',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'Pet Paradise - Salt Lake',
          brandsHandled: [brands[0]._id, brands[4]._id],
          pickupAddress: {
            street: 'AA-123, Sector 2, Salt Lake',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700091',
          },
          serviceablePincodes: ['700001', '700091', '700064', '700027', '700156'],
          bankDetails: {
            accountNumber: '3234567890',
            ifscCode: 'SBIN0003234',
            bankName: 'State Bank of India',
            accountHolderName: 'Pet Paradise Kolkata',
          },
          isApproved: true,
        },
      },
      {
        user: {
          name: 'Royal Pets Kolkata',
          email: 'royal.kolkata@primepets.com',
          password: hashedPassword,
          phone: '9876543213',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'Royal Pets - Park Street',
          brandsHandled: [brands[1]._id, brands[2]._id],
          pickupAddress: {
            street: '67, Park Street',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700016',
          },
          serviceablePincodes: ['700016', '700019', '700071', '700029'],
          bankDetails: {
            accountNumber: '4234567890',
            ifscCode: 'HDFC0004234',
            bankName: 'HDFC Bank',
            accountHolderName: 'Royal Pets Kolkata',
          },
          isApproved: true,
        },
      },

      // Pune Vendors
      {
        user: {
          name: 'Pet World Pune',
          email: 'petworld.pune@primepets.com',
          password: hashedPassword,
          phone: '9876543214',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'Pet World - Hinjewadi',
          brandsHandled: [brands[3]._id, brands[4]._id],
          pickupAddress: {
            street: 'Phase 2, Rajiv Gandhi Infotech Park',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411057',
          },
          serviceablePincodes: ['411057', '411045', '411033', '411038'],
          bankDetails: {
            accountNumber: '5234567890',
            ifscCode: 'AXIS0005234',
            bankName: 'Axis Bank',
            accountHolderName: 'Pet World Pune',
          },
          isApproved: true,
        },
      },
      {
        user: {
          name: 'Paws & Claws Pune',
          email: 'pawsclaws.pune@primepets.com',
          password: hashedPassword,
          phone: '9876543215',
          role: 'vendor',
          vendorType: 'PRIME',
          isApproved: true,
        },
        details: {
          vendorType: 'PRIME',
          shopName: 'Paws & Claws - Viman Nagar',
          brandsHandled: [brands[0]._id, brands[3]._id],
          pickupAddress: {
            street: '89, Viman Nagar Road',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411014',
          },
          serviceablePincodes: ['411014', '411006', '411001', '411040'],
          bankDetails: {
            accountNumber: '6234567890',
            ifscCode: 'ICIC0006234',
            bankName: 'ICICI Bank',
            accountHolderName: 'Paws & Claws Pune',
          },
          isApproved: true,
        },
      },
    ];

    // Create vendors
    console.log('\n🔄 Creating Prime Vendors...\n');
    
    for (const vendorData of primeVendorsData) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: vendorData.user.email });
        if (existingUser) {
          console.log(`⚠️  Skipped: ${vendorData.user.name} (already exists)`);
          continue;
        }

        // Create user
        const user = await User.create(vendorData.user);
        
        // Create vendor details
        await VendorDetails.create({
          ...vendorData.details,
          vendor_id: user._id,
        });

        console.log(`✅ Created: ${vendorData.user.name} (${vendorData.details.shopName})`);
      } catch (error: any) {
        console.error(`❌ Error creating ${vendorData.user.name}:`, error.message);
      }
    }

    console.log('\n========================================');
    console.log('✅ PRIME VENDORS SEEDED SUCCESSFULLY');
    console.log('========================================\n');
    console.log('📍 Cities: Bangalore (2), Kolkata (2), Pune (2)');
    console.log('🔐 Password for all vendors: password123');
    console.log('\n========================================\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding prime vendors:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedPrimeVendors();
