require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sendEmail = require('../src/utils/sendEmail');

async function runTest() {
  console.log('--- Testing TerraMarine Email Dispatch ---');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***[SET]***' : 'NOT SET');
  
  const recipient = process.argv[2] || process.env.SMTP_USER || 'terramarine33@gmail.com';
  console.log(`Sending test email to: ${recipient}...`);

  try {
    const res = await sendEmail({
      to: recipient,
      subject: 'TerraMarine Email Test - Working!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #e0f2fe; border-radius: 8px;">
          <h2 style="color: #0284c7;">🌊 TerraMarine Email System Verification</h2>
          <p>This is a test email sent from <strong>${process.env.SMTP_USER}</strong> to verify that your mail sending setup is working perfectly!</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('Test failed with error:', err);
  }
}

runTest();
