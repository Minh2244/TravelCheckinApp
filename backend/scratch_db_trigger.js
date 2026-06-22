const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Minhmap3367@',
    database: 'TravelCheckinApp'
  });
  
  try {
    console.log("Dropping old trigger if exists...");
    await pool.query('DROP TRIGGER IF EXISTS before_payments_insert');
    
    console.log("Creating trigger...");
    await pool.query(`
      CREATE TRIGGER before_payments_insert
      BEFORE INSERT ON payments
      FOR EACH ROW
      BEGIN
        DECLARE new_seq INT;
        DECLARE pfx VARCHAR(2);
        
        -- increment sequence
        INSERT INTO location_invoice_sequences (location_id, last_seq) VALUES (NEW.location_id, 1)
        ON DUPLICATE KEY UPDATE last_seq = last_seq + 1;
        
        SELECT last_seq INTO new_seq FROM location_invoice_sequences WHERE location_id = NEW.location_id;
        
        SET NEW.invoice_seq = new_seq;
        
        IF NEW.notes LIKE '%"service_type":"food"%' OR NEW.notes LIKE '%"service_type":"table"%' THEN
          SET pfx = 'NH';
        ELSEIF NEW.notes LIKE '%"service_type":"ticket"%' OR NEW.notes LIKE 'TOURIST_TICKETS:%' THEN
          SET pfx = 'DL';
        ELSE
          SET pfx = 'KS';
        END IF;
        
        SET NEW.invoice_code = CONCAT(pfx, '-', DATE_FORMAT(NOW(), '%y%m%d'), '-', new_seq);
      END
    `);
    console.log("Trigger created successfully.");
  } catch (err) {
    console.error(err);
  }
  
  process.exit(0);
}
run();
