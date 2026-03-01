import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const testEmail = async () => {
  console.log('🧪 Testing Email Configuration...\n');
  
  console.log('📋 SMTP Settings:');
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   Secure: ${process.env.SMTP_SECURE}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   Pass: ${process.env.SMTP_PASS ? '***SET***' : '***NOT SET***'}\n`);

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
    console.log('🔌 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Send to yourself
      subject: 'PetMaza Email TEST ✓',
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2 style="color: #2e7d32;">✅ Email System is Working!</h2>
          <p>If you received this email, your SMTP configuration is correct.</p>
          <p><strong>Test Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}\n`);
    console.log('💡 Check your inbox (and spam folder) to confirm receipt.\n');
  } catch (error: any) {
    console.error('❌ Email test failed!');
    console.error(`   Error: ${error.message}\n`);
    console.log('🔧 Troubleshooting:');
    console.log('   1. Gmail app password must be 16 characters with spaces');
    console.log('   2. 2-Step Verification must be enabled on Gmail');
    console.log('   3. Check SMTP_USER and SMTP_PASS in .env');
    console.log('   4. Verify internet connection');
  }

  process.exit(0);
};

testEmail();
