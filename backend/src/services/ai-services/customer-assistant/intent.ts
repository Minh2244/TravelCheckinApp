import { normalizeUserText } from "./tools";

export type AiIntent =
  | "small_talk"
  | "location_recommendation"
  | "weather_aware_recommendation"
  | "nearby_recommendation"
  | "booking_help"
  | "ticket_help"
  | "hotel_help"
  | "voucher_help"
  | "saved_locations_help"
  | "itinerary_help"
  | "safety_sos_help"
  | "out_of_scope";

export interface IntentResult {
  intent: AiIntent;
  confidence: number;
  normalizedQuery: string;
  shouldSearchLocations: boolean;
  smallTalkReply?: string;
  quickReplies: string[];
}

const hasAny = (value: string, terms: string[]): boolean =>
  terms.some((term) => value.includes(term));

const BORED_OR_LOW_MOOD_TERMS = [
  "chan",
  "chan qua",
  "hoi chan",
  "buon",
  "buon qua",
  "met",
  "met qua",
  "stress",
  "khong vui",
  "tut mood",
  "down mood",
  "doi gio",
  "khong biet lam gi",
];

const buildSmallTalkReply = (normalizedQuery: string): string | undefined => {
  if (hasAny(normalizedQuery, ["cam on", "thanks", "thank", "iu", "yeu ban"])) {
    return "Dễ thương dữ vậy. Có gì cần mình gợi ý chỗ ăn, chỗ chơi hay khách sạn thì gọi mình nha.";
  }

  if (hasAny(normalizedQuery, ["chao", "hello", "hi ", "helo", "alo", "e ", "ê "])) {
    return "Mình đây nè. Hôm nay bạn muốn tìm chỗ ăn, chỗ chơi, khách sạn hay chỉ muốn mình tám chút cho vui?";
  }

  if (hasAny(normalizedQuery, ["chan qua", "buon qua", "met qua", "stress", "khong vui"])) {
    return "Nghe hơi tụt mood rồi đó. Mình có thể gợi ý một chỗ đổi gió, quán nước ngồi chill, hoặc lên một kèo đi chơi nhẹ cho bạn.";
  }

  if (hasAny(normalizedQuery, ["xam", "tam", "noi chuyen", "ke chuyen"])) {
    return "Tám được chứ. Nhưng mình hơi có máu hướng dẫn viên, nói vài câu là lại muốn rủ bạn đi ăn hoặc đi chơi liền.";
  }

  return undefined;
};

