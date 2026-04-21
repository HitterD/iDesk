const http = require('http');

const data = JSON.stringify({
  fullName: 'John Doe',
  email: 'john10@cxamplc.com',
  role: 'AGENT',
  autoGeneratePassword: true
});

const options = {
  hostname: 'localhost',
  port: 5050,
  path: '/v1/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
