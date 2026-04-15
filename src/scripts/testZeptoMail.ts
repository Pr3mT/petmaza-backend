import dotenv from 'dotenv';
import { sendEmail } from '../services/emailer';

// Load env
dotenv.config();

async function run() {
  try {
    console.log('Sending test email to admin...');
    const res = await sendEmail({
      to: process.env.ADMIN_EMAILS?.split(',')[0] || 'admin@example.com',
      subject: 'Test ZeptoMail - Petmaza',
      html: '<p>This is a test email from Petmaza ZeptoMail integration.</p>',
      trigger: 'test_email',
    });
    console.log('Result:', res);
  } catch (err: any) {
    console.error('Send failed:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    if (err.response) console.error('Response:', JSON.stringify(err.response, Object.getOwnPropertyNames(err.response), 2));
  }
}

run().then(() => process.exit(0));