export const classifyUserIntent = (prompt: string): IntentResult => {
  const normalizedQuery = normalizeUserText(prompt);

  const weatherAware = hasAny(normalizedQuery, [
    "troi nong",
    "troi nang",
    "nong qua",
    "nang qua",
    "oi buc",
    "troi oi qua",
    "cho mat",
    "giai nhiet",
    "troi mua",
    "mua qua",
    "tru mua",
  ]);

  const locationAsk = hasAny(normalizedQuery, [
    "goi y",
    "di dau",
    "cho nao",
    "quan nao",
    "tim",
    "kiem",
    "cafe",
    "ca phe",
    "an gi",
    "an uong",
    "quan an",
    "do an",
    "do uong",
    "khach san",
    "luu tru",
    "du lich",
    "tham quan",
    "chill",
    "song ao",
    "checkin",
  ]);

  const moodNeedsSuggestion = hasAny(normalizedQuery, BORED_OR_LOW_MOOD_TERMS);
  const nearby = hasAny(normalizedQuery, ["gan day", "quanh day", "gan tui", "gan minh", "o day"]);
  const booking = hasAny(normalizedQuery, ["dat ban", "dat phong", "booking", "don dat", "huy don", "giu cho"]);
  const ticket = hasAny(normalizedQuery, ["ve", "mua ve", "vi ve", "ma ve", "qr ve"]);
  const hotel = hasAny(normalizedQuery, ["phong", "khach san", "luu tru", "check in", "checkout"]);
  const voucher = hasAny(normalizedQuery, ["voucher", "khuyen mai", "giam gia", "ma giam"]);
  const saved = hasAny(normalizedQuery, ["da luu", "yeu thich", "favorite", "luu dia diem"]);
  const itinerary = hasAny(normalizedQuery, ["lich trinh", "ke hoach", "di trong ngay", "cuoi tuan"]);
  const sos = hasAny(normalizedQuery, ["sos", "khẩn cấp", "khan cap", "cứu", "cuu", "nguy hiem"]);

  if (sos) {
    return {
      intent: "safety_sos_help",
      confidence: 0.9,
      normalizedQuery,
      shouldSearchLocations: false,
      quickReplies: ["Mở SOS", "Gọi hỗ trợ", "Chia sẻ vị trí"],
    };
  }

  if (weatherAware) {
    return {
      intent: "weather_aware_recommendation",
      confidence: locationAsk ? 0.9 : 0.84,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Gợi ý gần đây", "Chỗ mát", "Quán nước", "Điểm trong nhà"],
    };
  }

  if (moodNeedsSuggestion) {
    return {
      intent: nearby ? "nearby_recommendation" : "location_recommendation",
      confidence: 0.83,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Đổi gió gần đây", "Quán nước chill", "Chỗ đi chơi nhẹ", "Ăn gì đó"],
    };
  }

  if (nearby && locationAsk) {
    return {
      intent: "nearby_recommendation",
      confidence: 0.84,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Ăn uống gần đây", "Cafe gần đây", "Chỗ chơi gần đây"],
    };
  }

  if (locationAsk) {
    return {
      intent: "location_recommendation",
      confidence: 0.82,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Ăn uống", "Lưu trú", "Du lịch", "Cafe"],
    };
  }

  if (booking) {
    return {
      intent: "booking_help",
      confidence: 0.8,
      normalizedQuery,
      shouldSearchLocations: false,
      quickReplies: ["Xem đơn của tôi", "Hủy đơn chờ duyệt", "Cách đặt trước"],
    };
  }

  if (ticket) {
    return {
      intent: "ticket_help",
      confidence: 0.78,
      normalizedQuery,
      shouldSearchLocations: false,
      quickReplies: ["Ví vé của tôi", "Mua vé", "Kiểm tra mã vé"],
    };
  }

  if (hotel) {
    return {
      intent: "hotel_help",
      confidence: 0.76,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Tìm khách sạn", "Đặt phòng", "Xem phòng đã đặt"],
    };
  }

  if (voucher) {
    return {
      intent: "voucher_help",
      confidence: 0.78,
      normalizedQuery,
      shouldSearchLocations: false,
      quickReplies: ["Voucher của tôi", "Voucher gần đây", "Cách dùng voucher"],
    };
  }

  if (saved) {
    return {
      intent: "saved_locations_help",
      confidence: 0.78,
      normalizedQuery,
      shouldSearchLocations: false,
      quickReplies: ["Mở đã lưu", "Gợi ý từ đã lưu"],
    };
  }

  if (itinerary) {
    return {
      intent: "itinerary_help",
      confidence: 0.75,
      normalizedQuery,
      shouldSearchLocations: true,
      quickReplies: ["Tạo lịch trình nháp", "Gợi ý cuối tuần", "Xem lịch trình"],
    };
  }

  const smallTalkReply = buildSmallTalkReply(normalizedQuery);
  if (smallTalkReply) {
    return {
      intent: "small_talk",
      confidence: 0.72,
      normalizedQuery,
      shouldSearchLocations: false,
      smallTalkReply,
      quickReplies: ["Gợi ý chỗ ăn", "Gợi ý chỗ chơi", "Tìm khách sạn"],
    };
  }

  return {
    intent: "small_talk",
    confidence: 0.55,
    normalizedQuery,
    shouldSearchLocations: false,
    smallTalkReply:
      "Mình nghe nè. Bạn muốn mình gợi ý địa điểm, xem lịch trình, tìm voucher hay tám chút cho vui?",
    quickReplies: ["Gợi ý địa điểm", "Tìm gần đây", "Xem voucher", "Tạo lịch trình"],
  };
};
