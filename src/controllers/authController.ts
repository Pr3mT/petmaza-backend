import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { sendVerificationEmail, sendVerificationSuccessEmail, sendEmail } from '../services/emailer';
import { OAuth2Client } from 'google-auth-library';
import logger from '../config/logger';

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
    let vendorType: 'PRIME' | 'MY_SHOP' | undefined;

    if (userRole === 'vendor') {
      vendorType = vendor_type; // PRIME or MY_SHOP
      if (!vendorType || !['PRIME', 'MY_SHOP'].includes(vendorType)) {
        return next(new AppError('Invalid vendor type. Must be PRIME or MY_SHOP', 400));
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

/**
 * Google OAuth Sign-In
 * Verify Google ID token and create/login user
 */
export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return next(new AppError('Google credential is required', 400));
    }

    // Initialize Google OAuth client
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return next(new AppError('Invalid Google token', 400));
    }

    const { email, name, picture, sub: googleId, email_verified } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists - login
      // Update Google ID and email verification if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profilePicture = picture;
        user.isEmailVerified = true; // Google emails are verified
        await user.save();
      }
    } else {
      // Create new user with Google account
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        googleId,
        profilePicture: picture,
        role: 'customer',
        isEmailVerified: true, // Google emails are always verified
        isApproved: true, // Auto-approve Google users
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), // Random password for Google users
      });
    }

    // Generate JWT token
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
      message: user.googleId === googleId ? 'Login successful' : 'Account created successfully',
      data: {
        user: userObj,
        token,
      },
    });
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    next(new AppError('Google authentication failed', 401));
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // User is already fetched in auth middleware, just return it
    // No need for another DB query
    const user = req.user;

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

/**
 * Send verification email with OTP
 */
export const sendVerificationEmailController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new AppError('Invalid email format', 400));
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        code: verificationCode, // In production, store this in Redis/DB with expiry
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Send thank you email after successful verification
 */
export const sendVerificationSuccessController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return next(new AppError('Email and name are required', 400));
    }

    // Send thank you email
    await sendVerificationSuccessEmail(email, name);

    res.status(200).json({
      success: true,
      message: 'Thank you email sent successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Register Prime Vendor
 * Special registration endpoint for prime vendors with additional business details
 */
export const registerPrimeVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      // User Details
      name, email, password, phone,
      
      // Business Details
      shopName, panCard, aadharCard,
      businessType, yearsInBusiness,
      
      // Bank Details
      bankDetails,
      
      // Billing Details
      billingDetails,
      
      // Address
      pickupAddress,
      serviceablePincodes,
      
      // Optional
      brandsHandled,
      averageDeliveryTime,
      returnPolicy,
    } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return next(new AppError('Please provide all required user details', 400));
    }

    if (!shopName || !panCard || !aadharCard || !businessType) {
      return next(new AppError('Please provide all required business details', 400));
    }

    if (!bankDetails || !billingDetails || !pickupAddress) {
      return next(new AppError('Please provide bank, billing, and pickup address details', 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    // Create User
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'vendor',
      vendorType: 'PRIME',
      address: pickupAddress,
      pincodesServed: serviceablePincodes || [],
      isApproved: false, // Pending admin approval
    });

    // Create Vendor Details
    await VendorDetails.create({
      vendor_id: user._id,
      vendorType: 'PRIME',
      shopName,
      panCard,
      aadharCard,
      bankDetails,
      billingDetails,
      pickupAddress,
      serviceablePincodes: serviceablePincodes || [],
      brandsHandled: brandsHandled || [],
      businessType,
      yearsInBusiness: yearsInBusiness || 0,
      averageDeliveryTime: averageDeliveryTime || '2-5 days',
      returnPolicy: returnPolicy || '7 days return policy',
      isApproved: false,
    });

    // TODO: Send welcome email + pending approval notification

    res.status(201).json({
      success: true,
      message: 'Prime vendor registration successful. Your application is pending admin approval.',
      data: {
        userId: user._id,
        email: user.email,
        status: 'pending_approval',
      },
    });

  } catch (error: any) {
    next(error);
  }
};

/**
 * Forgot Password
 * Send password reset email to user
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError('Please provide your email address', 400));
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if email exists or not
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link shortly.',
      });
    }

    // Generate reset token using crypto
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and set to resetPasswordToken field
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Set token and expiration on user (30 minutes)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${email}`;

    // Send password reset email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .link { color: #667eea; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${user.name},</p>
            <p>We received a request to reset your password for your PETMAZA account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background-color: #667eea; border-radius: 5px; padding: 15px 40px;">
                    <a href="${resetUrl}" style="color: #ffffff; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="text-align: center;"><a href="${resetUrl}" class="link">${resetUrl}</a></p>
            <p><strong>Note:</strong> This link will expire in 30 minutes for security reasons.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>Best regards,<br>The PETMAZA Team</p>
          </div>
          <div class="footer">
            <p>© 2026 PETMAZA - Pet Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: 'Password Reset Request - PETMAZA',
      html: emailHtml,
      trigger: 'forgot_password',
      userId: user._id.toString(),
    });

    res.status(200).json({
      success: true,
      message: 'Password reset instructions have been sent to your email.',
    });

  } catch (error: any) {
    logger.error(`Forgot password error: ${error.message}`);
    next(error);
  }
};

/**
 * Reset Password
 * Verify token and update user password
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return next(new AppError('Please provide token, email and new password', 400));
    }

    if (newPassword.length < 6) {
      return next(new AppError('Password must be at least 6 characters long', 400));
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token and email, and token not expired
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <p>Hello ${user.name},</p>
            <p>Your PETMAZA account password has been successfully changed.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p>Best regards,<br>The PETMAZA Team</p>
          </div>
          <div class="footer">
            <p>© 2026 PETMAZA - Pet Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: 'Password Changed Successfully - PETMAZA',
      html: emailHtml,
      trigger: 'password_reset_success',
      userId: user._id.toString(),
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });

  } catch (error: any) {
    logger.error(`Reset password error: ${error.message}`);
    next(error);
  }
};

