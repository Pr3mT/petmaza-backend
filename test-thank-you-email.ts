import { sendVerificationSuccessEmail } from './src/services/emailer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testThankYouEmail() {
  try {
    console.log('\n🧪 Testing Thank You Email After Verification...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const testEmail = 'samruddhiamrutkar15@gmail.com';
    const testName = 'Samruddhi Amrutkar';

    console.log('📧 Sending thank you email...');
    console.log(`   → To: ${testEmail}`);
    console.log(`   → Name: ${testName}`);
    console.log(`   → Time: ${new Date().toLocaleTimeString()}\n`);

    await sendVerificationSuccessEmail(testEmail, testName);

    console.log('✅ THANK YOU EMAIL SENT SUCCESSFULLY!\n');
    console.log('📬 CHECK YOUR INBOX NOW:');
    console.log('   ✓ Subject: "Welcome to Petmaza - Email Verified Successfully!"');
    console.log('   ✓ Green checkmark icon');
    console.log('   ✓ Welcome message and thank you');
    console.log('   ✓ What\'s next section');
    console.log('   ✓ Why choose Petmaza features\n');
    console.log('⚠️  Remember to check SPAM/JUNK folder!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

testThankYouEmail();
