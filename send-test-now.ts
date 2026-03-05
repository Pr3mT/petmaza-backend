import { sendVerificationEmail } from './src/services/emailer';
import dotenv from 'dotenv';

dotenv.config();

async function testQuickEmail() {
  try {
    const testEmail = 'samruddhiamrutkar15@gmail.com';
    const testCode = '999888';

    console.log('\n🚀 SENDING VERIFICATION EMAIL NOW...');
    console.log(`   To: ${testEmail}`);
    console.log(`   Code: ${testCode}`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}\n`);

    await sendVerificationEmail(testEmail, testCode);

    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('\n📬 CHECK YOUR INBOX NOW:');
    console.log('   1. Open Gmail: samruddhiamrutkar15@gmail.com');
    console.log('   2. Check SPAM/JUNK folder first!');
    console.log('   3. Search for: "Verify Your Email - Petmaza"');
    console.log('   4. Verification code is: 999888\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

testQuickEmail();
