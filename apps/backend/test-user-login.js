const http = require('http');
// First login
const loginData = JSON.stringify({ email: 'admin@idesk.com', password: 'password' }); // Assuming standard admin test credentials
const loginReq = http.request({
  hostname: 'localhost', port: 5050, path: '/v1/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
  let body = ''; res.on('data', c => body += c);
  res.on('end', () => {
    let token = ''; try { const parsed = JSON.parse(body); token = parsed.access_token || parsed.data?.accessToken; } catch(e){}
    if(!token) return console.log('Login failed:', body);
    
    // Create User
    const userData = JSON.stringify({ fullName: 'Test User', email: 'testdbvar2@cxamplc.com', role: 'AGENT', autoGeneratePassword: true });
    const uReq = http.request({
      hostname: 'localhost', port: 5050, path: '/v1/users', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': userData.length, 'Authorization': 'Bearer ' + token }
    }, (uRes) => {
      let uBody = ''; uRes.on('data', c => uBody += c);
      uRes.on('end', () => console.log('Create User Response:', uRes.statusCode, uBody));
    });
    uReq.write(userData); uReq.end();
  });
});
loginReq.write(loginData); loginReq.end();
