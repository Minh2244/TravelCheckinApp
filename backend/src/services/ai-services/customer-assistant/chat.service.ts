import { GoogleGenAI } from "@google/genai";
import { pool } from "../../../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { CUSTOMER_ASSISTANT_PROMPT, responseSchema } from "./prompt.builder";
import { getLocationsContext } from "./tools";

// Khởi tạo Gemini Client
// Lưu ý: Đảm bảo GEMINI_API_KEY đã có trong process.env
const ai = new GoogleGenAI({});

export interface AiChatRequest {
  userId: number;
  prompt: string;
  conversationId?: number; // Tùy chọn, để duy trì ngữ cảnh
}

export interface AiLocationCardData {
  location_id: number;
  location_name: string;
  first_image: string | null;
  rating: number;
  total_reviews: number;
  address: string;
  reason: string;
}

export interface AiChatResponse {
  conversationId: number;
  message: string;
  locations: AiLocationCardData[];
}

export const processChat = async (request: AiChatRequest): Promise<AiChatResponse> => {
  const { userId, prompt, conversationId } = request;
  let currentConversationId = conversationId;

  // 1. Tạo conversation nếu chưa có
  if (!currentConversationId) {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ai_conversations (user_id, assistant_scope, title) VALUES (?, 'user', ?)`,
      [userId, prompt.substring(0, 50)]
    );
    currentConversationId = result.insertId;
  } else {
    // Cập nhật last_message_at
    await pool.query(
      `UPDATE ai_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE conversation_id = ?`,
      [currentConversationId]
    );
  }

  // 1.5 Lấy thông tin user để AI chào bằng tên
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT full_name FROM users WHERE user_id = ?`,
    [userId]
  );
  const userName = userRows.length > 0 ? userRows[0].full_name : "Quý khách";

  // 2. Lấy ngữ cảnh thực tế từ MySQL
  const candidates = await getLocationsContext(prompt);
  
  // Xây dựng nội dung gửi cho Gemini
  const promptContext = `
Người đang trò chuyện với bạn tên là: "${userName}". Hãy xưng hô thân thiện (chào bằng tên) nếu đây là câu chào hỏi.

Thông tin từ hệ thống (CANDIDATES):
${JSON.stringify(candidates, null, 2)}

Câu hỏi của người dùng:
"${prompt}"
`;

  // 3. Gọi Gemini API sử dụng Structured Output
  let responseText = "Xin lỗi, hiện tại tôi không thể tư vấn được. Vui lòng thử lại sau.";
  let locationsResult: { location_id: number; reason: string }[] = [];
  let status = "success";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Hoặc model mặc định phù hợp
      contents: promptContext,
      config: {
        systemInstruction: CUSTOMER_ASSISTANT_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.3, // Thấp để bớt hallucinate
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      responseText = parsed.message;
      locationsResult = parsed.locations || [];
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    status = "error";
    responseText = "Trợ lý AI đang gặp sự cố kết nối, nhưng đây là một số gợi ý ngẫu nhiên cho bạn.";
    // Fallback: Lấy bừa top 3 từ candidates
    locationsResult = candidates.slice(0, 3).map(c => ({
      location_id: c.location_id,
      reason: "Gợi ý hệ thống dành cho bạn."
    }));
  }

  // 4. Validate Location IDs & Gắn thêm Data thực tế (Ảnh, rating)
  const finalLocations: AiLocationCardData[] = [];
  
  if (locationsResult.length > 0) {
    const validIds = locationsResult.map(l => l.location_id);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(",");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id, location_name, first_image, rating, total_reviews, address 
         FROM locations WHERE location_id IN (${placeholders})`,
        validIds
      );
      
      for (const loc of locationsResult) {
        const dbLoc = rows.find(r => r.location_id === loc.location_id);
        if (dbLoc) {
          finalLocations.push({
            location_id: dbLoc.location_id,
            location_name: dbLoc.location_name,
            first_image: dbLoc.first_image,
            rating: dbLoc.rating,
            total_reviews: dbLoc.total_reviews,
            address: dbLoc.address,
            reason: loc.reason,
          });
        }
      }
    }
  }

  // 5. Lưu Lịch sử Chat vào MySQL
  const metadata = {
    locations: finalLocations
  };

  await pool.query(
    `INSERT INTO ai_chat_history (conversation_id, user_id, ai_model, prompt, response, response_type, status, metadata)
     VALUES (?, ?, 'gemini-2.5-flash', ?, ?, 'location_suggestions', ?, ?)`,
    [
      currentConversationId,
      userId,
      prompt,
      responseText,
      status,
      JSON.stringify(metadata)
    ]
  );

  return {
    conversationId: currentConversationId,
    message: responseText,
    locations: finalLocations
  };
};
