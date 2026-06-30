import { GoogleGenAI } from "@google/genai";
import { pool } from "../../../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { CUSTOMER_ASSISTANT_PROMPT, responseSchema } from "./prompt.builder";
import { getLocationsSearchContext, type AiRequestContext } from "./tools";
import { classifyUserIntent, type AiIntent } from "./intent";

// Khá»Ÿi táº¡o Gemini Client
// LÆ°u Ã½: Äáº£m báº£o GEMINI_API_KEY Ä‘Ã£ cÃ³ trong process.env
const ai = new GoogleGenAI({});

export interface AiChatRequest {
  userId: number;
  prompt: string;
  conversationId?: number; // TÃ¹y chá»n, Ä‘á»ƒ duy trÃ¬ ngá»¯ cáº£nh
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
        { type: "open_booking", label: "Xem Ä‘Æ¡n Ä‘áº·t trÆ°á»›c", payload: { route: "/user/bookings" } },
      ];
    case "ticket_help":
      return [
        { type: "open_wallet", label: "Má»Ÿ vÃ­ vÃ©", payload: { route: "/user/tickets" } },
      ];
    case "voucher_help":
      return [
        { type: "open_vouchers", label: "Xem voucher", payload: { route: "/user/vouchers" } },
      ];
    case "saved_locations_help":
      return [
        { type: "open_saved", label: "Má»Ÿ Ä‘Ã£ lÆ°u", payload: { route: "/user/saved" } },
      ];
    case "itinerary_help":
      return [
        { type: "open_itinerary", label: "Má»Ÿ lá»‹ch trÃ¬nh", payload: { route: "/user/itineraries" } },
      ];
    case "safety_sos_help":
      return [
        { type: "open_sos", label: "Má»Ÿ SOS", payload: { route: "/user/sos" } },
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
      label: `Chá»‰ Ä‘Æ°á»ng`,
      payload: { location_id: location.location_id },
    },
  ]);

const staticReplyForIntent = (intent: AiIntent): string | null => {
  switch (intent) {
    case "booking_help":
      return "MÃ¬nh há»— trá»£ báº¡n xem Ä‘Æ¡n Ä‘áº·t trÆ°á»›c, kiá»ƒm tra tráº¡ng thÃ¡i vÃ  hÆ°á»›ng dáº«n há»§y Ä‘Æ¡n chá» duyá»‡t. CÃ¡c thao tÃ¡c Ä‘áº·t/há»§y tháº­t cáº§n báº¡n xÃ¡c nháº­n trá»±c tiáº¿p trÃªn giao diá»‡n nha.";
    case "ticket_help":
      return "Báº¡n cÃ³ thá»ƒ má»Ÿ vÃ­ vÃ© Ä‘á»ƒ xem mÃ£ vÃ©, tráº¡ng thÃ¡i vÃ  háº¡n dÃ¹ng. Náº¿u muá»‘n mua vÃ©, mÃ¬nh sáº½ dáº«n báº¡n vÃ o Ä‘Ãºng Ä‘á»‹a Ä‘iá»ƒm/dá»‹ch vá»¥ Ä‘á»ƒ thao tÃ¡c.";
    case "voucher_help":
      return "Voucher thÃ¬ mÃ¬nh cÃ³ thá»ƒ giÃºp báº¡n má»Ÿ danh sÃ¡ch Ä‘Ã£ lÆ°u hoáº·c tÃ¬m Æ°u Ä‘Ã£i theo Ä‘á»‹a Ä‘iá»ƒm. Khi Ã¡p dá»¥ng voucher, app sáº½ kiá»ƒm tra Ä‘iá»u kiá»‡n tháº­t tá»« backend.";
    case "saved_locations_help":
      return "MÃ¬nh cÃ³ thá»ƒ má»Ÿ danh sÃ¡ch Ä‘á»‹a Ä‘iá»ƒm Ä‘Ã£ lÆ°u hoáº·c dá»±a vÃ o Ä‘Ã³ Ä‘á»ƒ gá»£i Ã½ thÃªm vÃ i nÆ¡i há»£p gu cá»§a báº¡n.";
    case "safety_sos_help":
      return "Náº¿u Ä‘ang cáº§n há»— trá»£ kháº©n cáº¥p, báº¡n nÃªn má»Ÿ SOS Ä‘á»ƒ chia sáº» vá»‹ trÃ­ vÃ  thÃ´ng tin cáº§n giÃºp ngay.";
    default:
      return null;
  }
};

