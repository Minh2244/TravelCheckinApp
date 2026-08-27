const autocannon = require('autocannon');
const fs = require('fs');

const endpoints = [
  { name: 'Gần đây (Geo)', method: 'GET', url: 'http://localhost:3000/api/geo/nearby?lat=10.8&lng=106.6', type: 'User' },
  { name: 'Xem Đánh giá', method: 'GET', url: 'http://localhost:3000/api/locations/1/reviews', type: 'User' },
  { name: 'Xem Lịch trình', method: 'GET', url: 'http://localhost:3000/api/itineraries', type: 'User' },
  { name: 'Gửi SOS', method: 'POST', url: 'http://localhost:3000/api/sos', body: '{"lat":10.8,"lng":106.6,"message":"Help!"}', type: 'User' },
  { name: 'AI Chat History', method: 'GET', url: 'http://localhost:3000/api/ai/chat/history', type: 'User' },
  { name: 'Thanh toán Booking', method: 'POST', url: 'http://localhost:3000/api/bookings/1/payments', type: 'User' },
  { name: 'POS Menu', method: 'GET', url: 'http://localhost:3000/api/owner/front-office/pos/menu', type: 'Owner' },
  { name: 'POS Mở Bàn', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/pos/tables/1/open', type: 'Owner' },
  { name: 'POS Gọi Món', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/pos/orders/1/items', body: '{"items":[{"id":1,"qty":2}]}', type: 'Owner' },
  { name: 'POS Thanh Toán', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/pos/orders/1/pay', type: 'Owner' },
  { name: 'Sơ đồ Phòng Khách Sạn', method: 'GET', url: 'http://localhost:3000/api/owner/front-office/hotel/rooms', type: 'Owner' },
  { name: 'Check-in Khách Sạn', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/hotel/rooms/1/checkin', type: 'Owner' },
  { name: 'Quét vé QR', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/checkins/secure-qr', body: '{"qr_code":"ABCD"}', type: 'Owner' },
  { name: 'Bán vé tại quầy (SLL)', method: 'POST', url: 'http://localhost:3000/api/owner/front-office/tourist/tickets/sell', body: '{"tickets":[{"type_id":1,"qty":5}]}', type: 'Owner' },
  { name: 'Danh sách Bookings', method: 'GET', url: 'http://localhost:3000/api/owner/bookings', type: 'Owner' },
  { name: 'Dashboard Thống kê', method: 'GET', url: 'http://localhost:3000/api/admin/dashboard/stats', type: 'Admin' },
  { name: 'Dòng tiền (Finance)', method: 'GET', url: 'http://localhost:3000/api/admin/finance/summary', type: 'Admin' },
  { name: 'Duyệt chủ cơ sở', method: 'GET', url: 'http://localhost:3000/api/admin/owners/pending', type: 'Admin' }
];

const results = [];

async function runTest(ep) {
  return new Promise((resolve) => {
    const options = {
      url: ep.url,
      connections: 1000,
      duration: 3, // Test nhanh 3s để khỏi sập server
      method: ep.method,
    };
    if (ep.body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = ep.body;
    }

    console.log(`Đang test: ${ep.name}...`);
    const instance = autocannon(options);
    instance.on('done', (result) => {
      const timeouts = result.errors + result.timeouts;
      results.push({
        ...ep,
        reqSec: result.requests.average,
        latency: result.latency.average,
        timeouts: timeouts
      });
      // Đợi 2s để server xả RAM trước khi test lệnh tiếp theo
      setTimeout(resolve, 2000);
    });
  });
}

async function start() {
  console.log('Bắt đầu chạy AI Fast Stress Test (3s / endpoint)...');
  for (const ep of endpoints) {
    await runTest(ep);
  }
  fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
  console.log('HOÀN TẤT! Đã lưu kết quả vào test_results.json');
}

start();
