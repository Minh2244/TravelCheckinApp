import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ConfigProvider, DatePicker } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import UserLayout from "../../layouts/UserLayout";
import { useBookings } from "../../hooks/useBookings";
import bookingApi from "../../api/bookingApi";
import locationApi from "../../api/locationApi";
import type {
  CreateBookingBatchPayload,
  CreateBookingBatchResult,
  CreateBookingPayload,
  ConfirmTicketTransferResult,
  TableReservationItem,
} from "../../types/booking.types";
import type { Location } from "../../types/location.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatMoney } from "../../utils/formatMoney";
import { getErrorMessage } from "../../utils/safe";
import {
  extractOpenClose,
  isWithinOpeningHours,
} from "../../utils/openingHours";
import { buildVietQrImageUrl } from "../../utils/vietqr";

type PrepayChoice = "none" | "transfer";

// Vì sao: gom dữ liệu form thành một kiểu rõ ràng để tránh sai payload
interface BookingFormState {
  serviceId: string;
  checkInDate: string;
  checkOutDate: string;
  quantity: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  voucherCode: string;
}

type StoredUser = {
  full_name?: string;
  phone?: string | null;
};

const readStoredUser = (): StoredUser | null => {
  const raw = sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    return {
      full_name: typeof obj.full_name === "string" ? obj.full_name : undefined,
      phone: typeof obj.phone === "string" ? obj.phone : null,
    };
  } catch {
    return null;
  }
};

type PublicServiceRow = {
  service_id: number;
  location_id: number;
  category_id: number | null;
  service_name: string;
  service_type: "room" | "table" | "ticket" | "food" | "combo" | "other";
  price: number | string;
  images: unknown;
  category_name?: string | null;
  category_type?: string | null;
  category_sort_order?: number | null;
  room_status?: string | null;
};

type PosAreaRow = {
  area_id: number;
  area_name: string;
};

const toNumberOrNull = (value?: string | null): number | null => {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const compareNaturalText = (a: string, b: string) => {
  return String(a || "").localeCompare(String(b || ""), "vi", {
    numeric: true,
    sensitivity: "base",
  });
};

const parseImages = (images: unknown): string[] => {
  if (Array.isArray(images)) return images.map((x) => String(x));
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      // ignore
    }
  }
  return [];
};

