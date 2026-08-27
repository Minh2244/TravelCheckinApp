const { spawn } = require('child_process');

const commands = [
    // ================= KHACH HANG (USER / PUBLIC) =================
    "node scripts/auto_stress.js GET http://localhost:3000/api/locations",
    "node scripts/auto_stress.js GET http://localhost:3000/api/locations/1",
    "node scripts/auto_stress.js GET http://localhost:3000/api/locations/1/reviews",
    "node scripts/auto_stress.js GET \"http://localhost:3000/api/geo/nearby?lat=10&lng=106\"",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/profile",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/checkins",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/favorites",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/leaderboard",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/notifications",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/vouchers/saved",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/recommendations/locations",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/created-locations",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/profile/login-history",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/vouchers/location/1",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/tickets",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/diary",
    "node scripts/auto_stress.js GET http://localhost:3000/api/user/booking-reminders",
    "node scripts/auto_stress.js GET http://localhost:3000/api/itineraries",
    "node scripts/auto_stress.js GET http://localhost:3000/api/ai/chat/history",
    "node scripts/auto_stress.js POST http://localhost:3000/api/sos '{\"lat\":10.8,\"lng\":106.6,\"message\":\"Help!\"}'",

    // ================= CHU CO SO (OWNER / POS / HOTEL) =================
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/me",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/profile",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/profile/login-history",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/profile/audit-logs",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/bank",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/locations",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/locations/1/services",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/bookings",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/bookings/1/food-items",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/payments",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/commissions",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/commissions/pending-payments",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers/stats",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers/1/usage-history",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/reviews",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/notifications",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/checkins",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/employees",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/context",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/hotel/rooms",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/areas",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/tables",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/menu",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/payments-history",
    "node scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/tourist/tickets/today",
    "node scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/pos/tables/1/open",
    "node scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/pos/orders/1/items '{\"items\":[{\"id\":1,\"qty\":2}]}'",
    "node scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/checkins/secure-qr '{\"qr_code\":\"ABCD\"}'",
    "node scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/tourist/tickets/sell '{\"tickets\":[{\"type_id\":1,\"qty\":5}]}'",

    // ================= QUAN TRI VIEN (ADMIN) =================
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/dashboard/stats",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/finance/summary",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/owners/pending",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/system/audit-logs",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/locations",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/bookings",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/users",
    "node scripts/auto_stress.js GET http://localhost:3000/api/admin/export"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runCommand(cmdStr) {
    return new Promise((resolve) => {
        const process = spawn(cmdStr, { shell: true, stdio: 'inherit' });
        process.on('close', () => resolve());
    });
}

async function start() {
    console.log("=============================================");
    console.log("   BAT DAU CHAY TU DONG TOAN BO STRESS TEST  ");
    console.log("      (58 API - SIEU KHUNG - CO NGHI 10S)    ");
    console.log("=============================================");

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        console.log(`\n[${i + 1}/${commands.length}] >>> Dang chay: ${cmd}`);
        
        await runCommand(cmd);
        
        if (i < commands.length - 1) {
            console.log(`[${i + 1}/${commands.length}] >>> Da chay xong! Server dang nghi ngoi giai phong RAM...`);
            for (let sec = 10; sec > 0; sec--) {
                process.stdout.write(`\rDoi ${sec} giay nua de chay lenh tiep theo... `);
                await sleep(1000);
            }
            console.log("\rTiep tuc!                                          ");
        }
    }

    console.log("\n=============================================");
    console.log("   DA HOAN TAT TOAN BO QUA TRINH KIEM THU    ");
    console.log("=============================================");
}

start();
