import { GoogleGenAI } from "@google/genai";
import { pool } from "../../../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { CUSTOMER_ASSISTANT_PROMPT, responseSchema } from "./prompt.builder";
import { getLocationsSearchContext, type AiRequestContext } from "./tools";
import { classifyUserIntent, type AiIntent } from "./intent";

// Removed global ai instance to support per-request rotation
function getGoogleGenAI() {
  const rawKeys = process.env.GEMINI_API_KEY || "";
  const keys = rawKeys.split(",").map(k => k.trim()).filter(Boolean);
  const apiKey = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;
  return new GoogleGenAI(apiKey ? { apiKey } : {});
}

export interface AiChatRequest {
  userId: number;
  prompt: string;
  conversationId?: number; // Tùy chọn, để duy trì ngữ cảnh
  context?: AiRequestContext;
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
  mode: AiReplyMode;
  message: string;
  locations: AiLocationCardData[];
  quickReplies: string[];
  actions: AiAction[];
  metadata: {
    intent: AiIntent;
    confidence: number;
    tools_used: string[];
    candidate_count?: number;
    filters?: Record<string, unknown>;
  };
}

type AiReplyMode =
  | "chat"
  | "suggest_locations"
  | "show_booking"
  | "show_voucher"
  | "itinerary_draft"
  | "need_clarification"
  | "error";

interface AiAction {
  type:
    | "open_location"
    | "open_map"
    | "save_location"
    | "open_booking"
    | "open_wallet"
    | "open_saved"
    | "open_vouchers"
    | "open_itinerary"
    | "open_sos"
    | "ask_confirm";
  label: string;
  payload: Record<string, unknown>;
}

const actionForIntent = (intent: AiIntent): AiAction[] => {
  switch (intent) {
    case "booking_help":
      return [
        { type: "open_booking", label: "Xem đơn đặt trước", payload: { route: "/user/bookings" } },
      ];
    case "ticket_help":
      return [
        { type: "open_wallet", label: "Mở ví vé", payload: { route: "/user/tickets" } },
      ];
    case "voucher_help":
      return [
        { type: "open_vouchers", label: "Xem voucher", payload: { route: "/user/vouchers" } },
      ];
    case "saved_locations_help":
      return [
        { type: "open_saved", label: "Mở đã lưu", payload: { route: "/user/saved" } },
      ];
    case "itinerary_help":
      return [
        { type: "open_itinerary", label: "Mở lịch trình", payload: { route: "/user/itineraries" } },
      ];
    case "safety_sos_help":
      return [
        { type: "open_sos", label: "Mở SOS", payload: { route: "/user/sos" } },
      ];
    default:
      return [];
  }
};

const actionsForLocations = (locations: AiLocationCardData[]): AiAction[] =>
  locations.flatMap((location) => [
    {
      type: "open_location" as const,
      label: `Xem ${location.location_name}`,
      payload: { location_id: location.location_id },
    },
    {
      type: "open_map" as const,
      label: `Chỉ đường`,
      payload: { location_id: location.location_id },
    },
  ]);

const staticReplyForIntent = (intent: AiIntent): string | null => {
  switch (intent) {
    case "booking_help":
      return "Mình hỗ trợ bạn xem đơn đặt trước, kiểm tra trạng thái và hướng dẫn hủy đơn chờ duyệt. Các thao tác đặt/hủy thật cần bạn xác nhận trực tiếp trên giao diện nha.";
    case "ticket_help":
      return "Bạn có thể mở ví vé để xem mã vé, trạng thái và hạn dùng. Nếu muốn mua vé, mình sẽ dẫn bạn vào đúng địa điểm/dịch vụ để thao tác.";
    case "voucher_help":
      return "Voucher thì mình có thể giúp bạn mở danh sách đã lưu hoặc tìm ưu đãi theo địa điểm. Khi áp dụng voucher, app sẽ kiểm tra điều kiện thật từ backend.";
    case "saved_locations_help":
      return "Mình có thể mở danh sách địa điểm đã lưu hoặc dựa vào đó để gợi ý thêm vài nơi hợp gu của bạn.";
    case "safety_sos_help":
      return "Nếu đang cần hỗ trợ khẩn cấp, bạn nên mở SOS để chia sẻ vị trí và thông tin cần giúp ngay.";
    default:
      return null;
  }
};

