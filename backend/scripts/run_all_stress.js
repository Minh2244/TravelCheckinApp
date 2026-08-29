const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Chuẩn bị thư mục docs để lưu file log tự động
const docsDir = path.join(__dirname, '../../docs/StressTestLogs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

let backendProcess = null;

async function checkServerReady() {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const req = http.get('http://localhost:3000/api/locations', (res) => {
                clearInterval(interval);
                resolve(true);
            });
            req.on('error', (err) => {
                if (attempts >= 60) {
                    clearInterval(interval);
                    resolve(false);
                }
            });
        }, 1000);
    });
}

async function killServer() {
    if (backendProcess && backendProcess.pid) {
        try {
            // Dùng taskkill với /T (Tree) để giết cả Node và Python chạy ngầm!
            execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { stdio: 'ignore' });
        } catch (e) {}
        backendProcess = null;
    }
    
    // Fallback: Diệt sạch các cổng nếu còn sót lại (dùng JS để tránh treo lệnh Pipe)
    const portsToKill = [3000, 8090];
    for (const port of portsToKill) {
        try {
            const out = execSync(`netstat -ano`).toString();
            const lines = out.split('\n');
            for (const line of lines) {
                if (line.includes(`:${port}`)) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0') {
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                    }
                }
            }
        } catch (e) {}
    }
    
    await sleep(2000); // Đợi port giải phóng hoàn toàn
}

async function start() {
    console.log("==========================================================");
    console.log("   BAT DAU CHAY TU DONG TOAN BO STRESS TEST (V3)          ");
    console.log("   TU DONG GHI LOG RA FILE MD MOI 10 LENH !               ");
    console.log("==========================================================");

    await killServer();

    let fileIndex = 1;
    let currentMdFile = path.join(docsDir, `Kết_Quả_Stress_Test_Phần_${fileIndex}.md`);
    fs.writeFileSync(currentMdFile, `# KẾT QUẢ STRESS TEST (PHẦN ${fileIndex})\n\n`);

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        
        console.log(`\n[${i + 1}/${commands.length}] >>> Dang khoi dong lai Backend...`);
        backendProcess = spawn('npm run dev', { shell: true, stdio: 'ignore' });
        
        process.stdout.write("Dang doi Server chay len... ");
        const isReady = await checkServerReady();
        if (!isReady) {
            console.log("Loi: Server khong the khoi dong! Bo qua lenh nay.");
            await killServer();
            continue;
        }
        console.log("Server da san sang!");
        await sleep(2000); 

        console.log(`[${i + 1}/${commands.length}] >>> Dang chay Test: ${cmd}`);
        
        // Chạy Test và ghi đè output ra file
        let output = "";
        await new Promise((resolve) => {
            const testProc = spawn(cmd, { shell: true });
            testProc.stdout.on('data', (data) => {
                process.stdout.write(data);
                output += data.toString();
            });
            testProc.stderr.on('data', (data) => {
                process.stderr.write(data);
                output += data.toString();
            });
            testProc.on('close', () => resolve());
        });
        
        // Ghi vào Markdown
        fs.appendFileSync(currentMdFile, `\n## [${i + 1}] Command: ${cmd}\n\n\`\`\`text\n${output}\n\`\`\`\n`);
        console.log(`\n✅ Đã lưu kết quả của API [${i + 1}] vào file Markdown!`);

        // Tự động tách file mỗi 10 lệnh
        if ((i + 1) % 10 === 0 && i < commands.length - 1) {
            fileIndex++;
            currentMdFile = path.join(docsDir, `Kết_Quả_Stress_Test_Phần_${fileIndex}.md`);
            fs.writeFileSync(currentMdFile, `# KẾT QUẢ STRESS TEST (PHẦN ${fileIndex})\n\n`);
            console.log(`\n🚀 CHUYỂN SANG GHI LOG VÀO FILE MỚI: Phần ${fileIndex}`);
        }

        console.log(`\n[${i + 1}/${commands.length}] >>> Da test xong! Tat Server va nghi 30s de giam nhiet CPU...`);
        await killServer();
        
        if (i < commands.length - 1) {
            for (let sec = 30; sec > 0; sec--) {
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
