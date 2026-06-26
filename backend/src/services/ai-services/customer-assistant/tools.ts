import { pool } from "../../../config/database";
import type { RowDataPacket } from "mysql2/promise";

export interface LocationCandidate {
  location_id: number;
  location_name: string;
  location_type: string;
  description: string | null;
  address: string;
  province: string | null;
  rating: number;
  total_reviews: number;
}

export const getLocationsContext = async (query: string): Promise<LocationCandidate[]> => {
  try {
    const lowerQuery = query.toLowerCase();
    
    // Heuristic đơn giản để lọc loại địa điểm
    let typeFilter = "";
    if (lowerQuery.includes("cafe") || lowerQuery.includes("cà phê")) typeFilter = "cafe";
    else if (lowerQuery.includes("khách sạn") || lowerQuery.includes("hotel") || lowerQuery.includes("lưu trú") || lowerQuery.includes("ngủ")) typeFilter = "hotel";
    else if (lowerQuery.includes("nhà hàng") || lowerQuery.includes("ăn") || lowerQuery.includes("quán")) typeFilter = "restaurant";
    else if (lowerQuery.includes("du lịch") || lowerQuery.includes("tham quan") || lowerQuery.includes("chơi")) typeFilter = "tourist";
    else if (lowerQuery.includes("resort") || lowerQuery.includes("nghỉ dưỡng")) typeFilter = "resort";

    let sql = `
      SELECT location_id, location_name, location_type, description, address, province, rating, total_reviews
      FROM locations
      WHERE status = 'active'
    `;
    const params: any[] = [];

    if (typeFilter) {
      sql += ` AND location_type = ?`;
      params.push(typeFilter);
    }

    // Heuristic đơn giản để lọc tỉnh/thành phổ biến (có thể mở rộng)
    if (lowerQuery.includes("cần thơ")) {
      sql += ` AND province LIKE '%Cần Thơ%'`;
    } else if (lowerQuery.includes("hồ chí minh") || lowerQuery.includes("sài gòn")) {
      sql += ` AND province LIKE '%Hồ Chí Minh%'`;
    } else if (lowerQuery.includes("đà lạt") || lowerQuery.includes("lâm đồng")) {
      sql += ` AND province LIKE '%Lâm Đồng%'`;
    } else if (lowerQuery.includes("đà nẵng")) {
      sql += ` AND province LIKE '%Đà Nẵng%'`;
    }

    // Lấy top 15 địa điểm có rating tốt nhất làm mồi (candidates) cho AI
    sql += ` ORDER BY rating DESC, total_reviews DESC LIMIT 15`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    
    // Xóa bớt các field nhạy cảm hoặc quá dài nếu cần thiết (ở đây đã select kỹ)
    return rows as LocationCandidate[];
  } catch (error) {
    console.error("Lỗi khi lấy context địa điểm:", error);
    return [];
  }
};
