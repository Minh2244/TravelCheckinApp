import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { FilterOutlined } from "@ant-design/icons";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type RoomRow = {
  room_id: number;
  floor_number: number;
  room_number: string;
  status: "vacant" | "occupied" | "reserved" | "cleaning";
  price?: number | null;
  images?: unknown;
  category_id?: number | null;
  category_name?: string | null;
  area_name?: string | null;
  stay_id?: number | null;
  stay_status?: string | null;
  checkin_time?: string | null;
  expected_checkin?: string | null;
  expected_checkout?: string | null;
  final_amount?: number | string | null;
  booking_id?: number | null;
  prepaid_payment_id?: number | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  notes?: string | null;
  booking_notes?: string | null;
  prepaid_amount?: number | null;
  prepaid_payment_method?: string | null;
};

// Recent payments panel removed

type HotelInvoice = {
  payment_id: number;
  location_name: string | null;
  owner_name: string | null;
  room_number: string | null;
  payment_time: string;
  checkin_time: string | null;
  checkout_time: string | null;
  room_unit_price: number;
  actual_minutes: number | null;
  overtime_hours: number;
  surcharge_amount: number;
  gross_amount?: number;
  prepaid_payment_method?: string | null;
  prepaid_amount?: number;
  onsite_amount?: number;
  total_amount: number;
};

type HotelTransferInit = {
  payment_id: number;
  qr: {
    qr_code_url: string;
    bank_name: string;
    bank_account: string;
    account_holder: string;
    bank_bin?: string;
    amount: number;
    note: string;
  };
  context: {
    location_name: string | null;
    owner_name: string | null;
    room_number: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    room_unit_price: number;
    actual_minutes: number;
    overtime_hours: number;
    surcharge_amount: number;
    gross_amount?: number;
    prepaid_payment_method?: string | null;
    prepaid_amount?: number;
    onsite_amount?: number;
    total_amount: number;
  };
};

type HotelPayContext = HotelTransferInit["context"];

type HotelCashPreview = {
  stay_id: number;
  room_number: string | null;
  context: HotelPayContext;
};

type HotelTransferBatchRoom = {
  stay_id: number;
  room_number: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  room_unit_price: number;
  actual_minutes: number;
  overtime_hours: number;
  surcharge_amount: number;
  gross_amount?: number;
  prepaid_payment_method?: string | null;
  prepaid_amount?: number;
  onsite_amount?: number;
  total_amount: number;
};

type HotelTransferBatchInit = {
  payment_id: number;
  qr: HotelTransferInit["qr"];
  context: {
    location_name: string | null;
    owner_name: string | null;
    rooms: HotelTransferBatchRoom[];
    total_amount: number;
  };
};

type HotelTransferBatchInvoice = {
  payment_id: number;
  payment_time: string;
  location_name: string | null;
  owner_name: string | null;
  rooms: HotelTransferBatchRoom[];
  total_amount: number;
};

const statusMeta = (s: string) => {
  if (s === "vacant") return { label: "TRỐNG", color: "green" };
  if (s === "occupied") return { label: "ĐANG Ở", color: "red" };
  if (s === "reserved") return { label: "ĐÃ ĐẶT", color: "volcano" };
  if (s === "cleaning") return { label: "DỌN DẸP", color: "default" };
  return { label: String(s).toUpperCase(), color: "default" };
};

const normalizeImages = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }
  return [];
};

