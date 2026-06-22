const m = require('mysql2/promise');

async function run() {
  const c = await m.createConnection({
    user: 'root',
    password: 'Minhmap3367@',
    database: 'TravelCheckinApp'
  });

  try {
    const [bookingCount] = await c.query("SELECT COUNT(*) as count FROM booking_tickets WHERE ticket_code LIKE 'SB-%' AND service_id IN (SELECT service_id FROM services WHERE service_type = 'ticket')");
    console.log('booking_tickets matching SB- for tourist services:', bookingCount[0].count);

    if (bookingCount[0].count > 0) {
      const [res] = await c.query("UPDATE booking_tickets SET ticket_code = REPLACE(ticket_code, 'SB-', 'DL-') WHERE ticket_code LIKE 'SB-%' AND service_id IN (SELECT service_id FROM services WHERE service_type = 'ticket')");
      console.log('booking_tickets updated:', res.affectedRows);
    }

    const [posCount] = await c.query("SELECT COUNT(*) as count FROM pos_tickets WHERE ticket_code LIKE 'SB-%' AND service_id IN (SELECT service_id FROM services WHERE service_type = 'ticket')");
    console.log('pos_tickets matching SB- for tourist services:', posCount[0].count);

    if (posCount[0].count > 0) {
      const [res2] = await c.query("UPDATE pos_tickets SET ticket_code = REPLACE(ticket_code, 'SB-', 'DL-') WHERE ticket_code LIKE 'SB-%' AND service_id IN (SELECT service_id FROM services WHERE service_type = 'ticket')");
      console.log('pos_tickets updated:', res2.affectedRows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await c.end();
  }
}

run();
