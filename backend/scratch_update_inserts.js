const fs = require('fs');

const path = 'e:/TravelCheckinApp/backend/src/controllers/ownerController.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /(const \[insert\] = await conn\.query<ResultSetHeader>\([\s\S]*?INSERT INTO payments[\s\S]*?;\s*)/g;

let count = 0;
content = content.replace(regex, (match) => {
  count++;
  // We need to determine the prefix based on service_type or notes
  // Since we don't always have serviceType, we can default to KS or determine it dynamically
  // Let's just append a generic UPDATE query that uses IF-ELSE on notes
  return match + `\n      await conn.query(
        \`UPDATE payments 
         SET invoice_code = CONCAT(
           CASE 
             WHEN notes LIKE '%"service_type":"food"%' OR notes LIKE '%"service_type":"table"%' THEN 'NH'
             WHEN notes LIKE '%"service_type":"ticket"%' OR notes LIKE 'TOURIST_TICKETS:%' THEN 'DL'
             ELSE 'KS'
           END, 
           '-', DATE_FORMAT(NOW(), '%y%m%d'), '-', payment_id
         ) 
         WHERE payment_id = ?\`,
        [insert.insertId]
      );\n`;
});

console.log('Replaced', count, 'occurrences');
fs.writeFileSync(path, content, 'utf8');
