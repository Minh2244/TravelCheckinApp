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
  distance_km?: number | null;
  starting_price?: number | null;
  available_service_types?: string | null;
  available_services?: string | null;
  affordable_service_count?: number | null;
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
    service_filters: string[];
    province: string | null;
    weather_context: "hot" | "rain" | null;
    keyword_hints: string[];
    budget: number | null;
    trip_days: number | null;
    trip_nights: number | null;
    people_count: number;
    includes_stay: boolean;
    nearby_priority: boolean;
    user_location: {
      lat: number;
      lng: number;
    } | null;
  };
}

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/Ä‘/g, "d")
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
  dc: "duoc",
  duocj: "duoc",
  j: "gi",
  z: "vay",
  dz: "vay",
  v: "vay",
  r: "roi",
  rui: "roi",
  roi: "roi",
  lun: "luon",
  nha: "nha",
  nhe: "nhe",
  nghen: "nhe",
  hen: "nhe",
  ne: "ne",
  wa: "qua",
  qa: "qua",
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
  if (containsAny(normalizedQuery, ["can tho", "cai rang", "ninh kieu"])) return "C\u1ea7n Th\u01a1";
  if (containsAny(normalizedQuery, ["ho chi minh", "sai gon", "tphcm"])) return "H\u1ed3 Ch\u00ed Minh";
  if (containsAny(normalizedQuery, ["da lat", "lam dong"])) return "L\u00e2m \u0110\u1ed3ng";
  if (normalizedQuery.includes("da nang")) return "\u0110\u00e0 N\u1eb5ng";
  return null;
};

const unique = (values: string[]): string[] =>
  [...new Set(values.filter(Boolean))];

const parseNumberValue = (rawValue: string): number =>
  Number(rawValue.replace(",", "."));

const parseBudget = (normalizedQuery: string): number | null => {
  const millionMatch = normalizedQuery.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr)\b/);
  if (millionMatch) {
    return Math.round(parseNumberValue(millionMatch[1]) * 1_000_000);
  }

  const thousandMatch = normalizedQuery.match(/(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan)\b/);
  if (thousandMatch) {
    return Math.round(parseNumberValue(thousandMatch[1]) * 1_000);
  }

  const compactMoney = normalizedQuery.replace(/[.,\s]/g, "").match(/\b(\d{5,9})\b/);
  if (compactMoney) {
    return Number(compactMoney[1]);
  }

  return null;
};

const parseTripDays = (normalizedQuery: string): number | null => {
  const dayMatch = normalizedQuery.match(/(\d+)\s*(ngay|hom)\b/);
  const nightMatch = normalizedQuery.match(/(\d+)\s*dem\b/);

  if (nightMatch) {
    const days = dayMatch ? Number(dayMatch[1]) : 0;
    const nights = Number(nightMatch[1]);
    return Math.max(days, nights, 2);
  }

  if (containsAny(normalizedQuery, ["ngay dem", "qua dem", "nghi dem", "o lai", "ngu lai"])) {
    return 2;
  }

  if (dayMatch) {
    return Number(dayMatch[1]);
  }

  return null;
};

const parseTripNights = (normalizedQuery: string): number | null => {
  const nightMatch = normalizedQuery.match(/(\d+)\s*dem\b/);
  if (nightMatch) {
    return Number(nightMatch[1]);
  }

  if (containsAny(normalizedQuery, ["ngay dem", "qua dem", "nghi dem", "o lai", "ngu lai"])) {
    return 1;
  }

  return null;
};

const parsePeopleCount = (normalizedQuery: string): number => {
  const numberMatch = normalizedQuery.match(/(\d+)\s*(nguoi|ban|dua)\b/);
  if (numberMatch) {
    return Math.max(1, Number(numberMatch[1]));
  }

  const wordNumbers: Record<string, number> = {
    mot: 1,
    hai: 2,
    ba: 3,
    bon: 4,
    nam: 5,
    sau: 6,
  };

  for (const [word, count] of Object.entries(wordNumbers)) {
    if (normalizedQuery.includes(`${word} nguoi`) || normalizedQuery.includes(`${word} dua`)) {
      return count;
    }
  }

  if (containsAny(normalizedQuery, ["mot minh", "di rieng"])) {
    return 1;
  }

  return 1;
};

