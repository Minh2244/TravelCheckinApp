import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

// Tải cấu hình biến môi trường
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const names = [
  "Nhi", "Ngọc", "Minh", "Tuấn", "Hương", 
  "Lan", "Quân", "Huy", "Trang", "Đức",
  "Hoa", "Long", "Bảo", "Linh", "Thảo",
  "Oanh", "Phong", "Thủy", "Vy", "Hải"
];

const comments: Record<string, string[]> = {
  hotel: [
    "Khách sạn rất sạch sẽ, tiện nghi đầy đủ.",
    "Nhân viên nhiệt tình, view phòng khá đẹp.",
    "Giá cả hợp lý so với mặt bằng chung, sẽ quay lại.",
    "Phòng hơi nhỏ nhưng cách âm tốt, giấc ngủ rất ngon.",
    "Gần trung tâm, đi lại thuận tiện. Rất đáng tiền.",
    "Bữa sáng ngon miệng, giường ngủ êm ái.",
    "Dịch vụ tốt, thủ tục check-in nhanh gọn.",
    "View ban công xuất sắc, không gian yên tĩnh.",
    "Phòng tắm rộng và sạch sẽ, tôi rất thích.",
    "Nhìn chung là hài lòng, phù hợp để đi công tác."
  ],
  resort: [
    "Khu nghỉ dưỡng tuyệt vời, không gian xanh mát.",
    "Bể bơi rộng và sạch, đồ ăn nhà hàng khá ngon.",
    "Cảnh quan đẹp, rất thích hợp để nghỉ ngơi gia đình.",
    "Nhân viên chu đáo từ lúc đón khách. Đánh giá cao.",
    "Phòng ốc sang trọng, nội thất đẳng cấp.",
    "Cảm giác rất yên bình khi nghỉ tại đây.",
    "Spa và các dịch vụ đi kèm rất tốt.",
    "Bãi biển riêng sạch sẽ, ít người.",
    "Buffet sáng phong phú, nhiều món ngon.",
    "Sẽ giới thiệu cho bạn bè đến đây nghỉ dưỡng."
  ],
  restaurant: [
    "Đồ ăn rất ngon, khẩu vị vừa miệng.",
    "Không gian quán đẹp, trang trí bắt mắt.",
    "Nhân viên phục vụ nhanh nhẹn, lên món nhanh.",
    "Giá cả phải chăng, phù hợp đi ăn gia đình.",
    "Món đặc sản của quán làm rất chuẩn vị.",
    "Quán hơi đông nhưng phục vụ vẫn chu đáo.",
    "Hải sản tươi sống, chế biến hấp dẫn.",
    "Rất thích nước chấm ở đây, một điểm cộng lớn.",
    "Menu đa dạng, gọi món nào cũng ngon.",
    "Đáng tiền, chắc chắn sẽ quay lại ăn thêm nhiều lần."
  ],
  cafe: [
    "Cà phê đậm vị, không gian yên tĩnh để làm việc.",
    "Quán trang trí rất chill, nhiều góc sống ảo.",
    "Nước uống ngon, bánh ngọt cũng rất tuyệt.",
    "Nhân viên thân thiện, quán có gu âm nhạc hay.",
    "Giá nước hợp lý, view nhìn ra phố rất đẹp.",
    "Matcha đá xay ngon tuyệt cú mèo.",
    "Thích hợp tụ tập bạn bè cuối tuần.",
    "Menu đa dạng, đồ uống pha chế vừa miệng.",
    "Wifi mạnh, ổ cắm nhiều, ngồi làm việc rất thoải mái.",
    "Thiết kế quán tối giản nhưng rất hiện đại."
  ],
  tourist: [
    "Địa điểm tham quan thú vị, cảnh quan đẹp.",
    "Rất nhiều góc chụp ảnh đẹp, thời tiết ủng hộ.",
    "Khu du lịch rộng rãi, phù hợp đi chơi cuối tuần.",
    "Dịch vụ trong khu du lịch khá tốt.",
    "Một trải nghiệm đáng nhớ cùng gia đình.",
    "Không khí trong lành, thoát khỏi cảnh ồn ào thành phố.",
    "Hướng dẫn viên nhiệt tình, thuyết minh hay.",
    "Giá vé hợp lý với những trải nghiệm mang lại.",
    "Nên đi vào buổi sáng để đỡ nắng và chụp ảnh đẹp hơn.",
    "Một nơi tuyệt vời để xả stress."
  ],
  other: [
    "Chất lượng dịch vụ tốt, nhân viên thân thiện.",
    "Trải nghiệm khá ấn tượng, vượt ngoài mong đợi.",
    "Giá cả hợp lý, đáng để thử.",
    "Mọi thứ đều ok, không có gì để chê.",
    "Rất hài lòng với dịch vụ ở đây.",
    "Sẽ quay lại vào lần sau.",
    "Một địa điểm thú vị.",
    "Dịch vụ chuyên nghiệp, tận tâm.",
    "Hoàn toàn đáng tiền.",
    "Đánh giá cao chất lượng phục vụ."
  ]
};

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "TravelCheckinApp",
  });

  console.log("Đã kết nối database!");

  try {
    // 0. Xóa các đánh giá giả mạo đã tạo trước đó để "không bị bừa"
    console.log("Đang dọn dẹp các đánh giá cũ do script tạo...");
    await connection.execute("DELETE FROM reviews WHERE user_id IN (SELECT user_id FROM users WHERE username LIKE 'fake_%')");
    await connection.execute(`
      UPDATE locations l
      SET 
        total_reviews = (SELECT COUNT(*) FROM reviews r WHERE r.location_id = l.location_id AND r.status = 'active'),
        rating = IFNULL((SELECT AVG(rating) FROM reviews r WHERE r.location_id = l.location_id AND r.status = 'active'), 0)
    `);

    // 1. Lấy danh sách địa điểm CỦA OWNER ĐANG HOẠT ĐỘNG
    const [locations] = await connection.execute<any>(
      "SELECT location_id, location_type, location_name FROM locations WHERE owner_id IS NOT NULL AND status = 'active'"
    );
    console.log(`Tìm thấy ${locations.length} địa điểm của owner đang hoạt động.`);

    if (locations.length === 0) {
      console.log("Không có địa điểm nào phù hợp.");
      return;
    }

    // 2. Tạo hoặc lấy 20 user ảo
    const [existingFakeUsers] = await connection.execute<any>(
      "SELECT user_id, full_name FROM users WHERE username LIKE 'fake_%'"
    );
    
    let fakeUsers = [...existingFakeUsers];
    if (fakeUsers.length < 20) {
      console.log("Đang tạo thêm user ảo...");
      for (const name of names) {
        const username = `fake_${name.toLowerCase()}_${getRandomInt(10000, 99999)}`;
        const email = `${username}@example.com`;
        const [result] = await connection.execute<any>(
          "INSERT INTO users (full_name, email, username, role, status) VALUES (?, ?, ?, 'user', 'active')",
          [name, email, username]
        );
        fakeUsers.push({ user_id: result.insertId, full_name: name });
      }
    }

    // 3. Thêm review cho từng địa điểm
    for (const loc of locations) {
      // Random từ 10 đến 20 đánh giá
      const reviewCount = getRandomInt(10, 20); 
      console.log(`Đang thêm ${reviewCount} đánh giá cho địa điểm: ${loc.location_name}`);

      let totalScore = 0;
      const type = (loc.location_type as string) || "other";
      const availableComments = comments[type] || comments["other"];

      // Tránh việc trùng lặp user trong cùng 1 địa điểm nếu số lượng review <= số fake users
      // Bằng cách shuffle mảng fakeUsers
      const shuffledUsers = [...fakeUsers].sort(() => 0.5 - Math.random());

      for (let i = 0; i < reviewCount; i++) {
        // Nếu số review > số user (20) thì sẽ bị lặp lại user, nhưng 10-20 thì ok không lặp.
        const user = shuffledUsers[i % shuffledUsers.length];
        const rating = getRandomInt(3, 5); // Random 3, 4, 5
        const comment = getRandomItem(availableComments);

        totalScore += rating;

        await connection.execute(
          "INSERT INTO reviews (user_id, location_id, rating, comment, status) VALUES (?, ?, ?, ?, 'active')",
          [user.user_id, loc.location_id, rating, comment]
        );
      }

      // Cập nhật lại rating và total_reviews cho location (tính tổng cộng cả review cũ nếu có)
      await connection.execute(`
        UPDATE locations l
        SET 
          total_reviews = (SELECT COUNT(*) FROM reviews r WHERE r.location_id = l.location_id AND r.status = 'active'),
          rating = IFNULL((SELECT AVG(rating) FROM reviews r WHERE r.location_id = l.location_id AND r.status = 'active'), 0)
        WHERE location_id = ?
      `, [loc.location_id]);
    }

    console.log("Hoàn thành thêm đánh giá mẫu theo chuẩn mới!");
  } catch (error) {
    console.error("Có lỗi xảy ra:", error);
  } finally {
    await connection.end();
  }
}

run();
