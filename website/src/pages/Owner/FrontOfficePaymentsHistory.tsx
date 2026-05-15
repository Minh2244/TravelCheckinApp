import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Segmented,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import ownerApi from "../../api/ownerApi";
import FrontOfficeLayout from "../../layouts/FrontOfficeLayout";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";

type RangeKey = "day" | "week" | "month" | "year" | "all";

type HistoryRow = {
  payment_id: number;
  payment_ids?: number[];
  payment_time: string;
  amount: number;
  payment_method: string;
  transaction_source?: string;
  booking_id?: number | null;
  booking_contact_name?: string | null;
  booking_contact_phone?: string | null;
  table_name: string | null;
  total_qty: number;
  items_count: number;
  hotel?: {
    stay_id: number | null;
    room_number: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    actual_minutes: number | null;
  } | null;
  hotel_rooms?: Array<{
    stay_id: number | null;
    room_number: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    gross_amount?: number | null;
    prepaid_payment_method?: string | null;
    prepaid_amount?: number | null;
    onsite_amount?: number | null;
    total_amount: number | null;
  }> | null;
  performed_by: {
    role: "owner" | "employee" | "user" | null;
    user_id?: number | null;
    name: string | null;
    phone: string | null;
  };
  processed_by: {
    name: string | null;
    role: "owner" | "employee" | "user" | null;
  };
  items: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  prepaid_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  onsite_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  prepaid_amount?: number;
  onsite_amount?: number;
  prepaid_payment_method?: string | null;
  onsite_payment_method?: string | null;
};

const STORAGE_KEY = "tc_front_office_location_id";

const DATE_UI_FORMAT = "DD/MM/YYYY";

