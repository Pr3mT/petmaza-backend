import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function testSMTPConnection() {
  console.log('🔍 Checking SMTP Configuration...\n');
  
  console.log('SMTP Settings:');
  console.log('   Host:', process.env.SMTP_HOST);
  console.log('   Port:', process.env.SMTP_PORT);
  console.log('   Secure:', process.env.SMTP_SECURE);
  console.log('   User:', process.env.SMTP_USER);
  console.log('   Pass:', process.env.SMTP_PASS ? '✓ Set (hidden)' : '❌ NOT SET');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('\n🧪 Testing SMTP Connection...');
    await transporter.verify();
    console.log('✅ SMTP Connection Successful!');
    console.log('\n✅ Email system is configured correctly.');
    console.log('Emails should be working.');
  } catch (error: any) {
    console.error('\n❌ SMTP Connection Failed!');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    console.error('\n🔧 Possible issues:');
    console.error('   1. Check SMTP credentials in .env file');
    console.error('   2. Gmail App Password may be invalid');
    console.error('   3. Network/firewall blocking SMTP port 587');
    console.error('   4. Gmail security settings need to be updated');
  }
  
  process.exit(0);
}

testSMTPConnection();
