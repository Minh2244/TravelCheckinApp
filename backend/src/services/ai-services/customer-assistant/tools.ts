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

export interface AiRequestContext {
  current_location?: {
    lat?: number;
    lng?: number;
    city?: string | null;
    province?: string | null;
  } | null;
  weather?: {
    temperature?: number | null;
    condition?: string | null;
  } | null;
}

export interface LocationSearchContext {
  candidates: LocationCandidate[];
  filters: {
    intent: string;
    normalized_query: string;
    type_filters: string[];
    province: string | null;
    weather_context: "hot" | "rain" | null;
    keyword_hints: string[];
  };
}

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (value: string, terms: string[]): boolean =>
  terms.some((term) => value.includes(term));

const VIETNAMESE_CHAT_NORMALIZATION: Record<string, string> = {
  k: "khong",
  ko: "khong",
  khongg: "khong",
  khum: "khong",
  hok: "khong",
  hk: "khong",
  hem: "khong",
  hong: "khong",
  hông: "khong",
  dc: "duoc",
  đc: "duoc",
  duocj: "duoc",
  j: "gi",
  z: "vay",
  dz: "vay",
  v: "vay",
  r: "roi",
  rui: "roi",
  roi: "roi",
  lun: "luon",
  luônn: "luon",
  nha: "nha",
  nhe: "nhe",
  nghen: "nhe",
  hen: "nhe",
  hén: "nhe",
  nè: "ne",
  ne: "ne",
  wa: "qua",
  wá: "qua",
  qa: "qua",
  qá: "qua",
  ok: "duoc",
  oke: "duoc",
  oki: "duoc",
};

const normalizeChatTokens = (value: string): string =>
  value
    .split(" ")
    .map((token) => VIETNAMESE_CHAT_NORMALIZATION[token] ?? token)
    .join(" ");

export const normalizeUserText = (value: string): string =>
  normalizeChatTokens(normalizeText(value));

const detectProvince = (normalizedQuery: string): string | null => {
  if (containsAny(normalizedQuery, ["can tho", "cai rang", "ninh kieu"])) return "Cần Thơ";
  if (containsAny(normalizedQuery, ["ho chi minh", "sai gon", "tphcm"])) return "Hồ Chí Minh";
  if (containsAny(normalizedQuery, ["da lat", "lam dong"])) return "Lâm Đồng";
  if (normalizedQuery.includes("da nang")) return "Đà Nẵng";
  return null;
};

