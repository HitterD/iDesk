const { Client } = require('pg');

async function run() {
    const client = new Client({
        user: 'postgres',
        password: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'idesk_db'
    });

    await client.connect();

    try {
        await client.query('BEGIN');
        
        // Find items with quantity > 1
        const res = await client.query('SELECT * FROM hardware_request_items WHERE quantity > 1');
        console.log(`Found ${res.rows.length} items to split.`);

        for (const item of res.rows) {
            console.log(`Processing item ${item.id}, qty=${item.quantity}`);
            
            // Set existing to qty 1
            await client.query('UPDATE hardware_request_items SET quantity = 1 WHERE id = $1', [item.id]);

            // Create remaining quantity as individual items
            for (let i = 1; i < item.quantity; i++) {
                await client.query(`
                    INSERT INTO hardware_request_items (
                        "requestId", "catalogId", "categorySnapshot", "quantity", 
                        "actualCost", "vendor", "invoiceNumber", "invoiceDate", 
                        "notes", "deliveryStatus", "arrivedAt", 
                        "procurementDecision", "procurementDecidedAt", "procurementDecidedBy"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    item.requestId, item.catalogId, item.categorySnapshot, 1,
                    item.actualCost, item.vendor, item.invoiceNumber, item.invoiceDate,
                    item.notes, item.deliveryStatus, item.arrivedAt,
                    item.procurementDecision, item.procurementDecidedAt, item.procurementDecidedBy
                ]);
            }
        }

        await client.query('COMMIT');
        console.log('Successfully split existing items!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error during split:', e);
    } finally {
        await client.end();
    }
}

run();