const formatDurationMinutes = (mins: number | null) => {
  if (mins == null) return "-";
  const m = Math.max(0, Math.floor(Number(mins || 0)));
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h} giờ ${mm} phút` : `${h} giờ`;
};

const getExecDisplay = (
  row: HistoryRow,
): { label: string; role: string | null } => {
  const role = row.processed_by?.role ?? row.performed_by?.role ?? null;
  const name = row.processed_by?.name || row.performed_by?.name || "-";
  return { label: name, role };
};

const formatPaymentMethod = (value: string | null | undefined) => {
  if (value === "Cash") return "Tiền mặt";
  if (value === "BankTransfer") return "Chuyển khoản";
  return value || "-";
};

const formatPrepaidPaymentMethod = (value: string | null | undefined) => {
  if (value === "BankTransfer") return "VietQR";
  return formatPaymentMethod(value);
};

const getPaymentTagColor = (value: string | null | undefined) => {
  if (value === "Cash") return "gold";
  if (value === "BankTransfer") return "blue";
  return "default";
};

const isMergedRestaurantInvoice = (row: HistoryRow) =>
  Number(row.prepaid_amount || 0) > 0 && Number(row.onsite_amount || 0) > 0;

const getEffectiveInvoiceTotal = (row: HistoryRow): number => {
  const prepaid = Number(row.prepaid_amount || 0);
  const onsite = Number(row.onsite_amount || 0);
  const hotelTotal = prepaid + onsite;
  if (row.hotel && Number.isFinite(hotelTotal) && hotelTotal > 0) {
    return hotelTotal;
  }
  return Number(row.amount || 0);
};

const getUniqueRoomPrepaidMethod = (row: HistoryRow): string | null => {
  const rooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
  const methods = Array.from(
    new Set(
      rooms
        .map((x) => String(x.prepaid_payment_method || "").trim())
        .filter(Boolean),
    ),
  );
  return methods.length === 1 ? methods[0] : null;
};

const resolvePaymentDisplay = (
  row: HistoryRow,
): { label: string; color: string } => {
  if (row.payment_ids && row.payment_ids.length > 1) {
    return { label: "Nhiều lần", color: "purple" };
  }

  const fallbackMethod = String(row.payment_method || "");
  if (!row.hotel) {
    return {
      label: formatPaymentMethod(fallbackMethod),
      color: getPaymentTagColor(fallbackMethod),
    };
  }

  const prepaid = Number(row.prepaid_amount || 0);
  const onsite = Number(row.onsite_amount || 0);

  if (prepaid > 0 && onsite > 0) {
    return { label: "Xem chi tiết", color: "purple" };
  }

  if (prepaid > 0 && onsite <= 0) {
    const method =
      String(row.prepaid_payment_method || "").trim() ||
      getUniqueRoomPrepaidMethod(row) ||
      fallbackMethod;
    return {
      label: formatPrepaidPaymentMethod(method),
      color: getPaymentTagColor(method),
    };
  }

  const onsiteMethod =
    String(row.onsite_payment_method || "").trim() || fallbackMethod;
  return {
    label: formatPaymentMethod(onsiteMethod),
    color: getPaymentTagColor(onsiteMethod),
  };
};

export default function FrontOfficePaymentsHistory() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationImageUrl, setLocationImageUrl] = useState<string | null>(null);

  const [range, setRange] = useState<RangeKey>("day");
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [summary, setSummary] = useState<{
    total: number;
    cash: number;
    transfer: number;
    commission_amount: number;
    owner_receivable: number;
  }>({
    total: 0,
    cash: 0,
    transfer: 0,
    commission_amount: 0,
    owner_receivable: 0,
  });
  const [series, setSeries] = useState<
    Array<{
      day: string;
      total: number;
      commission: number;
      after_commission: number;
    }>
  >([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [hoverChartIndex, setHoverChartIndex] = useState<number | null>(null);

  const role = useMemo(() => {
    const meData = asRecord(asRecord(me).data);
    return String(asRecord(meData.actor).role || "");
  }, [me]);

  const frontOfficePath =
    role === "employee" ? "/employee/front-office" : "/owner/front-office";

  const loadMeAndLocation = useCallback(async () => {
    const meRes = await ownerApi.getMe();
    setMe(meRes);

    const data = asRecord(asRecord(meRes).data);
    const actorRole = String(asRecord(data.actor).role || "");

    const qLocationId = Number(sp.get("location_id"));

    if (actorRole === "employee") {
      const ctx = asRecord(data.employee_context);
      if (!ctx.location_id) {
        message.error("Nhân viên chưa được gán địa điểm");
        navigate(frontOfficePath, { replace: true });
        return;
      }
      const id = Number(ctx.location_id);
      setLocationId(id);
      setLocationName((ctx.location_name as string | undefined) ?? null);
      return;
    }

    // Owner: if URL provides location_id, prioritize it (and persist)
    if (Number.isFinite(qLocationId) && qLocationId > 0) {
      setLocationId(qLocationId);
      localStorage.setItem(STORAGE_KEY, String(qLocationId));
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const id =
      stored && Number.isFinite(Number(stored)) ? Number(stored) : null;
    if (!id) {
      navigate("/owner/navigate", { replace: true });
      return;
    }
    setLocationId(id);
  }, [frontOfficePath, navigate, sp]);

  const loadLocationHeader = useCallback(async (resolvedLocationId: number) => {
    try {
      const ctxRes = await ownerApi.getFrontOfficeContext({
        location_id: resolvedLocationId,
      });
      const data = asRecord(asRecord(ctxRes).data);
      const loc = asRecord(data.location);
      setLocationName((loc.location_name as string | undefined) ?? null);
      const firstImage = loc.first_image;
      setLocationImageUrl(
        resolveBackendUrl(
          typeof firstImage === "string" ? firstImage : undefined,
        ) || null,
      );
    } catch {
      // keep existing
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params: any = { location_id: locationId, range, date: pickedDate };

      const res = await ownerApi.getPosPaymentsHistory(params);
      const data = asRecord(asRecord(res).data);

      setSummary({
        total: Number(asRecord(data.summary).total || 0),
        cash: Number(asRecord(data.summary).cash || 0),
        transfer: Number(asRecord(data.summary).transfer || 0),
        commission_amount: Number(
          asRecord(data.summary).commission_amount || 0,
        ),
        owner_receivable: Number(asRecord(data.summary).owner_receivable || 0),
      });

      const s = Array.isArray(data.series) ? data.series : [];
      setSeries(
        s
          .map((x: any) => ({
            day: String(x.day || ""),
            total: Number(x.total || 0),
            commission: Number(x.commission || 0),
            after_commission: Number(x.after_commission || 0),
          }))
          .filter(
            (x: any) =>
              x.day &&
              Number.isFinite(x.total) &&
              Number.isFinite(x.commission) &&
              Number.isFinite(x.after_commission),
          ),
      );

      const h = Array.isArray(data.history) ? data.history : [];
      setHistory(
        h
          .map((x: any) => {
            const r = asRecord(x);
            return {
              payment_id: Number(r.payment_id),
              payment_time: String(r.payment_time || ""),
              amount: Number(r.amount || 0),
              payment_method: String(r.payment_method || ""),
              transaction_source:
                r.transaction_source == null
                  ? undefined
                  : String(r.transaction_source),
              booking_id:
                r.booking_id == null ? null : Number(r.booking_id || 0),
              booking_contact_name:
                r.booking_contact_name == null
                  ? null
                  : String(r.booking_contact_name),
              booking_contact_phone:
                r.booking_contact_phone == null
                  ? null
                  : String(r.booking_contact_phone),
              table_name: r.table_name == null ? null : String(r.table_name),
              total_qty: Number(r.total_qty || 0),
              items_count: Number(r.items_count || 0),
              hotel:
                r.hotel == null
                  ? null
                  : {
                      stay_id:
                        asRecord(r.hotel).stay_id == null
                          ? null
                          : Number(asRecord(r.hotel).stay_id),
                      room_number:
                        asRecord(r.hotel).room_number == null
                          ? null
                          : String(asRecord(r.hotel).room_number),
                      guest_name:
                        asRecord(r.hotel).guest_name == null
                          ? null
                          : String(asRecord(r.hotel).guest_name),
                      guest_phone:
                        asRecord(r.hotel).guest_phone == null
                          ? null
                          : String(asRecord(r.hotel).guest_phone),
                      checkin_time:
                        asRecord(r.hotel).checkin_time == null
                          ? null
                          : String(asRecord(r.hotel).checkin_time),
                      checkout_time:
                        asRecord(r.hotel).checkout_time == null
                          ? null
                          : String(asRecord(r.hotel).checkout_time),
                      actual_minutes:
                        asRecord(r.hotel).actual_minutes == null
                          ? null
                          : Number(asRecord(r.hotel).actual_minutes),
                    },
              hotel_rooms: Array.isArray(r.hotel_rooms)
                ? (r.hotel_rooms as any[]).map((hr: any) => {
                    const rr = asRecord(hr);
                    return {
                      stay_id: rr.stay_id == null ? null : Number(rr.stay_id),
                      room_number:
                        rr.room_number == null ? null : String(rr.room_number),
                      guest_name:
                        rr.guest_name == null ? null : String(rr.guest_name),
                      guest_phone:
                        rr.guest_phone == null ? null : String(rr.guest_phone),
                      checkin_time:
                        rr.checkin_time == null
                          ? null
                          : String(rr.checkin_time),
                      checkout_time:
                        rr.checkout_time == null
                          ? null
                          : String(rr.checkout_time),
                      gross_amount:
                        rr.gross_amount == null
                          ? null
                          : Number(rr.gross_amount),
                      prepaid_payment_method:
                        rr.prepaid_payment_method == null
                          ? null
                          : String(rr.prepaid_payment_method),
                      prepaid_amount:
                        rr.prepaid_amount == null
                          ? null
                          : Number(rr.prepaid_amount),
                      onsite_amount:
                        rr.onsite_amount == null
                          ? null
                          : Number(rr.onsite_amount),
                      total_amount:
                        rr.total_amount == null
                          ? null
                          : Number(rr.total_amount),
                    };
                  })
                : null,
              performed_by: {
                role: (asRecord(r.performed_by).role as any) ?? null,
                user_id: (asRecord(r.performed_by).user_id as any) ?? null,
                name: (asRecord(r.performed_by).name as any) ?? null,
                phone: (asRecord(r.performed_by).phone as any) ?? null,
              },
              processed_by: {
                name: (asRecord(r.processed_by).name as any) ?? null,
                role: (asRecord(r.processed_by).role as any) ?? null,
              },
              items: Array.isArray(r.items) ? (r.items as any) : [],
              prepaid_items: Array.isArray(r.prepaid_items)
                ? (r.prepaid_items as any)
                : [],
              onsite_items: Array.isArray(r.onsite_items)
                ? (r.onsite_items as any)
                : [],
              prepaid_amount:
                r.prepaid_amount == null ? 0 : Number(r.prepaid_amount),
              onsite_amount:
                r.onsite_amount == null ? 0 : Number(r.onsite_amount),
              prepaid_payment_method:
                r.prepaid_payment_method == null
                  ? null
                  : String(r.prepaid_payment_method),
              onsite_payment_method:
                r.onsite_payment_method == null
                  ? null
                  : String(r.onsite_payment_method),
              payment_ids: Array.isArray(r.payment_ids)
                ? (r.payment_ids as any[])
                    .map((value) => Number(value))
                    .filter((value) => Number.isFinite(value))
                : undefined,
            } as HistoryRow;
          })
          .filter((x: HistoryRow) => Number.isFinite(x.payment_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải lịch sử thanh toán"));
    } finally {
      setLoading(false);
    }
  }, [locationId, pickedDate, range]);

  const selectDateFromChart = useCallback(
    (rawDay: string) => {
      const raw = String(rawDay || "").trim();
      if (raw.length < 10) return;
      const d = dayjs(raw.slice(0, 10), "YYYY-MM-DD");
      if (!d.isValid()) return;
      const next = d.format("YYYY-MM-DD");
      setPickedDate(next);
      // Backend supports range=day; switch to it so table+chart reflect that date.
      setRange("day" as any);
    },
    [setPickedDate, setRange],
  );

  useEffect(() => {
    void loadMeAndLocation();
  }, [loadMeAndLocation]);

  useEffect(() => {
    if (!locationId) return;
    void loadLocationHeader(locationId);
  }, [loadLocationHeader, locationId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const segmentedOptions = useMemo(
    () => [
      { label: "Hôm nay", value: "day" },
      { label: "7 ngày", value: "week" },
      { label: "1 tháng", value: "month" },
      { label: "1 năm", value: "year" },
      { label: "Tất cả", value: "all" },
    ],
    [],
  );

  const weekMeta = useMemo(() => {
    const anchor = dayjs(pickedDate, "YYYY-MM-DD");
    if (!anchor.isValid()) return null;
    const dow = anchor.day(); // 0=Sun
    const diffFromMonday = (dow + 6) % 7;
    const start = anchor.subtract(diffFromMonday, "day").startOf("day");
    const end = start.add(6, "day").startOf("day");
    return { start, end };
  }, [pickedDate]);

  const chartSeries = useMemo(() => series, [series]);

  const isHotelMode = useMemo(
    () => history.some((r) => Boolean(r.hotel)),
    [history],
  );

  const expandedInvoiceRender = useCallback((row: HistoryRow) => {
    const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
    const fallbackHotelRoom = row.hotel
      ? {
          stay_id: row.hotel.stay_id,
          room_number: row.hotel.room_number,
          guest_name: row.hotel.guest_name,
          guest_phone: row.hotel.guest_phone,
          checkin_time: row.hotel.checkin_time,
          checkout_time: row.hotel.checkout_time,
          gross_amount: null as number | null,
          prepaid_payment_method: null as string | null,
          prepaid_amount: null as number | null,
          onsite_amount: null as number | null,
          total_amount: null as number | null,
        }
      : null;
    const roomsForRender =
      hotelRooms.length > 0
        ? hotelRooms
        : fallbackHotelRoom
          ? [fallbackHotelRoom]
          : [];

    const effectiveTotal = getEffectiveInvoiceTotal(row);
    const paymentDisplay = resolvePaymentDisplay(row);
    const hotelPrepaidAmount = Number(row.prepaid_amount || 0);
    const hotelOnsiteAmount = Number(row.onsite_amount || 0);
    const hotelPrepaidMethodRaw =
      String(row.prepaid_payment_method || "").trim() ||
      getUniqueRoomPrepaidMethod(row) ||
      String(row.payment_method || "").trim();
    const hotelOnsiteMethodRaw =
      String(row.onsite_payment_method || "").trim() ||
      String(row.payment_method || "").trim();
    const hasMixedHotelMethods =
      Boolean(row.hotel) && hotelPrepaidAmount > 0 && hotelOnsiteAmount > 0;

    const bookedName =
      roomsForRender.find((x) => String(x.guest_name || "").trim())
        ?.guest_name ||
      row.hotel?.guest_name ||
      row.performed_by?.name ||
      "-";
    const bookedPhone =
      roomsForRender.find((x) => String(x.guest_phone || "").trim())
        ?.guest_phone ||
      row.hotel?.guest_phone ||
      row.performed_by?.phone ||
      "-";

    const prepaidItems = Array.isArray(row.prepaid_items)
      ? row.prepaid_items
      : [];
    const onsiteItems = Array.isArray(row.onsite_items) ? row.onsite_items : [];
    const hasSplitFoodSections =
      prepaidItems.length > 0 || onsiteItems.length > 0;

    const renderItemTable = (
      title: string,
      items: HistoryRow["items"],
      amount: number,
      tone: "amber" | "blue",
      paymentMethod?: string | null,
    ) => {
      if (!items.length) return null;

      const toneMap =
        tone === "amber"
          ? {
              wrapper: "border-amber-100 bg-amber-50/70",
              title: "text-amber-800",
            }
          : {
              wrapper: "border-blue-100 bg-blue-50/60",
              title: "text-blue-800",
            };

      return (
        <div className={`rounded-2xl border p-3 ${toneMap.wrapper}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`text-sm font-semibold ${toneMap.title}`}>
              {title}
            </div>
            {paymentMethod ? (
              <Tag color={getPaymentTagColor(paymentMethod)}>
                {formatPaymentMethod(paymentMethod)}
              </Tag>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
            <div>Món</div>
            <div className="text-right">SL</div>
            <div className="text-right">Giá</div>
            <div className="text-right">Thành tiền</div>
          </div>
          <div className="divide-y">
            {items.map((it) => (
              <div
                key={`${title}-${it.service_id}-${it.service_name}`}
                className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm"
              >
                <div className="min-w-0 truncate">{it.service_name}</div>
                <div className="text-right font-semibold">{it.quantity}</div>
                <div className="text-right">{formatMoney(it.unit_price)}</div>
                <div className="text-right font-semibold">
                  {formatMoney(it.line_total)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t pt-3 text-sm font-semibold">
            {formatMoney(amount)}
          </div>
        </div>
      );
    };

    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-base font-semibold text-blue-800">
              Hóa đơn #{row.payment_id}
            </div>
            <div className="text-xs text-gray-500">
              {formatDateTimeVi(row.payment_time)}
              {row.table_name ? ` • ${row.table_name}` : ""}
              {row.payment_ids && row.payment_ids.length > 1
                ? ` • ${row.payment_ids.length} lần thanh toán`
                : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Thanh toán</div>
            <div>
              <Tag color={paymentDisplay.color}>{paymentDisplay.label}</Tag>
            </div>
          </div>
        </div>

        {roomsForRender.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">
                Thông tin người đặt
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="text-gray-500">Người đặt</div>
                <div className="text-right font-semibold">{bookedName}</div>
                <div className="text-gray-500">SĐT</div>
                <div className="text-right font-semibold">{bookedPhone}</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">
                Tổng thanh toán
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {roomsForRender.length} phòng
                </div>
                <div className="text-xl font-bold">
                  {formatMoney(effectiveTotal)}
                </div>
              </div>
              {hasMixedHotelMethods ? (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">Trả trước</span>
                    <Tag color={getPaymentTagColor(hotelPrepaidMethodRaw)}>
                      {formatPrepaidPaymentMethod(hotelPrepaidMethodRaw)}
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      Gia hạn/Lố giờ
                    </span>
                    <Tag color={getPaymentTagColor(hotelOnsiteMethodRaw)}>
                      {formatPaymentMethod(hotelOnsiteMethodRaw)}
                    </Tag>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Chi tiết phòng
            </div>
            <div className="space-y-2">
              {roomsForRender.map((rm, idx) => (
                <div
                  key={`${rm.stay_id ?? "x"}-${rm.room_number ?? "-"}-${idx}`}
                  className="rounded-2xl border bg-white p-3"
                >
                  {(() => {
                    const roomAmount =
                      rm.gross_amount != null
                        ? Number(rm.gross_amount)
                        : rm.total_amount != null
                          ? Number(rm.total_amount)
                          : roomsForRender.length > 0
                            ? Number(effectiveTotal || 0) /
                              roomsForRender.length
                            : 0;
                    const hasPrepaid = Number(rm.prepaid_amount || 0) > 0;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-800">
                            {rm.room_number || "-"}
                          </div>
                          <div className="font-bold">
                            {formatMoney(roomAmount)}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          <div className="text-gray-500">Nhận phòng</div>
                          <div className="text-right font-medium">
                            {rm.checkin_time
                              ? formatDateTimeVi(rm.checkin_time)
                              : "-"}
                          </div>
                          <div className="text-gray-500">Trả phòng</div>
                          <div className="text-right font-medium">
                            {rm.checkout_time
                              ? formatDateTimeVi(rm.checkout_time)
                              : "-"}
                          </div>
                          <div className="text-gray-500">Thành tiền</div>
                          <div className="text-right font-semibold">
                            {formatMoney(roomAmount)}
                          </div>
                          {hasPrepaid ? (
                            <>
                              <div className="text-gray-500">Đã trả trước</div>
                              <div className="text-right font-semibold text-green-700">
                                {formatMoney(Number(rm.prepaid_amount || 0))}
                                {rm.prepaid_payment_method
                                  ? ` (${formatPaymentMethod(rm.prepaid_payment_method)})`
                                  : ""}
                              </div>
                              <div className="text-gray-500">Tại quầy</div>
                              <div className="text-right font-semibold">
                                {formatMoney(
                                  Number(
                                    rm.onsite_amount ?? rm.total_amount ?? 0,
                                  ),
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        ) : hasSplitFoodSections ? (
          <div className="mt-3 space-y-3">
            {renderItemTable(
              "Món khách đã thanh toán trước khi check-in",
              prepaidItems,
              Number(row.prepaid_amount || 0),
              "amber",
              row.prepaid_payment_method,
            )}
            {renderItemTable(
              "Món gọi thêm tại bàn",
              onsiteItems,
              Number(row.onsite_amount || 0),
              "blue",
              row.onsite_payment_method,
            )}
          </div>
        ) : Array.isArray(row.items) && row.items.length > 0 ? (
          <div className="mt-3">
            <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
              <div>Món</div>
              <div className="text-right">SL</div>
              <div className="text-right">Giá</div>
              <div className="text-right">Thành tiền</div>
            </div>
            <div className="divide-y">
              {row.items.map((it) => (
                <div
                  key={`${it.service_id}-${it.service_name}`}
                  className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm"
                >
                  <div className="min-w-0 truncate">{it.service_name}</div>
                  <div className="text-right font-semibold">{it.quantity}</div>
                  <div className="text-right">{formatMoney(it.unit_price)}</div>
                  <div className="text-right font-semibold">
                    {formatMoney(it.line_total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? null : (
          <div className="mt-4 flex items-end justify-between gap-4 border-t pt-3">
            <div className="text-sm text-gray-600">
              Số món: <b>{row.items_count || row.items.length}</b> • Tổng SL:{" "}
              <b>{row.total_qty}</b>
            </div>
            <div className="text-lg font-bold">{formatMoney(row.amount)}</div>
          </div>
        )}
      </div>
    );
  }, []);

  const hotelColumns = useMemo(
    () => [
      {
        title: "Hóa đơn",
        dataIndex: "payment_id",
        render: (v: number) => (
          <span className="font-semibold text-blue-700">#{v}</span>
        ),
      },
      {
        title: "Thời gian",
        dataIndex: "payment_time",
        render: (v: string) => (
          <span className="text-xs">{formatDateTimeVi(v)}</span>
        ),
      },
      {
        title: "Phòng/Bàn",
        render: (_: unknown, row: HistoryRow) =>
          row.hotel?.room_number || row.table_name || "-",
      },
      {
        title: "Khách",
        render: (_: unknown, row: HistoryRow) => row.hotel?.guest_name || "-",
      },
      {
        title: "SĐT",
        render: (_: unknown, row: HistoryRow) => row.hotel?.guest_phone || "-",
      },
      {
        title: "Nhận phòng",
        render: (_: unknown, row: HistoryRow) =>
          row.hotel?.checkin_time
            ? formatDateTimeVi(row.hotel.checkin_time)
            : "-",
      },
      {
        title: "Trả phòng",
        render: (_: unknown, row: HistoryRow) =>
          row.hotel?.checkout_time
            ? formatDateTimeVi(row.hotel.checkout_time)
            : "-",
      },
      {
        title: "Tổng thời gian",
        render: (_: unknown, row: HistoryRow) =>
          row.hotel ? formatDurationMinutes(row.hotel.actual_minutes) : "-",
      },
      {
        title: "Số tiền",
        dataIndex: "amount",
        render: (v: number, row: HistoryRow) => {
          const prepaid = Number(row.prepaid_amount || 0);
          const onsite = Number(row.onsite_amount || 0);
          const hotelTotal = prepaid + onsite;
          const displayAmount =
            row.hotel && Number.isFinite(hotelTotal) && hotelTotal > 0
              ? hotelTotal
              : Number(v || 0);
          return <b>{formatMoney(displayAmount)}</b>;
        },
      },
      {
        title: "Thanh toán",
        dataIndex: "payment_method",
        render: (_v: string, row: HistoryRow) => {
          const paymentDisplay = resolvePaymentDisplay(row);
          return <Tag color={paymentDisplay.color}>{paymentDisplay.label}</Tag>;
        },
      },
      {
        title: "Người thực hiện",
        dataIndex: ["processed_by", "name"],
        render: (_: unknown, row: HistoryRow) => {
          const exec = getExecDisplay(row);
          const role = exec.role;
          const roleLabel =
            role === "owner"
              ? "Owner"
              : role === "employee"
                ? "Nhân viên"
                : null;
          return (
            <span>
              {exec.label}
              {roleLabel ? (
                <span className="text-xs text-gray-500"> ({roleLabel})</span>
              ) : null}
            </span>
          );
        },
      },
      {
        title: "Khách đặt trước",
        render: (_: unknown, row: HistoryRow) => {
          const hasBookingLink =
            row.booking_id != null && Number(row.booking_id) > 0;
          const hasHotelPrepaid = Number(row.prepaid_amount || 0) > 0;
          const isOnlineBooking =
            String(row.transaction_source || "").toLowerCase() ===
            "online_booking";
          if (!hasBookingLink && !hasHotelPrepaid && !isOnlineBooking)
            return "-";

          const hotelRooms = Array.isArray(row.hotel_rooms)
            ? row.hotel_rooms
            : [];
          const firstWithGuest = hotelRooms.find(
            (x) =>
              Boolean(String(x.guest_name || "").trim()) ||
              Boolean(String(x.guest_phone || "").trim()),
          );
          const guestName =
            (row.booking_contact_name &&
              String(row.booking_contact_name).trim()) ||
            (firstWithGuest?.guest_name &&
              String(firstWithGuest.guest_name).trim()) ||
            (row.hotel?.guest_name && String(row.hotel.guest_name).trim()) ||
            "-";

          const guestPhone =
            (row.booking_contact_phone &&
              String(row.booking_contact_phone).trim()) ||
            (firstWithGuest?.guest_phone &&
              String(firstWithGuest.guest_phone).trim()) ||
            (row.hotel?.guest_phone && String(row.hotel.guest_phone).trim()) ||
            "";

          if (!guestName || guestName === "-") return "-";
          return guestPhone ? `${guestName} (${guestPhone})` : guestName;
        },
      },
    ],
    [],
  );

  const restaurantColumns = useMemo(
    () => [
      {
        title: "Hóa đơn",
        dataIndex: "payment_id",
        render: (v: number) => (
          <span className="font-semibold text-blue-700">#{v}</span>
        ),
      },
      {
        title: "Thời gian",
        dataIndex: "payment_time",
        render: (v: string) => (
          <span className="text-xs">{formatDateTimeVi(v)}</span>
        ),
      },
      {
        title: "Bàn",
        dataIndex: "table_name",
        render: (v: string | null) => v || "-",
      },
      {
        title: "Người đặt trước",
        render: (_: unknown, row: HistoryRow) => {
          const name = String(row.booking_contact_name || "").trim();
          if (name) return name;
          if (row.performed_by?.role !== "user") return "-";
          return row.performed_by?.name || "-";
        },
      },
      {
        title: "SĐT",
        render: (_: unknown, row: HistoryRow) => {
          const phone = String(row.booking_contact_phone || "").trim();
          if (phone) return phone;
          if (row.performed_by?.role !== "user") return "-";
          return row.performed_by?.phone || "-";
        },
      },
      {
        title: "Tổng SL",
        dataIndex: "total_qty",
        render: (v: number) => <b>{Number(v || 0)}</b>,
      },
      {
        title: "Số tiền",
        dataIndex: "amount",
        render: (v: number) => <b>{formatMoney(v)}</b>,
      },
      {
        title: "Thanh toán",
        dataIndex: "payment_method",
        render: (v: string, row: HistoryRow) =>
          isMergedRestaurantInvoice(row) ? (
            <span className="text-xs text-gray-400">Xem chi tiết</span>
          ) : (
            <Tag color={getPaymentTagColor(v)}>{formatPaymentMethod(v)}</Tag>
          ),
      },
      {
        title: "Người thực hiện",
        dataIndex: ["processed_by", "name"],
        render: (_: unknown, row: HistoryRow) => {
          const exec = getExecDisplay(row);
          const role = exec.role;
          const roleLabel =
            role === "owner"
              ? "Owner"
              : role === "employee"
                ? "Nhân viên"
                : null;
          return (
            <span>
              {exec.label}
              {roleLabel ? (
                <span className="text-xs text-gray-500"> ({roleLabel})</span>
              ) : null}
            </span>
          );
        },
      },
    ],
    [],
  );

  const columns = useMemo<any[]>(
    () => (isHotelMode ? hotelColumns : restaurantColumns),
    [isHotelMode, hotelColumns, restaurantColumns],
  );

  const columnsWithExpand = useMemo<any[]>(
    () => [...columns, Table.EXPAND_COLUMN],
    [columns],
  );

  return (
    <FrontOfficeLayout
      title="Lịch sử thanh toán"
      locationName={locationName}
      locationImageUrl={locationImageUrl}
      onBack={() => navigate(frontOfficePath, { replace: true })}
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Segmented
              options={segmentedOptions}
              value={range}
              onChange={(v) => setRange(v as RangeKey)}
            />
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <DatePicker
                value={dayjs(pickedDate, "YYYY-MM-DD") as any}
                format={DATE_UI_FORMAT}
                onChange={(_d: any, dateString: string | null) => {
                  if (!dateString) return;
                  const next = dayjs(dateString, DATE_UI_FORMAT);
                  if (!next.isValid()) return;
                  setPickedDate(next.format("YYYY-MM-DD"));
                }}
                allowClear={false}
              />
              <Button onClick={() => void loadHistory()} loading={loading}>
                Tải lại
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <Card size="small">
            <div className="text-xs text-gray-500">Tổng doanh thu</div>
            <div className="text-lg font-bold">
              {formatMoney(summary.total)}
            </div>
          </Card>
          <Card size="small">
            <div className="text-xs text-gray-500">Tiền mặt</div>
            <div className="text-lg font-bold">{formatMoney(summary.cash)}</div>
          </Card>
          <Card size="small">
            <div className="text-xs text-gray-500">Chuyển khoản</div>
            <div className="text-lg font-bold">
              {formatMoney(summary.transfer)}
            </div>
          </Card>
          <Card size="small">
            <div className="text-xs text-gray-500">Hoa hồng</div>
            <div className="text-lg font-bold text-amber-600">
              {formatMoney(summary.commission_amount)}
            </div>
          </Card>
          <Card size="small">
            <div className="text-xs text-gray-500">Tổng nhận</div>
            <div className="text-lg font-bold text-emerald-600">
              {formatMoney(summary.owner_receivable)}
            </div>
          </Card>
        </div>

        <Card title="Biểu đồ doanh thu">
          {range === "week" && weekMeta ? (
            <div className="mb-2 text-xs text-gray-500">
              Tuần: {weekMeta.start.format(DATE_UI_FORMAT)} -{" "}
              {weekMeta.end.format(DATE_UI_FORMAT)}
            </div>
          ) : null}

          {chartSeries.length === 0 ? (
            <div className="text-sm text-gray-500">Chưa có dữ liệu.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded bg-amber-500" />
                  <span>Hoa hồng</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded bg-emerald-600" />
                  <span>Owner nhận</span>
                </div>
              </div>

              {(() => {
                const n = chartSeries.length;
                const W = 720;
                const H = 240;
                const padX = 28;
                const padTop = 16;
                const padBottom = 44;

                const plotW = W - padX * 2;
                const plotH = H - padTop - padBottom;

                const niceCeil = (v: number) => {
                  const x = Math.max(1, Number(v || 0));
                  const exp = Math.floor(Math.log10(x));
                  const base = 10 ** exp;
                  const f = x / base;
                  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
                  return nice * base;
                };

                const maxTotal = Math.max(
                  1,
                  ...chartSeries.map((x: any) =>
                    Math.max(
                      0,
                      Number(x.after_commission || 0) +
                        Number(x.commission || 0),
                    ),
                  ),
                );
                const yMax = niceCeil(maxTotal);
                const y0 = padTop + plotH;

                const toY = (value: number) => {
                  const ratio = yMax <= 0 ? 0 : value / yMax;
                  const clamped = Math.max(0, Math.min(1, ratio));
                  return padTop + (1 - clamped) * plotH;
                };

                const canDrillDown = range === "week" || range === "month";

                const labelEvery = (() => {
                  // Reduce label density when there are many points.
                  if (n <= 12) return 1;
                  if (n <= 24) return 2;
                  if (n <= 36) return 3;
                  if (n <= 48) return 4;
                  if (n <= 72) return 6;
                  if (n <= 120) return 10;
                  return 20;
                })();

                const minWidth = Math.max(520, Math.min(6000, n * 28));

                const points = chartSeries.map((x: any, i) => {
                  const rawDay = String(x.day || "");
                  const ownerValue = Number(x.after_commission || 0);
                  const commissionValue = Number(x.commission || 0);
                  const totalValue = Math.max(0, ownerValue + commissionValue);

                  const slotW = plotW / n;
                  const barW = Math.max(6, Math.min(28, slotW * 0.66));
                  const barX = padX + slotW * i + (slotW - barW) / 2;

                  const getDowLabel = (d: dayjs.Dayjs) =>
                    ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.day()];

                  let dayLabel = rawDay;
                  let subLabel = "";
                  let titleLabel = rawDay;

                  if (range === "day") {
                    const hh = rawDay.includes("T")
                      ? rawDay.split("T")[1]?.slice(0, 2) || ""
                      : "";
                    dayLabel = hh;
                    titleLabel = rawDay.includes("T")
                      ? `${rawDay.slice(0, 10)} ${hh}:00`
                      : rawDay;
                  } else if (range === "week" || range === "month") {
                    const d = dayjs(rawDay, "YYYY-MM-DD");
                    if (d.isValid()) {
                      titleLabel = d.format("DD/MM/YYYY");
                      if (range === "week") {
                        dayLabel = d.format("DD/MM");
                        subLabel = getDowLabel(d);
                      } else {
                        dayLabel = d.format("DD");
                        subLabel = "";
                      }
                    }
                  } else {
                    const d = dayjs(rawDay, "YYYY-MM");
                    if (d.isValid()) {
                      titleLabel = d.format("MM/YYYY");
                      dayLabel =
                        range === "year"
                          ? d.format("MM")
                          : // all: shorter label to avoid crowding
                            d.format("MM/YY");
                      subLabel = "";
                    }
                  }

                  const yOwnerTop = toY(ownerValue);
                  const yTotalTop = toY(totalValue);

                  return {
                    key: `${rawDay || i}`,
                    rawDay,
                    barX,
                    barW,
                    ownerValue,
                    commissionValue,
                    totalValue,
                    yOwnerTop,
                    yTotalTop,
                    y0,
                    dayLabel,
                    subLabel,
                    titleLabel,
                  };
                });

                const hoverIdx =
                  hoverChartIndex == null
                    ? null
                    : Math.max(0, Math.min(n - 1, hoverChartIndex));
                const hp = hoverIdx == null ? null : points[hoverIdx];

                const onLeave = () => setHoverChartIndex(null);

                return (
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[520px]" style={{ minWidth }}>
                      <svg
                        ref={chartSvgRef}
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        height={240}
                        role="img"
                        aria-label="Biểu đồ doanh thu"
                        onMouseLeave={onLeave}
                        onClick={() => {
                          if (!hp) return;
                          if (!canDrillDown) return;
                          selectDateFromChart(hp.rawDay);
                        }}
                      >
                        {/* grid */}
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = padTop + (plotH * i) / 4;
                          return (
                            <line
                              key={i}
                              x1={padX}
                              y1={y}
                              x2={W - padX}
                              y2={y}
                              stroke="currentColor"
                              className="text-gray-100"
                              strokeWidth={2}
                            />
                          );
                        })}

                        <line
                          x1={padX}
                          y1={padTop + plotH}
                          x2={W - padX}
                          y2={padTop + plotH}
                          stroke="currentColor"
                          className="text-gray-200"
                          strokeWidth={2}
                        />

                        {/* stacked columns */}
                        {points.map((p, i) => {
                          const ownerH = Math.max(0, p.y0 - p.yOwnerTop);
                          const commissionTop = p.yTotalTop;
                          const commissionH = Math.max(
                            0,
                            p.yOwnerTop - commissionTop,
                          );
                          const slotW = plotW / n;
                          const slotX = padX + slotW * i;
                          return (
                            <g
                              key={`bar-${p.key}`}
                              onMouseEnter={() => setHoverChartIndex(i)}
                              onMouseMove={() => setHoverChartIndex(i)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canDrillDown) return;
                                selectDateFromChart(p.rawDay);
                              }}
                              style={{
                                cursor: canDrillDown ? "pointer" : "default",
                              }}
                            >
                              <rect
                                x={slotX}
                                y={padTop}
                                width={slotW}
                                height={plotH}
                                fill="transparent"
                              />
                              <rect
                                x={p.barX}
                                y={p.yOwnerTop}
                                width={p.barW}
                                height={ownerH}
                                rx={3}
                                fill="currentColor"
                                className="text-emerald-600"
                                opacity={0.95}
                              />
                              <rect
                                x={p.barX}
                                y={commissionTop}
                                width={p.barW}
                                height={commissionH}
                                rx={3}
                                fill="currentColor"
                                className="text-amber-500"
                                opacity={0.95}
                              />
                            </g>
                          );
                        })}

                        {/* hover crosshair + tooltip */}
                        {!hp ? null : (
                          <g>
                            <line
                              x1={hp.barX + hp.barW / 2}
                              y1={padTop}
                              x2={hp.barX + hp.barW / 2}
                              y2={padTop + plotH}
                              stroke="currentColor"
                              className="text-gray-200"
                              strokeWidth={2}
                            />

                            {(() => {
                              const boxW = 210;
                              const boxH = 98;
                              const boxX = Math.max(
                                8,
                                Math.min(
                                  W - boxW - 8,
                                  hp.barX + hp.barW / 2 + 12,
                                ),
                              );
                              const topY = hp.yTotalTop;
                              const boxY = Math.max(
                                8,
                                Math.min(
                                  padTop + plotH - boxH - 8,
                                  topY - boxH - 10,
                                ),
                              );

                              const pct =
                                hp.totalValue > 0
                                  ? (hp.commissionValue / hp.totalValue) * 100
                                  : 0;

                              return (
                                <g>
                                  <rect
                                    x={boxX}
                                    y={boxY}
                                    width={boxW}
                                    height={boxH}
                                    rx={10}
                                    fill="currentColor"
                                    className="text-gray-800"
                                    opacity={0.92}
                                  />

                                  <text
                                    x={boxX + 12}
                                    y={boxY + 22}
                                    fontSize={12}
                                    fill="#fff"
                                  >
                                    {hp.titleLabel}
                                  </text>

                                  <g>
                                    <rect
                                      x={boxX + 12}
                                      y={boxY + 30}
                                      width={10}
                                      height={10}
                                      fill="currentColor"
                                      className="text-emerald-600"
                                    />
                                    <text
                                      x={boxX + 28}
                                      y={boxY + 39}
                                      fontSize={12}
                                      fill="#fff"
                                    >
                                      {`Owner nhận: ${formatMoney(hp.ownerValue)}`}
                                    </text>
                                  </g>
                                  <g>
                                    <rect
                                      x={boxX + 12}
                                      y={boxY + 48}
                                      width={10}
                                      height={10}
                                      fill="currentColor"
                                      className="text-amber-500"
                                    />
                                    <text
                                      x={boxX + 28}
                                      y={boxY + 57}
                                      fontSize={12}
                                      fill="#fff"
                                    >
                                      {`Hoa hồng: ${formatMoney(hp.commissionValue)}`}
                                    </text>
                                  </g>
                                  <g>
                                    <text
                                      x={boxX + 12}
                                      y={boxY + 75}
                                      fontSize={12}
                                      fill="#fff"
                                    >
                                      {`Tổng: ${formatMoney(hp.totalValue)}  (${pct.toFixed(1)}% hoa hồng)`}
                                    </text>
                                  </g>
                                </g>
                              );
                            })()}
                          </g>
                        )}

                        {points.map((p, i) => {
                          const show = i % labelEvery === 0 || i === n - 1;
                          if (!show) return null;
                          const hasTop = Boolean(
                            String(p.dayLabel || "").trim(),
                          );
                          const hasBottom = Boolean(
                            String(p.subLabel || "").trim(),
                          );
                          if (!hasTop && !hasBottom) return null;
                          return (
                            <g
                              key={`lbl-${p.key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canDrillDown) return;
                                selectDateFromChart(p.rawDay);
                              }}
                              style={{
                                cursor: canDrillDown ? "pointer" : "default",
                              }}
                            >
                              {!hasTop ? null : (
                                <text
                                  x={p.barX + p.barW / 2}
                                  y={H - 24}
                                  textAnchor="middle"
                                  fontSize={11}
                                  fill="currentColor"
                                  className="text-gray-500"
                                >
                                  {p.dayLabel}
                                </text>
                              )}
                              {!hasBottom ? null : (
                                <text
                                  x={p.barX + p.barW / 2}
                                  y={H - 10}
                                  textAnchor="middle"
                                  fontSize={11}
                                  fill="currentColor"
                                  className="text-gray-500"
                                >
                                  {p.subLabel}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>

        <Card title="Lịch sử hóa đơn">
          <Table<HistoryRow>
            rowKey={(r) => String(r.payment_id)}
            loading={loading}
            dataSource={history}
            pagination={false}
            scroll={{ y: 340, x: true }}
            expandable={{
              columnTitle: <span className="whitespace-nowrap">Chi tiết</span>,
              columnWidth: 90,
              expandedRowRender: expandedInvoiceRender,
            }}
            columns={columnsWithExpand}
          />
        </Card>
      </Space>
    </FrontOfficeLayout>
  );
}
