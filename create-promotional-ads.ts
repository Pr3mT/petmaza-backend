/**
 * PETMAZA - Quick Ad Creation Script
 * Run this to populate your database with promotional ads
 * 
 * How to use:
 * 1. Make sure backend is running
 * 2. Update image URLs (upload images first)
 * 3. Run: ts-node create-promotional-ads.ts
 */

import mongoose from 'mongoose';
import Ad from './src/models/Ad';
import dotenv from 'dotenv';

dotenv.config();

const SAMPLE_ADS = [
  // PRIME MEMBERSHIP CAMPAIGNS
  {
    title: "🌟 PETMAZA PRIME - Exclusive Benefits Await!",
    description: "Join Prime & Get FREE Shipping, Early Access to Sales, Extra 10% OFF on all orders, and Priority Customer Support!",
    image: "https://your-cloudinary-url/prime-membership-ad.jpg", // UPLOAD IMAGE FIRST
    link: "/prime-membership",
    position: "popup",
    displayOrder: 1,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-05-31"),
    isActive: true,
  },
  {
    title: "📦 Free Shipping on ALL Orders with Prime",
    description: "Subscribe to Petmaza Prime and never pay for shipping again! Order anytime, anywhere.",
    image: "https://your-cloudinary-url/prime-free-shipping.jpg", // UPLOAD IMAGE FIRST
    link: "/prime-membership",
    position: "top",
    displayOrder: 2,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-06-30"),
    isActive: true,
  },
  {
    title: "⚡ Early Access to Flash Sales - Prime Exclusive",
    description: "Get 24 hours early access to all sales! Plus save extra 10% on every purchase.",
    image: "https://your-cloudinary-url/prime-early-access.jpg", // UPLOAD IMAGE FIRST
    link: "/prime-membership",
    position: "sidebar",
    displayOrder: 3,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-12-31"),
    isActive: true,
  },

  // NEW USER CAMPAIGNS
  {
    title: "🎉 Welcome to Petmaza! Get 25% OFF Your First Order",
    description: "New to Petmaza? Use code WELCOME25 and save big on premium pet supplies!",
    image: "https://your-cloudinary-url/welcome-offer.jpg", // UPLOAD IMAGE FIRST
    link: "/register",
    position: "top",
    displayOrder: 4,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    title: "💰 Refer & Earn ₹500! Share the Pet Love",
    description: "Invite friends to Petmaza! You get ₹500, they get 20% OFF. Win-Win!",
    image: "https://your-cloudinary-url/referral-bonus.jpg", // UPLOAD IMAGE FIRST
    link: "/referral",
    position: "bottom",
    displayOrder: 5,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-12-31"),
    isActive: true,
  },

  // CATEGORY-SPECIFIC DEALS
  {
    title: "🐕 Premium Dog Food Sale - Upto 40% OFF!",
    description: "Royal Canin, Pedigree, Drools & More! Stock up on your pup's favorites.",
    image: "https://your-cloudinary-url/dog-food-sale.jpg", // UPLOAD IMAGE FIRST
    link: "/products?category=dog-food",
    position: "top",
    displayOrder: 6,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-15"),
    isActive: true,
  },
  {
    title: "🐱 Cat Care Bonanza - 30% OFF All Cat Products",
    description: "Litter, Food, Toys, Grooming - Everything your feline friend needs!",
    image: "https://your-cloudinary-url/cat-care-sale.jpg", // UPLOAD IMAGE FIRST
    link: "/products?category=cat",
    position: "popup",
    displayOrder: 7,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-20"),
    isActive: true,
  },

  // SEASONAL OFFERS
  {
    title: "🌸 Spring Refresh - Pet Grooming Essentials 35% OFF",
    description: "Get your pets spring-ready! Shampoos, brushes, nail clippers & more.",
    image: "https://your-cloudinary-url/spring-grooming.jpg", // UPLOAD IMAGE FIRST
    link: "/products?category=grooming",
    position: "top",
    displayOrder: 9,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-04-30"),
    isActive: true,
  },

  // APP & FEATURES
  {
    title: "📱 Download Petmaza App & Get Extra 10% OFF!",
    description: "Shop on the go! Exclusive app-only deals, faster checkout, order tracking.",
    image: "https://your-cloudinary-url/app-download.jpg", // UPLOAD IMAGE FIRST
    link: "/download-app",
    position: "bottom",
    displayOrder: 11,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-12-31"),
    isActive: true,
  },
  {
    title: "🚀 Same Day Delivery Available in Your City!",
    description: "Order before 2 PM and get your pet supplies delivered today. Available in select cities.",
    image: "https://your-cloudinary-url/same-day-delivery.jpg", // UPLOAD IMAGE FIRST
    link: "/same-day-delivery",
    position: "top",
    displayOrder: 12,
    startDate: new Date("2026-04-02"),
    endDate: new Date("2026-12-31"),
    isActive: true,
  },
];

async function createAds() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-marketplace';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing test ads (OPTIONAL - comment out if you want to keep existing)
    // await Ad.deleteMany({ title: { $regex: /🌟|📦|⚡|🎉|💰|🐕|🐱|🌸|📱|🚀/i } });
    // console.log('🗑️  Cleared existing promotional ads');

    // Create new ads
    const createdAds = await Ad.insertMany(SAMPLE_ADS);
    console.log(`✅ Created ${createdAds.length} promotional ads successfully!`);

    // Display summary
    console.log('\n📊 Ads Created:');
    createdAds.forEach((ad, index) => {
      console.log(`${index + 1}. ${ad.title} - Position: ${ad.position}`);
    });

    console.log('\n⚠️  IMPORTANT: Update image URLs in the ads before activating!');
    console.log('📸 Upload images to Cloudinary and update the "image" field for each ad.');
    
  } catch (error) {
    console.error('❌ Error creating ads:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
createAds();
