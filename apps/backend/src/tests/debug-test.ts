/**
 * Minimal Debug Test Script
 */
import axios from 'axios';

const API_URL = 'http://localhost:5050';

async function run() {
    console.log('=== MINIMAL DEBUG TEST ===\n');

    // Step 1: Login
    console.log('1. Attempting login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@idesk.com',
        password: 'admin123',
    });

    console.log('   Status:', loginRes.status);
    console.log('   Data keys:', Object.keys(loginRes.data));
    console.log('   access_token exists:', !!loginRes.data.access_token);
    console.log('   Token (first 30):', loginRes.data.access_token?.substring(0, 30));

    const token = loginRes.data.access_token;

    if (!token) {
        console.log('\n❌ No token received!');
        return;
    }

    // Step 2: Call Sites with token
    console.log('\n2. Calling /sites with token...');
    const sitesRes = await axios.get(`${API_URL}/sites`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    console.log('   Status:', sitesRes.status);
    console.log('   Sites count:', sitesRes.data?.length);
    if (sitesRes.data?.length > 0) {
        console.log('   First site:', sitesRes.data[0].code, '-', sitesRes.data[0].name);
    }

    // Step 3: Call Manager Dashboard
    console.log('\n3. Log in as manager...');
    const mgrLoginRes = await axios.post(`${API_URL}/auth/login`, {
        email: 'manager@idesk.com',
        password: 'admin123',
    });
    const mgrToken = mgrLoginRes.data.access_token;
    console.log('   Manager token (first 30):', mgrToken?.substring(0, 30));

    console.log('\n4. Calling /manager/dashboard...');
    const dashRes = await axios.get(`${API_URL}/manager/dashboard`, {
        headers: {
            'Authorization': `Bearer ${mgrToken}`,
        },
    });
    console.log('   Status:', dashRes.status);
    console.log('   Dashboard keys:', Object.keys(dashRes.data));

    console.log('\n✅ All tests passed!');
}

run().catch(e => {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
});
