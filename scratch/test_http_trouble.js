const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { user_id: '7bfe70a9-aa2e-4828-ad6d-581e4273ab49', email: 'aradhya@gmail.com', role: 'Researcher', name: 'Aradhya' },
  'super_secret_terramarine_token_key_123!',
  { expiresIn: '1d' }
);

function ask(msg) {
  return new Promise(resolve => {
    const data = JSON.stringify({ message: msg });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/researcher/assistant/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.write(data);
    req.end();
  });
}

async function run() {
  const r = await ask("i'm in a trouble");
  console.log('--- RESPONSE FOR "i\'m in a trouble" ---');
  console.log(r.reply);
  process.exit(0);
}

run();