export default function FrontOfficeHotel(props: {
  locationId: number;
  floors: number[];
  role: "owner" | "employee";
}) {
  const { locationId, floors, role } = props;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [floor, setFloor] = useState<string>("all");
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  const [categoryKey, setCategoryKey] = useState<string>("all");
  const [roomQuery, setRoomQuery] = useState<string>("");
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Recent payments panel removed

  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // State for hotel check-in flow
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [selectedCheckoutRoomIds, setSelectedCheckoutRoomIds] = useState<
    number[]
  >([]);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);

  const selectedCheckoutRoomIdsRef = useRef<number[]>([]);
  useEffect(() => {
    selectedCheckoutRoomIdsRef.current = selectedCheckoutRoomIds;
  }, [selectedCheckoutRoomIds]);

  const [stayPreset, setStayPreset] = useState<
    "day" | "week" | "month" | "custom"
  >("day");
  const [customDays, setCustomDays] = useState<number>(1);

  const [checkoutMethod, setCheckoutMethod] = useState<"cash" | "transfer">(
    "cash",
  );

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendStayId, setExtendStayId] = useState<number | null>(null);
  const [extendPreset, setExtendPreset] = useState<
    "day" | "week" | "month" | "custom"
  >("day");
  const [extendCustomDays, setExtendCustomDays] = useState<number>(1);
  const [extendSubmitting, setExtendSubmitting] = useState(false);

  const [checkoutSelectionSnapshot, setCheckoutSelectionSnapshot] = useState<
    number[] | null
  >(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [transferInit, setTransferInit] = useState<HotelTransferInit | null>(
    null,
  );
  const [transferBatchInit, setTransferBatchInit] =
    useState<HotelTransferBatchInit | null>(null);
  const [batchInvoice, setBatchInvoice] =
    useState<HotelTransferBatchInvoice | null>(null);
  const [cashPreview, setCashPreview] = useState<HotelCashPreview[]>([]);
  const [invoices, setInvoices] = useState<HotelInvoice[]>([]);
  const [payRooms, setPayRooms] = useState<RoomRow[]>([]);

  const payTitle = useMemo(() => {
    if (checkoutMethod === "cash") return "Thanh toán tiền mặt";
    return "Thanh toán chuyển khoản";
  }, [checkoutMethod]);

  const paySubTitle = useMemo(() => {
    const roomsLabel = payRooms.map((r) => r.room_number).join(", ");
    return roomsLabel ? `Phòng: ${roomsLabel}` : "";
  }, [payRooms]);

  const renderRoomBillDetails = (row: {
    checkin_time?: string | null;
    checkout_time?: string | null;
    room_unit_price?: number | null;
    actual_minutes?: number | null;
    surcharge_amount?: number | null;
    gross_amount?: number | null;
    prepaid_payment_method?: string | null;
    prepaid_amount?: number | null;
    onsite_amount?: number | null;
    total_amount?: number | null;
  }) => {
    const grossAmount = Number(row.gross_amount ?? row.total_amount ?? 0);
    const prepaidAmount = Number(row.prepaid_amount || 0);
    const onsiteAmount = Number(row.onsite_amount ?? row.total_amount ?? 0);
    const hasPrepaidBreakdown = prepaidAmount > 0;

    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div className="text-gray-500">Nhận phòng</div>
        <div className="text-right font-medium">
          {row.checkin_time ? formatDateTimeVN(row.checkin_time) : "-"}
        </div>

        <div className="text-gray-500">Trả phòng</div>
        <div className="text-right font-medium">
          {row.checkout_time ? formatDateTimeVN(row.checkout_time) : "-"}
        </div>

        <div className="text-gray-500">Giá/giờ</div>
        <div className="text-right font-semibold">
          {formatMoney(Number(row.room_unit_price || 0))}
        </div>

        <div className="text-gray-500">Thời gian</div>
        <div className="text-right font-semibold">
          {formatDurationMinutes(Number(row.actual_minutes || 0))}
        </div>

        <div className="text-gray-500">Phụ thu</div>
        <div className="text-right font-semibold">
          {formatMoney(Number(row.surcharge_amount || 0))}
        </div>

        {hasPrepaidBreakdown ? (
          <>
            <div className="text-gray-500">Tổng lưu trú</div>
            <div className="text-right font-semibold">
              {formatMoney(grossAmount)}
            </div>

            <div className="text-gray-500">Đã trả trước</div>
            <div className="text-right font-semibold text-green-700">
              -{formatMoney(prepaidAmount)}
              {row.prepaid_payment_method
                ? ` (${row.prepaid_payment_method})`
                : ""}
            </div>
          </>
        ) : null}

        <div className="text-gray-500">Cần thanh toán</div>
        <div className="text-right text-base font-bold text-gray-800">
          {formatMoney(onsiteAmount)}
        </div>
      </div>
    );
  };

  const renderInvoice = (inv: HotelInvoice) => (
    <div className="mx-auto max-w-[520px]">
      <div className="rounded-3xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-2xl font-semibold">Hóa đơn</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {formatDateTimeVN(inv.payment_time)}
            </div>
          </div>
          <div className="rounded-full border bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-700">
            #{inv.payment_id}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-base font-semibold text-blue-800">
            {inv.location_name || "-"}
          </div>
          <div className="text-xs text-gray-500">
            Owner: {inv.owner_name || "-"}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border bg-slate-50 px-4 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Phòng</span>
            <span className="font-semibold">{inv.room_number || "-"}</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white px-4 py-3">
          {renderRoomBillDetails(inv)}
        </div>
      </div>
    </div>
  );

  const lastActiveRoomIdRef = useRef<number | null>(null);

  const stayHours = useMemo(() => {
    if (stayPreset === "day") return 24;
    if (stayPreset === "week") return 24 * 7;
    if (stayPreset === "month") return 24 * 30;
    const d = Math.floor(Number(customDays));
    return Number.isFinite(d) && d > 0 ? d * 24 : 24;
  }, [customDays, stayPreset]);

  const selectedReservedBookingSeed = useMemo(() => {
    if (selectedRoomIds.length === 0) return null;
    const selectedSet = new Set(selectedRoomIds.map((x) => Number(x)));
    return (
      rooms
        .filter((r) => selectedSet.has(Number(r.room_id)))
        .find(
          (r) =>
            r.status === "reserved" &&
            r.booking_id != null &&
            Number(r.booking_id) > 0,
        ) || null
    );
  }, [rooms, selectedRoomIds]);

  const autoStayHoursFromBooking = useMemo(() => {
    if (!selectedReservedBookingSeed) return null;
    const inTime = selectedReservedBookingSeed.expected_checkin
      ? new Date(String(selectedReservedBookingSeed.expected_checkin))
      : null;
    const outTime = selectedReservedBookingSeed.expected_checkout
      ? new Date(String(selectedReservedBookingSeed.expected_checkout))
      : null;
    if (
      !inTime ||
      !outTime ||
      !Number.isFinite(inTime.getTime()) ||
      !Number.isFinite(outTime.getTime())
    ) {
      return null;
    }
    const diffHours = Math.max(
      1,
      Math.ceil((outTime.getTime() - inTime.getTime()) / (60 * 60 * 1000)),
    );
    return Number.isFinite(diffHours) && diffHours > 0 ? diffHours : null;
  }, [selectedReservedBookingSeed]);

  const lockStayDurationByBooking = useMemo(() => {
    return autoStayHoursFromBooking != null;
  }, [autoStayHoursFromBooking]);

  const effectiveStayHours = useMemo(() => {
    return autoStayHoursFromBooking ?? stayHours;
  }, [autoStayHoursFromBooking, stayHours]);

  const stayDays = useMemo(() => {
    return Math.max(1, Math.ceil(effectiveStayHours / 24));
  }, [effectiveStayHours]);

  const expectedCheckoutPreview = useMemo(() => {
    const hours = effectiveStayHours;
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return formatDateTimeVi(end);
  }, [effectiveStayHours]);

  const floorOptions = useMemo((): Array<{ label: string; value: string }> => {
    const all = [{ label: "Tất cả", value: "all" }];
    const f = floors.map((x) => ({ label: `Tầng ${x}`, value: String(x) }));
    return [...all, ...f];
  }, [floors]);

  const load = useCallback(
    async (selectedFloor: string) => {
      setLoading(true);
      try {
        const res = await ownerApi.getHotelRooms({
          location_id: locationId,
          floor: selectedFloor,
        });
        const raw = (res?.data || []) as unknown[];
        const mapped: RoomRow[] = raw
          .map((item) => {
            const r = asRecord(item);
            return {
              room_id: Number(r.room_id),
              floor_number: Number(r.floor_number || 0),
              room_number: String(r.room_number || ""),
              status: String(r.status || "vacant") as RoomRow["status"],
              stay_id: r.stay_id == null ? null : Number(r.stay_id),
              stay_status: r.stay_status == null ? null : String(r.stay_status),
              checkin_time:
                r.checkin_time == null ? null : String(r.checkin_time),
              expected_checkin:
                r.expected_checkin == null ? null : String(r.expected_checkin),
              expected_checkout:
                r.expected_checkout == null
                  ? null
                  : String(r.expected_checkout),
              booking_id: r.booking_id == null ? null : Number(r.booking_id),
              prepaid_payment_id: r.prepaid_payment_id == null ? null : Number(r.prepaid_payment_id),
              final_amount:
                r.final_amount == null ? null : Number(r.final_amount),
              guest_name: r.guest_name == null ? null : String(r.guest_name),
              guest_phone: r.guest_phone == null ? null : String(r.guest_phone),
              prepaid_amount:
                r.prepaid_amount == null ? null : Number(r.prepaid_amount),
              prepaid_payment_method:
                r.prepaid_payment_method == null
                  ? null
                  : String(r.prepaid_payment_method),
              notes: r.notes == null ? null : String(r.notes),
              booking_notes: r.booking_notes == null ? null : String(r.booking_notes),
              price: r.price == null ? null : Number(r.price),
              images: r.images,
              category_id: r.category_id == null ? null : Number(r.category_id),
              category_name:
                r.category_name == null ? null : String(r.category_name),
              area_name: r.area_name == null ? null : String(r.area_name),
            } satisfies RoomRow;
          })
          .filter((x) => Number.isFinite(x.room_id) && Boolean(x.room_number));
        setRooms(mapped);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải danh sách phòng"));
      } finally {
        setLoading(false);
      }
    },
    [locationId],
  );

  const reloadAll = useCallback(async () => {
    await load(floorRef.current);
  }, [load]);

  const floorRef = useRef<string>(floor);
  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  useEffect(() => {
    void load(floor);
  }, [floor, load]);

  // Recent payments panel removed

  // Fallback auto-refresh: nếu SSE bị chặn/không ổn định thì vẫn tự đồng bộ
  useEffect(() => {
    const tick = () => {
      void load(floorRef.current);
    };

    const id = window.setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 5000);

    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  // Realtime: auto-sync danh sách phòng giữa nhiều màn hình vận hành
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) return;

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type?: string;
          location_id?: number;
        };
        if (data?.type !== "hotel_updated") return;
        if (Number(data.location_id) !== Number(locationId)) return;

        void load(floorRef.current);
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
    };
  }, [load, locationId]);

  const categories = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; count: number; sort: number }
    >();

    for (const r of rooms) {
      const id = r.category_id;
      const key = Number.isFinite(Number(id)) ? `cat-${Number(id)}` : "uncat";
      const label = String(r.category_name || "").trim() || "Chưa phân loại";
      const sort = Number.isFinite(Number(id)) ? Number(id) : 999999;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { key, label, count: 1, sort });
      } else {
        cur.count += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.label === "Chưa phân loại" && b.label !== "Chưa phân loại")
        return 1;
      if (b.label === "Chưa phân loại" && a.label !== "Chưa phân loại")
        return -1;
      return a.label.localeCompare(b.label, "vi");
    });
  }, [rooms]);

  const roomsFiltered = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    return rooms.filter((r) => {
      if (categoryKey !== "all") {
        const id = r.category_id;
        const key = Number.isFinite(Number(id)) ? `cat-${Number(id)}` : "uncat";
        if (key !== categoryKey) return false;
      }
      if (!q) return true;
      const hay = `${r.room_number} ${r.guest_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rooms, categoryKey, roomQuery]);

  const categoryButtons = useMemo(() => {
    return [
      { key: "all", label: "Tất cả phòng", count: rooms.length },
      ...categories,
    ];
  }, [categories, rooms.length]);

  const activeRoom = useMemo(() => {
    const id = Number(activeRoomId);
    if (!Number.isFinite(id)) return null;
    return rooms.find((x) => Number(x.room_id) === id) || null;
  }, [activeRoomId, rooms]);

  const normalizeGuestName = useCallback((raw: string): string => {
    const s = String(raw || "");
    // Allow only letters (incl. Vietnamese) and spaces
    const filtered = s.replace(/[^\p{L}\s]/gu, "");
    return filtered.replace(/\s+/g, " ");
  }, []);

  const normalizeGuestPhone = useCallback((raw: string): string => {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
    // VN phone: 10-11 digits, usually starts with 0
    return digits.slice(0, 11);
  }, []);

  const isValidGuestName = useCallback((raw: string): boolean => {
    const s = String(raw || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!s) return false;
    if (!/^[\p{L}\s]+$/u.test(s)) return false;
    return s.length >= 2;
  }, []);

  const isValidVNPhone = useCallback(
    (raw: string): boolean => {
      const d = normalizeGuestPhone(raw);
      return /^0\d{9,10}$/.test(d);
    },
    [normalizeGuestPhone],
  );

  const applyStayPresetFromReservation = useCallback(
    (room?: RoomRow | null) => {
      if (!room) {
        setStayPreset("day");
        setCustomDays(1);
        return;
      }

      const parseDate = (v: unknown): Date | null => {
        if (!v) return null;
        const d = new Date(String(v));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const expectedIn = parseDate(room.expected_checkin);
      const expectedOut = parseDate(room.expected_checkout);
      if (!expectedIn || !expectedOut) {
        setStayPreset("day");
        setCustomDays(1);
        return;
      }

      const diffHours = Math.max(
        1,
        Math.ceil(
          (expectedOut.getTime() - expectedIn.getTime()) / (60 * 60 * 1000),
        ),
      );

      if (diffHours === 24) {
        setStayPreset("day");
        setCustomDays(1);
        return;
      }
      if (diffHours === 24 * 7) {
        setStayPreset("week");
        setCustomDays(7);
        return;
      }
      if (diffHours === 24 * 30) {
        setStayPreset("month");
        setCustomDays(30);
        return;
      }

      setStayPreset("custom");
      setCustomDays(Math.max(1, Math.ceil(diffHours / 24)));
    },
    [],
  );

  useEffect(() => {
    const id = Number(activeRoomId);
    if (!Number.isFinite(id)) return;
    if (!activeRoom) return;
    if (lastActiveRoomIdRef.current === id) return;
    lastActiveRoomIdRef.current = id;
    if (activeRoom.status === "reserved") {
      // If this room came from an online reservation, prefill guest info.
      const nextName = String(activeRoom.guest_name || "").trim();
      const nextPhone = String(activeRoom.guest_phone || "").trim();
      setGuestName((prev) =>
        prev.trim() ? prev : normalizeGuestName(nextName),
      );
      setGuestPhone((prev) =>
        prev.trim() ? prev : normalizeGuestPhone(nextPhone),
      );
      applyStayPresetFromReservation(activeRoom);
      return;
    }

    if (activeRoom.status === "vacant") {
      setGuestName("");
      setGuestPhone("");
      applyStayPresetFromReservation(null);
    }
  }, [
    activeRoomId,
    activeRoom,
    applyStayPresetFromReservation,
    normalizeGuestName,
    normalizeGuestPhone,
  ]);

  const prevSelectedCountRef = useRef<number>(0);
  useEffect(() => {
    const prev = prevSelectedCountRef.current;
    const next = selectedRoomIds.length;
    prevSelectedCountRef.current = next;
    // When starting a new selection session, clear previous guest info
    if (prev === 0 && next > 0) {
      const set = new Set(selectedRoomIds.map((x) => Number(x)));
      const reservedWithGuest = rooms
        .filter((r) => set.has(Number(r.room_id)))
        .find(
          (r) =>
            r.status === "reserved" &&
            (String(r.guest_name || "").trim() ||
              String(r.guest_phone || "").trim()),
        );

      if (reservedWithGuest) {
        setGuestName(
          normalizeGuestName(String(reservedWithGuest.guest_name || "")),
        );
        setGuestPhone(
          normalizeGuestPhone(String(reservedWithGuest.guest_phone || "")),
        );
      } else {
        setGuestName("");
        setGuestPhone("");
      }
      const reservedSeed = rooms
        .filter((r) => set.has(Number(r.room_id)))
        .find((r) => r.status === "reserved");
      applyStayPresetFromReservation(reservedSeed || null);
    }
  }, [
    applyStayPresetFromReservation,
    normalizeGuestName,
    normalizeGuestPhone,
    rooms,
    selectedRoomIds,
  ]);

  const removeSelectedRoom = useCallback((roomId: number) => {
    setSelectedRoomIds((prev) =>
      prev.filter((x) => Number(x) !== Number(roomId)),
    );
  }, []);

  // Tự động reset selectionConfirmed khi không còn phòng nào được chọn
  // (thay vì gọi setSelectionConfirmed lồng trong setSelectedRoomIds - gây warning)
  useEffect(() => {
    if (selectedRoomIds.length === 0 && selectionConfirmed) {
      setSelectionConfirmed(false);
    }
  }, [selectedRoomIds, selectionConfirmed]);

  const clearSelectedRooms = useCallback(() => {
    setSelectedRoomIds([]);
    setSelectionConfirmed(false);
    setGuestName("");
    setGuestPhone("");
    applyStayPresetFromReservation(null);
  }, [applyStayPresetFromReservation]);

  const selectedRooms = useMemo(() => {
    const set = new Set(selectedRoomIds.map((x) => Number(x)));
    return rooms
      .filter((r) => set.has(Number(r.room_id)))
      .filter((r) => r.status === "vacant" || r.status === "reserved");
  }, [rooms, selectedRoomIds]);

  const selectedRoomsTotal = useMemo(() => {
    const hours = effectiveStayHours;
    return selectedRooms.reduce((sum, r) => {
      const prepaidAmount = Number(r.prepaid_amount || 0);
      const hasPrepaid = Number.isFinite(prepaidAmount) && prepaidAmount > 0;
      if (hasPrepaid) return sum;
      const price = Number(r.price || 0);
      return sum + (Number.isFinite(price) ? price * hours : 0);
    }, 0);
  }, [effectiveStayHours, selectedRooms]);

  const selectedRoomsAllPrepaid = useMemo(() => {
    if (selectedRooms.length === 0) return false;
    return selectedRooms.every((r) => {
      const prepaidAmount = Number(r.prepaid_amount || 0);
      return Number.isFinite(prepaidAmount) && prepaidAmount > 0;
    });
  }, [selectedRooms]);

  const confirmRoomSelection = () => {
    if (selectedRooms.length === 0) {
      message.error("Vui lòng chọn ít nhất 1 phòng");
      return;
    }
    setSelectionConfirmed(true);
  };

  const confirmCheckin = async () => {
    const name = normalizeGuestName(guestName).trim();
    const phone = normalizeGuestPhone(guestPhone).trim();
    if (!name) {
      message.error("Vui lòng nhập họ tên khách");
      return;
    }
    if (!isValidGuestName(name)) {
      message.error("Họ tên không được chứa ký tự đặc biệt");
      return;
    }
    if (!phone) {
      message.error("Vui lòng nhập số điện thoại khách");
      return;
    }
    if (!isValidVNPhone(phone)) {
      message.error("Số điện thoại không đúng định dạng (VD: 0901234567)");
      return;
    }
    if (stayHours <= 0) {
      message.error("Thời gian ở không hợp lệ");
      return;
    }
    if (selectedRooms.length === 0) {
      message.error("Chưa chọn phòng");
      return;
    }

    setCheckinSubmitting(true);
    try {
      const roomIds = selectedRooms.map((r) => r.room_id);
      const firstRoomId = roomIds[0];
      await ownerApi.checkinHotelRoom(firstRoomId, {
        room_ids: roomIds,
        guest_full_name: name,
        guest_phone: phone,
        stay_nights: stayDays,
      });

      message.success("Đã nhận phòng");
      setSelectedRoomIds([]);
      setSelectionConfirmed(false);
      setGuestName("");
      setGuestPhone("");
      setStayPreset("day");
      setCustomDays(1);
      await load(floor);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi nhận phòng"));
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const guestNameUi = useMemo(() => {
    const normalized = normalizeGuestName(guestName);
    const value = normalized;
    const ok = value.trim().length === 0 ? null : isValidGuestName(value);
    return { value, ok };
  }, [guestName, isValidGuestName, normalizeGuestName]);

  const guestPhoneUi = useMemo(() => {
    const normalized = normalizeGuestPhone(guestPhone);
    const ok =
      normalized.trim().length === 0 ? null : isValidVNPhone(normalized);
    return { value: normalized, ok };
  }, [guestPhone, isValidVNPhone, normalizeGuestPhone]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const toDateSafe = (v: unknown): Date | null => {
    if (!v) return null;
    const d = new Date(String(v));
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const formatDateTimeVN = (v: unknown): string => {
    const d = toDateSafe(v);
    if (!d) return "-";
    return new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  const computeLiveRoomFee = useCallback(
    (room: RoomRow): { raw: number; payable: number; durationText: string } => {
      const unitPrice = Number(room.price || 0);
      const safeUnitPrice =
        Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
      const checkin = toDateSafe(room.checkin_time);
      if (!checkin || safeUnitPrice <= 0)
        return { raw: 0, payable: 0, durationText: "-" };

      const expected = toDateSafe(room.expected_checkout);
      const prepaidAmount = Number(room.prepaid_amount || 0);
      const hasPrepaid = Number.isFinite(prepaidAmount) && prepaidAmount > 0;
      const elapsedMinutes = Math.max(
        1,
        Math.ceil((nowTs - checkin.getTime()) / 60000),
      );

      let plannedHoursCeil: number | null = null;
      if (expected) {
        const plannedMinutes = Math.ceil(
          (expected.getTime() - checkin.getTime()) / 60000,
        );
        if (Number.isFinite(plannedMinutes) && plannedMinutes > 0) {
          plannedHoursCeil = Math.max(1, Math.ceil(plannedMinutes / 60));
        }
      }

      let raw = 0;
      let payableRaw = 0;
      let durationText = "";
      if (elapsedMinutes < 60) {
        raw = safeUnitPrice * (elapsedMinutes / 60);
        durationText = `${elapsedMinutes} phút`;
        payableRaw = hasPrepaid ? 0 : raw;
      } else {
        const elapsedHoursCeil = Math.max(1, Math.ceil(elapsedMinutes / 60));
        if (plannedHoursCeil != null) {
          const withinHours = Math.min(elapsedHoursCeil, plannedHoursCeil);
          const overtimeHours = Math.max(
            0,
            elapsedHoursCeil - plannedHoursCeil,
          );
          const baseRaw = safeUnitPrice * withinHours;
          const overtimeRaw = safeUnitPrice * 1.1 * overtimeHours;
          raw = baseRaw + overtimeRaw;
          durationText =
            overtimeHours > 0
              ? `${elapsedHoursCeil} giờ (quá ${overtimeHours} giờ)`
              : `${elapsedHoursCeil} giờ`;
          payableRaw = hasPrepaid ? overtimeRaw : raw;
        } else {
          raw = safeUnitPrice * elapsedHoursCeil;
          durationText = `${elapsedHoursCeil} giờ`;
          payableRaw = hasPrepaid ? 0 : raw;
        }
      }

      const rawVnd = Math.max(0, Math.round(raw));
      const payableBase = Math.max(0, Math.round(payableRaw));
      const payableVnd =
        payableBase === 0 ? 0 : Math.ceil(payableBase / 1000) * 1000;
      return { raw: rawVnd, payable: payableVnd, durationText };
    },
    [nowTs],
  );

  const formatDurationMinutes = useCallback((mins: number | null) => {
    const m = Math.max(0, Math.floor(Number(mins || 0)));
    if (m < 60) return `${m} phút`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm > 0 ? `${h} giờ ${mm} phút` : `${h} giờ`;
  }, []);

  const resetPayState = useCallback(() => {
    setPayOpen(false);
    setPayBusy(false);
    setTransferInit(null);
    setTransferBatchInit(null);
    setBatchInvoice(null);
    setCashPreview([]);
    setInvoices([]);
    setPayRooms([]);
    if (checkoutSelectionSnapshot) {
      setSelectedCheckoutRoomIds(checkoutSelectionSnapshot);
    }
    setCheckoutSelectionSnapshot(null);
  }, [checkoutSelectionSnapshot]);

  const startPay = useCallback(
    async (roomsToPay: RoomRow[]) => {
      const roomsOk = roomsToPay
        .filter((x) => x.status === "occupied")
        .filter((x) => Number.isFinite(Number(x.stay_id)));
      if (roomsOk.length === 0) {
        message.error("Chưa chọn phòng để thanh toán");
        return;
      }

      setCheckoutSelectionSnapshot(
        selectedCheckoutRoomIds.map((x) => Number(x)).filter(Number.isFinite),
      );

      setPayRooms(roomsOk);
      setPayOpen(true);
      setPayBusy(true);
      setTransferInit(null);
      setTransferBatchInit(null);
      setBatchInvoice(null);
      setCashPreview([]);
      setInvoices([]);
      try {
        if (checkoutMethod === "cash") {
          if (roomsOk.length > 1) {
            const stayIds = roomsOk
              .map((x) => Number(x.stay_id))
              .filter((x) => Number.isFinite(x));
            const res = await ownerApi.checkoutHotelStaysBatch({
              payment_method: "cash",
              step: "init",
              stay_ids: stayIds,
            });
            const data = asRecord(asRecord(res).data);
            const ctx = asRecord((data as any).context);
            const roomsArr = Array.isArray((ctx as any).rooms)
              ? ((ctx as any).rooms as any[])
              : [];

            const previews: HotelCashPreview[] = roomsArr.map((r: any) => ({
              stay_id: Number(r.stay_id),
              room_number: r.room_number == null ? null : String(r.room_number),
              context: {
                location_name:
                  ctx.location_name == null ? null : String(ctx.location_name),
                owner_name:
                  ctx.owner_name == null ? null : String(ctx.owner_name),
                room_number:
                  r.room_number == null ? null : String(r.room_number),
                checkin_time:
                  r.checkin_time == null ? null : String(r.checkin_time),
                checkout_time:
                  r.checkout_time == null ? null : String(r.checkout_time),
                room_unit_price: Number(r.room_unit_price || 0),
                actual_minutes: Number(r.actual_minutes || 0),
                overtime_hours: Number(r.overtime_hours || 0),
                surcharge_amount: Number(r.surcharge_amount || 0),
                gross_amount: Number(r.gross_amount || r.total_amount || 0),
                prepaid_payment_method:
                  r.prepaid_payment_method == null
                    ? null
                    : String(r.prepaid_payment_method),
                prepaid_amount: Number(r.prepaid_amount || 0),
                onsite_amount: Number(r.onsite_amount || r.total_amount || 0),
                total_amount: Number(r.total_amount || 0),
              },
            }));

            setCashPreview(previews);
            await load(floor);
            return;
          }

          const previews: HotelCashPreview[] = [];
          for (const x of roomsOk) {
            const res = await ownerApi.checkoutHotelStay(Number(x.stay_id), {
              payment_method: "cash",
              step: "init",
            });
            const ctx = asRecord(asRecord(res).data).context;
            const c = asRecord(ctx);
            previews.push({
              stay_id: Number(x.stay_id),
              room_number: x.room_number || null,
              context: {
                location_name:
                  c.location_name == null ? null : String(c.location_name),
                owner_name: c.owner_name == null ? null : String(c.owner_name),
                room_number:
                  c.room_number == null ? null : String(c.room_number),
                checkin_time:
                  c.checkin_time == null ? null : String(c.checkin_time),
                checkout_time:
                  c.checkout_time == null ? null : String(c.checkout_time),
                room_unit_price: Number(c.room_unit_price || 0),
                actual_minutes: Number(c.actual_minutes || 0),
                overtime_hours: Number(c.overtime_hours || 0),
                surcharge_amount: Number(c.surcharge_amount || 0),
                gross_amount: Number(c.gross_amount || c.total_amount || 0),
                prepaid_payment_method:
                  c.prepaid_payment_method == null
                    ? null
                    : String(c.prepaid_payment_method),
                prepaid_amount: Number(c.prepaid_amount || 0),
                onsite_amount: Number(c.onsite_amount || c.total_amount || 0),
                total_amount: Number(c.total_amount || 0),
              },
            });
          }
          setCashPreview(previews);
          return;
        }

        if (roomsOk.length > 1) {
          const stayIds = roomsOk
            .map((x) => Number(x.stay_id))
            .filter((x) => Number.isFinite(x));
          const res = await ownerApi.checkoutHotelStaysBatch({
            payment_method: "transfer",
            step: "init",
            stay_ids: stayIds,
          });
          const data = asRecord(asRecord(res).data);
          const qr = asRecord((data as any).qr);
          const ctx = asRecord((data as any).context);
          const roomsArr = Array.isArray((ctx as any).rooms)
            ? ((ctx as any).rooms as any[])
            : [];
          setTransferBatchInit({
            payment_id: Number((data as any).payment_id),
            qr: {
              qr_code_url: String(qr.qr_code_url || ""),
              bank_name: String(qr.bank_name || ""),
              bank_account: String(qr.bank_account || ""),
              account_holder: String(qr.account_holder || ""),
              bank_bin: qr.bank_bin == null ? undefined : String(qr.bank_bin),
              amount: Number(qr.amount || 0),
              note: String(qr.note || ""),
            },
            context: {
              location_name:
                ctx.location_name == null ? null : String(ctx.location_name),
              owner_name:
                ctx.owner_name == null ? null : String(ctx.owner_name),
              rooms: roomsArr.map((r: any) => ({
                stay_id: Number(r.stay_id),
                room_number:
                  r.room_number == null ? null : String(r.room_number),
                checkin_time:
                  r.checkin_time == null ? null : String(r.checkin_time),
                checkout_time:
                  r.checkout_time == null ? null : String(r.checkout_time),
                room_unit_price: Number(r.room_unit_price || 0),
                actual_minutes: Number(r.actual_minutes || 0),
                overtime_hours: Number(r.overtime_hours || 0),
                surcharge_amount: Number(r.surcharge_amount || 0),
                gross_amount: Number(r.gross_amount || r.total_amount || 0),
                prepaid_payment_method:
                  r.prepaid_payment_method == null
                    ? null
                    : String(r.prepaid_payment_method),
                prepaid_amount: Number(r.prepaid_amount || 0),
                onsite_amount: Number(r.onsite_amount || r.total_amount || 0),
                total_amount: Number(r.total_amount || 0),
              })),
              total_amount: Number((ctx as any).total_amount || 0),
            },
          });
          message.success("Đã tạo mã QR chuyển khoản");
          await load(floor);
          return;
        }

        const x = roomsOk[0];
        const res = await ownerApi.checkoutHotelStay(Number(x.stay_id), {
          payment_method: "transfer",
          step: "init",
        });
        const data = asRecord(asRecord(res).data);
        const qr = asRecord((data as any).qr);
        const ctx = asRecord((data as any).context);
        setTransferInit({
          payment_id: Number((data as any).payment_id),
          qr: {
            qr_code_url: String(qr.qr_code_url || ""),
            bank_name: String(qr.bank_name || ""),
            bank_account: String(qr.bank_account || ""),
            account_holder: String(qr.account_holder || ""),
            bank_bin: qr.bank_bin == null ? undefined : String(qr.bank_bin),
            amount: Number(qr.amount || 0),
            note: String(qr.note || ""),
          },
          context: {
            location_name:
              ctx.location_name == null ? null : String(ctx.location_name),
            owner_name: ctx.owner_name == null ? null : String(ctx.owner_name),
            room_number:
              ctx.room_number == null ? null : String(ctx.room_number),
            checkin_time:
              ctx.checkin_time == null ? null : String(ctx.checkin_time),
            checkout_time:
              ctx.checkout_time == null ? null : String(ctx.checkout_time),
            room_unit_price: Number(ctx.room_unit_price || 0),
            actual_minutes: Number(ctx.actual_minutes || 0),
            overtime_hours: Number(ctx.overtime_hours || 0),
            surcharge_amount: Number(ctx.surcharge_amount || 0),
            gross_amount: Number(ctx.gross_amount || ctx.total_amount || 0),
            prepaid_payment_method:
              ctx.prepaid_payment_method == null
                ? null
                : String(ctx.prepaid_payment_method),
            prepaid_amount: Number(ctx.prepaid_amount || 0),
            onsite_amount: Number(ctx.onsite_amount || ctx.total_amount || 0),
            total_amount: Number(ctx.total_amount || 0),
          },
        });
        message.success("Đã tạo mã QR chuyển khoản");
        await load(floor);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Không thể thanh toán"));
        resetPayState();
      } finally {
        setPayBusy(false);
      }
    },
    [checkoutMethod, floor, load, resetPayState, selectedCheckoutRoomIds],
  );

  const confirmTransferComplete = useCallback(async () => {
    const paymentId = Number(transferInit?.payment_id);
    const room = payRooms[0];
    const stayId = Number(room?.stay_id);
    if (!Number.isFinite(paymentId) || !Number.isFinite(stayId)) return;
    setPayBusy(true);
    try {
      const res = await ownerApi.checkoutHotelStay(stayId, {
        payment_method: "transfer",
        step: "complete",
        payment_id: paymentId,
      });
      const inv = asRecord(asRecord(res).data).invoice;
      const p = asRecord(inv);
      setInvoices([
        {
          payment_id: Number(p.payment_id),
          location_name:
            p.location_name == null ? null : String(p.location_name),
          owner_name: p.owner_name == null ? null : String(p.owner_name),
          room_number: p.room_number == null ? null : String(p.room_number),
          payment_time: String(p.payment_time || ""),
          checkin_time: p.checkin_time == null ? null : String(p.checkin_time),
          checkout_time:
            p.checkout_time == null ? null : String(p.checkout_time),
          room_unit_price: Number(p.room_unit_price || 0),
          actual_minutes:
            p.actual_minutes == null ? null : Number(p.actual_minutes),
          overtime_hours: Number(p.overtime_hours || 0),
          surcharge_amount: Number(p.surcharge_amount || 0),
          gross_amount: Number(p.gross_amount || p.total_amount || 0),
          prepaid_payment_method:
            p.prepaid_payment_method == null
              ? null
              : String(p.prepaid_payment_method),
          prepaid_amount: Number(p.prepaid_amount || 0),
          onsite_amount: Number(p.onsite_amount || p.total_amount || 0),
          total_amount: Number(p.total_amount || 0),
        },
      ]);
      setTransferInit(null);
      setCheckoutSelectionSnapshot(null);
      message.success("Đã xác nhận chuyển khoản");
      setSelectedCheckoutRoomIds([]);
      await load(floor);
      // Recent payments panel removed
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xác nhận"));
    } finally {
      setPayBusy(false);
    }
  }, [floor, load, payRooms, transferInit]);

  const confirmTransferBatchComplete = useCallback(async () => {
    const paymentId = Number(transferBatchInit?.payment_id);
    if (!Number.isFinite(paymentId)) return;
    const stayIds = payRooms
      .map((x) => Number(x.stay_id))
      .filter((x) => Number.isFinite(x));
    if (stayIds.length < 2) return;

    setPayBusy(true);
    try {
      const res = await ownerApi.checkoutHotelStaysBatch({
        payment_method: "transfer",
        step: "complete",
        payment_id: paymentId,
        stay_ids: stayIds,
      });
      const inv = asRecord(asRecord(res).data).invoice;
      const p = asRecord(inv);
      const roomsArr = Array.isArray((p as any).rooms)
        ? ((p as any).rooms as any[])
        : [];
      setBatchInvoice({
        payment_id: Number(p.payment_id),
        payment_time: String(p.payment_time || ""),
        location_name: p.location_name == null ? null : String(p.location_name),
        owner_name: p.owner_name == null ? null : String(p.owner_name),
        rooms: roomsArr.map((r: any) => ({
          stay_id: Number(r.stay_id),
          room_number: r.room_number == null ? null : String(r.room_number),
          checkin_time: r.checkin_time == null ? null : String(r.checkin_time),
          checkout_time:
            r.checkout_time == null ? null : String(r.checkout_time),
          room_unit_price: Number(r.room_unit_price || 0),
          actual_minutes: Number(r.actual_minutes || 0),
          overtime_hours: Number(r.overtime_hours || 0),
          surcharge_amount: Number(r.surcharge_amount || 0),
          gross_amount: Number(r.gross_amount || r.total_amount || 0),
          prepaid_payment_method:
            r.prepaid_payment_method == null
              ? null
              : String(r.prepaid_payment_method),
          prepaid_amount: Number(r.prepaid_amount || 0),
          onsite_amount: Number(r.onsite_amount || r.total_amount || 0),
          total_amount: Number(r.total_amount || 0),
        })),
        total_amount: Number((p as any).total_amount || 0),
      });
      setTransferBatchInit(null);
      setCheckoutSelectionSnapshot(null);
      message.success("Đã xác nhận chuyển khoản");
      setSelectedCheckoutRoomIds([]);
      await load(floor);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xác nhận"));
    } finally {
      setPayBusy(false);
    }
  }, [floor, load, payRooms, transferBatchInit]);

  const confirmCashComplete = useCallback(async () => {
    if (cashPreview.length === 0) return;
    setPayBusy(true);
    try {
      if (cashPreview.length > 1) {
        const stayIds = cashPreview
          .map((x) => Number(x.stay_id))
          .filter((x) => Number.isFinite(x));
        const res = await ownerApi.checkoutHotelStaysBatch({
          payment_method: "cash",
          step: "complete",
          stay_ids: stayIds,
        });
        const inv = asRecord(asRecord(res).data).invoice;
        const p = asRecord(inv);
        const roomsArr = Array.isArray((p as any).rooms)
          ? ((p as any).rooms as any[])
          : [];

        setCashPreview([]);
        setInvoices([]);
        setBatchInvoice({
          payment_id: Number(p.payment_id),
          payment_time: String(p.payment_time || ""),
          location_name:
            p.location_name == null ? null : String(p.location_name),
          owner_name: p.owner_name == null ? null : String(p.owner_name),
          rooms: roomsArr.map((r: any) => ({
            stay_id: Number(r.stay_id),
            room_number: r.room_number == null ? null : String(r.room_number),
            checkin_time:
              r.checkin_time == null ? null : String(r.checkin_time),
            checkout_time:
              r.checkout_time == null ? null : String(r.checkout_time),
            room_unit_price: Number(r.room_unit_price || 0),
            actual_minutes: Number(r.actual_minutes || 0),
            overtime_hours: Number(r.overtime_hours || 0),
            surcharge_amount: Number(r.surcharge_amount || 0),
            gross_amount: Number(r.gross_amount || r.total_amount || 0),
            prepaid_payment_method:
              r.prepaid_payment_method == null
                ? null
                : String(r.prepaid_payment_method),
            prepaid_amount: Number(r.prepaid_amount || 0),
            onsite_amount: Number(r.onsite_amount || r.total_amount || 0),
            total_amount: Number(r.total_amount || 0),
          })),
          total_amount: Number((p as any).total_amount || 0),
        });
        setCheckoutSelectionSnapshot(null);
        message.success("Đã xác nhận đã nhận tiền");
        setSelectedCheckoutRoomIds([]);
        await load(floor);
        return;
      }

      const invs: HotelInvoice[] = [];
      for (const p of cashPreview) {
        const res = await ownerApi.checkoutHotelStay(Number(p.stay_id), {
          payment_method: "cash",
          step: "complete",
        });
        const inv = asRecord(asRecord(res).data).invoice;
        const x = asRecord(inv);
        invs.push({
          payment_id: Number(x.payment_id),
          location_name:
            x.location_name == null ? null : String(x.location_name),
          owner_name: x.owner_name == null ? null : String(x.owner_name),
          room_number: x.room_number == null ? null : String(x.room_number),
          payment_time: String(x.payment_time || ""),
          checkin_time: x.checkin_time == null ? null : String(x.checkin_time),
          checkout_time:
            x.checkout_time == null ? null : String(x.checkout_time),
          room_unit_price: Number(x.room_unit_price || 0),
          actual_minutes:
            x.actual_minutes == null ? null : Number(x.actual_minutes),
          overtime_hours: Number(x.overtime_hours || 0),
          surcharge_amount: Number(x.surcharge_amount || 0),
          gross_amount: Number(x.gross_amount || x.total_amount || 0),
          prepaid_payment_method:
            x.prepaid_payment_method == null
              ? null
              : String(x.prepaid_payment_method),
          prepaid_amount: Number(x.prepaid_amount || 0),
          onsite_amount: Number(x.onsite_amount || x.total_amount || 0),
          total_amount: Number(x.total_amount || 0),
        });
      }

      setCashPreview([]);
      setInvoices(invs);
      setBatchInvoice(null);
      setCheckoutSelectionSnapshot(null);
      message.success("Đã xác nhận đã nhận tiền");
      setSelectedCheckoutRoomIds([]);
      await load(floor);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xác nhận"));
    } finally {
      setPayBusy(false);
    }
  }, [cashPreview, floor, load]);

  const getGuestKey = useCallback((room: RoomRow): string => {
    const phone = String(room.guest_phone || "").trim();
    if (phone) return `phone:${phone}`;
    const name = String(room.guest_name || "").trim();
    if (name) return `name:${name}`;
    return "";
  }, []);

  const getCheckinMinuteKey = useCallback((room: RoomRow): string => {
    const raw = room.checkin_time;
    if (!raw) return "";
    const d = new Date(String(raw));
    if (!Number.isFinite(d.getTime())) return "";
    return String(Math.floor(d.getTime() / 60000));
  }, []);

  const selectedCheckoutRooms = useMemo(() => {
    const set = new Set(selectedCheckoutRoomIds.map((x) => Number(x)));
    return rooms
      .filter((r) => set.has(Number(r.room_id)))
      .filter((r) => r.status === "occupied");
  }, [rooms, selectedCheckoutRoomIds]);

  const clearCheckoutSelection = useCallback(() => {
    setSelectedCheckoutRoomIds([]);
  }, []);

  const removeCheckoutSelectedRoom = useCallback((roomId: number) => {
    setSelectedCheckoutRoomIds((prev) =>
      prev.filter((x) => Number(x) !== Number(roomId)),
    );
  }, []);

  const toggleCheckoutRoom = useCallback(
    (room: RoomRow) => {
      if (room.status !== "occupied") return;
      if (!Number.isFinite(Number(room.stay_id))) {
        message.error("Phòng này thiếu stay_id để thanh toán");
        return;
      }

      // Do not mix with check-in selection
      setSelectedRoomIds([]);
      setSelectionConfirmed(false);

      const prev = selectedCheckoutRoomIdsRef.current;
      const set = new Set(prev.map((x) => Number(x)));

      if (set.has(Number(room.room_id))) {
        set.delete(Number(room.room_id));
        setSelectedCheckoutRoomIds(Array.from(set));
        return;
      }

      if (set.size > 0) {
        const firstRoomId = Array.from(set)[0];
        const first = rooms.find((r) => Number(r.room_id) === firstRoomId);

        const desiredKey = getGuestKey(room);
        const firstKey = first ? getGuestKey(first) : "";
        if (desiredKey && firstKey && firstKey !== desiredKey) {
          message.error("Chỉ chọn phòng cùng khách để thanh toán chung");
          return;
        }

        // Allow grouping for same guest if check-in time is the same minute.
        const firstCheckinKey = first ? getCheckinMinuteKey(first) : "";
        const nextCheckinKey = getCheckinMinuteKey(room);
        if (
          firstCheckinKey &&
          nextCheckinKey &&
          firstCheckinKey !== nextCheckinKey
        ) {
          message.error(
            "Chỉ chọn phòng cùng giờ nhận phòng để thanh toán chung",
          );
          return;
        }
      }

      set.add(Number(room.room_id));
      setSelectedCheckoutRoomIds(Array.from(set));
    },
    [getCheckinMinuteKey, getGuestKey, rooms],
  );

  const checkout = async (room: RoomRow) => {
    void startPay([room]);
  };

  const checkoutMany = async (roomsToCheckout: RoomRow[]) => {
    void startPay(roomsToCheckout);
  };

  const openExtendModal = useCallback((room: RoomRow) => {
    const stayId = Number(room.stay_id);
    if (!Number.isFinite(stayId) || stayId <= 0) {
      message.error("Phòng này thiếu stay_id để gia hạn");
      return;
    }
    setExtendStayId(stayId);
    setExtendPreset("day");
    setExtendCustomDays(1);
    setExtendOpen(true);
  }, []);

  const confirmExtendStay = useCallback(async () => {
    if (!Number.isFinite(Number(extendStayId)) || Number(extendStayId) <= 0) {
      message.error("stay_id không hợp lệ");
      return;
    }

    const payload = {
      preset: extendPreset,
      custom_days:
        extendPreset === "custom"
          ? Math.max(1, Math.floor(Number(extendCustomDays || 1)))
          : undefined,
    } as const;

    setExtendSubmitting(true);
    try {
      const res = await ownerApi.extendHotelStay(Number(extendStayId), payload);
      const data = asRecord(res?.data);
      const expected =
        data.expected_checkout == null
          ? ""
          : formatDateTimeVN(String(data.expected_checkout));
      message.success(
        expected
          ? `Đã gia hạn. Hết hạn mới: ${expected}`
          : "Đã gia hạn thành công",
      );
      setExtendOpen(false);
      setExtendStayId(null);
      await load(floor);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể gia hạn lưu trú"));
    } finally {
      setExtendSubmitting(false);
    }
  }, [extendCustomDays, extendPreset, extendStayId, floor, load]);

  const setRoomStatus = async (room: RoomRow, status: RoomRow["status"]) => {
    await ownerApi.setHotelRoomStatus(room.room_id, { status });
    await load(floor);
  };

  const activeCategoryLabel = useMemo(() => {
    if (categoryKey === "all") return "Tất cả";
    const found = categories.find((c) => c.key === categoryKey);
    return found?.label || "";
  }, [categories, categoryKey]);

  const renderSidebar = () => (
    <Card size="small" className="border border-blue-100 shadow-sm">
      <Typography.Text strong>Phòng</Typography.Text>
      <div className="mt-2">
        <Input
          value={roomQuery}
          onChange={(e) => setRoomQuery(e.target.value)}
          placeholder="Tìm phòng / khách..."
          allowClear
        />
      </div>

      <div className="mt-3 max-h-[55vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          {roomsFiltered.map((r) => {
            const meta = statusMeta(r.status);
            const selected = Number(activeRoomId) === Number(r.room_id);
            const thumbRaw = normalizeImages(r.images)?.[0] ?? "";
            const thumb = resolveBackendUrl(thumbRaw) || thumbRaw;
            return (
              <button
                key={r.room_id}
                type="button"
                onClick={() => {
                  setActiveRoomId(r.room_id);
                }}
                onDoubleClick={() => {
                  if (r.status === "vacant" || r.status === "reserved") {
                    setSelectedRoomIds((prev) => {
                      const set = new Set(prev);
                      if (set.has(r.room_id)) set.delete(r.room_id);
                      else set.add(r.room_id);
                      return Array.from(set);
                    });
                    setSelectionConfirmed(false);
                    setSelectedCheckoutRoomIds([]);
                  } else if (r.status === "occupied") {
                    toggleCheckoutRoom(r);
                  } else {
                    setSelectedRoomIds([]);
                    setSelectionConfirmed(false);
                    setSelectedCheckoutRoomIds([]);
                  }
                }}
                className={
                  "w-full text-left rounded-2xl border p-2 bg-white hover:border-blue-300 hover:shadow-sm transition " +
                  (selected
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-gray-200")
                }
              >
                <div className="flex items-center gap-2">
                  {thumb ? (
                    <img
                      alt={r.room_number}
                      src={thumb}
                      className="h-10 w-10 rounded-xl object-cover border border-gray-200 shrink-0"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate">
                        {r.room_number}
                      </div>
                      <Tag color={meta.color} className="!m-0">
                        {meta.label}
                      </Tag>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {String(r.category_name || "").trim() || "-"}
                      {Number.isFinite(Number(r.price))
                        ? ` • ${formatMoney(Number(r.price || 0))} / 1 giờ`
                        : ""}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {roomsFiltered.length === 0 ? (
            <div className="text-xs text-gray-500">Không có phòng phù hợp.</div>
          ) : null}
        </div>
      </div>
    </Card>
  );

  const renderPaymentPanel = (inStack?: boolean) => {
    const r = activeRoom;

    if (!r) {
      return (
        <div className={inStack ? "" : "sticky top-4"}>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-white to-blue-50">
              <div className="text-sm font-semibold">Vận hành</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Chọn phòng để thao tác
              </div>
            </div>
            <div className="p-4 text-sm text-gray-600">Chưa chọn phòng.</div>
          </div>
        </div>
      );
    }

    const meta = statusMeta(r.status);
    const isOccupied = r.status === "occupied";
    const checkoutRooms =
      selectedCheckoutRooms.length > 0
        ? selectedCheckoutRooms
        : isOccupied
          ? [r]
          : [];
    const live = isOccupied ? computeLiveRoomFee(r) : null;
    const liveTotal = isOccupied
      ? checkoutRooms.reduce((sum, x) => sum + computeLiveRoomFee(x).payable, 0)
      : 0;

    return (
      <div className={inStack ? "" : "sticky top-4"}>
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-white to-blue-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {isOccupied
                    ? checkoutRooms.length > 1
                      ? `Thanh toán • ${checkoutRooms.length} phòng`
                      : `Thanh toán • ${r.room_number}`
                    : "Chọn phòng"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Tầng {r.floor_number}
                  {String(r.category_name || "").trim()
                    ? ` • ${String(r.category_name).trim()}`
                    : ""}
                </div>
              </div>
              <Tag color={meta.color} className="!m-0">
                {meta.label}
              </Tag>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {isOccupied ? (
              <>
                <div className="text-sm text-gray-700">
                  <div>
                    Khách: <b>{r.guest_name || "-"}</b>
                    {r.guest_phone ? ` • ${r.guest_phone}` : ""}
                  </div>
                  <div>Giờ vào: {formatDateTimeVN(r.checkin_time)}</div>
                  <div>
                    Hết hạn: <b>{formatDateTimeVN(r.expected_checkout)}</b>
                  </div>
                  <div className="mt-1">
                    Tổng tiền: <b>{formatMoney(liveTotal)}</b>
                    {live?.durationText ? (
                      <span className="text-xs text-gray-500">
                        {" "}
                        • {live.durationText}
                      </span>
                    ) : null}
                  </div>
                </div>

                {selectedCheckoutRooms.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">
                        Phòng đang chọn trả
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={clearCheckoutSelection}
                      >
                        Xóa hết
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCheckoutRooms.map((x) => (
                        <Tag
                          key={x.room_id}
                          className="!m-0"
                          closable
                          onClose={(e) => {
                            e.preventDefault();
                            removeCheckoutSelectedRoom(x.room_id);
                          }}
                        >
                          {x.room_number}
                        </Tag>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-500">
                    Mẹo: bấm thêm phòng ĐANG Ở để trả chung
                  </div>
                )}

                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Phương thức thanh toán
                  </div>
                  <Segmented
                    value={checkoutMethod}
                    onChange={(v) => setCheckoutMethod(v as any)}
                    options={[
                      { label: "Tiền mặt", value: "cash" },
                      { label: "Chuyển khoản", value: "transfer" },
                    ]}
                  />
                </div>

                <Space wrap>
                  <Button onClick={() => openExtendModal(r)}>Gia hạn</Button>
                  <Button
                    danger
                    onClick={() =>
                      selectedCheckoutRooms.length > 0
                        ? checkoutMany(selectedCheckoutRooms)
                        : checkout(r)
                    }
                  >
                    {selectedCheckoutRooms.length > 0
                      ? "Trả phòng đã chọn"
                      : "Trả phòng & thanh toán"}
                  </Button>
                </Space>
              </>
            ) : r.status === "cleaning" ? (
              <Button onClick={() => setRoomStatus(r, "vacant")}>
                Đã dọn xong
              </Button>
            ) : (
              <>
                {selectedRooms.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    Chọn phòng (trống/đã đặt) để nhận phòng.
                  </div>
                ) : !selectionConfirmed ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">Phòng đã chọn</div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={clearSelectedRooms}
                      >
                        Xóa hết
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRooms.map((x) => (
                        <Tag
                          key={x.room_id}
                          className="!m-0"
                          closable
                          onClose={(e) => {
                            e.preventDefault();
                            removeSelectedRoom(x.room_id);
                          }}
                        >
                          {x.room_number}
                        </Tag>
                      ))}
                    </div>
                    <Button
                      type="primary"
                      size="middle"
                      className="!rounded-full"
                      onClick={confirmRoomSelection}
                    >
                      Xác nhận chọn phòng
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Tiền phòng</div>
                      <div className="text-lg font-bold text-blue-700">
                        {formatMoney(selectedRoomsTotal)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedRooms.length} phòng • {stayDays} ngày •{" "}
                        {selectedRoomsAllPrepaid
                          ? "Đã thanh toán trước"
                          : "Thanh toán khi trả phòng"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        Họ tên khách
                      </div>
                      <Input
                        value={guestNameUi.value}
                        onChange={(e) =>
                          setGuestName(normalizeGuestName(e.target.value))
                        }
                        placeholder="Ví dụ: Nguyễn Văn A"
                        disabled={checkinSubmitting}
                        maxLength={60}
                        status={guestNameUi.ok === false ? "error" : undefined}
                      />
                      <div
                        className={
                          "mt-1 text-[11px] " +
                          (guestNameUi.ok === false
                            ? "text-red-600"
                            : "text-gray-500")
                        }
                      >
                        Chỉ nhập chữ và khoảng trắng (không ký tự đặc biệt).
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        Số điện thoại
                      </div>
                      <Input
                        value={guestPhoneUi.value}
                        onChange={(e) =>
                          setGuestPhone(normalizeGuestPhone(e.target.value))
                        }
                        placeholder="VD: 0901234567"
                        disabled={checkinSubmitting}
                        inputMode="numeric"
                        maxLength={11}
                        status={guestPhoneUi.ok === false ? "error" : undefined}
                      />
                      <div
                        className={
                          "mt-1 text-[11px] " +
                          (guestPhoneUi.ok === false
                            ? "text-red-600"
                            : "text-gray-500")
                        }
                      >
                        Nhập 10–11 số. Hệ thống tự bỏ khoảng trắng/ký tự lạ.
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        Thời gian ở
                      </div>
                      {lockStayDurationByBooking ? (
                        <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                          Tự đồng bộ theo thời gian khách đã đặt trước. Không
                          thể chỉnh tay khi nhận phòng.
                        </div>
                      ) : null}
                      <Segmented
                        value={stayPreset}
                        onChange={(v) => {
                          if (lockStayDurationByBooking) return;
                          setStayPreset(v as any);
                        }}
                        options={[
                          { label: "1 ngày", value: "day" },
                          { label: "1 tuần", value: "week" },
                          { label: "1 tháng", value: "month" },
                          { label: "Chọn khác", value: "custom" },
                        ]}
                        disabled={
                          checkinSubmitting || lockStayDurationByBooking
                        }
                      />
                      {stayPreset === "custom" && !lockStayDurationByBooking ? (
                        <div className="mt-2">
                          <div className="text-xs text-gray-500 mb-1">
                            Nhập số ngày
                          </div>
                          <InputNumber
                            min={1}
                            value={customDays}
                            onChange={(v) => setCustomDays(Number(v || 1))}
                            style={{ width: "100%" }}
                            disabled={
                              checkinSubmitting || lockStayDurationByBooking
                            }
                          />
                        </div>
                      ) : null}

                      <div className="text-xs text-gray-500 mt-2">
                        Hết hạn ở (tự tính): <b>{expectedCheckoutPreview}</b>
                      </div>
                    </div>

                    <Space wrap>
                      <Button
                        onClick={() => setSelectionConfirmed(false)}
                        disabled={checkinSubmitting}
                      >
                        Quay lại
                      </Button>
                      <Button
                        type="primary"
                        size="middle"
                        className="!rounded-full"
                        onClick={confirmCheckin}
                        loading={checkinSubmitting}
                      >
                        Xác nhận nhận phòng
                      </Button>
                    </Space>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryPanel = () => (
    <div>
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Lịch sử</div>
            <Button
              size="small"
              onClick={() =>
                navigate(
                  `/owner/front-office/payments-history?location_id=${locationId}`,
                )
              }
            >
              Lịch sử thanh toán
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-2">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />

          <Card
            title="Sơ đồ phòng (PMS)"
            className="relative z-10 border border-blue-100/70 bg-white/70 backdrop-blur"
            extra={
              <Space wrap>
                <Space size={6} wrap>
                  <Tag color="green" className="!m-0">
                    Trống
                  </Tag>
                  <Tag color="red" className="!m-0">
                    Đang ở
                  </Tag>
                  <Tag color="orange" className="!m-0">
                    Đã đặt
                  </Tag>
                  <Tag className="!m-0">Dọn dẹp</Tag>
                </Space>
                <div className="mx-2 w-px self-stretch bg-gray-200" />
                <Segmented
                  options={floorOptions}
                  value={floor}
                  onChange={(v) => setFloor(String(v))}
                />
                <Button
                  className="md:hidden"
                  icon={<FilterOutlined />}
                  onClick={() => setSidebarOpen(true)}
                >
                  Lọc
                </Button>
                <Button onClick={reloadAll} loading={loading}>
                  Tải lại
                </Button>
              </Space>
            }
          >
            <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-gray-500">
                Danh mục: <b>{activeCategoryLabel}</b>
                {roomQuery.trim() ? (
                  <>
                    {" "}
                    • Tìm: <b>{roomQuery.trim()}</b>
                  </>
                ) : null}
              </div>
              <div className="text-xs text-gray-500">
                Tổng: <b>{roomsFiltered.length}</b> phòng
              </div>
            </div>

            <div className="flex gap-4">
              <div className="hidden md:block w-[320px] shrink-0">
                <div className="sticky top-4">{renderSidebar()}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="lg:w-[220px] shrink-0">
                    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b bg-gray-50/60">
                        <div className="text-sm font-semibold">Danh mục</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Chọn để lọc
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {categoryButtons.map((c) => {
                          const active = String(categoryKey) === String(c.key);
                          return (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => setCategoryKey(String(c.key))}
                              className={
                                "w-full text-left rounded-xl border px-3 py-2 text-sm transition flex items-center justify-between gap-2 " +
                                (active
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 bg-white hover:border-blue-300")
                              }
                            >
                              <span className="truncate font-medium">
                                {c.label}
                              </span>
                              <span
                                className={
                                  "text-xs px-2 py-0.5 rounded-full border " +
                                  (active
                                    ? "border-blue-200 text-blue-700 bg-white"
                                    : "border-gray-200 text-gray-600 bg-gray-50")
                                }
                              >
                                {c.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      {roomsFiltered.map((r) => {
                        const meta = statusMeta(r.status);
                        const canSelectForCheckin =
                          r.status === "vacant" || r.status === "reserved";
                        const selected =
                          Number(activeRoomId) === Number(r.room_id);

                        const thumbRaw = normalizeImages(r.images)?.[0] ?? "";
                        const thumb = resolveBackendUrl(thumbRaw) || thumbRaw;

                        const isPicked = selectedRoomIds.includes(r.room_id);
                        const isCheckoutPicked =
                          selectedCheckoutRoomIds.includes(r.room_id);

                        const rPrepaid = Number(r.prepaid_amount || 0);
                        // Dùng prepaid_payment_id để nhóm các phòng cùng 1 giao dịch thanh toán trước
                        // (1 đơn đặt bao gồm nhiều phòng -> nhiều booking_id khác nhau nhưng cùng payment_id)
                        const rPrepaidPaymentId = Number(r.prepaid_payment_id || 0);
                        const isPrepaid = Number.isFinite(rPrepaid) && rPrepaid > 0;

                        const handleSelectForCheckin = () => {
                          if (canSelectForCheckin) {
                            setSelectedCheckoutRoomIds([]);
                            setSelectedRoomIds((prev) => {
                              const set = new Set(prev);
                              const willRemove = set.has(r.room_id);

                              if (willRemove) {
                                set.delete(r.room_id);
                                return Array.from(set);
                              }

                              // Kiểm tra logic nhóm phòng
                              const alreadySelected = rooms.filter(cr => set.has(cr.room_id));
                              const hasPrepaidAlready = alreadySelected.some(cr => {
                                const crPrepaid = Number(cr.prepaid_amount || 0);
                                return Number.isFinite(crPrepaid) && crPrepaid > 0;
                              });

                              if (alreadySelected.length > 0) {
                                if (hasPrepaidAlready && !isPrepaid) {
                                  message.error("Không thể chọn phòng vãng lai/chưa thanh toán cùng với phòng đã thanh toán trước.");
                                  return prev;
                                }
                                if (!hasPrepaidAlready && isPrepaid) {
                                  message.error("Không thể chọn phòng đã thanh toán trước cùng với phòng vãng lai/chưa thanh toán.");
                                  return prev;
                                }
                                if (hasPrepaidAlready && isPrepaid) {
                                  // Lấy prepaid_payment_id của phòng đã chọn trước
                                  const existingPrepaidRoom = alreadySelected.find(cr => {
                                    const amount = Number(cr.prepaid_amount || 0);
                                    return Number.isFinite(amount) && amount > 0;
                                  });
                                  const existingPrepaidPaymentId = existingPrepaidRoom
                                    ? Number(existingPrepaidRoom.prepaid_payment_id || 0)
                                    : 0;

                                  // Chặn chỉ khi cả 2 đều có payment_id hợp lệ và khác nhau
                                  if (existingPrepaidPaymentId > 0 && rPrepaidPaymentId > 0
                                    && existingPrepaidPaymentId !== rPrepaidPaymentId) {
                                    message.error("Các phòng thanh toán trước thuộc phần đặt chỗ khác nhau. Vui lòng nhận phòng riêng biệt.");
                                    return prev;
                                  }
                                }
                              }

                              set.add(r.room_id);
                              return Array.from(set);
                            });
                            setSelectionConfirmed(false);
                          }
                        };

                        const statusTone =
                          r.status === "vacant"
                            ? "border-emerald-200 bg-emerald-50/40"
                            : r.status === "occupied"
                              ? "border-rose-200 bg-rose-50/40"
                              : r.status === "reserved"
                                ? "border-amber-200 bg-amber-50/40"
                                : "border-gray-200 bg-gray-50/40";

                        return (
                          <div
                            id={`room-${r.room_id}`}
                            key={r.room_id}
                            onClick={(e) => {
                              const t = e.target as HTMLElement;
                              if (t?.closest("button")) return;
                              setActiveRoomId(r.room_id);
                            }}
                            onDoubleClick={(e) => {
                              const t = e.target as HTMLElement;
                              if (t?.closest("button")) return;
                              if (canSelectForCheckin) {
                                handleSelectForCheckin();
                              } else if (r.status === "occupied") {
                                toggleCheckoutRoom(r);
                              } else {
                                setSelectedRoomIds([]);
                                setSelectionConfirmed(false);
                                setSelectedCheckoutRoomIds([]);
                              }
                            }}
                            className={
                              "h-full flex flex-col rounded-2xl border bg-white shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden " +
                              statusTone +
                              (selected
                                ? " ring-4 ring-blue-100 border-blue-400"
                                : isCheckoutPicked
                                  ? " ring-4 ring-rose-100 border-rose-400"
                                  : "")
                            }
                          >
                            <div className="p-3 flex flex-col h-full">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-3">
                                    {thumb ? (
                                      <img
                                        alt={r.room_number}
                                        src={thumb}
                                        className="h-12 w-12 rounded-xl object-cover border border-gray-200 shrink-0"
                                        loading="lazy"
                                      />
                                    ) : null}
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-base truncate flex items-center gap-2">
                                        {r.room_number}
                                      </div>
                                      <div className="text-xs text-gray-600 mt-0.5">
                                        Tầng <b>{r.floor_number}</b>
                                        {String(r.area_name || "").trim()
                                          ? ` • ${String(r.area_name).trim()}`
                                          : ""}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {isPicked ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 font-bold bg-blue-50/80 !m-0">
                                      Đã chọn
                                    </span>
                                  ) : null}
                                  <Tag color={meta.color} className="!m-0">
                                    {meta.label}
                                  </Tag>
                                  {isPrepaid ? (
                                    <Tag color="green" className="!m-0 text-[10px] font-semibold border-green-200">
                                      Đã thanh toán trước
                                    </Tag>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="text-xs text-gray-600 truncate">
                                  {String(r.category_name || "").trim() || "-"}
                                </div>
                                {Number.isFinite(Number(r.price)) ? (
                                  <div className="text-right">
                                    <div className="text-[11px] text-gray-500">
                                      Tiền phòng/tiếng
                                    </div>
                                    <div className="text-sm font-semibold text-blue-700 whitespace-nowrap">
                                      {formatMoney(Number(r.price || 0))} / 1
                                      giờ
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              {/* Khu vực thông tin khách - luôn hiển thị với nền nền, không phụ thuộc trạng thái */}
                              <div className="mt-2 rounded-xl border bg-white/70 p-2 text-xs text-gray-700 min-h-[52px]">
                                {r.status === "occupied" || r.status === "reserved" ? (
                                  <>
                                    <div className="truncate">
                                      <span className="text-gray-400">Khách:</span>{" "}
                                      <b>{r.guest_name || "-"}</b>
                                      {r.guest_phone ? (
                                        <span className="text-gray-500"> • {r.guest_phone}</span>
                                      ) : null}
                                    </div>
                                    {r.status === "reserved" && r.expected_checkin ? (
                                      <div className="truncate mt-0.5 text-gray-500">
                                        Dự kiến:{" "}
                                        {formatDateTimeVN(String(r.expected_checkin))}
                                      </div>
                                    ) : null}
                                    {(() => {
                                      // Ưu tiên ghi chú từ đơn đặt chỗ (booking_notes) nếu có và không phải JSON
                                      // Sau đó mới đến ghi chú lưu trú (stay notes)
                                      const bNote = String(r.booking_notes || "").trim();
                                      const sNote = String(r.notes || "").trim();
                                      
                                      let displayNote = bNote || sNote;

                                      // 1. Lọc bỏ JSON hệ thống
                                      if (displayNote.startsWith("{") && displayNote.endsWith("}")) {
                                        try {
                                          JSON.parse(displayNote);
                                          displayNote = ""; 
                                        } catch (e) {}
                                      }

                                      // 2. Lọc bỏ các từ khóa hệ thống nhạy cảm
                                      const systemKeywords = [
                                        "PREPAY_UNCONFIRMED", 
                                        "PREPAY_CONFIRMED", 
                                        "online_booking",
                                        "BATCH_BOOKINGS:"
                                      ];
                                      
                                      systemKeywords.forEach(kw => {
                                        if (displayNote.includes(kw)) {
                                          displayNote = displayNote.replace(kw, "").trim();
                                        }
                                      });

                                      // Nếu rỗng sau khi lọc thì không hiển thị gì cả
                                      if (!displayNote) return null;

                                      return (
                                        <div className="mt-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 text-[11px] leading-tight">
                                          <span className="font-semibold block mb-0.5">Ghi chú:</span>
                                          <span>{displayNote}</span>
                                        </div>
                                      );
                                    })()}
                                  </>
                                ) : r.status === "cleaning" ? (
                                  <div className="text-gray-400 italic">Đang dọn dẹp...</div>
                                ) : (
                                  <div className="text-gray-400 italic">Phòng trống</div>
                                )}
                              </div>

                              <div className="mt-auto pt-3">
                                {r.status === "occupied" ? (
                                  <Space wrap>
                                    <Button
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openExtendModal(r);
                                      }}
                                    >
                                      Gia hạn
                                    </Button>
                                    <Button
                                      size="small"
                                      danger
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        checkout(r);
                                      }}
                                    >
                                      Trả phòng
                                    </Button>
                                  </Space>
                                ) : r.status === "cleaning" ? (
                                  <Button
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRoomStatus(r, "vacant");
                                    }}
                                  >
                                    Đã dọn xong
                                  </Button>
                                ) : (
                                  <Space wrap>
                                    <Button
                                      size="small"
                                      type="primary"
                                      ghost
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canSelectForCheckin) {
                                          setActiveRoomId(r.room_id);
                                          handleSelectForCheckin();
                                        }
                                      }}
                                      disabled={!canSelectForCheckin}
                                    >
                                      Nhận phòng
                                    </Button>
                                    {role === "owner" ? (
                                      <Button
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRoomStatus(r, "cleaning");
                                        }}
                                      >
                                        Dọn dẹp
                                      </Button>
                                    ) : null}
                                  </Space>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {roomsFiltered.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          Không có phòng phù hợp.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden xl:block w-[380px] shrink-0">
                    <div className="space-y-4">
                      {renderPaymentPanel()}
                      {renderHistoryPanel()}
                    </div>
                  </div>
                </div>

                <div className="xl:hidden mt-4 space-y-4">
                  {renderPaymentPanel(true)}
                  {renderHistoryPanel()}
                </div>

                {rooms.length === 0 ? (
                  <div className="text-sm text-gray-500 mt-4">
                    Chưa có phòng. Owner có thể tạo phòng ở Back-office.
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </Space>

      <Drawer
        title="Lọc & chọn phòng"
        placement="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        size="default"
        styles={{ body: { padding: 12 }, wrapper: { width: 340 } }}
      >
        {renderSidebar()}
      </Drawer>

      <Modal
        open={extendOpen}
        title="Gia hạn lưu trú"
        onCancel={() => {
          if (extendSubmitting) return;
          setExtendOpen(false);
          setExtendStayId(null);
        }}
        onOk={() => {
          void confirmExtendStay();
        }}
        okText="Xác nhận gia hạn"
        confirmLoading={extendSubmitting}
        cancelButtonProps={{ disabled: extendSubmitting }}
      >
        <div className="space-y-3 pt-2">
          <div>
            <div className="text-xs text-gray-500 mb-1">Thời gian gia hạn</div>
            <Segmented
              value={extendPreset}
              onChange={(v) => setExtendPreset(v as any)}
              options={[
                { label: "1 ngày", value: "day" },
                { label: "1 tuần", value: "week" },
                { label: "1 tháng", value: "month" },
                { label: "Chọn khác", value: "custom" },
              ]}
              disabled={extendSubmitting}
            />
          </div>

          {extendPreset === "custom" ? (
            <div>
              <div className="text-xs text-gray-500 mb-1">Nhập số ngày</div>
              <InputNumber
                min={1}
                value={extendCustomDays}
                onChange={(v) => setExtendCustomDays(Number(v || 1))}
                style={{ width: "100%" }}
                disabled={extendSubmitting}
              />
            </div>
          ) : null}

          <div className="text-xs text-gray-600">
            Gia hạn sẽ cập nhật lại mốc hết hạn để không bị tính phụ thu ngoài
            giờ trong khung mới.
          </div>
        </div>
      </Modal>

      <Modal
        open={payOpen}
        title={null}
        footer={null}
        onCancel={() => {
          if (payBusy) return;
          resetPayState();
        }}
        maskClosable={!payBusy}
        closable={!payBusy}
        destroyOnHidden
        centered={false}
        style={{ top: 32 }}
        width={660}
        styles={{ container: { borderRadius: 24, overflow: "hidden" } }}
      >
        {batchInvoice ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold">Hóa đơn</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDateTimeVN(batchInvoice.payment_time)}
                  </div>
                </div>
                <div className="rounded-full border bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-700">
                  #{batchInvoice.payment_id}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-base font-semibold text-blue-800">
                  {batchInvoice.location_name || "-"}
                </div>
                <div className="text-xs text-gray-500">{paySubTitle}</div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-gray-700">
                  Phòng đã thanh toán
                </div>
                <div className="mt-2 divide-y">
                  {batchInvoice.rooms.map((r) => (
                    <div key={r.stay_id} className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold">
                          {r.room_number || "-"}
                        </div>
                        <div className="text-sm font-bold">
                          {formatMoney(r.total_amount)}
                        </div>
                      </div>
                      <div className="mt-2 rounded-2xl border bg-white px-4 py-3">
                        {renderRoomBillDetails(r)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t pt-3 flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">Tổng thanh toán</div>
                  <div className="text-xl font-bold text-gray-800">
                    {formatMoney(batchInvoice.total_amount)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : checkoutMethod === "transfer" && transferBatchInit ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="text-2xl font-semibold">Chuyển khoản</div>
                <div className="text-sm text-gray-500">VietQR</div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                Quét QR để chuyển khoản. Sau khi chuyển xong, bấm{" "}
                <span className="font-semibold">Xác nhận đã chuyển khoản</span>.
              </div>

              <div className="mt-4 flex items-start gap-4 flex-wrap">
                <div className="shrink-0 rounded-2xl border bg-slate-50 p-3">
                  <img
                    src={transferBatchInit.qr.qr_code_url}
                    alt="VietQR"
                    className="h-48 w-48 rounded-xl"
                  />
                </div>
                <div className="min-w-[220px] flex-1 rounded-2xl border bg-white px-4 py-3">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="text-gray-500">Ngân hàng</div>
                    <div className="text-right font-semibold">
                      {transferBatchInit.qr.bank_name}
                    </div>

                    <div className="text-gray-500">Số TK</div>
                    <div className="text-right font-semibold">
                      {transferBatchInit.qr.bank_account}
                    </div>

                    <div className="text-gray-500">Chủ TK</div>
                    <div className="text-right font-semibold">
                      {transferBatchInit.qr.account_holder}
                    </div>

                    <div className="text-gray-500">Số tiền</div>
                    <div className="text-right font-bold">
                      {formatMoney(transferBatchInit.qr.amount)}
                    </div>

                    <div className="text-gray-500">Nội dung</div>
                    <div className="text-right font-semibold break-all">
                      {transferBatchInit.qr.note}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-gray-700">
                  Thông tin phòng
                </div>
                <div className="mt-2 divide-y">
                  {transferBatchInit.context.rooms.map((r) => (
                    <div key={r.stay_id} className="py-3">
                      <div className="text-sm font-semibold">
                        {r.room_number || "-"}
                      </div>
                      <div className="mt-2 rounded-2xl border bg-white px-4 py-3">
                        {renderRoomBillDetails(r)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-t pt-3 flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">Tổng thanh toán</div>
                  <div className="text-xl font-bold text-gray-800">
                    {formatMoney(transferBatchInit.context.total_amount)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  disabled={payBusy}
                  className="h-11 rounded-full"
                  onClick={() => resetPayState()}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  className="h-11 rounded-full"
                  loading={payBusy}
                  onClick={() => void confirmTransferBatchComplete()}
                >
                  Xác nhận đã chuyển khoản
                </Button>
              </div>
            </div>
          </div>
        ) : checkoutMethod === "transfer" && transferInit ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="text-2xl font-semibold">Chuyển khoản</div>
                <div className="text-sm text-gray-500">VietQR</div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                Quét QR để chuyển khoản. Sau khi chuyển xong, bấm{" "}
                <span className="font-semibold">Xác nhận đã chuyển khoản</span>.
              </div>

              <div className="mt-4 flex items-start gap-4 flex-wrap">
                <div className="shrink-0 rounded-2xl border bg-slate-50 p-3">
                  <img
                    src={transferInit.qr.qr_code_url}
                    alt="VietQR"
                    className="h-48 w-48 rounded-xl"
                  />
                </div>
                <div className="min-w-[220px] flex-1 rounded-2xl border bg-white px-4 py-3">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="text-gray-500">Ngân hàng</div>
                    <div className="text-right font-semibold">
                      {transferInit.qr.bank_name}
                    </div>

                    <div className="text-gray-500">Số TK</div>
                    <div className="text-right font-semibold">
                      {transferInit.qr.bank_account}
                    </div>

                    <div className="text-gray-500">Chủ TK</div>
                    <div className="text-right font-semibold">
                      {transferInit.qr.account_holder}
                    </div>

                    <div className="text-gray-500">Số tiền</div>
                    <div className="text-right font-bold">
                      {formatMoney(transferInit.qr.amount)}
                    </div>

                    <div className="text-gray-500">Nội dung</div>
                    <div className="text-right font-semibold break-all">
                      {transferInit.qr.note}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-gray-700">
                  Thông tin phòng
                </div>
                <div className="mt-2">
                  <div className="text-sm font-semibold">
                    {transferInit.context.room_number || "-"}
                  </div>
                  <div className="mt-2 rounded-2xl border bg-white px-4 py-3">
                    {renderRoomBillDetails(transferInit.context)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  disabled={payBusy}
                  className="h-11 rounded-full"
                  onClick={() => resetPayState()}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  className="h-11 rounded-full"
                  loading={payBusy}
                  onClick={() => void confirmTransferComplete()}
                >
                  Xác nhận đã chuyển khoản
                </Button>
              </div>
            </div>
          </div>
        ) : checkoutMethod === "cash" && cashPreview.length > 0 ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold">Tiền mặt</div>
                  {paySubTitle ? (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {paySubTitle}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-gray-500">{payTitle}</div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                Kiểm tra thông tin thanh toán. Sau khi nhận đủ tiền, bấm{" "}
                <span className="font-semibold">Xác nhận đã nhận tiền</span>.
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-gray-700">
                  Thông tin phòng
                </div>
                <div className="mt-2 divide-y">
                  {cashPreview.map((p) => (
                    <div key={p.stay_id} className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-semibold">
                          {p.context.room_number || p.room_number || "-"}
                        </div>
                        <div className="text-sm font-bold">
                          {formatMoney(p.context.total_amount)}
                        </div>
                      </div>
                      <div className="mt-2 rounded-2xl border bg-white px-4 py-3">
                        {renderRoomBillDetails(p.context)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  disabled={payBusy}
                  className="h-11 rounded-full"
                  onClick={() => resetPayState()}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  className="h-11 rounded-full"
                  loading={payBusy}
                  onClick={() => void confirmCashComplete()}
                >
                  Xác nhận đã nhận tiền
                </Button>
              </div>
            </div>
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-4">
            {invoices.map((inv) => (
              <div key={inv.payment_id}>{renderInvoice(inv)}</div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">Đang xử lý thanh toán…</div>
            <Spin />
          </div>
        )}
      </Modal>
    </>
  );
}
