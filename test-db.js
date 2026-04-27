const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/idesk' });
client.connect().then(() => client.query('SELECT role, "isActive", COUNT(*) FROM users GROUP BY role, "isActive"')).then(res => { console.table(res.rows); client.end() }).catch(e => {console.error(e); client.end()});
