
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

async function queryData() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "TravelCheckinApp",
    charset: "utf8mb4",
  }).promise();

  try {
    const [locations] = await pool.query(
      "SELECT location_id, location_name, owner_id FROM locations WHERE location_type = 'tourist' LIMIT 5"
    );
    console.log("Tourist Locations:", JSON.stringify(locations, null, 2));

    if (locations.length > 0) {
      const ownerIds = locations.map(l => l.owner_id);
      const [owners] = await pool.query(
        "SELECT user_id, email, full_name, role FROM users WHERE user_id IN (?)",
        [ownerIds]
      );
      console.log("Owners:", JSON.stringify(owners, null, 2));

      for (const loc of locations) {
        const [services] = await pool.query(
          "SELECT service_id, service_name, quantity FROM services WHERE location_id = ? AND service_type = 'ticket' AND deleted_at IS NULL",
          [loc.location_id]
        );
        console.log(`Services for Location ${loc.location_id}:`, JSON.stringify(services, null, 2));
      }
    }
  } catch (error) {
    console.error("Error querying data:", error);
  } finally {
    await pool.end();
  }
}

queryData();