const formatDisplayDateTime = (value: string | null | undefined): string => {
  if (!value) return "";

  // Date-only: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map((x) => Number(x));
    if (!y || !m || !d) return value;
    return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${String(y)}`;
  }

  // Accept both datetime-local and MySQL datetime
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return value;

  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

const parseQrData = (qrData: unknown): any | null => {
  if (!qrData) return null;
  if (typeof qrData === "object") return qrData as any;
  if (typeof qrData === "string") {
    try {
      return JSON.parse(qrData);
    } catch {
      return null;
    }
  }
  return null;
};

const PERSON_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)*$/u;
const PHONE_PATTERN = /^0\d{9}$/;

const isValidPersonName = (value: string) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  return PERSON_NAME_PATTERN.test(normalized);
};

const isValidPhoneNumber = (value: string) => {
  return PHONE_PATTERN.test(String(value || "").trim());
};

const HOTEL_BATCH_STORAGE_KEY = "last_hotel_batch_booking_v1";
const HOTEL_NOTICES_STORAGE_KEY = "hotel_booking_notices_v1";

const TABLE_SUCCESS_STORAGE_KEY = "last_table_booking_success_v1";
const TICKET_ISSUED_STORAGE_KEY = "ticket_issued_blocks_v1";

type LastHotelBatchBooking = {
  ts: number;
  locationId: number;
  checkInDate: string;
  selectedRoomIds: number[];
  result: CreateBookingBatchResult;
};

type HotelBookingNotice = {
  id: string;
  ts: number;
  locationId: number;
  locationName: string | null;
  bookingIds: number[];
  contactName: string | null;
  contactPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  roomNames: string[];
  paymentId: number | null;
  paymentStatus: string | null;
  expiresAt: number | null;
};

type HotelRoomBatchPaymentMeta = {
  bookingIds: number[];
  locationName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  roomNames: string[];
};

const readHotelNotices = (): HotelBookingNotice[] => {
  try {
    const raw = sessionStorage.getItem(HOTEL_NOTICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const notices: HotelBookingNotice[] = [];
    for (const it of parsed) {
      if (!it || typeof it !== "object") continue;
      const o = it as any;
      if (typeof o.id !== "string" || !o.id.trim()) continue;
      if (typeof o.ts !== "number") continue;
      if (typeof o.locationId !== "number") continue;
      if (!Array.isArray(o.bookingIds)) continue;
      if (typeof o.checkInDate !== "string") continue;
      if (typeof o.checkOutDate !== "string") continue;
      if (!Array.isArray(o.roomNames)) continue;

      notices.push({
        id: String(o.id),
        ts: Number(o.ts),
        locationId: Number(o.locationId),
        locationName:
          typeof o.locationName === "string" ? String(o.locationName) : null,
        bookingIds: Array.from(
          new Set(
            o.bookingIds
              .map((x: any) => Number(x))
              .filter((n: number) => Number.isFinite(n) && n > 0),
          ),
        ),
        contactName:
          typeof o.contactName === "string" ? String(o.contactName) : null,
        contactPhone:
          typeof o.contactPhone === "string" ? String(o.contactPhone) : null,
        checkInDate: String(o.checkInDate),
        checkOutDate: String(o.checkOutDate),
        roomNames: o.roomNames.map((x: any) => String(x)).filter(Boolean),
        paymentId:
          o.paymentId == null
            ? null
            : Number.isFinite(Number(o.paymentId))
              ? Number(o.paymentId)
              : null,
        paymentStatus:
          typeof o.paymentStatus === "string" ? String(o.paymentStatus) : null,
        expiresAt:
          o.expiresAt == null
            ? null
            : Number.isFinite(Number(o.expiresAt))
              ? Number(o.expiresAt)
              : null,
      });
    }
    return notices;
  } catch {
    return [];
  }
};

const writeHotelNotices = (v: HotelBookingNotice[]) => {
  try {
    sessionStorage.setItem(HOTEL_NOTICES_STORAGE_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
};

const readLastHotelBatchBooking = (): LastHotelBatchBooking | null => {
  try {
    const raw = sessionStorage.getItem(HOTEL_BATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastHotelBatchBooking>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.ts !== "number") return null;
    if (typeof parsed.locationId !== "number") return null;
    if (typeof parsed.checkInDate !== "string") return null;
    if (!Array.isArray(parsed.selectedRoomIds)) return null;
    if (!parsed.result || typeof parsed.result !== "object") return null;
    return parsed as LastHotelBatchBooking;
  } catch {
    return null;
  }
};

const writeLastHotelBatchBooking = (v: LastHotelBatchBooking | null) => {
  try {
    if (!v) {
      sessionStorage.removeItem(HOTEL_BATCH_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(HOTEL_BATCH_STORAGE_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
};

type LastTableBookingSuccess = {
  ts: number;
  bookingId: number;
  locationId: number;
  locationName: string | null;
  checkInDate: string;
  tableIds: number[];
  contactName: string | null;
  contactPhone: string | null;
};

type IssuedTicketBlock = {
  id: string;
  ts: number;
  bookingId: number;
  ticketId: number;
  ticketCode: string;
  serviceId: number;
  serviceName: string | null;
  locationId: number;
  locationName: string | null;
  useDate: string | null;
};

const readIssuedTickets = (): IssuedTicketBlock[] => {
  try {
    const raw = sessionStorage.getItem(TICKET_ISSUED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const items: IssuedTicketBlock[] = [];
    for (const it of parsed) {
      if (!it || typeof it !== "object") continue;
      const o = it as any;
      if (typeof o.id !== "string" || !o.id.trim()) continue;
      if (typeof o.ts !== "number") continue;
      if (typeof o.bookingId !== "number") continue;
      if (typeof o.ticketId !== "number") continue;
      if (typeof o.ticketCode !== "string" || !o.ticketCode.trim()) continue;
      if (typeof o.serviceId !== "number") continue;
      if (typeof o.locationId !== "number") continue;

      items.push({
        id: String(o.id),
        ts: Number(o.ts),
        bookingId: Number(o.bookingId),
        ticketId: Number(o.ticketId),
        ticketCode: String(o.ticketCode),
        serviceId: Number(o.serviceId),
        serviceName:
          typeof o.serviceName === "string" ? String(o.serviceName) : null,
        locationId: Number(o.locationId),
        locationName:
          typeof o.locationName === "string" ? String(o.locationName) : null,
        useDate: typeof o.useDate === "string" ? String(o.useDate) : null,
      });
    }
    return items;
  } catch {
    return [];
  }
};

const writeIssuedTickets = (items: IssuedTicketBlock[]) => {
  try {
    sessionStorage.setItem(TICKET_ISSUED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

const readLastTableBookingSuccess = (): LastTableBookingSuccess | null => {
  try {
    const raw = sessionStorage.getItem(TABLE_SUCCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastTableBookingSuccess>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.ts !== "number") return null;
    if (typeof parsed.bookingId !== "number") return null;
    if (typeof parsed.locationId !== "number") return null;
    if (typeof parsed.checkInDate !== "string") return null;
    if (!Array.isArray(parsed.tableIds)) return null;
    return {
      ts: parsed.ts,
      bookingId: parsed.bookingId,
      locationId: parsed.locationId,
      locationName:
        typeof parsed.locationName === "string" ? parsed.locationName : null,
      checkInDate: parsed.checkInDate,
      tableIds: parsed.tableIds.map((x) => Number(x)).filter((n) => n > 0),
      contactName:
        typeof parsed.contactName === "string" ? parsed.contactName : null,
      contactPhone:
        typeof parsed.contactPhone === "string" ? parsed.contactPhone : null,
    };
  } catch {
    return null;
  }
};

const writeLastTableBookingSuccess = (v: LastTableBookingSuccess | null) => {
  try {
    if (!v) {
      sessionStorage.removeItem(TABLE_SUCCESS_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(TABLE_SUCCESS_STORAGE_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
};


const getCurrentMinuteValue = () =>
  dayjs().second(0).millisecond(0).format("YYYY-MM-DDTHH:mm:ss");

const BookingPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { loading, error, result, createBooking } = useBookings();

  const [tableSuccess, setTableSuccess] =
    useState<LastTableBookingSuccess | null>(null);

  const [hideSingleSuccess, setHideSingleSuccess] = useState(false);
  const latestSingleBookingIdRef = useRef<number | null>(null);
  const latestBatchResultRef = useRef<CreateBookingBatchResult | null>(null);
  const suppressNextAutoShowSuccessRef = useRef(false);

  useEffect(() => {
    latestSingleBookingIdRef.current =
      result && Number.isFinite(Number((result as any).bookingId))
        ? Number((result as any).bookingId)
        : null;
    // new booking result should re-show the success panel
    if (result) {
      if (suppressNextAutoShowSuccessRef.current) {
        suppressNextAutoShowSuccessRef.current = false;
        setHideSingleSuccess(true);
      } else {
        setHideSingleSuccess(false);
      }
    }
  }, [result]);

  useEffect(() => {
    dayjs.locale("vi");
  }, []);

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<PublicServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  type PosTableRow = {
    table_id: number;
    area_id: number | null;
    table_name: string;
    shape?: string | null;
    status: "free" | "reserved" | "occupied";
  };

  const [posAreas, setPosAreas] = useState<PosAreaRow[]>([]);
  const [posTables, setPosTables] = useState<PosTableRow[]>([]);
  const [posTablesLoading, setPosTablesLoading] = useState(false);
  const [posTablesError, setPosTablesError] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [selectedTableArea, setSelectedTableArea] = useState<string>("all");
  const [selectedMenuCategory, setSelectedMenuCategory] =
    useState<string>("all");
  const [tableReservations, setTableReservations] = useState<
    TableReservationItem[]
  >([]);
  const [tableReservationsLoading, setTableReservationsLoading] =
    useState(false);
  const [autoSyncCheckIn, setAutoSyncCheckIn] = useState(true);

  const fetchPosTables = async (): Promise<PosTableRow[] | null> => {
    if (!locationIdNum || !isFoodLocation) return null;
    try {
      const res = await locationApi.getLocationPosTables(locationIdNum, {
        check_in_date: form.checkInDate || undefined,
      });
      const raw = Array.isArray(res.data) ? res.data : [];
      const mapped: PosTableRow[] = raw
        .map((r) => r as any)
        .filter((r) => r && typeof r === "object")
        .map((r) => ({
          table_id: Number(r.table_id),
          area_id: r.area_id == null ? null : Number(r.area_id),
          table_name: String(r.table_name || ""),
          shape: r.shape == null ? null : String(r.shape),
          status: String(r.status || "free") as any,
        }))
        .filter((t) => Number.isFinite(t.table_id) && t.table_name);
      return mapped;
    } catch {
      return null;
    }
  };

  const fetchMyTableReservations = async (): Promise<
    TableReservationItem[]
  > => {
    if (!locationIdNum || !isFoodLocation) return [];
    try {
      const res = await bookingApi.getMyTableReservations(locationIdNum);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const fetchPosAreas = async (): Promise<PosAreaRow[] | null> => {
    if (!locationIdNum || !isFoodLocation) return null;
    try {
      const res = await locationApi.getLocationPosAreas(locationIdNum);
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw
        .map((r) => r as any)
        .filter((r) => r && typeof r === "object")
        .map((r) => ({
          area_id: Number(r.area_id),
          area_name: String(r.area_name || "").trim(),
        }))
        .filter((a) => Number.isFinite(a.area_id) && a.area_name);
    } catch {
      return null;
    }
  };

  const [preorderEnabled, setPreorderEnabled] = useState(false);
  const [preorderQtyByServiceId, setPreorderQtyByServiceId] = useState<
    Record<number, number>
  >({});

  const [ticketQtyByServiceId, setTicketQtyByServiceId] = useState<
    Record<number, number>
  >({});

  const isFoodLocation =
    location?.location_type === "restaurant" ||
    location?.location_type === "cafe";

  const isTouristLocation = location?.location_type === "tourist";

  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [selectedHotelCategory, setSelectedHotelCategory] =
    useState<string>("all");
  const [hotelStayPreset, setHotelStayPreset] = useState<
    "day" | "week" | "month" | "custom"
  >("day");
  const [hotelCustomDays, setHotelCustomDays] = useState<number>(1);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] =
    useState<CreateBookingBatchResult | null>(null);
  const [hotelRoomBatchPaymentMetaById, setHotelRoomBatchPaymentMetaById] =
    useState<Record<number, HotelRoomBatchPaymentMeta>>({});

  useEffect(() => {
    latestBatchResultRef.current = batchResult;
  }, [batchResult]);

  const initialForm = useMemo<BookingFormState>(() => {
    const u = readStoredUser();
    return {
      serviceId: params.serviceId ?? "",
      checkInDate: "",
      checkOutDate: "",
      quantity: "1",
      contactName: u?.full_name ? String(u.full_name) : "",
      contactPhone: u?.phone ? String(u.phone) : "",
      notes: "",
      voucherCode: "",
    };
  }, [params.serviceId, searchParams]);

  const [form, setForm] = useState<BookingFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [prepayChoice, setPrepayChoice] = useState<PrepayChoice>("none");
  const [createdPayments, setCreatedPayments] = useState<any[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [roomBatchConfirmLoading, setRoomBatchConfirmLoading] = useState(false);
  const [roomConfirmError, setRoomConfirmError] = useState<string | null>(null);

  const visibleCreatedPayments = useMemo(() => {
    return createdPayments.filter(
      (p) => String((p as any)?.status || "pending") !== "completed",
    );
  }, [createdPayments]);

  const [hotelNotices, setHotelNotices] = useState<HotelBookingNotice[]>([]);

  const [hotelSuccessEditingNoticeId, setHotelSuccessEditingNoticeId] =
    useState<string | null>(null);
  const [hotelSuccessContactDraftName, setHotelSuccessContactDraftName] =
    useState<string>("");
  const [hotelSuccessContactDraftPhone, setHotelSuccessContactDraftPhone] =
    useState<string>("");
  const [hotelSuccessContactSaveLoading, setHotelSuccessContactSaveLoading] =
    useState(false);
  const [hotelSuccessContactSaveError, setHotelSuccessContactSaveError] =
    useState<string | null>(null);

  // Food preorder payment gate
  const [foodPrepayBookingId, setFoodPrepayBookingId] = useState<number | null>(
    null,
  );
  const [foodPrepayPaid, setFoodPrepayPaid] = useState(false);
  const [foodPrepayConfirmLoading, setFoodPrepayConfirmLoading] =
    useState(false);
  const [foodPrepayConfirmError, setFoodPrepayConfirmError] = useState<
    string | null
  >(null);

  const [ticketConfirmLoading, setTicketConfirmLoading] = useState(false);
  const [ticketConfirmError, setTicketConfirmError] = useState<string | null>(
    null,
  );
  const [ticketConfirmByBookingId, setTicketConfirmByBookingId] = useState<
    Record<number, ConfirmTicketTransferResult>
  >({});

  const locationIdNum = useMemo(
    () => toNumberOrNull(searchParams.get("locationId")),
    [searchParams],
  );

  const serviceIdNum = useMemo(
    () => toNumberOrNull(form.serviceId || params.serviceId),
    [form.serviceId, params.serviceId],
  );

  useEffect(() => {
    const run = async () => {
      setServicesError(null);
      setServices([]);
      setLocation(null);
      setTicketQtyByServiceId({});
      setSelectedRoomIds([]);
      setFoodPrepayBookingId(null);
      setFoodPrepayPaid(false);
      setFoodPrepayConfirmError(null);
      if (!locationIdNum) return;

      setServicesLoading(true);
      try {
        const [locRes, svcRes] = await Promise.all([
          locationApi.getLocationById(locationIdNum, "web"),
          locationApi.getLocationServices(locationIdNum),
        ]);
        setLocation(locRes.data);

        const raw = Array.isArray(svcRes.data) ? svcRes.data : [];
        const mapped: PublicServiceRow[] = raw
          .map((r) => r as any)
          .filter((r) => r && typeof r === "object")
          .map((r) => ({
            service_id: Number(r.service_id),
            location_id: Number(r.location_id),
            category_id: r.category_id == null ? null : Number(r.category_id),
            service_name: String(r.service_name || ""),
            service_type: String(r.service_type || "other") as any,
            price: r.price,
            images: r.images,
            category_name:
              r.category_name == null ? null : String(r.category_name),
            category_type:
              r.category_type == null ? null : String(r.category_type),
            category_sort_order:
              r.category_sort_order == null
                ? null
                : Number(r.category_sort_order),
            room_status:
              r.room_status == null ? null : String(r.room_status || ""),
          }))
          .filter((r) => Number.isFinite(r.service_id) && r.service_name);

        setServices(mapped);
      } catch {
        setServicesError("Không thể tải dịch vụ của địa điểm");
      } finally {
        setServicesLoading(false);
      }
    };
    void run();
  }, [locationIdNum]);

  useEffect(() => {
    const run = async () => {
      setPosTablesError(null);
      setPosAreas([]);
      setPosTables([]);
      setTableReservations([]);
      setSelectedTableIds([]);
      setSelectedTableArea("all");
      setPreorderEnabled(false);
      setPreorderQtyByServiceId({});

      if (!locationIdNum || !isFoodLocation) return;

      setPosTablesLoading(true);
      try {
        const [areas, mapped, reservations] = await Promise.all([
          fetchPosAreas(),
          fetchPosTables(),
          fetchMyTableReservations(),
        ]);
        if (!mapped) {
          setPosTablesError("Không thể tải danh sách bàn");
          return;
        }
        setPosAreas(areas ?? []);
        setPosTables(mapped);
        setTableReservations(reservations);
      } catch {
        setPosTablesError("Không thể tải danh sách bàn");
      } finally {
        setPosTablesLoading(false);
      }
    };
    void run();
  }, [isFoodLocation, locationIdNum]);

  useEffect(() => {
    if (!isFoodLocation || !autoSyncCheckIn) return;

    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const syncCurrentMinute = () => {
      const nextValue = getCurrentMinuteValue();
      setForm((prev) =>
        prev.checkInDate === nextValue
          ? prev
          : { ...prev, checkInDate: nextValue },
      );
    };

    syncCurrentMinute();

    const now = dayjs();
    const nextMinute = now.add(1, "minute").second(0).millisecond(0);
    const delay = Math.max(250, nextMinute.diff(now, "millisecond"));

    timeoutId = window.setTimeout(() => {
      syncCurrentMinute();
      intervalId = window.setInterval(syncCurrentMinute, 60 * 1000);
    }, delay);

    return () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [autoSyncCheckIn, isFoodLocation]);

  useEffect(() => {
    const isHotelFlow =
      location?.location_type === "hotel" ||
      location?.location_type === "resort";
    if (!isHotelFlow) return;

    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const syncCurrentMinute = () => {
      const nextValue = getCurrentMinuteValue();
      setForm((prev) =>
        prev.checkInDate === nextValue
          ? prev
          : { ...prev, checkInDate: nextValue },
      );
    };

    syncCurrentMinute();

    const now = dayjs();
    const nextMinute = now.add(1, "minute").second(0).millisecond(0);
    const delay = Math.max(250, nextMinute.diff(now, "millisecond"));

    timeoutId = window.setTimeout(() => {
      syncCurrentMinute();
      intervalId = window.setInterval(syncCurrentMinute, 60 * 1000);
    }, delay);

    return () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [location?.location_type]);

  const filteredPosTables = useMemo(() => {
    const base = [...posTables].sort((a, b) =>
      compareNaturalText(a.table_name, b.table_name),
    );
    if (selectedTableArea === "all") return base;
    const areaId = Number(selectedTableArea);
    if (!Number.isFinite(areaId)) return base;
    return base.filter((t) => Number(t.area_id) === areaId);
  }, [posTables, selectedTableArea]);

  const tableAreaOptions = useMemo(() => {
    return [
      { value: "all", label: "Tất cả" },
      ...posAreas.map((area) => ({
        value: String(area.area_id),
        label: area.area_name,
      })),
    ];
  }, [posAreas]);

  const appendHotelNotice = useCallback((notice: HotelBookingNotice) => {
    setHotelNotices((prev) => {
      const next = [notice, ...prev]
        .filter((n) => n && typeof n === "object")
        .slice(0, 30);
      writeHotelNotices(next);
      return next;
    });
  }, []);

  const appendIssuedTickets = useCallback((items: IssuedTicketBlock[]) => {
    if (!items.length) return;
    const existingList = readIssuedTickets();
    const existing = new Map(existingList.map((t) => [t.ticketCode, t]));
    for (const item of items) {
      if (!existing.has(item.ticketCode)) {
        existing.set(item.ticketCode, item);
      }
    }
    const next = Array.from(existing.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200);
    writeIssuedTickets(next);
  }, []);

  const updateHotelNotices = useCallback(
    (updater: (prev: HotelBookingNotice[]) => HotelBookingNotice[]) => {
      setHotelNotices((prev) => {
        const next = updater(prev);
        writeHotelNotices(next);
        return next;
      });
    },
    [],
  );

  // Restore hotel booking notices on refresh
  useEffect(() => {
    const cached = readHotelNotices();
    if (!cached.length) {
      setHotelNotices([]);
      return;
    }

    const now = Date.now();
    const filtered = cached.filter(
      (n) =>
        (n.expiresAt == null || now <= Number(n.expiresAt)) &&
        (n.paymentId == null || n.paymentStatus === "completed"),
    );

    if (filtered.length !== cached.length) {
      writeHotelNotices(filtered);
    }
    setHotelNotices(filtered);
  }, []);

  useEffect(() => {
    const hasExpiring = hotelNotices.some(
      (n) => n.expiresAt != null && Number.isFinite(Number(n.expiresAt)),
    );
    if (!hasExpiring) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      updateHotelNotices((prev) =>
        prev.filter((n) => n.expiresAt == null || now <= Number(n.expiresAt)),
      );
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hotelNotices, updateHotelNotices]);

  // Restore last table booking success on refresh (short TTL)
  useEffect(() => {
    const cached = readLastTableBookingSuccess();
    if (!cached) return;
    const ttlMs = 12 * 60 * 60 * 1000; // 12 hours
    if (Date.now() - cached.ts > ttlMs) {
      writeLastTableBookingSuccess(null);
      setTableSuccess(null);
      return;
    }
    if (locationIdNum && cached.locationId !== locationIdNum) return;
    setTableSuccess(cached);
  }, [locationIdNum]);


  // Restore last hotel batch booking on refresh (short TTL)
  useEffect(() => {
    const cached = readLastHotelBatchBooking();
    if (!cached) return;
    const ttlMs = 2 * 60 * 60 * 1000; // 2 hours
    if (Date.now() - cached.ts > ttlMs) {
      writeLastHotelBatchBooking(null);
      return;
    }
    if (locationIdNum && cached.locationId !== locationIdNum) return;

    // Only restore if this page context still matches
    setBatchResult(cached.result);
    setForm((prev) => ({
      ...prev,
      checkInDate: cached.checkInDate || prev.checkInDate,
    }));
    if (
      Array.isArray(cached.selectedRoomIds) &&
      cached.selectedRoomIds.length
    ) {
      setSelectedRoomIds(cached.selectedRoomIds);
    }
  }, [locationIdNum]);

  // Realtime: sync booking state and POS/menu changes with owner operations
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) return;

    const clearHotelSuccessIfMatch = (bookingId: number) => {
      updateHotelNotices((prev) => {
        const next = prev.filter(
          (n) =>
            !Array.isArray(n.bookingIds) || !n.bookingIds.includes(bookingId),
        );
        if (next.length !== prev.length) {
          if (
            hotelSuccessEditingNoticeId != null &&
            prev
              .find((n) => n.id === hotelSuccessEditingNoticeId)
              ?.bookingIds?.includes?.(bookingId)
          ) {
            setHotelSuccessEditingNoticeId(null);
            setHotelSuccessContactSaveError(null);
          }
        }
        return next;
      });

      const cached = readLastHotelBatchBooking();
      const cachedIds = cached?.result?.bookingIds;
      if (Array.isArray(cachedIds) && cachedIds.includes(bookingId)) {
        writeLastHotelBatchBooking(null);
        setBatchResult(null);
      }

      const currentBatch = latestBatchResultRef.current;
      if (currentBatch?.bookingIds?.includes?.(bookingId)) {
        writeLastHotelBatchBooking(null);
        setBatchResult(null);
      }

      const singleId = latestSingleBookingIdRef.current;
      if (singleId != null && singleId === bookingId) {
        setHideSingleSuccess(true);
      }

      setHotelRoomBatchPaymentMetaById((prev) => {
        const next: Record<number, HotelRoomBatchPaymentMeta> = {};
        for (const [k, meta] of Object.entries(prev)) {
          const hasBooking = Array.isArray(meta.bookingIds)
            ? meta.bookingIds.includes(bookingId)
            : false;
          if (!hasBooking) next[Number(k)] = meta;
        }
        return next;
      });
    };

    const clearTableSuccessIfMatch = (bookingId: number) => {
      const cached = readLastTableBookingSuccess();
      if (cached?.bookingId === bookingId) {
        writeLastTableBookingSuccess(null);
        setTableSuccess(null);
        // UX spec: after customer completes check-in, auto-reload
        setTimeout(() => {
          window.location.reload();
        }, 50);
      }
    };

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type?: string;
          booking_id?: number;
          location_id?: number;
        };
        if (data?.type === "booking_checked_in") {
          const bookingId = Number(data.booking_id);
          if (!Number.isFinite(bookingId) || bookingId <= 0) return;
          clearHotelSuccessIfMatch(bookingId);
          clearTableSuccessIfMatch(bookingId);
          if (isFoodLocation) {
            void fetchMyTableReservations().then((latest) => {
              setTableReservations(latest);
            });
            void fetchPosTables().then((latest) => {
              if (latest) setPosTables(latest);
            });
          }
          return;
        }

        if (
          data?.type === "booking_cancelled" ||
          data?.type === "booking_expired"
        ) {
          const bookingId = Number(data.booking_id);
          if (!Number.isFinite(bookingId) || bookingId <= 0) return;
          clearHotelSuccessIfMatch(bookingId);
          clearTableSuccessIfMatch(bookingId);
          return;
        }

        if (data?.type === "pos_updated") {
          if (Number(data.location_id) !== Number(locationIdNum)) return;
          if (isFoodLocation) {
            void fetchPosTables().then((latest) => {
              if (latest) setPosTables(latest);
            });
            void fetchMyTableReservations().then((latest) => {
              setTableReservations(latest);
            });
          }
          if (locationIdNum) {
            void locationApi
              .getLocationServices(locationIdNum)
              .then((svcRes) => {
                const raw = Array.isArray(svcRes.data) ? svcRes.data : [];
                const mapped: PublicServiceRow[] = raw
                  .map((r) => r as any)
                  .filter((r) => r && typeof r === "object")
                  .map((r) => ({
                    service_id: Number(r.service_id),
                    location_id: Number(r.location_id),
                    category_id:
                      r.category_id == null ? null : Number(r.category_id),
                    service_name: String(r.service_name || ""),
                    service_type: String(r.service_type || "other") as any,
                    price: r.price,
                    images: r.images,
                    category_name:
                      r.category_name == null ? null : String(r.category_name),
                    category_type:
                      r.category_type == null ? null : String(r.category_type),
                    category_sort_order:
                      r.category_sort_order == null
                        ? null
                        : Number(r.category_sort_order),
                    room_status:
                      r.room_status == null
                        ? null
                        : String(r.room_status || ""),
                  }))
                  .filter(
                    (r) => Number.isFinite(r.service_id) && r.service_name,
                  );
                setServices(mapped);
              });
          }
        }

        if (data?.type === "hotel_updated") {
          if (Number(data.location_id) !== Number(locationIdNum)) return;
          if (locationIdNum) {
            void locationApi
              .getLocationServices(locationIdNum)
              .then((svcRes) => {
                const raw = Array.isArray(svcRes.data) ? svcRes.data : [];
                const mapped: PublicServiceRow[] = raw
                  .map((r) => r as any)
                  .filter((r) => r && typeof r === "object")
                  .map((r) => ({
                    service_id: Number(r.service_id),
                    location_id: Number(r.location_id),
                    category_id:
                      r.category_id == null ? null : Number(r.category_id),
                    service_name: String(r.service_name || ""),
                    service_type: String(r.service_type || "other") as any,
                    price: r.price,
                    images: r.images,
                    category_name:
                      r.category_name == null ? null : String(r.category_name),
                    category_type:
                      r.category_type == null ? null : String(r.category_type),
                    category_sort_order:
                      r.category_sort_order == null
                        ? null
                        : Number(r.category_sort_order),
                    room_status:
                      r.room_status == null
                        ? null
                        : String(r.room_status || ""),
                  }))
                  .filter(
                    (r) => Number.isFinite(r.service_id) && r.service_name,
                  );

                setServices(mapped);

                // Keep only still-available room ids in current selection.
                const available = new Set(
                  mapped
                    .filter((s) => String(s.service_type) === "room")
                    .filter((s) => {
                      const st = String(s.room_status || "").toLowerCase();
                      return (
                        st !== "occupied" &&
                        st !== "reserved" &&
                        st !== "cleaning"
                      );
                    })
                    .map((s) => Number(s.service_id)),
                );
                setSelectedRoomIds((prev) =>
                  prev.filter((id) => available.has(Number(id))),
                );
              });
          }
          return;
        }
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
    };
  }, [
    fetchPosTables,
    isFoodLocation,
    locationIdNum,
    updateHotelNotices,
    hotelSuccessEditingNoticeId,
  ]);

  const handleChange = (field: keyof BookingFormState, value: string) => {
    if (field === "checkInDate" && !isHotelBooking) {
      setAutoSyncCheckIn(false);
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isHotelBooking =
    location?.location_type === "hotel" || location?.location_type === "resort";

  useEffect(() => {
    if (!isHotelBooking) return;
    setForm((prev) => ({ ...prev, serviceId: "" }));
  }, [isHotelBooking]);

  const selectedService = useMemo(() => {
    const sid = Number(form.serviceId || params.serviceId);
    if (!Number.isFinite(sid)) return null;
    return services.find((s) => Number(s.service_id) === sid) ?? null;
  }, [form.serviceId, params.serviceId, services]);

  const selectedServiceType = selectedService?.service_type ?? null;

  const isTicketBooking = isTouristLocation || selectedServiceType === "ticket";
  const isTableBooking = selectedServiceType === "table" || isFoodLocation;
  const isRoomBooking = selectedServiceType === "room" || isHotelBooking;

  const hotelStayDays = useMemo(() => {
    if (hotelStayPreset === "week") return 7;
    if (hotelStayPreset === "month") return 30;
    if (hotelStayPreset === "custom") {
      const d = Math.floor(Number(hotelCustomDays));
      return Number.isFinite(d) && d > 0 ? d : 1;
    }
    return 1;
  }, [hotelCustomDays, hotelStayPreset]);

  const hotelComputedCheckout = useMemo(() => {
    if (!isHotelBooking || !form.checkInDate) return "";
    const start = dayjs(form.checkInDate);
    if (!start.isValid()) return "";
    return start.add(hotelStayDays, "day").format("YYYY-MM-DDTHH:mm");
  }, [form.checkInDate, hotelStayDays, isHotelBooking]);

  useEffect(() => {
    if (!isHotelBooking) return;
    setForm((prev) => {
      const nextOut = hotelComputedCheckout;
      if (!nextOut || prev.checkOutDate === nextOut) return prev;
      return { ...prev, checkOutDate: nextOut };
    });
  }, [hotelComputedCheckout, isHotelBooking]);

  // Defaults: vé mặc định hôm nay; khách sạn/ăn uống mặc định thời gian hiện tại
  useEffect(() => {
    if (isTicketBooking) {
      if (!form.checkInDate) {
        setForm((prev) => ({
          ...prev,
          checkInDate: dayjs().format("YYYY-MM-DD"),
        }));
      }
      return;
    }

    if (isHotelBooking) {
      if (!form.checkInDate) {
        const now = dayjs().second(0).millisecond(0);
        setForm((prev) => ({
          ...prev,
          checkInDate: now.format("YYYY-MM-DDTHH:mm:ss"),
        }));
      }
      return;
    }

    if (isFoodLocation) {
      if (!form.checkInDate) {
        // include seconds so it's not considered "in the past" by strict now checks
        const now = dayjs().second(0).millisecond(0);
        setForm((prev) => ({
          ...prev,
          checkInDate: now.format("YYYY-MM-DDTHH:mm:ss"),
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTicketBooking, isHotelBooking, isFoodLocation]);

  const resolveTicketUseDate = (bookingId: number): string | null => {
    const fromForm = form.checkInDate ? String(form.checkInDate) : null;
    const candidates: unknown[] = [];

    if (Number((result as any)?.bookingId) === bookingId) {
      candidates.push((result as any)?.payment?.qrData);
    }

    for (const p of createdPayments) {
      if (Number((p as any)?.booking_id) === bookingId) {
        candidates.push((p as any)?.qr_data);
      }
    }

    for (const raw of candidates) {
      const parsed = parseQrData(raw);
      if (parsed && typeof parsed.use_date === "string") {
        return String(parsed.use_date);
      }
    }

    return fromForm;
  };

  const confirmTicketTransfer = async (bookingId: number) => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;
    setTicketConfirmError(null);
    setTicketConfirmLoading(true);
    try {
      const res = await bookingApi.confirmTicketTransfer(bookingId);
      if (!res?.success) {
        setTicketConfirmError(
          res?.message || "Không thể xác nhận chuyển khoản",
        );
        return;
      }
      const data = res.data as ConfirmTicketTransferResult;
      setTicketConfirmByBookingId((prev) => ({
        ...prev,
        [bookingId]: data,
      }));
      setCreatedPayments((prev) =>
        prev.map((p) =>
          Number((p as any)?.booking_id) === bookingId
            ? { ...p, status: "completed" }
            : p,
        ),
      );

      const locationId = Number(
        locationIdNum ?? (location as any)?.location_id ?? 0,
      );
      const locationName = String(location?.location_name || "").trim() || null;
      const useDate = resolveTicketUseDate(bookingId);

      if (Number.isFinite(locationId) && locationId > 0) {
        const now = Date.now();
        const issued = (data.issuedTickets || [])
          .map((t) => {
            const serviceId = Number(t.serviceId);
            const svc = services.find(
              (s) => Number(s.service_id) === serviceId,
            );
            const ticketCode = String(t.ticketCode || "").trim();
            return {
              id: `${now}_${Math.random().toString(16).slice(2)}`,
              ts: now,
              bookingId,
              ticketId: Number(t.ticketId),
              ticketCode,
              serviceId,
              serviceName: svc?.service_name ?? null,
              locationId,
              locationName,
              useDate: useDate ?? null,
            } as IssuedTicketBlock;
          })
          .filter((t) => t.ticketCode);
        appendIssuedTickets(issued);
      }

      window.setTimeout(() => {
        window.location.reload();
      }, 80);
    } catch (e) {
      setTicketConfirmError(
        getErrorMessage(e, "Không thể xác nhận chuyển khoản"),
      );
    } finally {
      setTicketConfirmLoading(false);
    }
  };

  const confirmTableTransfer = async (bookingId: number) => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;
    setFoodPrepayConfirmError(null);
    setFoodPrepayConfirmLoading(true);
    try {
      const res = await bookingApi.confirmTableTransfer(bookingId);
      if (!res?.success) {
        setFoodPrepayConfirmError(
          res?.message || "Không thể xác nhận thanh toán",
        );
        return;
      }
      setFoodPrepayPaid(true);
      setCreatedPayments((prev) =>
        prev.map((p) =>
          Number((p as any)?.booking_id) === bookingId
            ? { ...p, status: "completed" }
            : p,
        ),
      );

      const [latestTables, latestReservations] = await Promise.all([
        fetchPosTables(),
        fetchMyTableReservations(),
      ]);
      if (latestTables) setPosTables(latestTables);
      setTableReservations(latestReservations);
      setSelectedTableIds([]);
      setTimeout(() => {
        window.location.reload();
      }, 50);
    } catch (e) {
      setFoodPrepayConfirmError(
        getErrorMessage(e, "Không thể xác nhận thanh toán"),
      );
    } finally {
      setFoodPrepayConfirmLoading(false);
    }
  };

  const confirmRoomBatchTransfer = async (paymentIdRaw: number) => {
    const paymentId = Number(paymentIdRaw);
    if (!Number.isFinite(paymentId) || paymentId <= 0) return;

    const meta = hotelRoomBatchPaymentMetaById[paymentId];

    setRoomConfirmError(null);
    setRoomBatchConfirmLoading(true);
    try {
      const res = await bookingApi.confirmRoomBatchTransfer(paymentId);
      if (!res?.success) {
        setRoomConfirmError(res?.message || "Không thể xác nhận thanh toán");
        return;
      }

      if (meta && Array.isArray(meta.bookingIds) && meta.bookingIds.length) {
        appendHotelNotice({
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          ts: Date.now(),
          locationId: Number(locationIdNum || 0),
          locationName: meta.locationName,
          bookingIds: meta.bookingIds,
          contactName: meta.contactName,
          contactPhone: meta.contactPhone,
          checkInDate: meta.checkInDate,
          checkOutDate: meta.checkOutDate,
          roomNames: meta.roomNames,
          paymentId,
          paymentStatus: "completed",
          expiresAt: null,
        });
      }

      setCreatedPayments((prev) =>
        prev.map((p) =>
          Number((p as any)?.payment_id) === paymentId
            ? { ...p, status: "completed" }
            : p,
        ),
      );

      setHotelRoomBatchPaymentMetaById((prev) => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });

      // Reset UI to fresh booking state after successful payment confirmation.
      setBatchResult(null);
      setSelectedRoomIds([]);
      setCreatedPayments([]);
      setForm((prev) => ({
        ...prev,
        checkOutDate: "",
        notes: "",
        voucherCode: "",
      }));

      if (locationIdNum) {
        const svcRes = await locationApi.getLocationServices(locationIdNum);
        const raw = Array.isArray(svcRes.data) ? svcRes.data : [];
        const mapped: PublicServiceRow[] = raw
          .map((r) => r as any)
          .filter((r) => r && typeof r === "object")
          .map((r) => ({
            service_id: Number(r.service_id),
            location_id: Number(r.location_id),
            category_id: r.category_id == null ? null : Number(r.category_id),
            service_name: String(r.service_name || ""),
            service_type: String(r.service_type || "other") as any,
            price: r.price,
            images: r.images,
            category_name:
              r.category_name == null ? null : String(r.category_name),
            category_type:
              r.category_type == null ? null : String(r.category_type),
            category_sort_order:
              r.category_sort_order == null
                ? null
                : Number(r.category_sort_order),
            room_status:
              r.room_status == null ? null : String(r.room_status || ""),
          }))
          .filter((r) => Number.isFinite(r.service_id) && r.service_name);

        setServices(mapped);
      }
    } catch (e) {
      setRoomConfirmError(getErrorMessage(e, "Không thể xác nhận thanh toán"));
    } finally {
      setRoomBatchConfirmLoading(false);
    }
  };

  const hotelEditingNotice = useMemo(() => {
    if (!hotelSuccessEditingNoticeId) return null;
    return (
      hotelNotices.find((n) => n.id === hotelSuccessEditingNoticeId) ?? null
    );
  }, [hotelNotices, hotelSuccessEditingNoticeId]);

  const openHotelSuccessContactEditor = (notice: HotelBookingNotice) => {
    setHotelSuccessContactSaveError(null);
    setHotelSuccessContactDraftName(String(notice.contactName || "").trim());
    setHotelSuccessContactDraftPhone(String(notice.contactPhone || "").trim());
    setHotelSuccessEditingNoticeId(notice.id);
  };

  const saveHotelSuccessContact = async () => {
    if (!hotelEditingNotice || hotelEditingNotice.bookingIds.length === 0)
      return;

    const contactName = String(hotelSuccessContactDraftName || "").trim();
    const contactPhone = String(hotelSuccessContactDraftPhone || "").trim();

    setHotelSuccessContactSaveError(null);
    if (!contactName) {
      setHotelSuccessContactSaveError("Vui lòng nhập họ tên người đặt");
      return;
    }
    if (!isValidPersonName(contactName)) {
      setHotelSuccessContactSaveError("Họ tên không được chứa ký tự đặc biệt");
      return;
    }
    if (!contactPhone) {
      setHotelSuccessContactSaveError("Vui lòng nhập số điện thoại người đặt");
      return;
    }
    if (!isValidPhoneNumber(contactPhone)) {
      setHotelSuccessContactSaveError(
        "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
      );
      return;
    }

    setHotelSuccessContactSaveLoading(true);
    try {
      const res = await bookingApi.updateRoomBookingBatchContact(
        hotelEditingNotice.bookingIds,
        contactName,
        contactPhone,
      );
      if (!res?.success) {
        setHotelSuccessContactSaveError(
          res?.message || "Không thể cập nhật liên hệ",
        );
        return;
      }

      setForm((prev) => ({
        ...prev,
        contactName: res.data?.contactName ?? contactName,
        contactPhone: res.data?.contactPhone ?? contactPhone,
      }));

      updateHotelNotices((prev) =>
        prev.map((n) =>
          n.id === hotelEditingNotice.id
            ? {
                ...n,
                contactName: res.data?.contactName ?? contactName,
                contactPhone: res.data?.contactPhone ?? contactPhone,
              }
            : n,
        ),
      );

      setHotelSuccessEditingNoticeId(null);
    } catch (e) {
      setHotelSuccessContactSaveError(
        getErrorMessage(e, "Không thể cập nhật liên hệ"),
      );
    } finally {
      setHotelSuccessContactSaveLoading(false);
    }
  };

  const allowRoomPrepay = isRoomBooking;

  useEffect(() => {
    if (!allowRoomPrepay && prepayChoice !== "none") {
      setPrepayChoice("none");
      setCreatedPayments([]);
      setPaymentError(null);
    }
  }, [allowRoomPrepay, prepayChoice]);

  useEffect(() => {
    if (preorderEnabled) return;
    setPreorderQtyByServiceId({});
    setFoodPrepayBookingId(null);
    setFoodPrepayPaid(false);
    setFoodPrepayConfirmError(null);
    setCreatedPayments([]);
    setPaymentError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preorderEnabled]);

  const openClose = useMemo(() => {
    return extractOpenClose(location?.opening_hours ?? null, new Date());
  }, [location?.opening_hours]);

  const isOpenNow = useMemo(() => {
    return isWithinOpeningHours(location?.opening_hours ?? null, new Date());
  }, [location?.opening_hours]);

  const roomServices = useMemo(
    () => services.filter((s) => s.service_type === "room"),
    [services],
  );

  const ticketServices = useMemo(
    () => services.filter((s) => s.service_type === "ticket"),
    [services],
  );

  const selectedTicketItems = useMemo(() => {
    const rows = [] as Array<{
      service_id: number;
      service_name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }>;
    for (const s of ticketServices) {
      const sid = Number(s.service_id);
      const qty = ticketQtyByServiceId[sid] ?? 0;
      if (!Number.isFinite(sid) || qty <= 0) continue;
      const unit = Number(s.price || 0);
      rows.push({
        service_id: sid,
        service_name: s.service_name,
        unit_price: unit,
        quantity: qty,
        line_total: unit * qty,
      });
    }
    return rows;
  }, [ticketQtyByServiceId, ticketServices]);

  const ticketTotal = useMemo(() => {
    return selectedTicketItems.reduce((sum, it) => sum + it.line_total, 0);
  }, [selectedTicketItems]);

  useEffect(() => {
    if (!isTouristLocation) return;
    if (!serviceIdNum) return;
    const exists = ticketServices.some(
      (s) => Number(s.service_id) === Number(serviceIdNum),
    );
    if (!exists) return;

    setTicketQtyByServiceId((prev) => {
      if ((prev[Number(serviceIdNum)] ?? 0) > 0) return prev;
      return { ...prev, [Number(serviceIdNum)]: 1 };
    });
  }, [isTouristLocation, serviceIdNum, ticketServices]);

  const roomGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; sort: number; rooms: PublicServiceRow[] }
    >();
    for (const r of roomServices) {
      const key = String(r.category_name || "Khác");
      const sort = Number(r.category_sort_order ?? 999);
      const cur = map.get(key);
      if (cur) {
        cur.rooms.push(r);
      } else {
        map.set(key, { key, sort, rooms: [r] });
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        rooms: g.rooms
          .slice()
          .sort((a, b) => a.service_name.localeCompare(b.service_name)),
      }))
      .sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
  }, [roomServices]);

  const hotelCategoryOptions = useMemo(() => {
    return [
      { key: "all", label: "Tất cả phòng", count: roomServices.length },
      ...roomGroups.map((g) => ({
        key: g.key,
        label: g.key,
        count: g.rooms.length,
      })),
    ];
  }, [roomGroups, roomServices.length]);

  const selectedRooms = useMemo(() => {
    const selectedSet = new Set(selectedRoomIds);
    return roomServices.filter((r) => selectedSet.has(Number(r.service_id)));
  }, [roomServices, selectedRoomIds]);

  const selectedTotal = useMemo(() => {
    const hourly = selectedRooms.reduce(
      (sum, r) => sum + Number(r.price || 0),
      0,
    );
    if (isHotelBooking) {
      return hourly * hotelStayDays * 24;
    }
    return hourly;
  }, [hotelStayDays, isHotelBooking, selectedRooms]);

  const toggleRoom = (serviceId: number) => {
    setSelectedRoomIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((x) => x !== serviceId)
        : [...prev, serviceId],
    );
  };

  const toggleTable = (tableId: number) => {
    setSelectedTableIds((prev) =>
      prev.includes(tableId)
        ? prev.filter((x) => x !== tableId)
        : [...prev, tableId],
    );
  };

  const reservationByTableId = useMemo(() => {
    const map = new Map<number, TableReservationItem>();
    for (const reservation of tableReservations) {
      for (const tableId of reservation.tableIds) {
        if (!map.has(Number(tableId))) {
          map.set(Number(tableId), reservation);
        }
      }
    }
    return map;
  }, [tableReservations]);

  const selectedOwnedReservation = useMemo(() => {
    if (selectedTableIds.length !== 1) return null;
    return reservationByTableId.get(Number(selectedTableIds[0])) ?? null;
  }, [reservationByTableId, selectedTableIds]);

  const menuServices = useMemo(() => {
    return services
      .filter((s) =>
        ["food", "combo", "other"].includes(String(s.service_type)),
      )
      .sort((a, b) => {
        const sortA = Number(a.category_sort_order ?? 9999);
        const sortB = Number(b.category_sort_order ?? 9999);
        if (sortA !== sortB) return sortA - sortB;
        const categoryCompare = compareNaturalText(
          String(a.category_name || "Khác"),
          String(b.category_name || "Khác"),
        );
        if (categoryCompare !== 0) return categoryCompare;
        return compareNaturalText(a.service_name, b.service_name);
      });
  }, [services]);

  const preorderCategoryOptions = useMemo(() => {
    const categoryMap = new Map<string, { label: string; sort: number }>();
    for (const service of menuServices) {
      const label = String(service.category_name || "Khác").trim() || "Khác";
      if (!categoryMap.has(label)) {
        categoryMap.set(label, {
          label,
          sort: Number(service.category_sort_order ?? 9999),
        });
      }
    }

    return [
      { key: "all", label: "Tất cả sản phẩm", sort: -1 },
      ...Array.from(categoryMap.entries())
        .map(([key, value]) => ({ key, label: value.label, sort: value.sort }))
        .sort(
          (a, b) => a.sort - b.sort || compareNaturalText(a.label, b.label),
        ),
    ];
  }, [menuServices]);

  const filteredMenuServices = useMemo(() => {
    if (selectedMenuCategory === "all") return menuServices;
    return menuServices.filter(
      (service) =>
        String(service.category_name || "Khác") === selectedMenuCategory,
    );
  }, [menuServices, selectedMenuCategory]);

  const preorderTotal = useMemo(() => {
    if (!preorderEnabled) return 0;
    const priceMap = new Map<number, number>();
    for (const s of menuServices) {
      const raw = Number(s.price ?? 0);
      const price = Number.isFinite(raw) ? raw : 0;
      priceMap.set(Number(s.service_id), price);
    }
    let total = 0;
    for (const [sidStr, qty] of Object.entries(preorderQtyByServiceId)) {
      const sid = Number(sidStr);
      if (!Number.isFinite(sid) || qty <= 0) continue;
      const price = priceMap.get(sid) ?? 0;
      total += (Number.isFinite(price) ? price : 0) * qty;
    }
    return Number.isFinite(total) ? total : 0;
  }, [menuServices, preorderEnabled, preorderQtyByServiceId]);

  const selectedPreorderItems = useMemo(() => {
    return menuServices
      .map((service) => {
        const serviceId = Number(service.service_id);
        const quantity = Number(preorderQtyByServiceId[serviceId] ?? 0);
        const unitPrice = Number(service.price || 0);
        if (!Number.isFinite(serviceId) || quantity <= 0) return null;
        return {
          service_id: serviceId,
          service_name: service.service_name,
          quantity,
          unit_price: unitPrice,
          line_total: unitPrice * quantity,
        };
      })
      .filter(Boolean) as Array<{
      service_id: number;
      service_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }>;
  }, [menuServices, preorderQtyByServiceId]);

  const hasFoodPreorderSelection = useMemo(() => {
    if (!preorderEnabled) return false;
    for (const qty of Object.values(preorderQtyByServiceId)) {
      if (Number(qty) > 0) return true;
    }
    return false;
  }, [preorderEnabled, preorderQtyByServiceId]);

  const bookingNotes = useMemo(() => {
    if (isFoodLocation || isTableBooking) {
      return [
        "1/ Khi đặt bàn nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.",
        "2/ Khách có thể tới nhận bàn trong khoảng ± 1 giờ so với giờ đã đặt.",
        "3/ Quý khách có thể đặt món trước nhưng phải thanh toán trước qua hình thức chuyển khoản.",
        "4/ Quý khách có thể đặt trước tối đa 3 ngày.",
        "5/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.",
      ];
    }

    if (isHotelBooking || isRoomBooking) {
      return [
        "1/ Khi đặt phòng nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.",
        "2/ Khách có thể tới nhận phòng trong khoảng ± 1 giờ so với giờ đã đặt.",
        "3/ Quý khách có thể đặt phòng trước nhưng phải thanh toán trước qua hình thức chuyển khoản.",
        "4/ Quý khách có thể đặt trước tối đa 3 ngày.",
        "5/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.",
      ];
    }

    if (isTouristLocation || isTicketBooking) {
      return [
        "1/ Vé quý khách mua chỉ có hạn dùng trong ngày đặt mua và hết hạn khi tới giờ đóng cửa",
        "2/ Khi đặt vé vui lòng thanh toán trước bằng hình thức chuyển khoản.",
        "3/ Quý khách có thể đặt trước tối đa 3 ngày.",
        "4/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.",
      ];
    }

    return [];
  }, [
    isFoodLocation,
    isHotelBooking,
    isRoomBooking,
    isTableBooking,
    isTicketBooking,
    isTouristLocation,
  ]);


  const cancelTableReservation = async (bookingId: number) => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;

    setTableReservationsLoading(true);
    setFormError(null);
    try {
      const res = await bookingApi.cancelTableBooking(bookingId);
      if (!res.success) {
        setFormError(res.message || "Không thể hủy đặt bàn");
        return;
      }

      const [latestTables, latestReservations] = await Promise.all([
        fetchPosTables(),
        fetchMyTableReservations(),
      ]);
      if (latestTables) setPosTables(latestTables);
      setTableReservations(latestReservations);
    } catch (error) {
      setFormError(getErrorMessage(error, "Không thể hủy đặt bàn"));
    } finally {
      setTableReservationsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    setBatchError(null);
    setBatchResult(null);

    const keepFoodPrepayState =
      isFoodLocation && preorderEnabled && foodPrepayBookingId != null;
    if (!keepFoodPrepayState) {
      setPaymentError(null);
      setCreatedPayments([]);
    }
    writeLastHotelBatchBooking(null);

    if (!locationIdNum || !form.checkInDate) {
      setFormError("Vui lòng chọn địa điểm và thời gian");
      return;
    }

    // Client-side limit: today + 3 days
    const now = dayjs();
    const nowFloorMinute = now.second(0).millisecond(0).toDate();
    const startOfToday = new Date(now.year(), now.month(), now.date());
    const maxEnd = new Date(startOfToday);
    maxEnd.setDate(maxEnd.getDate() + 4);
    maxEnd.setMilliseconds(maxEnd.getMilliseconds() - 1);

    const inDate = new Date(form.checkInDate);
    if (Number.isNaN(inDate.getTime())) {
      setFormError("Thời gian không hợp lệ");
      return;
    }

    if (isTicketBooking) {
      const useDay = new Date(
        inDate.getFullYear(),
        inDate.getMonth(),
        inDate.getDate(),
      );
      if (useDay < startOfToday) {
        setFormError("Ngày sử dụng vé không hợp lệ");
        return;
      }
      if (useDay.getTime() > maxEnd.getTime()) {
        setFormError("Chỉ được mua vé trước tối đa 3 ngày");
        return;
      }
    } else {
      if (inDate.getTime() < nowFloorMinute.getTime()) {
        setFormError("Vui lòng chọn thời gian tới trong tương lai");
        return;
      }
      if (inDate.getTime() > maxEnd.getTime()) {
        setFormError("Chỉ được đặt trước tối đa 3 ngày");
        return;
      }
    }

    if (isHotelBooking) {
      if (selectedRoomIds.length === 0) {
        setFormError("Vui lòng chọn ít nhất 1 phòng");
        return;
      }

      const contactName = String(form.contactName || "").trim();
      const contactPhone = String(form.contactPhone || "").trim();
      if (!contactName) {
        setFormError("Vui lòng nhập họ tên người đặt");
        return;
      }
      if (!isValidPersonName(contactName)) {
        setFormError("Họ tên không được chứa ký tự đặc biệt");
        return;
      }
      if (!contactPhone) {
        setFormError("Vui lòng nhập số điện thoại người đặt");
        return;
      }
      if (!isValidPhoneNumber(contactPhone)) {
        setFormError(
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
        );
        return;
      }

      const computedCheckout = hotelComputedCheckout;
      if (!computedCheckout) {
        setFormError("Không thể tính thời gian trả phòng");
        return;
      }

      setBatchLoading(true);
      try {
        const payload: CreateBookingBatchPayload = {
          location_id: Number(locationIdNum),
          service_ids: selectedRoomIds,
          check_in_date: form.checkInDate,
          check_out_date: computedCheckout,
          notes: null,
          source: "web",
          reserve_on_confirm: prepayChoice === "transfer" ? true : undefined,
        };
        const res = await bookingApi.createBookingBatch(payload);

        const makeNoticeBase = (): HotelBookingNotice => ({
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          ts: Date.now(),
          locationId: Number(locationIdNum),
          locationName: String(location?.location_name || "").trim() || null,
          bookingIds: Array.from(
            new Set(
              (res.data.bookingIds || [])
                .map((x) => Number(x))
                .filter((x) => Number.isFinite(x) && x > 0),
            ),
          ),
          contactName,
          contactPhone,
          checkInDate: form.checkInDate,
          checkOutDate: computedCheckout,
          roomNames: selectedRooms.map((r) => r.service_name),
          paymentId: null,
          paymentStatus: null,
          expiresAt: null,
        });

        if (prepayChoice === "transfer") {
          try {
            const payRes = await bookingApi.createOrGetPaymentForBookingBatch(
              res.data.bookingIds || [],
            );
            const payments: any[] = payRes?.data ? [payRes.data] : [];
            const paymentId = Number(payRes?.data?.payment_id || 0);
            if (!Number.isFinite(paymentId) || paymentId <= 0) {
              throw new Error("payment_id không hợp lệ");
            }

            writeLastHotelBatchBooking(null);
            setCreatedPayments(payments);
            setHotelRoomBatchPaymentMetaById((prev) => ({
              ...prev,
              [paymentId]: {
                bookingIds: Array.from(
                  new Set(
                    (res.data.bookingIds || [])
                      .map((x) => Number(x))
                      .filter((x) => Number.isFinite(x) && x > 0),
                  ),
                ),
                locationName:
                  String(location?.location_name || "").trim() || null,
                contactName,
                contactPhone,
                checkInDate: form.checkInDate,
                checkOutDate: computedCheckout,
                roomNames: selectedRooms.map((r) => r.service_name),
              },
            }));
            setBatchResult(null);
            setPaymentError(null);
            setRoomConfirmError(null);
          } catch (e) {
            // Booking may already be created; do not mask success just because payment QR failed.
            setPaymentError(getErrorMessage(e, "Không thể tạo QR thanh toán"));
            setBatchResult(res.data);
            appendHotelNotice(makeNoticeBase());
            writeLastHotelBatchBooking({
              ts: Date.now(),
              locationId: Number(locationIdNum),
              checkInDate: form.checkInDate,
              selectedRoomIds: selectedRoomIds.slice(),
              result: res.data,
            });
          }
        } else {
          setBatchResult(res.data);
          appendHotelNotice(makeNoticeBase());
          writeLastHotelBatchBooking({
            ts: Date.now(),
            locationId: Number(locationIdNum),
            checkInDate: form.checkInDate,
            selectedRoomIds: selectedRoomIds.slice(),
            result: res.data,
          });
        }
      } catch (e: any) {
        setBatchError(getErrorMessage(e, "Không thể tạo booking"));
      } finally {
        setBatchLoading(false);
      }

      return;
    }

    if (isFoodLocation) {
      const preorderItems = preorderEnabled
        ? Object.entries(preorderQtyByServiceId)
            .map(([sid, qty]) => ({
              service_id: Number(sid),
              quantity: Number(qty),
            }))
            .filter(
              (x) =>
                Number.isFinite(x.service_id) &&
                x.service_id > 0 &&
                Number.isFinite(x.quantity) &&
                x.quantity > 0,
            )
        : [];

      if (selectedOwnedReservation) {
        if (!selectedOwnedReservation.canPreorder) {
          setFormError("Bàn đã đặt này không còn hỗ trợ đặt món trước");
          return;
        }
        if (!preorderEnabled || preorderItems.length === 0) {
          setFormError("Vui lòng chọn món trước cho bàn đã đặt");
          return;
        }

        try {
          await bookingApi.attachTablePreorder(
            selectedOwnedReservation.bookingId,
            preorderItems,
          );
          setFoodPrepayBookingId(selectedOwnedReservation.bookingId);
          const payRes = await bookingApi.createOrGetPaymentForBooking(
            selectedOwnedReservation.bookingId,
          );
          setCreatedPayments([payRes.data]);
          const [latestTables, latestReservations] = await Promise.all([
            fetchPosTables(),
            fetchMyTableReservations(),
          ]);
          if (latestTables) setPosTables(latestTables);
          setTableReservations(latestReservations);
          return;
        } catch (error) {
          setFormError(
            getErrorMessage(error, "Không thể cập nhật món đặt trước"),
          );
          return;
        }
      }

      // Food locations: booking = table reservation (multi-table) + optional preorder
      // Refresh tables right before submit to reduce stale conflicts.
      setPosTablesLoading(true);
      const latest = await fetchPosTables();
      setPosTablesLoading(false);
      if (latest) {
        setPosTables(latest);
        const byId = new Map(latest.map((t) => [t.table_id, t] as const));
        const conflict = selectedTableIds
          .map((id) => byId.get(id))
          .filter((t): t is PosTableRow => t != null && t.status !== "free");
        if (conflict.length > 0) {
          const details = conflict
            .map(
              (t) =>
                `${t.table_name} (${t.status === "reserved" ? "đã được giữ chỗ" : "đang có khách"})`,
            )
            .join(", ");
          setSelectedTableIds((prev) =>
            prev.filter((id) => (byId.get(id)?.status ?? "free") === "free"),
          );
          setFormError(
            `Có bàn vừa được cập nhật trạng thái: ${details}. Vui lòng chọn bàn khác.`,
          );
          return;
        }
      }

      if (selectedTableIds.length === 0) {
        setFormError("Vui lòng chọn ít nhất 1 bàn");
        return;
      }

      const contactName = String(form.contactName || "").trim();
      const contactPhone = String(form.contactPhone || "").trim();
      if (!contactName) {
        setFormError("Vui lòng nhập họ tên");
        return;
      }
      if (!isValidPersonName(contactName)) {
        setFormError("Họ tên không được chứa ký tự đặc biệt");
        return;
      }
      if (!contactPhone) {
        setFormError("Vui lòng nhập số điện thoại");
        return;
      }
      if (!isValidPhoneNumber(contactPhone)) {
        setFormError(
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
        );
        return;
      }

      const payload: CreateBookingPayload = {
        location_id: Number(locationIdNum),
        check_in_date: form.checkInDate,
        check_out_date: null,
        quantity: selectedTableIds.length,
        contact_name: contactName,
        contact_phone: contactPhone,
        notes: form.notes || null,
        voucher_code: null,
        source: "web",
        table_ids: selectedTableIds,
        preorder_items: preorderItems.length ? preorderItems : undefined,
        reserve_on_confirm: preorderItems.length > 0 ? true : undefined,
      };

      const hasPreorder = preorderItems.length > 0;
      if (hasPreorder && selectedTableIds.length !== 1) {
        setFormError("Đặt món trước chỉ áp dụng khi bạn chọn đúng 1 bàn");
        return;
      }
      if (!hasPreorder) {
        const created = await createBooking(payload);
        if (created) {
          const [latestTables, latestReservations] = await Promise.all([
            fetchPosTables(),
            fetchMyTableReservations(),
          ]);
          if (latestTables) setPosTables(latestTables);
          setTableReservations(latestReservations);
          setSelectedTableIds([]);
          setPreorderEnabled(false);
          setPreorderQtyByServiceId({});
          setFoodPrepayBookingId(null);
          setFoodPrepayPaid(false);
          setFoodPrepayConfirmError(null);
        }
        return;
      }

      // Step 1: generate VietQR (create booking + payment)
      if (foodPrepayBookingId == null) {
        setFoodPrepayPaid(false);
        setFoodPrepayConfirmError(null);
        setPaymentError(null);
        setCreatedPayments([]);

        suppressNextAutoShowSuccessRef.current = true;
        setHideSingleSuccess(true);

        const created = await createBooking(payload);
        if (!created) return;

        setFoodPrepayBookingId(created.bookingId);
        try {
          const payRes = await bookingApi.createOrGetPaymentForBooking(
            created.bookingId,
          );
          setCreatedPayments([payRes.data]);
        } catch (e: any) {
          setPaymentError(getErrorMessage(e, "Không thể tạo payment"));
        }
        return;
      }

      // Step 2: must confirm payment first
      if (!foodPrepayPaid) {
        setFormError(
          "Vui lòng bấm “Xác nhận đã thanh toán” sau khi chuyển khoản",
        );
        return;
      }

      // After payment confirmation we auto-reload, and restore success panel
      // from sessionStorage. Nothing else to do here.
      return;
    }

    if (isTouristLocation) {
      if (selectedTicketItems.length === 0) {
        setFormError("Vui lòng chọn ít nhất 1 loại vé và số lượng");
        return;
      }

      const payload: CreateBookingPayload = {
        location_id: Number(locationIdNum),
        check_in_date: form.checkInDate,
        check_out_date: null,
        quantity: selectedTicketItems.reduce((sum, it) => sum + it.quantity, 0),
        notes: form.notes || null,
        voucher_code: form.voucherCode || null,
        source: "web",
        ticket_items: selectedTicketItems.map((it) => ({
          service_id: it.service_id,
          quantity: it.quantity,
        })),
      };

      await createBooking(payload);
      return;
    }

    if (!form.serviceId) {
      setFormError("Vui lòng chọn dịch vụ");
      return;
    }

    if (isTableBooking && prepayChoice !== "none") {
      setPrepayChoice("none");
    }

    const payload: CreateBookingPayload = {
      location_id: Number(locationIdNum),
      service_id: Number(form.serviceId),
      check_in_date: form.checkInDate,
      check_out_date:
        isTicketBooking || isTableBooking || selectedServiceType === "room"
          ? null
          : form.checkOutDate || null,
      quantity: isTableBooking ? 1 : Number(form.quantity || 1),
      notes:
        isHotelBooking || selectedServiceType === "room"
          ? null
          : form.notes || null,
      voucher_code: form.voucherCode || null,
      source: "web",
      reserve_on_confirm:
        prepayChoice === "transfer" && selectedServiceType === "room"
          ? true
          : undefined,
    };

    const created = await createBooking(payload);
    if (
      created &&
      prepayChoice === "transfer" &&
      selectedServiceType === "room"
    ) {
      try {
        const payRes = await bookingApi.createOrGetPaymentForBooking(
          created.bookingId,
        );
        setCreatedPayments([payRes.data]);
      } catch (e: any) {
        setPaymentError(getErrorMessage(e, "Không thể tạo payment"));
      }
    }
  };

  const maxAdvanceDay = useMemo(() => dayjs().add(3, "day").endOf("day"), []);

  return (
    <ConfigProvider locale={viVN}>
      <UserLayout title="Đặt chỗ" activeKey="/user/dashboard">
        <section className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold">
                Đặt chỗ
              </p>
              <h2 className="text-2xl font-semibold text-gray-900">
                Xác nhận thông tin booking
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isTouristLocation || isTicketBooking ? (
                <button
                  type="button"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    const target = Number.isFinite(Number(locationIdNum))
                      ? `/user/tickets?locationId=${Number(locationIdNum)}`
                      : "/user/tickets";
                    navigate(target);
                  }}
                >
                  Giỏ vé
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => navigate(-1)}
              >
                Quay lại
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6 mt-6">
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Địa điểm
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {location?.location_name ||
                        (locationIdNum
                          ? `Location #${locationIdNum}`
                          : "Chưa chọn")}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {location?.address || ""}
                    </p>
                  </div>
                </div>

                {servicesError ? (
                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {servicesError}
                  </div>
                ) : null}
              </div>

              <div
                className={
                  "grid grid-cols-1 gap-4 " +
                  (isTicketBooking || isTableBooking || isHotelBooking
                    ? "sm:grid-cols-2"
                    : "")
                }
              >
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isTicketBooking
                      ? "Ngày sử dụng"
                      : isTableBooking
                        ? "Thời gian tới"
                        : isRoomBooking
                          ? "Thời gian đến"
                          : "Ngày check-in"}
                  </label>
                  {isTicketBooking ? (
                    <DatePicker
                      className="mt-2 w-full"
                      value={form.checkInDate ? dayjs(form.checkInDate) : null}
                      format="DD-MM-YYYY"
                      placeholder="Chọn ngày"
                      disabledDate={(current) => {
                        if (!current) return false;
                        return (
                          current.isBefore(dayjs().startOf("day")) ||
                          current.isAfter(maxAdvanceDay)
                        );
                      }}
                      onChange={(d) =>
                        handleChange(
                          "checkInDate",
                          d ? d.format("YYYY-MM-DD") : "",
                        )
                      }
                    />
                  ) : (
                    <DatePicker
                      className="mt-2 w-full"
                      value={form.checkInDate ? dayjs(form.checkInDate) : null}
                      format="DD-MM-YYYY HH:mm"
                      showTime={{ format: "HH:mm", use12Hours: false }}
                      placeholder="Chọn ngày giờ"
                      disabledDate={(current) => {
                        if (!current) return false;
                        return (
                          current.isBefore(dayjs().startOf("day")) ||
                          current.isAfter(maxAdvanceDay)
                        );
                      }}
                      disabledTime={(current) => {
                        if (!current) return {};
                        if (!(isHotelBooking || isFoodLocation)) return {};

                        const now = dayjs();
                        if (!current.isSame(now, "day")) return {};

                        const curHour = now.hour();
                        const curMinute = now.minute();
                        return {
                          disabledHours: () =>
                            Array.from({ length: curHour }, (_, i) => i),
                          disabledMinutes: (selectedHour: number) => {
                            if (selectedHour !== curHour) return [];
                            return Array.from(
                              { length: curMinute },
                              (_, i) => i,
                            );
                          },
                        };
                      }}
                      onChange={(d) =>
                        handleChange(
                          "checkInDate",
                          d ? d.format("YYYY-MM-DDTHH:mm") : "",
                        )
                      }
                    />
                  )}

                  {form.checkInDate &&
                  (!isHotelBooking || selectedRoomIds.length > 0) ? (
                    <div className="mt-1 text-xs text-gray-500">
                      Đã chọn: {formatDisplayDateTime(form.checkInDate)}
                      {!isTicketBooking
                        ? (() => {
                            const d = new Date(form.checkInDate);
                            if (Number.isNaN(d.getTime())) return null;

                            const from = new Date(d);
                            from.setHours(from.getHours() - 1);
                            const to = new Date(d);
                            to.setHours(to.getHours() + 1);

                            const fmt = (x: Date) => {
                              const dd = String(x.getDate()).padStart(2, "0");
                              const mm = String(x.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const yyyy = String(x.getFullYear());
                              const hh = String(x.getHours()).padStart(2, "0");
                              const min = String(x.getMinutes()).padStart(
                                2,
                                "0",
                              );
                              return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
                            };

                            return (
                              <div className="mt-1">
                                Khung đến: {fmt(from)} – {fmt(to)}
                              </div>
                            );
                          })()
                        : null}
                    </div>
                  ) : null}
                </div>

                {isTicketBooking || isTableBooking || isHotelBooking ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Hạn sử dụng
                    </label>
                    <div className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                      {isTicketBooking
                        ? (() => {
                            const d = new Date(form.checkInDate);
                            if (
                              Number.isNaN(d.getTime()) ||
                              !location?.opening_hours
                            )
                              return "Trong ngày";
                            const oc = extractOpenClose(
                              location.opening_hours,
                              d,
                            );
                            if (!oc) return "Trong ngày";
                            return `Trong ngày · hết hạn lúc ${oc.close}`;
                          })()
                        : "Trễ hơn 1 tiếng tự hủy"}
                    </div>
                  </div>
                ) : null}
              </div>

              {isFoodLocation ? (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Họ tên
                      </label>
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                        value={form.contactName}
                        onChange={(e) =>
                          handleChange("contactName", e.target.value)
                        }
                        placeholder="Nhập họ tên"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Số điện thoại
                      </label>
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                        value={form.contactPhone}
                        onChange={(e) =>
                          handleChange("contactPhone", e.target.value)
                        }
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        Chọn bàn
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Chọn 1 hoặc nhiều bàn. Bàn đã có khách sẽ không chọn
                        được.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-600">Khu:</span>
                        {tableAreaOptions.map((option) => {
                          const active = selectedTableArea === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSelectedTableArea(option.value)}
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition " +
                                (active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-sm text-gray-700">
                        Đã chọn: <b>{selectedTableIds.length}</b> bàn
                      </div>
                    </div>
                  </div>

                  {posTablesError ? (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {posTablesError}
                    </div>
                  ) : null}

                  {posTablesLoading ? (
                    <div className="text-sm text-gray-500 mt-3">
                      Đang tải bàn...
                    </div>
                  ) : filteredPosTables.length === 0 ? (
                    <div className="text-sm text-gray-500 mt-3">
                      Chưa có bàn trong khu đã chọn.
                    </div>
                  ) : (
                    <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredPosTables.map((t) => {
                          const ownedReservation = reservationByTableId.get(
                            Number(t.table_id),
                          );
                          const selected = selectedTableIds.includes(
                            Number(t.table_id),
                          );
                          const disabled =
                            t.status === "occupied" ||
                            (t.status === "reserved" && !ownedReservation);
                          const statusLabel =
                            t.status === "occupied"
                              ? "Có khách"
                              : ownedReservation
                                ? "Bạn đã đặt"
                                : t.status === "reserved"
                                  ? "Đã giữ chỗ"
                                  : selected
                                    ? "Đã chọn"
                                    : "Trống";

                          const statusClass =
                            t.status === "occupied"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : ownedReservation || t.status === "reserved"
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : selected
                                  ? "bg-blue-50 border-blue-200 text-blue-700"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-700";
                          return (
                            <button
                              key={t.table_id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleTable(Number(t.table_id))}
                              className={
                                "text-left rounded-2xl border p-3 transition " +
                                (disabled
                                  ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                                  : ownedReservation
                                    ? "border-amber-400 bg-amber-50 hover:shadow-sm"
                                    : selected
                                      ? "border-blue-400 bg-blue-50 hover:shadow-sm"
                                      : "border-gray-100 bg-white hover:shadow-sm")
                              }
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold truncate">
                                  {t.table_name}
                                </p>
                                <span
                                  className={
                                    "text-[11px] px-2 py-0.5 rounded-full border " +
                                    (disabled
                                      ? "bg-gray-200 text-gray-600 border-gray-200"
                                      : statusClass)
                                  }
                                >
                                  {statusLabel}
                                </span>
                              </div>
                              {ownedReservation ? (
                                <p className="mt-2 text-[11px] text-amber-700">
                                  {[
                                    ownedReservation.contactName,
                                    ownedReservation.contactPhone,
                                  ]
                                    .filter(Boolean)
                                    .join(" • ") ||
                                    `Nhận bàn lúc ${formatDisplayDateTime(
                                      ownedReservation.checkInDate,
                                    )}`}
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl border border-gray-100 p-4">
                    <label className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={preorderEnabled}
                        onChange={(e) => setPreorderEnabled(e.target.checked)}
                      />
                      Đặt món trước (bắt buộc chuyển khoản)
                    </label>

                    {preorderEnabled ? (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600">
                          Chọn danh mục, món và số lượng:
                        </div>
                        {menuServices.length === 0 ? (
                          <div className="text-sm text-gray-500 mt-2">
                            Chưa có menu.
                          </div>
                        ) : (
                          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-slate-50">
                              <div className="border-b border-gray-100 px-4 py-3">
                                <div className="text-sm font-semibold text-blue-800">
                                  Danh mục
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Chọn để lọc
                                </div>
                              </div>
                              <div className="space-y-2 p-3">
                                {preorderCategoryOptions.map((category) => {
                                  const active =
                                    selectedMenuCategory === category.key;
                                  return (
                                    <button
                                      key={category.key}
                                      type="button"
                                      onClick={() =>
                                        setSelectedMenuCategory(category.key)
                                      }
                                      className={
                                        "w-full rounded-2xl border px-4 py-3 text-sm font-medium transition " +
                                        (active
                                          ? "border-blue-600 bg-blue-600 text-white"
                                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                                      }
                                    >
                                      {category.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                              {filteredMenuServices.map((s) => {
                                const sid = Number(s.service_id);
                                const qty = preorderQtyByServiceId[sid] ?? 0;
                                const imgs = parseImages(s.images);
                                const img = resolveBackendUrl(imgs[0]);
                                return (
                                  <div
                                    key={s.service_id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2"
                                  >
                                    <div className="min-w-0 flex items-center gap-3">
                                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                        {img ? (
                                          <img
                                            src={img}
                                            alt={s.service_name}
                                            className="h-10 w-10 object-cover"
                                            loading="lazy"
                                          />
                                        ) : null}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-gray-900">
                                          {s.service_name}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          {Number(s.price || 0).toLocaleString(
                                            "vi-VN",
                                          )}
                                          đ
                                        </div>
                                      </div>
                                    </div>
                                    <input
                                      type="number"
                                      min={0}
                                      className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                                      value={qty}
                                      onChange={(e) => {
                                        const next = Number(
                                          e.target.value || 0,
                                        );
                                        setPreorderQtyByServiceId((prev) => ({
                                          ...prev,
                                          [sid]:
                                            Number.isFinite(next) && next > 0
                                              ? Math.trunc(next)
                                              : 0,
                                        }));
                                      }}
                                    />
                                  </div>
                                );
                              })}

                              {filteredMenuServices.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                                  Chưa có sản phẩm trong danh mục này.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : !isHotelBooking ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isTouristLocation ? (
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-gray-700">
                        Vé du lịch
                      </label>
                      {ticketServices.length === 0 ? (
                        <div className="mt-2 text-sm text-gray-500">
                          Chưa có loại vé khả dụng.
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {ticketServices.map((s) => {
                            const sid = Number(s.service_id);
                            const qty = ticketQtyByServiceId[sid] ?? 0;
                            const imgs = parseImages(s.images);
                            const img = resolveBackendUrl(imgs[0]);
                            return (
                              <div
                                key={s.service_id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2"
                              >
                                <div className="min-w-0 flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                                    {img ? (
                                      <img
                                        src={img}
                                        alt={s.service_name}
                                        className="h-10 w-10 object-cover"
                                        loading="lazy"
                                      />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {s.service_name}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {Number(s.price || 0).toLocaleString(
                                        "vi-VN",
                                      )}
                                      đ
                                    </div>
                                  </div>
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                                  value={qty}
                                  onChange={(e) => {
                                    const next = Number(e.target.value || 0);
                                    setTicketQtyByServiceId((prev) => ({
                                      ...prev,
                                      [sid]:
                                        Number.isFinite(next) && next > 0
                                          ? Math.trunc(next)
                                          : 0,
                                    }));
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 text-sm text-gray-800">
                        Tổng tiền vé:{" "}
                        <b>{ticketTotal.toLocaleString("vi-VN")}</b>đ
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Sau khi mua vé sẽ hiển thị QR chuyển khoản.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Dịch vụ
                        </label>
                        <select
                          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                          value={form.serviceId}
                          onChange={(event) =>
                            handleChange("serviceId", event.target.value)
                          }
                          disabled={servicesLoading}
                        >
                          <option value="">-- Chọn dịch vụ --</option>
                          {(services.some((s) =>
                            ["room", "table", "ticket"].includes(
                              s.service_type,
                            ),
                          )
                            ? services.filter((s) =>
                                ["room", "table", "ticket"].includes(
                                  s.service_type,
                                ),
                              )
                            : services
                          ).map((s) => (
                            <option
                              key={s.service_id}
                              value={String(s.service_id)}
                            >
                              {s.service_name} ({s.service_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">
                          Số lượng
                        </label>
                        <input
                          type="number"
                          min="1"
                          disabled={isTableBooking}
                          className={
                            "mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm " +
                            (isTableBooking ? "bg-gray-50 text-gray-500" : "")
                          }
                          value={isTableBooking ? "1" : form.quantity}
                          onChange={(event) =>
                            handleChange("quantity", event.target.value)
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Họ tên người đặt
                      </label>
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                        value={form.contactName}
                        onChange={(e) =>
                          handleChange("contactName", e.target.value)
                        }
                        placeholder="Nhập họ tên"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Số điện thoại
                      </label>
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                        value={form.contactPhone}
                        onChange={(e) =>
                          handleChange("contactPhone", e.target.value)
                        }
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4 mb-4">
                    <div className="text-sm font-semibold text-gray-900">
                      Thời gian lưu trú
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { value: "day", label: "1 ngày" },
                        { value: "week", label: "1 tuần" },
                        { value: "month", label: "1 tháng" },
                        { value: "custom", label: "Tùy chọn" },
                      ].map((opt) => {
                        const active = hotelStayPreset === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setHotelStayPreset(
                                opt.value as typeof hotelStayPreset,
                              )
                            }
                            className={
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                              (active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                            }
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {hotelStayPreset === "custom" ? (
                      <div className="mt-3">
                        <label className="text-xs text-gray-600">
                          Số ngày ở
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                          value={hotelCustomDays}
                          onChange={(e) =>
                            setHotelCustomDays(
                              Math.max(
                                1,
                                Math.floor(Number(e.target.value || 1)),
                              ),
                            )
                          }
                        />
                      </div>
                    ) : null}

                    <div className="mt-3 text-xs text-gray-600">
                      Thời gian dự kiến:{" "}
                      <b>{formatDisplayDateTime(hotelComputedCheckout)}</b>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        Chọn phòng
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Chọn nhiều phòng, nhiều danh mục rồi bấm “Đặt phòng”.
                      </p>
                    </div>
                    <div className="text-sm text-gray-700">
                      Đã chọn: <b>{selectedRoomIds.length}</b> phòng
                    </div>
                  </div>

                  {servicesLoading ? (
                    <div className="text-sm text-gray-500 mt-3">
                      Đang tải phòng...
                    </div>
                  ) : roomGroups.length === 0 ? (
                    <div className="text-sm text-gray-500 mt-3">
                      Chưa có phòng khả dụng.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-wrap gap-2">
                        {hotelCategoryOptions.map((c) => {
                          const active = selectedHotelCategory === c.key;
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setSelectedHotelCategory(c.key)}
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition " +
                                (active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                              }
                            >
                              {c.label} ({c.count})
                            </button>
                          );
                        })}
                      </div>

                      {roomGroups
                        .filter(
                          (g) =>
                            selectedHotelCategory === "all" ||
                            g.key === selectedHotelCategory,
                        )
                        .map((g) => (
                          <div key={g.key}>
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-semibold text-gray-800">
                                {g.key}
                              </h5>
                              <span className="text-xs text-gray-500">
                                {g.rooms.length} phòng
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                              {g.rooms.map((r) => {
                                const imgs = parseImages(r.images);
                                const img = resolveBackendUrl(imgs[0]);
                                const selected = selectedRoomIds.includes(
                                  Number(r.service_id),
                                );
                                const roomStatus = String(
                                  (r.room_status || "").toLowerCase(),
                                );
                                const disabled =
                                  roomStatus === "occupied" ||
                                  roomStatus === "reserved" ||
                                  roomStatus === "cleaning";
                                const statusLabel =
                                  roomStatus === "occupied"
                                    ? "Có khách"
                                    : roomStatus === "reserved"
                                      ? "Đã đặt"
                                      : roomStatus === "cleaning"
                                        ? "Đang dọn"
                                        : selected
                                          ? "Đã chọn"
                                          : "Chọn";

                                const statusTone = (() => {
                                  if (selected)
                                    return {
                                      card: "border-blue-400 bg-blue-50 hover:shadow-sm",
                                      pill: "bg-blue-600 text-white",
                                    };
                                  if (roomStatus === "occupied")
                                    return {
                                      card: "border-red-200 bg-red-50 cursor-not-allowed",
                                      pill: "bg-red-600 text-white",
                                    };
                                  if (roomStatus === "reserved")
                                    return {
                                      card: "border-amber-200 bg-amber-50 cursor-not-allowed",
                                      pill: "bg-amber-600 text-white",
                                    };
                                  if (roomStatus === "cleaning")
                                    return {
                                      card: "border-purple-200 bg-purple-50 cursor-not-allowed",
                                      pill: "bg-purple-600 text-white",
                                    };
                                  return {
                                    card: "border-gray-100 bg-white hover:shadow-sm",
                                    pill: "bg-gray-100 text-gray-700",
                                  };
                                })();
                                return (
                                  <button
                                    key={r.service_id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                      if (disabled) return;
                                      toggleRoom(Number(r.service_id));
                                    }}
                                    className={
                                      "text-left rounded-2xl border p-3 transition " +
                                      statusTone.card +
                                      (disabled ? " opacity-85" : "")
                                    }
                                  >
                                    <div className="flex gap-3">
                                      <div className="h-14 w-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                                        {img ? (
                                          <img
                                            src={img}
                                            alt={r.service_name}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : null}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-gray-900 truncate">
                                            {r.service_name}
                                          </p>
                                          <span
                                            className={
                                              "text-[11px] px-2 py-0.5 rounded-full " +
                                              statusTone.pill
                                            }
                                          >
                                            {statusLabel}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">
                                          {Number(r.price || 0).toLocaleString(
                                            "vi-VN",
                                          )}
                                          đ / giờ
                                        </p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {!isHotelBooking ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Ghi chú
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                    rows={4}
                    value={form.notes}
                    onChange={(event) =>
                      handleChange("notes", event.target.value)
                    }
                  />
                </div>
              ) : null}

              {formError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {formError}
                </div>
              ) : null}

              {batchError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {batchError}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              {paymentError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {paymentError}
                </div>
              ) : null}

              {allowRoomPrepay && (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="text-base font-semibold text-gray-900">
                    Thanh toán trước
                  </h4>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="prepay"
                        checked={prepayChoice === "none"}
                        onChange={() => {
                          setPrepayChoice("none");
                          setCreatedPayments([]);
                          setPaymentError(null);
                        }}
                      />
                      Không thanh toán trước
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="prepay"
                        checked={prepayChoice === "transfer"}
                        onChange={() => {
                          setPrepayChoice("transfer");
                          setPaymentError(null);
                        }}
                      />
                      Chuyển khoản (VietQR)
                    </label>
                  </div>
                </div>
              )}

              {isTicketBooking ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Bắt buộc chuyển khoản</p>
                  <p className="mt-1">
                    Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy
                    thì tiền không được hoàn lại.
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
                onClick={handleSubmit}
                disabled={
                  loading ||
                  batchLoading ||
                  !isOpenNow ||
                  (isFoodLocation &&
                    hasFoodPreorderSelection &&
                    foodPrepayBookingId != null &&
                    !foodPrepayPaid)
                }
              >
                {loading || batchLoading
                  ? "Đang tạo booking..."
                  : isHotelBooking
                    ? "Đặt phòng"
                    : isFoodLocation &&
                        hasFoodPreorderSelection &&
                        foodPrepayBookingId == null
                      ? "Thanh toán"
                      : "Xác nhận đặt chỗ"}
              </button>

              {!isOpenNow ? (
                <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Đang đóng cửa
                  {openClose ? ` (${openClose.open} - ${openClose.close})` : ""}
                  .
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 p-4">
                <h4 className="text-base font-semibold text-gray-900">Lưu ý</h4>
                <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc list-inside">
                  {bookingNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>

              {isHotelBooking &&
              hotelNotices.filter(
                (n) =>
                  (!locationIdNum || n.locationId === locationIdNum) &&
                  (n.paymentId == null || n.paymentStatus === "completed"),
              ).length ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {hotelNotices
                    .filter(
                      (n) =>
                        (!locationIdNum || n.locationId === locationIdNum) &&
                        (n.paymentId == null ||
                          n.paymentStatus === "completed"),
                    )
                    .map((notice) => {
                      const editing =
                        hotelSuccessEditingNoticeId === String(notice.id);
                      const canEditContact =
                        notice.paymentId == null ||
                        notice.paymentStatus === "completed";
                      return (
                        <div
                          key={String(notice.id)}
                          className="rounded-2xl border border-green-100 bg-green-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-base font-semibold text-green-700">
                              Đã đặt thành công tại {notice.locationName || "-"}
                            </h4>
                            {editing ? (
                              <button
                                type="button"
                                className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setHotelSuccessEditingNoticeId(null);
                                  setHotelSuccessContactSaveError(null);
                                }}
                              >
                                Hủy
                              </button>
                            ) : canEditContact ? (
                              <button
                                type="button"
                                className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                                onClick={() =>
                                  openHotelSuccessContactEditor(notice)
                                }
                              >
                                Sửa liên hệ
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-2 space-y-1 text-sm text-green-800">
                            <div>
                              Liên lạc: <b>{notice.contactName || "-"}</b> -{" "}
                              <b>{notice.contactPhone || "-"}</b>
                            </div>
                            <div>
                              Tên phòng:{" "}
                              <b>{notice.roomNames.join(", ") || "-"}</b>
                            </div>
                            <div>
                              Thời gian tới:{" "}
                              <b>{formatDisplayDateTime(notice.checkInDate)}</b>
                            </div>
                            <div>
                              Thời gian lưu trú:{" "}
                              <b>{formatDisplayDateTime(notice.checkInDate)}</b>
                              {" - "}
                              <b>
                                {formatDisplayDateTime(notice.checkOutDate)}
                              </b>
                            </div>
                            {notice.paymentId != null ? (
                              <div>
                                Trạng thái thanh toán:{" "}
                                <b>
                                  {notice.paymentStatus === "completed"
                                    ? "Đã xác nhận"
                                    : "Đang chờ xác nhận"}
                                </b>
                              </div>
                            ) : null}
                          </div>

                          {editing ? (
                            <div className="mt-3 rounded-xl border border-green-200 bg-white p-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-gray-700">
                                    Họ tên người đặt
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    value={hotelSuccessContactDraftName}
                                    onChange={(e) =>
                                      setHotelSuccessContactDraftName(
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Nhập họ tên"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-700">
                                    Số điện thoại
                                  </label>
                                  <input
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    value={hotelSuccessContactDraftPhone}
                                    onChange={(e) =>
                                      setHotelSuccessContactDraftPhone(
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Nhập số điện thoại"
                                  />
                                </div>
                              </div>

                              {hotelSuccessContactSaveError ? (
                                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                                  {hotelSuccessContactSaveError}
                                </div>
                              ) : null}

                              <div className="mt-3 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                  onClick={saveHotelSuccessContact}
                                  disabled={hotelSuccessContactSaveLoading}
                                >
                                  {hotelSuccessContactSaveLoading
                                    ? "Đang lưu..."
                                    : "Lưu"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              ) : null}

              {isFoodLocation && preorderEnabled ? (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="text-base font-semibold text-gray-900">
                    Tóm tắt đặt món trước
                  </h4>
                  {selectedPreorderItems.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">
                      Chưa chọn món. Bạn vẫn có thể đặt chỗ, hệ thống sẽ không
                      lưu hóa đơn gọi món trước.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedPreorderItems.map((item) => (
                        <div
                          key={item.service_id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">
                              {item.service_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatMoney(item.unit_price)} x {item.quantity}
                            </div>
                          </div>
                          <div className="font-semibold text-gray-900">
                            {formatMoney(item.line_total)}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-end justify-between gap-3 border-t pt-3 text-sm">
                        <div className="text-gray-600">
                          Số món: <b>{selectedPreorderItems.length}</b> • Tổng
                          SL:{" "}
                          <b>
                            {selectedPreorderItems.reduce(
                              (sum, item) => sum + item.quantity,
                              0,
                            )}
                          </b>
                        </div>
                        <div className="text-base font-bold text-gray-900">
                          {formatMoney(preorderTotal)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {isFoodLocation && tableReservations.length > 0 ? (
                <div className="space-y-3">
                  {tableReservations.map((reservation) => (
                    <div
                      key={reservation.bookingId}
                      className="rounded-2xl border border-amber-100 bg-amber-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h4 className="text-base font-semibold text-amber-800">
                            {`Đặt chỗ ${reservation.tableNames.join(", ")} thành công`}
                          </h4>
                          <p className="text-sm text-amber-800 mt-2">
                            {[
                              reservation.locationName,
                              formatDisplayDateTime(reservation.checkInDate),
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                          <p className="text-xs text-amber-700 mt-2">
                            {[reservation.contactName, reservation.contactPhone]
                              .filter(Boolean)
                              .join(" • ") ||
                              "Thông báo này sẽ tự mất khi booking check-in hoặc hết hạn."}
                          </p>
                        </div>
                        {reservation.canCancel ? (
                          <button
                            type="button"
                            onClick={() =>
                              void cancelTableReservation(reservation.bookingId)
                            }
                            disabled={tableReservationsLoading}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Hủy bàn này
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (result && !hideSingleSuccess) || tableSuccess ? (
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <h4 className="text-base font-semibold text-green-700">
                    {(() => {
                      const locName =
                        String(location?.location_name || "").trim() ||
                        String(tableSuccess?.locationName || "").trim();
                      if (isFoodLocation || isTableBooking) {
                        return locName
                          ? `Đặt chỗ ${locName} thành công`
                          : "Đặt chỗ thành công";
                      }
                      return "Đặt chỗ thành công";
                    })()}
                  </h4>
                  <p className="text-sm text-green-700 mt-2">
                    {isTouristLocation && selectedTicketItems.length > 0
                      ? `Vé: ${selectedTicketItems
                          .map((it) => `${it.service_name} x${it.quantity}`)
                          .join(", ")}`
                      : isFoodLocation || isTableBooking
                        ? `Địa điểm: ${String(location?.location_name || "").trim() || String(tableSuccess?.locationName || "").trim() || "-"}`
                        : selectedService?.service_name
                          ? `Dịch vụ: ${selectedService.service_name}`
                          : "Đặt chỗ thành công."}
                  </p>

                  {tableSuccess ? (
                    <p className="text-xs text-green-800 mt-2">
                      Đặt bàn thành công. Thông báo này sẽ tự mất sau khi bạn
                      check-in.
                    </p>
                  ) : null}

                  {!tableSuccess && result?.payment
                    ? (() => {
                        const qr = parseQrData((result as any).payment?.qrData);
                        if (!qr) return null;

                        const qrImg = buildVietQrImageUrl({
                          bankName: String(qr.bank_name || ""),
                          bankAccount: String(qr.bank_account || ""),
                          accountHolder: String(qr.account_holder || ""),
                          amount: Number(qr.amount || 0),
                          addInfo: String(qr.content || ""),
                          template: "compact2",
                        });
                        return (
                          <div className="mt-4 rounded-xl border border-green-200 bg-white p-3 text-sm text-green-800">
                            <p className="font-semibold">
                              Thông tin chuyển khoản
                            </p>

                            {qrImg.url ? (
                              <div className="mt-3 flex items-start gap-4 flex-wrap">
                                <div className="shrink-0 rounded-xl border bg-slate-50 p-2">
                                  <img
                                    src={qrImg.url}
                                    alt="VietQR"
                                    className="h-44 w-44 rounded-lg"
                                    loading="lazy"
                                  />
                                </div>
                                <div className="min-w-[220px] flex-1">
                                  <p className="mt-0">
                                    Ngân hàng: {String(qr.bank_name || "")}
                                  </p>
                                  <p>
                                    Số tài khoản:{" "}
                                    {String(qr.bank_account || "")}
                                  </p>
                                  <p>
                                    Chủ TK: {String(qr.account_holder || "")}
                                  </p>
                                  <p>
                                    Số tiền:{" "}
                                    {Number(qr.amount || 0).toLocaleString(
                                      "vi-VN",
                                    )}
                                    đ
                                  </p>
                                  <p>Nội dung: {String(qr.content || "")}</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="mt-2">
                                  Ngân hàng: {String(qr.bank_name || "")}
                                </p>
                                <p>
                                  Số tài khoản: {String(qr.bank_account || "")}
                                </p>
                                <p>Chủ TK: {String(qr.account_holder || "")}</p>
                                <p>
                                  Số tiền:{" "}
                                  {Number(qr.amount || 0).toLocaleString(
                                    "vi-VN",
                                  )}
                                  đ
                                </p>
                                <p>Nội dung: {String(qr.content || "")}</p>
                                {qrImg.error ? (
                                  <p className="mt-2 text-xs text-amber-700">
                                    {qrImg.error}
                                  </p>
                                ) : null}
                              </>
                            )}
                            {isTicketBooking ? (
                              <>
                                <p className="mt-1 text-xs text-gray-600">
                                  Sau khi chuyển khoản, vui lòng bấm “Xác nhận
                                  đã chuyển khoản” để nhận vé.
                                </p>
                                {(() => {
                                  const bookingId = Number(
                                    (result as any)?.bookingId,
                                  );
                                  if (
                                    !Number.isFinite(bookingId) ||
                                    bookingId <= 0
                                  )
                                    return null;
                                  const confirmData =
                                    ticketConfirmByBookingId[bookingId];
                                  const paymentStatus =
                                    confirmData?.paymentStatus ||
                                    String(
                                      (result as any)?.payment?.status ||
                                        "pending",
                                    );

                                  if (paymentStatus === "completed") {
                                    return (
                                      <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                                        <p className="font-semibold">
                                          Vé đã phát hành
                                        </p>
                                        <p className="mt-1 text-xs text-green-700">
                                          Vui lòng xem chi tiết trong Giỏ vé.
                                        </p>
                                        <button
                                          type="button"
                                          className="mt-2 w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                                          onClick={() => {
                                            const target = Number.isFinite(
                                              Number(locationIdNum),
                                            )
                                              ? `/user/tickets?locationId=${Number(locationIdNum)}`
                                              : "/user/tickets";
                                            navigate(target);
                                          }}
                                        >
                                          Mở giỏ vé
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <>
                                      <button
                                        type="button"
                                        className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                        onClick={() =>
                                          confirmTicketTransfer(bookingId)
                                        }
                                        disabled={ticketConfirmLoading}
                                      >
                                        {ticketConfirmLoading
                                          ? "Đang xác nhận..."
                                          : "Xác nhận đã chuyển khoản"}
                                      </button>
                                      {ticketConfirmError ? (
                                        <div className="mt-2 text-xs text-red-600">
                                          {ticketConfirmError}
                                        </div>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </>
                            ) : (
                              <p className="mt-1 text-xs text-gray-600">
                                Sau khi chuyển khoản, vui lòng chờ chủ địa điểm
                                xác nhận.
                              </p>
                            )}
                          </div>
                        );
                      })()
                    : null}
                </div>
              ) : null}

              {visibleCreatedPayments.length ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <h4 className="text-base font-semibold text-blue-700">
                    {isFoodLocation && hasFoodPreorderSelection
                      ? "Thanh toán món đặt trước"
                      : "Thanh toán (VietQR)"}
                  </h4>
                  <p className="text-sm text-blue-600 mt-2">
                    Đã tạo {visibleCreatedPayments.length} payment.
                  </p>
                  <div className="mt-3 space-y-3">
                    {visibleCreatedPayments.map((p, idx) => {
                      const qr = parseQrData((p as any)?.qr_data);
                      const qrImg = qr
                        ? buildVietQrImageUrl({
                            bankName: String(qr.bank_name || ""),
                            bankAccount: String(qr.bank_account || ""),
                            accountHolder: String(qr.account_holder || ""),
                            amount: Number(qr.amount || 0),
                            addInfo: String(qr.content || ""),
                            template: "compact2",
                          })
                        : {
                            url: null as string | null,
                            error: null as string | null,
                          };
                      return (
                        <div
                          key={String((p as any)?.payment_id || idx)}
                          className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-blue-900"
                        >
                          <p className="font-semibold">
                            Payment #{String((p as any)?.payment_id || "")}
                          </p>
                          {qr ? (
                            <>
                              {qrImg.url ? (
                                <div className="mt-3 flex items-start gap-4 flex-wrap">
                                  <div className="shrink-0 rounded-xl border bg-slate-50 p-2">
                                    <img
                                      src={qrImg.url}
                                      alt="VietQR"
                                      className="h-72 w-72 rounded-lg"
                                      loading="lazy"
                                    />
                                  </div>
                                  <div className="min-w-[220px] flex-1">
                                    <p className="mt-0">
                                      Ngân hàng: {String(qr.bank_name || "")}
                                    </p>
                                    <p>
                                      Số tài khoản:{" "}
                                      {String(qr.bank_account || "")}
                                    </p>
                                    <p>
                                      Chủ TK: {String(qr.account_holder || "")}
                                    </p>
                                    <p>
                                      Số tiền:{" "}
                                      {Number(qr.amount || 0).toLocaleString(
                                        "vi-VN",
                                      )}
                                      đ
                                    </p>
                                    <p>Nội dung: {String(qr.content || "")}</p>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="mt-2">
                                    Ngân hàng: {String(qr.bank_name || "")}
                                  </p>
                                  <p>
                                    Số tài khoản:{" "}
                                    {String(qr.bank_account || "")}
                                  </p>
                                  <p>
                                    Chủ TK: {String(qr.account_holder || "")}
                                  </p>
                                  <p>
                                    Số tiền:{" "}
                                    {Number(qr.amount || 0).toLocaleString(
                                      "vi-VN",
                                    )}
                                    đ
                                  </p>
                                  <p>Nội dung: {String(qr.content || "")}</p>
                                  {qrImg.error ? (
                                    <p className="mt-2 text-xs text-amber-700">
                                      {qrImg.error}
                                    </p>
                                  ) : null}
                                </>
                              )}
                            </>
                          ) : (
                            <p className="mt-2">
                              Không đọc được dữ liệu VietQR.
                            </p>
                          )}
                          {(() => {
                            const bookingId = Number((p as any)?.booking_id);
                            const paymentId = Number((p as any)?.payment_id);
                            const paymentStatus = String(
                              (p as any)?.status || "pending",
                            );
                            const isFoodPrepayPayment =
                              isFoodLocation &&
                              hasFoodPreorderSelection &&
                              foodPrepayBookingId != null &&
                              bookingId === foodPrepayBookingId;
                            const isHotelPendingPayment =
                              isHotelBooking &&
                              Number.isFinite(paymentId) &&
                              paymentId > 0 &&
                              Boolean(hotelRoomBatchPaymentMetaById[paymentId]);

                            return (
                              <>
                                <p className="mt-1 text-xs text-gray-600">
                                  {isTicketBooking
                                    ? "Sau khi chuyển khoản, vui lòng bấm “Xác nhận đã chuyển khoản” để nhận vé."
                                    : isFoodPrepayPayment
                                      ? "Sau khi chuyển khoản, vui lòng bấm “Xác nhận đã thanh toán” để hoàn tất đặt bàn. Trang sẽ tự tải lại và ẩn toàn bộ nội dung tạm của phiên đặt món này."
                                      : isHotelPendingPayment
                                        ? "Sau khi chuyển khoản, vui lòng bấm “Xác nhận đã chuyển khoản” để hoàn tất toàn bộ các phòng đã đặt."
                                        : "Sau khi chuyển khoản, vui lòng chờ chủ địa điểm xác nhận."}
                                </p>

                                {isTicketBooking
                                  ? (() => {
                                      if (
                                        !Number.isFinite(bookingId) ||
                                        bookingId <= 0
                                      )
                                        return null;
                                      const confirmData =
                                        ticketConfirmByBookingId[bookingId];
                                      const effectivePaymentStatus =
                                        confirmData?.paymentStatus ||
                                        paymentStatus;

                                      if (
                                        effectivePaymentStatus === "completed"
                                      ) {
                                        return (
                                          <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                                            <p className="font-semibold">
                                              Vé đã phát hành
                                            </p>
                                            <p className="mt-1 text-xs text-green-700">
                                              Vui lòng xem chi tiết trong Giỏ vé.
                                            </p>
                                            <button
                                              type="button"
                                              className="mt-2 w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                                              onClick={() => {
                                                const target = Number.isFinite(
                                                  Number(locationIdNum),
                                                )
                                                  ? `/user/tickets?locationId=${Number(locationIdNum)}`
                                                  : "/user/tickets";
                                                navigate(target);
                                              }}
                                            >
                                              Mở giỏ vé
                                            </button>
                                          </div>
                                        );
                                      }

                                      return (
                                        <>
                                          <button
                                            type="button"
                                            className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                            onClick={() =>
                                              confirmTicketTransfer(bookingId)
                                            }
                                            disabled={ticketConfirmLoading}
                                          >
                                            {ticketConfirmLoading
                                              ? "Đang xác nhận..."
                                              : "Xác nhận đã chuyển khoản"}
                                          </button>
                                          {ticketConfirmError ? (
                                            <div className="mt-2 text-xs text-red-600">
                                              {ticketConfirmError}
                                            </div>
                                          ) : null}
                                        </>
                                      );
                                    })()
                                  : isFoodPrepayPayment
                                    ? (() => {
                                        if (
                                          !Number.isFinite(bookingId) ||
                                          bookingId <= 0
                                        )
                                          return null;

                                        const paid =
                                          foodPrepayPaid ||
                                          paymentStatus === "completed";

                                        return (
                                          <>
                                            <button
                                              type="button"
                                              className={
                                                "mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60 " +
                                                (paid
                                                  ? "bg-gray-400"
                                                  : "bg-green-600 hover:bg-green-700")
                                              }
                                              onClick={() =>
                                                confirmTableTransfer(bookingId)
                                              }
                                              disabled={
                                                foodPrepayConfirmLoading || paid
                                              }
                                            >
                                              {foodPrepayConfirmLoading
                                                ? "Đang xác nhận..."
                                                : paid
                                                  ? "Đã xác nhận thanh toán"
                                                  : "Xác nhận đã thanh toán"}
                                            </button>
                                            {foodPrepayConfirmError ? (
                                              <div className="mt-2 text-xs text-red-600">
                                                {foodPrepayConfirmError}
                                              </div>
                                            ) : null}
                                          </>
                                        );
                                      })()
                                    : isHotelPendingPayment
                                      ? (() => {
                                          if (
                                            !Number.isFinite(paymentId) ||
                                            paymentId <= 0
                                          )
                                            return null;

                                          const alreadyConfirmed =
                                            paymentStatus === "completed";
                                          const confirming =
                                            roomBatchConfirmLoading;

                                          return (
                                            <>
                                              <button
                                                type="button"
                                                className={
                                                  "mt-3 w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60 " +
                                                  (alreadyConfirmed
                                                    ? "bg-gray-400"
                                                    : "bg-green-600 hover:bg-green-700")
                                                }
                                                onClick={() =>
                                                  confirmRoomBatchTransfer(
                                                    paymentId,
                                                  )
                                                }
                                                disabled={
                                                  confirming || alreadyConfirmed
                                                }
                                              >
                                                {confirming
                                                  ? "Đang xác nhận..."
                                                  : alreadyConfirmed
                                                    ? "Đã xác nhận thanh toán"
                                                    : "Xác nhận đã chuyển khoản"}
                                              </button>
                                              {roomConfirmError ? (
                                                <div className="mt-2 text-xs text-red-600">
                                                  {roomConfirmError}
                                                </div>
                                              ) : null}
                                            </>
                                          );
                                        })()
                                      : null}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {isHotelBooking ? (
                <div className="rounded-2xl border border-gray-100 p-4">
                  <h4 className="text-base font-semibold text-gray-900">
                    Phòng đã chọn
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Tổng: <b>{selectedRoomIds.length}</b> phòng ·{" "}
                    <b>{selectedTotal.toLocaleString("vi-VN")}đ</b>
                  </p>
                  {selectedRooms.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedRooms.map((r) => (
                        <div
                          key={String(r.service_id)}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {r.service_name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {String(r.category_name || "Khác")}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:text-red-700"
                            onClick={() => toggleRoom(Number(r.service_id))}
                          >
                            Bỏ
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-3">
                      Chưa chọn phòng
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </UserLayout>
    </ConfigProvider>
  );
};

export default BookingPage;