const parseCoordinate = (value: unknown): number | null => {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

const buildSearchIntent = (query: string, context?: AiRequestContext) => {
  const normalizedQuery = normalizeUserText(query);
  const budget = parseBudget(normalizedQuery);
  const tripDays = parseTripDays(normalizedQuery);
  const tripNights = parseTripNights(normalizedQuery);
  const peopleCount = parsePeopleCount(normalizedQuery);
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
    "nha nghi",
    "cho o",
    "noi o",
    "tim cho o",
    "tim noi o",
    "dem",
    "qua dem",
    "ngay dem",
    "nghi dem",
    "o lai",
    "ngu lai",
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
    "cho choi",
    "mua ve",
    "ban ve",
    "ve du lich",
  ]);
  const wantsTicketPurchase = containsAny(normalizedQuery, [
    "mua ve",
    "ban ve",
    "ve du lich",
    "dat ve",
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

  const locationTypeFilters: string[] = [];
  const serviceTypeFilters: string[] = [];
  let intent = "general_recommendation";
  const keywordHints: string[] = [];
  const includesStay = wantsStay || Boolean(tripDays && tripDays > 1);

  if (wantsStay && wantsTravel) {
    locationTypeFilters.push("tourist", "restaurant", "cafe", "hotel", "resort");
    serviceTypeFilters.push("ticket", "food", "combo", "table", "room");
    intent = "overnight_trip_recommendation";
    keywordHints.push("lich trinh co diem choi, an uong va cho o");
  } else if (wantsStay) {
    locationTypeFilters.push("hotel", "resort");
    serviceTypeFilters.push("room");
    intent = "stay_recommendation";
  } else if (weatherContext === "hot") {
    locationTypeFilters.push("cafe", "restaurant", "tourist");
    serviceTypeFilters.push("food", "combo", "table", "ticket");
    intent = "hot_weather_recommendation";
    keywordHints.push("mat", "nuoc uong", "cafe", "tra", "kem", "ngoi nghi", "tranh nang", "giai nhiet");
  } else if (weatherContext === "rain") {
    locationTypeFilters.push("cafe", "restaurant", "tourist");
    serviceTypeFilters.push("food", "combo", "table", "ticket");
    intent = "rain_weather_recommendation";
    keywordHints.push("trong nha", "am", "ngoi nghi", "gan");
  } else if (wantsMoodBreak) {
    locationTypeFilters.push("cafe", "restaurant", "tourist");
    serviceTypeFilters.push("food", "combo", "table", "ticket");
    intent = "mood_break_recommendation";
    keywordHints.push("doi gio", "chill", "ngoi nghi", "an uong", "di choi nhe");
  } else if (wantsTicketPurchase) {
    locationTypeFilters.push("tourist");
    serviceTypeFilters.push("ticket");
    intent = "ticket_recommendation";
  } else if (wantsTravel) {
    locationTypeFilters.push("tourist", "restaurant", "cafe");
    serviceTypeFilters.push("ticket", "food", "combo", "table");
    intent = "travel_recommendation";
  } else if (wantsDrink) {
    locationTypeFilters.push("cafe", "restaurant");
    serviceTypeFilters.push("food", "combo", "table");
    intent = "drink_recommendation";
  } else if (wantsFood || normalizedQuery.includes("quan")) {
    locationTypeFilters.push("restaurant", "cafe");
    serviceTypeFilters.push("food", "combo", "table");
    intent = "food_recommendation";
  }

  if (includesStay) {
    locationTypeFilters.push("hotel", "resort");
    serviceTypeFilters.push("room");
    if (!wantsStay && intent === "travel_recommendation") {
      keywordHints.push("co lich trinh nhieu ngay nen can goi y them cho o");
    }
  }

  return {
    normalizedQuery,
    weatherContext,
    province:
      detectProvince(normalizedQuery) ||
      context?.current_location?.province ||
      context?.current_location?.city ||
      null,
    typeFilters: unique(locationTypeFilters),
    serviceTypeFilters: unique(serviceTypeFilters),
    intent,
    keywordHints,
    budget,
    tripDays,
    tripNights,
    peopleCount,
    includesStay,
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
  const intent = buildSearchIntent(query, requestContext);
  const userLat = parseCoordinate(requestContext?.current_location?.lat);
  const userLng = parseCoordinate(requestContext?.current_location?.lng);
  const hasUserLocation = userLat !== null && userLng !== null;

  try {
    const params: any[] = [];
    const distanceSelect = hasUserLocation
      ? `ROUND(
          6371 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
              )
            )
          ),
          2
        ) as distance_km,`
      : "NULL as distance_km,";
    const budgetSelect = intent.budget
      ? "SUM(CASE WHEN s.price > 0 AND s.price <= ? THEN 1 ELSE 0 END) as affordable_service_count,"
      : "0 as affordable_service_count,";

    if (hasUserLocation) {
      params.push(userLat, userLng, userLat);
    }

    if (intent.budget) {
      params.push(intent.budget);
    }

    let sql = `
      SELECT
        l.location_id,
        l.location_name,
        l.location_type,
        l.description,
        l.address,
        l.province,
        l.rating,
        l.total_reviews,
        ${distanceSelect}
        MIN(NULLIF(s.price, 0)) as starting_price,
        ${budgetSelect}
        GROUP_CONCAT(DISTINCT s.service_type ORDER BY s.service_type SEPARATOR ', ') as available_service_types,
        GROUP_CONCAT(DISTINCT CONCAT(s.service_name, ' (', CAST(s.price AS UNSIGNED), ' VND - ', s.service_type, ')') SEPARATOR ', ') as available_services
      FROM locations l
      LEFT JOIN services s
        ON l.location_id = s.location_id
        AND s.status = 'available'
        AND s.admin_status = 'approved'
        AND s.deleted_at IS NULL
      WHERE l.status = 'active'
        AND l.deleted_at IS NULL
        AND l.owner_id IS NOT NULL
        AND l.source = 'owner'
    `;

    if (intent.typeFilters.length > 0 || intent.serviceTypeFilters.length > 0) {
      const typePlaceholders = intent.typeFilters.map(() => "?").join(",");
      const servicePlaceholders = intent.serviceTypeFilters.map(() => "?").join(",");
      const filterParts: string[] = [];

      if (intent.typeFilters.length > 0) {
        filterParts.push(`l.location_type IN (${typePlaceholders})`);
        params.push(...intent.typeFilters);
      }

      if (intent.serviceTypeFilters.length > 0) {
        filterParts.push(`
          EXISTS (
            SELECT 1
            FROM services sf
            WHERE sf.location_id = l.location_id
              AND sf.status = 'available'
              AND sf.admin_status = 'approved'
              AND sf.deleted_at IS NULL
              AND sf.service_type IN (${servicePlaceholders})
          )
        `);
        params.push(...intent.serviceTypeFilters);
      }

      sql += ` AND (${filterParts.join(" OR ")})`;
    }

    if (intent.province) {
      sql += ` AND l.province LIKE ?`;
      params.push(`%${intent.province}%`);
    }

    sql += `
      GROUP BY l.location_id
      ORDER BY
        ${hasUserLocation ? "distance_km IS NULL ASC, distance_km ASC," : ""}
        ${intent.budget ? "affordable_service_count DESC," : ""}
        CASE l.location_type
          WHEN 'tourist' THEN 1
          WHEN 'restaurant' THEN 2
          WHEN 'cafe' THEN 3
          WHEN 'hotel' THEN 4
          WHEN 'resort' THEN 5
          ELSE 9
        END ASC,
        l.rating DESC,
        l.total_reviews DESC,
        l.location_id DESC
      LIMIT 15`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    return {
      candidates: rows as LocationCandidate[],
      filters: {
        intent: intent.intent,
        normalized_query: intent.normalizedQuery,
        type_filters: intent.typeFilters,
        service_filters: intent.serviceTypeFilters,
        province: intent.province,
        weather_context: intent.weatherContext,
        keyword_hints: intent.keywordHints,
        budget: intent.budget,
        trip_days: intent.tripDays,
        trip_nights: intent.tripNights,
        people_count: intent.peopleCount,
        includes_stay: intent.includesStay,
        nearby_priority: hasUserLocation,
        user_location: hasUserLocation
          ? {
              lat: userLat,
              lng: userLng,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("Loi khi lay context dia diem cho AI:", error);
    return {
      candidates: [],
      filters: {
        intent: "error",
        normalized_query: normalizeUserText(query),
        type_filters: [],
        service_filters: [],
        province: null,
        weather_context: null,
        keyword_hints: [],
        budget: intent.budget,
        trip_days: intent.tripDays,
        trip_nights: intent.tripNights,
        people_count: intent.peopleCount,
        includes_stay: intent.includesStay,
        nearby_priority: hasUserLocation,
        user_location: hasUserLocation
          ? {
              lat: userLat,
              lng: userLng,
            }
          : null,
      },
    };
  }
};
