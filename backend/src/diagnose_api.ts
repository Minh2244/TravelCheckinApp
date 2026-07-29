import { pool } from "./config/database";
import { getLocationPosTablesPublic, getLocationPosAreasPublic } from "./controllers/locationController";
import { listMyTableReservationsHandler } from "./controllers/bookingController";

async function run() {
  console.log("--- START API HANDLER DIAGNOSTICS ---");

  // Mock response object
  const createMockRes = (name: string) => {
    const res: any = {};
    res.status = (code: number) => {
      console.log(`[${name}] Status code:`, code);
      return res;
    };
    res.json = (data: any) => {
      console.log(`[${name}] JSON Response:`, JSON.stringify(data, null, 2).slice(0, 1000));
      return res;
    };
    return res;
  };

  try {
    // 1. Test getLocationPosAreasPublic for location 1
    console.log("\n--- Testing getLocationPosAreasPublic ---");
    const reqAreas = {
      params: { id: "1" }
    } as any;
    await getLocationPosAreasPublic(reqAreas, createMockRes("getLocationPosAreasPublic"));

    // 2. Test getLocationPosTablesPublic for location 1
    console.log("\n--- Testing getLocationPosTablesPublic ---");
    const reqTables = {
      params: { id: "1" },
      query: { area_id: "all" }
    } as any;
    await getLocationPosTablesPublic(reqTables, createMockRes("getLocationPosTablesPublic"));

    // 3. Test listMyTableReservationsHandler for user ID 4 and location ID 1
    console.log("\n--- Testing listMyTableReservationsHandler ---");
    const reqReservations = {
      userId: 4,
      query: { location_id: "1" }
    } as any;
    await listMyTableReservationsHandler(reqReservations, createMockRes("listMyTableReservationsHandler"));

  } catch (err: any) {
    console.error("Handler error:", err);
  } finally {
    await pool.end();
    console.log("\n--- END API HANDLER DIAGNOSTICS ---");
  }
}

run();
