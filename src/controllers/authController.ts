import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, phone, role, vendor_type, shopName, panCard, aadharCard, bankDetails, billingDetails, address, categories, pincodesServed } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    // Determine role and vendorType
    const userRole = role || 'customer';
    let vendorType: 'PRIME' | 'NORMAL' | 'MY_SHOP' | undefined;

    if (userRole === 'vendor') {
      vendorType = vendor_type; // PRIME, NORMAL, or MY_SHOP
      if (!vendorType || !['PRIME', 'NORMAL', 'MY_SHOP'].includes(vendorType)) {
        return next(new AppError('Invalid vendor type. Must be PRIME, NORMAL, or MY_SHOP', 400));
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: userRole,
      vendorType,
      pincodesServed: pincodesServed || [],
      address: role === 'customer' ? address : undefined,
      isApproved: userRole === 'admin' || vendorType === 'MY_SHOP' ? true : false, // MY_SHOP auto-approved
    });

    // Create vendor details if vendor
    if (userRole === 'vendor' && vendorType) {
      const { brandsHandled, pickupAddress, serviceablePincodes } = req.body;
      
      await VendorDetails.create({
        vendor_id: user._id,
        vendorType,
        shopName,
        brandsHandled: brandsHandled || [],
        pickupAddress: pickupAddress || address,
        serviceablePincodes: serviceablePincodes || [],
        panCard,
        aadharCard,
        bankDetails,
        billingDetails,
        isApproved: vendorType === 'MY_SHOP' ? true : false,
      });
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Remove password from response
    const userObj = user.toObject() as any;
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userObj,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await (user as any).comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Remove password from response
    const userObj = user.toObject() as any;
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userObj,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(address && { address }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