export const processChat = async (request: AiChatRequest): Promise<AiChatResponse> => {
  const { userId, prompt, conversationId, context } = request;
  let currentConversationId = conversationId;

  // 1. Táº¡o conversation náº¿u chÆ°a cÃ³
  if (!currentConversationId) {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ai_conversations (user_id, assistant_scope, title) VALUES (?, 'user', ?)`,
      [userId, prompt.substring(0, 50)]
    );
    currentConversationId = result.insertId;
  } else {
    // Cáº­p nháº­t last_message_at
    await pool.query(
      `UPDATE ai_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE conversation_id = ?`,
      [currentConversationId]
    );
  }

  // 1.5 Láº¥y thÃ´ng tin user Ä‘á»ƒ AI chÃ o báº±ng tÃªn
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT full_name FROM users WHERE user_id = ?`,
    [userId]
  );
  const userName = userRows.length > 0 ? userRows[0].full_name : "QuÃ½ khÃ¡ch";
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

  // 2. Láº¥y ngá»¯ cáº£nh thá»±c táº¿ tá»« MySQL
  const searchContext = await getLocationsSearchContext(prompt, context);
  const candidates = searchContext.candidates;
  
  // XÃ¢y dá»±ng ná»™i dung gá»­i cho Gemini
  const promptContext = `
NgÆ°á»i Ä‘ang trÃ² chuyá»‡n vá»›i báº¡n tÃªn lÃ : "${userName}". HÃ£y xÆ°ng hÃ´ thÃ¢n thiá»‡n (chÃ o báº±ng tÃªn) náº¿u Ä‘Ã¢y lÃ  cÃ¢u chÃ o há»i.

Ngá»¯ cáº£nh truy xuáº¥t tá»« Backend:
${JSON.stringify({
  ai_intent: intent.intent,
  confidence: intent.confidence,
  search_intent: searchContext.filters.intent,
  search_filters: searchContext.filters,
  request_context: context || null,
}, null, 2)}

ThÃ´ng tin tá»« há»‡ thá»‘ng (CANDIDATES):
${JSON.stringify(candidates, null, 2)}

CÃ¢u há»i cá»§a ngÆ°á»i dÃ¹ng:
"${prompt}"
`;

  // 3. Gá»i Gemini API sá»­ dá»¥ng Structured Output
  let responseText = "Xin lá»—i, hiá»‡n táº¡i tÃ´i khÃ´ng thá»ƒ tÆ° váº¥n Ä‘Æ°á»£c. Vui lÃ²ng thá»­ láº¡i sau.";
  let locationsResult: { location_id: number; reason: string }[] = [];
  let status = "success";

  try {
    if (candidates.length === 0) {
      responseText =
        "Hiá»‡n há»‡ thá»‘ng chÆ°a cÃ³ Ä‘á»‹a Ä‘iá»ƒm phÃ¹ há»£p vá»›i yÃªu cáº§u nÃ y. Báº¡n thá»­ nÃ³i rÃµ khu vá»±c hoáº·c loáº¡i Ä‘á»‹a Ä‘iá»ƒm báº¡n muá»‘n tÃ¬m nha.";
      locationsResult = [];
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Hoáº·c model máº·c Ä‘á»‹nh phÃ¹ há»£p
        contents: promptContext,
        config: {
          systemInstruction: CUSTOMER_ASSISTANT_PROMPT,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.3, // Tháº¥p Ä‘á»ƒ bá»›t hallucinate
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
    responseText = "Trá»£ lÃ½ AI Ä‘ang gáº·p sá»± cá»‘ káº¿t ná»‘i. MÃ¬nh gá»­i táº¡m vÃ i Ä‘á»‹a Ä‘iá»ƒm tháº­t há»‡ thá»‘ng tÃ¬m tháº¥y Ä‘á»ƒ báº¡n tham kháº£o nha.";
    // Fallback: váº«n chá»‰ láº¥y candidates tháº­t tá»« database, khÃ´ng bá»‹a Ä‘á»‹a Ä‘iá»ƒm.
    locationsResult = candidates.slice(0, 3).map(c => ({
      location_id: c.location_id,
      reason: "Gá»£i Ã½ há»‡ thá»‘ng dÃ nh cho báº¡n."
    }));
  }

  // 4. Validate Location IDs & Gáº¯n thÃªm Data thá»±c táº¿ (áº¢nh, rating)
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

  // 5. LÆ°u Lá»‹ch sá»­ Chat vÃ o MySQL
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
      ? ["Xem chi tiáº¿t", "Chá»‰ Ä‘Æ°á»ng", "LÆ°u Ä‘á»‹a Ä‘iá»ƒm", ...intent.quickReplies.slice(0, 2)]
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