const buildSearchIntent = (query: string, context?: AiRequestContext) => {
  const normalizedQuery = normalizeUserText(query);
  const weatherContext: "hot" | "rain" | null = containsAny(normalizedQuery, [
    "troi nong",
    "troi nang",
    "nong qua",
    "nong",
    "nang qua",
    "nang",
    "oi buc",
    "oi qua",
    "ham",
    "ham qua",
    "giai nhiet",
    "cho mat",
    "ngoi mat",
    "ne nong",
    "tranh nong",
    "nong muon xiu",
    "nong xiu",
    "nong chet",
    "nang chay da",
  ])
    ? "hot"
    : containsAny(normalizedQuery, [
      "troi mua",
      "mua qua",
      "mua",
      "mua lon",
      "mua tam ta",
      "u u",
      "am u",
      "lanh",
    ])
      ? "rain"
      : null;

  const wantsDrink = containsAny(normalizedQuery, [
    "cafe",
    "ca phe",
    "nuoc",
    "tra",
    "do uong",
    "giai khat",
    "kem",
    "sinh to",
    "tra sua",
    "nuoc mia",
    "nuoc ep",
    "giai nhiet",
  ]);
  const wantsFood = containsAny(normalizedQuery, [
    "do an",
    "an gi",
    "an uong",
    "nha hang",
    "quan an",
    "quan nao",
    "cho nao an",
    "mon",
    "doi",
    "an vat",
    "lai rai",
  ]);
  const wantsStay = containsAny(normalizedQuery, [
    "khach san",
    "hotel",
    "luu tru",
    "ngu",
    "phong",
    "resort",
    "nha tro",
  ]);
  const wantsTravel = containsAny(normalizedQuery, [
    "du lich",
    "tham quan",
    "vui choi",
    "di choi",
    "di dau",
    "cho nao",
    "cho di",
    "cho tui",
    "cho tao",
    "goi y",
    "goi y cho",
    "chill",
    "song ao",
    "cuoi tuan",
    "check in",
    "checkin",
  ]);
  const wantsMoodBreak = containsAny(normalizedQuery, [
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
  ]);

  let typeFilters: string[] = [];
  let intent = "general_recommendation";
  const keywordHints: string[] = [];

  if (wantsStay) {
    typeFilters = ["hotel", "resort", "homestay", "motel"];
    intent = "stay_recommendation";
  } else if (weatherContext === "hot") {
    typeFilters = wantsTravel
      ? ["cafe", "restaurant", "tourist", "attraction", "entertainment"]
      : ["cafe", "restaurant"];
    intent = "hot_weather_recommendation";
    keywordHints.push("mát", "nước uống", "cafe", "trà", "kem", "ngồi nghỉ", "tránh nắng", "giải nhiệt");
  } else if (weatherContext === "rain") {
    typeFilters = wantsTravel
      ? ["cafe", "restaurant", "hotel", "tourist", "attraction", "entertainment"]
      : ["cafe", "restaurant", "hotel"];
    intent = "rain_weather_recommendation";
    keywordHints.push("trong nhà", "ấm", "ngồi nghỉ", "gần");
  } else if (wantsMoodBreak) {
    typeFilters = ["cafe", "restaurant", "tourist", "attraction", "entertainment"];
    intent = "mood_break_recommendation";
    keywordHints.push("doi gio", "chill", "ngoi nghi", "an uong", "di choi nhe");
  } else if (wantsTravel) {
    typeFilters = ["tourist", "attraction", "entertainment", "cafe"];
    intent = "travel_recommendation";
  } else if (wantsDrink) {
    typeFilters = ["cafe", "restaurant"];
    intent = "drink_recommendation";
  } else if (wantsFood || normalizedQuery.includes("quan")) {
    typeFilters = ["restaurant", "cafe"];
    intent = "food_recommendation";
  }

  return {
    normalizedQuery,
    weatherContext,
    province:
      detectProvince(normalizedQuery) ||
      context?.current_location?.province ||
      context?.current_location?.city ||
      null,
    typeFilters,
    intent,
    keywordHints,
  };
};

export const getLocationsContext = async (query: string, requestContext?: AiRequestContext): Promise<LocationCandidate[]> => {
  const context = await getLocationsSearchContext(query, requestContext);
  return context.candidates;
};

export const getLocationsSearchContext = async (
  query: string,
  requestContext?: AiRequestContext,
): Promise<LocationSearchContext> => {
  try {
    const intent = buildSearchIntent(query, requestContext);

    let sql = `
      SELECT location_id, location_name, location_type, description, address, province, rating, total_reviews
      FROM locations
      WHERE status = 'active'
    `;
    const params: any[] = [];

    if (intent.typeFilters.length > 0) {
      sql += ` AND location_type IN (${intent.typeFilters.map(() => "?").join(",")})`;
      params.push(...intent.typeFilters);
    }

    if (intent.province) {
      sql += ` AND province LIKE ?`;
      params.push(`%${intent.province}%`);
    }

    sql += `
      ORDER BY
        CASE
          WHEN ? = 'hot_weather_recommendation'
            AND (
              LOWER(COALESCE(description, '')) LIKE '%mát%'
              OR LOWER(COALESCE(description, '')) LIKE '%cafe%'
              OR LOWER(COALESCE(description, '')) LIKE '%cà phê%'
              OR LOWER(COALESCE(description, '')) LIKE '%nước%'
              OR LOWER(COALESCE(description, '')) LIKE '%trà%'
            )
          THEN 0
          ELSE 1
        END,
        rating DESC,
        total_reviews DESC,
        location_id DESC
      LIMIT 15`;
    params.push(intent.intent);

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    return {
      candidates: rows as LocationCandidate[],
      filters: {
        intent: intent.intent,
        normalized_query: intent.normalizedQuery,
        type_filters: intent.typeFilters,
        province: intent.province,
        weather_context: intent.weatherContext,
        keyword_hints: intent.keywordHints,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy context địa điểm:", error);
    return {
      candidates: [],
      filters: {
        intent: "error",
        normalized_query: normalizeUserText(query),
        type_filters: [],
        province: null,
        weather_context: null,
        keyword_hints: [],
      },
    };
  }
};
