import { sendVerificationEmail } from './src/services/emailer';
import dotenv from 'dotenv';

dotenv.config();

async function testVerificationEmail() {
  try {
    console.log('🧪 Testing Email Verification...\n');

    const testEmail = 'samruddhiamrutkar15@gmail.com';
    const testCode = '123456';

    console.log('📧 Sending verification email...');
    console.log(`   → To: ${testEmail}`);
    console.log(`   → Code: ${testCode}\n`);

    await sendVerificationEmail(testEmail, testCode);

    console.log('✅ Verification email sent successfully!\n');
    console.log('📬 Check your inbox for:');
    console.log('   ✓ PETMAZA header (centered, clean design)');
    console.log('   ✓ 6-digit verification code in dashed box');
    console.log('   ✓ Clear instructions');
    console.log('   ✓ 10-minute validity warning\n');

    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testVerificationEmail();
