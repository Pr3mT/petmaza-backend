import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function run() {
  const host = process.env.ZEPTOMAIL_HOST || 'api.zeptomail.com';
  const url = `https://${host}/v1.1/email`;
  const token = process.env.ZEPTOMAIL_TOKEN || '';
  const from = {
    address: process.env.ZEPTOMAIL_FROM_ADDRESS || 'noreply@petmaza.com',
    name: process.env.ZEPTOMAIL_FROM_NAME || 'PETMAZA',
  };
  const to = (process.env.ADMIN_EMAILS?.split(',')[0] || 'admin@example.com').trim();

  console.log('POST', url);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({
        from,
        to: [ { email_address: { address: to, name: to } } ],
        subject: 'Raw Test ZeptoMail',
        htmlbody: '<p>Raw test</p>'
      })
    });

    console.log('Status:', resp.status);
    const text = await resp.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

run().then(() => process.exit(0));