export const processChat = async (request: AiChatRequest): Promise<AiChatResponse> => {
  const { userId, prompt, conversationId, context } = request;
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
  const intent = classifyUserIntent(prompt);

  const staticMessage = intent.smallTalkReply || staticReplyForIntent(intent.intent);
  if (!intent.shouldSearchLocations && staticMessage) {
    const metadata = {
      intent: intent.intent,
      confidence: intent.confidence,
      tools_used: [],
      normalized_query: intent.normalizedQuery,
    };

    await pool.query(
      `INSERT INTO ai_chat_history (conversation_id, user_id, ai_model, prompt, response, response_type, status, metadata)
       VALUES (?, ?, 'travelcheckin-intent-v1', ?, ?, 'text', 'success', ?)`,
      [
        currentConversationId,
        userId,
        prompt,
        staticMessage,
        JSON.stringify(metadata)
      ]
    );

    return {
      conversationId: currentConversationId,
      mode: intent.intent === "small_talk" ? "chat" : "need_clarification",
      message: staticMessage,
      locations: [],
      quickReplies: intent.quickReplies,
      actions: actionForIntent(intent.intent),
      metadata: {
        intent: intent.intent,
        confidence: intent.confidence,
        tools_used: [],
      },
    };
  }

  // 2. Lấy ngữ cảnh thực tế từ MySQL
  const searchContext = await getLocationsSearchContext(prompt, context);
  const candidates = searchContext.candidates;
  
  // Xây dựng nội dung gửi cho Gemini
  const promptContext = `
Người đang trò chuyện với bạn tên là: "${userName}". Hãy xưng hô thân thiện (chào bằng tên) nếu đây là câu chào hỏi.

Ngữ cảnh truy xuất từ Backend:
${JSON.stringify({
  ai_intent: intent.intent,
  confidence: intent.confidence,
  search_intent: searchContext.filters.intent,
  search_filters: searchContext.filters,
  request_context: context || null,
}, null, 2)}

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
    if (candidates.length === 0) {
      responseText =
        "Hiện hệ thống chưa có địa điểm phù hợp với yêu cầu này. Bạn thử nói rõ khu vực hoặc loại địa điểm bạn muốn tìm nha.";
      locationsResult = [];
    } else {
      const ai = getGoogleGenAI();
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
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    status = "error";
    responseText = "Trợ lý AI đang gặp sự cố kết nối. Mình gửi tạm vài địa điểm thật hệ thống tìm thấy để bạn tham khảo nha.";
    // Fallback: vẫn chỉ lấy candidates thật từ database, không bịa địa điểm.
    locationsResult = candidates.slice(0, 3).map(c => ({
      location_id: c.location_id,
      reason: "Gợi ý hệ thống dành cho bạn."
    }));
  }

  // 4. Validate Location IDs & Gắn thêm Data thực tế (Ảnh, rating)
  if (intent.shouldSearchLocations && candidates.length > 0 && locationsResult.length === 0) {
    responseText =
      "Mình thấy bạn đang cần một gợi ý thật để đổi gió. Mình gửi trước vài địa điểm phù hợp từ hệ thống nha.";
    locationsResult = candidates.slice(0, 3).map((candidate) => ({
      location_id: candidate.location_id,
      reason: "Địa điểm thật trong hệ thống, phù hợp để bạn xem nhanh và mở chi tiết.",
    }));
  }

  const finalLocations: AiLocationCardData[] = [];
  
  if (locationsResult.length > 0) {
    const validIds = locationsResult.map(l => l.location_id);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(",");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id, location_name, first_image, rating, total_reviews, address 
         FROM locations WHERE status = 'active' AND location_id IN (${placeholders})`,
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
    intent: intent.intent,
    confidence: intent.confidence,
    filters: searchContext.filters,
    candidate_count: candidates.length,
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
    mode: finalLocations.length > 0 ? "suggest_locations" : status === "error" ? "error" : "need_clarification",
    message: responseText,
    locations: finalLocations,
    quickReplies: finalLocations.length > 0
      ? ["Xem chi tiết", "Chỉ đường", "Lưu địa điểm", ...intent.quickReplies.slice(0, 2)]
      : intent.quickReplies,
    actions: [...actionsForLocations(finalLocations), ...actionForIntent(intent.intent)],
    metadata: {
      intent: intent.intent,
      confidence: intent.confidence,
      tools_used: ["search_locations", "gemini"],
      candidate_count: candidates.length,
      filters: searchContext.filters as unknown as Record<string, unknown>,
    },
  };
};
