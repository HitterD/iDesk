// Direct behavioural verification of Nth-from-right logic (no jest machinery)
process.env.TRUSTED_PROXY_COUNT = '2';
const req2 = {
    socket: { remoteAddress: '10.0.0.1' },
    ip: '10.0.0.1',
    headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.2, 20.0.0.1' },
};
