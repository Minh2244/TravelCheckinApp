Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   BẮT ĐẦU CHẠY TỰ ĐỘNG TOÀN BỘ STRESS TEST  " -ForegroundColor Cyan
Write-Host "      (58 API - SIÊU KHỦNG - CÓ NGHỈ 10S)    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$commands = @(
    # ================= KHÁCH HÀNG (USER / PUBLIC) =================
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/locations",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/locations/1",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/locations/1/reviews",
    "node backend/scripts/auto_stress.js GET `"http://localhost:3000/api/geo/nearby?lat=10&lng=106`"",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/profile",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/checkins",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/favorites",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/leaderboard",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/notifications",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/vouchers/saved",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/recommendations/locations",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/created-locations",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/profile/login-history",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/vouchers/location/1",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/tickets",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/diary",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/user/booking-reminders",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/itineraries",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/ai/chat/history",
    "node backend/scripts/auto_stress.js POST http://localhost:3000/api/sos '{`"lat`":10.8,`"lng`":106.6,`"message`":`"Help!`"}'",

    # ================= CHỦ CƠ SỞ (OWNER / POS / HOTEL) =================
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/me",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/profile",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/profile/login-history",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/profile/audit-logs",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/bank",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/locations",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/locations/1/services",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/bookings",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/bookings/1/food-items",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/payments",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/commissions",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/commissions/pending-payments",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers/stats",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/vouchers/1/usage-history",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/reviews",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/notifications",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/checkins",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/employees",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/context",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/hotel/rooms",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/areas",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/tables",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/menu",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/pos/payments-history",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/owner/front-office/tourist/tickets/today",
    "node backend/scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/pos/tables/1/open",
    "node backend/scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/pos/orders/1/items '{`"items`":[{`"id`":1,`"qty`":2}]}'",
    "node backend/scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/checkins/secure-qr '{`"qr_code`":`"ABCD`"}'",
    "node backend/scripts/auto_stress.js POST http://localhost:3000/api/owner/front-office/tourist/tickets/sell '{`"tickets`":[{`"type_id`":1,`"qty`":5}]}'",

    # ================= QUẢN TRỊ VIÊN (ADMIN) =================
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/dashboard/stats",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/finance/summary",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/owners/pending",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/system/audit-logs",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/locations",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/bookings",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/users",
    "node backend/scripts/auto_stress.js GET http://localhost:3000/api/admin/export"
)

$total = $commands.Length
$count = 1

foreach ($cmd in $commands) {
    Write-Host "`n[$count/$total] >>> Đang chạy: $cmd" -ForegroundColor Yellow
    Invoke-Expression $cmd
    
    Write-Host "[$count/$total] >>> Đã chạy xong! Server đang nghỉ ngơi giải phóng RAM..." -ForegroundColor Green
    for ($i = 10; $i -gt 0; $i--) {
        Write-Host -NoNewline "`rĐợi $i giây nữa để chạy lệnh tiếp theo... "
        Start-Sleep -Seconds 1
    }
    Write-Host "`rTiếp tục!                                          "
    $count++
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "   ĐÃ HOÀN TẤT TOÀN BỘ QUÁ TRÌNH KIỂM THỬ    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
