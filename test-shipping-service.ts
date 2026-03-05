import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { ShippingService } from './src/services/ShippingService';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://prem:8007@cluster0.vgjkl.mongodb.net/pet-marketplace?retryWrites=true&w=majority';

async function testShippingService() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');

    console.log('Testing ShippingService.calculateCharges()...');
    const startTime = Date.now();
    
    const charges = await ShippingService.calculateCharges(1500);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ ShippingService.calculateCharges() completed in', duration, 'ms');
    console.log('Charges:', charges);
    console.log('');

    // Test 2: Get settings
    console.log('Testing ShippingService.getSettings()...');
    const settings = await ShippingService.getSettings();
    console.log('✅ Settings:', settings);
    
    await mongoose.disconnect();
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testShippingService();
