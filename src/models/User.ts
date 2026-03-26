import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    profilePicture: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['admin', 'vendor', 'customer'],
      default: 'customer',
    },
    vendorType: {
      type: String,
      enum: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'],
    },
    pincodesServed: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes for better query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ vendorType: 1 });
userSchema.index({ isApproved: 1 });
userSchema.index({ role: 1, isApproved: 1 }); // Compound index for vendor queries

const User = mongoose.model<IUser>('User', userSchema);

export default User;

