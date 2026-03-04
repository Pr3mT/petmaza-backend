import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function quickEmailTest() {
  try {
    console.log('🧪 Quick SMTP Test\n');
    console.log('Testing new email configuration:');
    console.log(`   From: ${process.env.SMTP_FROM || process.env.SMTP_USER}`);
    console.log(`   SMTP User: ${process.env.SMTP_USER}`);
    console.log(`   Password: ${process.env.SMTP_PASS ? '✓ Set' : '❌ Not set'}\n`);
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('Sending test email...');
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'samruddhiamrutkar15@gmail.com',
      subject: 'PETMAZA Email Test',
      html: '<h1>✅ Email Configuration Working!</h1><p>This email was sent from officialpetmaza@gmail.com</p>',
    });

    console.log('\n✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('\n📬 Check inbox: samruddhiamrutkar15@gmail.com');
    console.log('   From: PETMAZA <officialpetmaza@gmail.com>');
    console.log('\n💡 Also check SPAM folder!');
    
  } catch (error: any) {
    console.error('\n❌ FAILED:', error.message);
    if (error.code === 'EAUTH') {
      console.error('\n🔒 Authentication Error!');
      console.error('   → SMTP password is incorrect');
      console.error('   → Check SMTP_PASS in .env file');
    } else if (error.code) {
      console.error('   Error Code:', error.code);
    }
  } finally {
    process.exit(0);
  }
}

quickEmailTest();
