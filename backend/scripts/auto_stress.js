const autocannon = require('autocannon');

const method = process.argv[2] || 'GET';
const url = process.argv[3] || 'http://localhost:3000/api/locations';
const bodyString = process.argv[4] || null;

let currentConnections = 1000;
const step = 500;
const duration = 5;

console.log(`\n🚀 BẮT ĐẦU TỰ ĐỘNG DÒ TÌM GIỚI HẠN CHỊU ĐỰNG CỦA SERVER`);
console.log(`Mục tiêu: [${method}] ${url}\n`);

async function runTest() {
  console.log(`⏳ Đang test thử mức: ${currentConnections} người dùng cùng lúc...`);
  
  const options = {
    url: url,
    connections: currentConnections,
    duration: duration,
    method: method,
  };

  if (bodyString) {
    options.headers = {
      'Content-Type': 'application/json'
    };
    options.body = bodyString;
  }

  const instance = autocannon(options);

  return new Promise((resolve) => {
    instance.on('done', (result) => {
      const errors = result.errors + result.timeouts; 
      
      console.log(`   👉 Kết quả: ${result.requests.average} Req/Sec | Độ trễ TB: ${result.latency.average}ms | Sập/Timeout: ${errors}`);

      if (errors > 0) {
        console.log(`\n❌ PHÁT HIỆN LỖI! SERVER ĐÃ QUÁ TẢI (SẬP)!`);
        console.log(`💥 GIỚI HẠN CHỊU ĐỰNG TỐI ĐA CỦA HỆ THỐNG LÀ KHOẢNG: ${currentConnections - step} - ${currentConnections} NGƯỜI DÙNG CÙNG LÚC!`);
        console.log(`--------------------------------------------------------\n`);
        resolve(false);
      } else {
        console.log(`   ✅ Server vẫn khỏe. Tiếp tục tăng độ khó...\n`);
        currentConnections += step;
        resolve(true);
      }
    });
  });
}

async function startAutoScaling() {
  let keepRunning = true;
  while (keepRunning) {
    keepRunning = await runTest();
  }
}

startAutoScaling();
