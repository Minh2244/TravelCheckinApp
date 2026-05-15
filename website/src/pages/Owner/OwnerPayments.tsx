import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Button,
  Card,
  DatePicker,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type RangeKey = "day" | "week" | "month" | "year" | "all";

type LocationRow = {
  location_id: number;
  location_name: string;
  status: string;
  location_type: string;
};

type PaymentsSummary = {
  total: number;
  cash: number;
  transfer: number;
};

type SeriesPoint = {
  day: string;
  total: number;
  commission: number;
  after_commission: number;
};

type HistoryRow = {
  payment_id: number;
  payment_time: string;
  amount: number;
  payment_method: string;
  transaction_source?: string;
  booking_id?: number | null;
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
    total_amount: number | null;
  }> | null;
  performed_by: {
    role: "owner" | "employee" | "user" | null;
    user_id?: number | null;
    name: string | null;
    phone: string | null;
  };
  processed_by: { name: string | null };
  items: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

type TicketInvoiceItem = {
  service_id: number | null;
  service_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type TicketInvoiceRow = {
  source: "booking" | "pos";
  payment_id: number | null;
  booking_id: number | null;
  payment_time: string;
  payment_method?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  total_qty: number;
  total_amount: number;
  items: TicketInvoiceItem[];
};

type InvoiceSummary = {
  date: string;
  invoices: TicketInvoiceRow[];
};

const STORAGE_KEY = "tc_owner_payments_location_id";
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
  const role = row.performed_by?.role ?? null;
  const name = row.processed_by?.name || row.performed_by?.name || "-";
  return { label: name, role };
};

const renderPaymentMethodTag = (method: unknown) => {
  const raw = method == null ? "" : String(method);
  const m = raw.trim().toLowerCase();
  if (!m) return "-";

  const isCash =
    m === "cash" ||
    m.includes("cash") ||
    m.includes("tien mat") ||
    m.includes("tiền mặt");
  const isTransfer =
    m === "transfer" ||
    m.includes("transfer") ||
    m.includes("bank") ||
    m.includes("chuyen") ||
    m.includes("chuyển");

  if (isCash) return <Tag color="gold">TIỀN MẶT</Tag>;
  if (isTransfer) return <Tag color="blue">CHUYỂN KHOẢN</Tag>;
  return <Tag>{raw}</Tag>;
};

export default function OwnerPayments() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [locationId, setLocationId] = useState<number | null>(null);
  const selectedLocation = useMemo(() => {
    if (!locationId) return null;
    return (
      locations.find((l) => Number(l.location_id) === Number(locationId)) ||
      null
    );
  }, [locationId, locations]);

  const [range, setRange] = useState<RangeKey>("day");
  const [pickedDate, setPickedDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [summary, setSummary] = useState<PaymentsSummary>({
    total: 0,
    cash: 0,
    transfer: 0,
  });
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(
    null,
  );

  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [hoverChartIndex, setHoverChartIndex] = useState<number | null>(null);

  const isTouristLocation = useMemo(() => {
    const t = String(selectedLocation?.location_type || "").toLowerCase();
    return t.includes("tour") || t.includes("ticket") || t === "tourist";
  }, [selectedLocation?.location_type]);

  const loadMeAndLocations = useCallback(async () => {
    const meRes = await ownerApi.getMe();
    const data = asRecord(asRecord(meRes).data);
    const actorRole = String(asRecord(data.actor).role || "");
    if (actorRole === "employee") {
      navigate("/employee/front-office", { replace: true });
      return;
    }

    const locRes = await ownerApi.getLocations();
    const locs = (locRes?.data || []) as LocationRow[];
    setLocations(locs);

    const qLocationId = Number(sp.get("location_id"));
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedId =
      stored && Number.isFinite(Number(stored)) ? Number(stored) : null;

    const fallbackId = locs.length > 0 ? Number(locs[0].location_id) : null;
    const nextId =
      Number.isFinite(qLocationId) && qLocationId > 0
        ? qLocationId
        : storedId || fallbackId;
    if (nextId) setLocationId(nextId);
  }, [navigate, sp]);

  const selectDateFromChart = useCallback(
    (rawDay: string) => {
      const raw = String(rawDay || "").trim();
      if (raw.length < 10) return;
      const d = dayjs(raw.slice(0, 10), "YYYY-MM-DD");
      if (!d.isValid()) return;
      setPickedDate(d.format("YYYY-MM-DD"));
      setRange("day");
    },
    [setPickedDate, setRange],
  );

  const loadData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const payResP = ownerApi.getPosPaymentsHistory({
        location_id: locationId,
        range,
        date: pickedDate,
      });
      const invoiceResP = isTouristLocation
        ? ownerApi.getTouristTicketInvoices({
            location_id: locationId,
            range,
            date: pickedDate,
          })
        : Promise.resolve(null);

      const [payRes, invoiceRes] = await Promise.all([payResP, invoiceResP]);

      const payData = asRecord(asRecord(payRes).data);
      setSummary({
        total: Number(asRecord(payData.summary).total || 0),
        cash: Number(asRecord(payData.summary).cash || 0),
        transfer: Number(asRecord(payData.summary).transfer || 0),
      });

      const s = Array.isArray(payData.series) ? payData.series : [];
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

      if (isTouristLocation) {
        setInvoiceSummary(
          (invoiceRes as any)?.data
            ? ((invoiceRes as any).data as InvoiceSummary)
            : null,
        );
        setHistory([]);
        return;
      }

      setInvoiceSummary(null);
      const h = Array.isArray(payData.history) ? payData.history : [];
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
              },
              items: Array.isArray(r.items) ? (r.items as any) : [],
            } as HistoryRow;
          })
          .filter((x: HistoryRow) => Number.isFinite(x.payment_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải lịch sử thanh toán"));
    } finally {
      setLoading(false);
    }
  }, [isTouristLocation, locationId, pickedDate, range]);

  useEffect(() => {
    void loadMeAndLocations();
  }, [loadMeAndLocations]);

  useEffect(() => {
    if (!locationId) return;
    localStorage.setItem(STORAGE_KEY, String(locationId));
    if (Number(locationId) > 0) {
      const next = new URLSearchParams(sp);
      next.set("location_id", String(locationId));
      setSp(next, { replace: true });
    }
  }, [locationId, setSp, sp]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    const dow = anchor.day();
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
          total_amount: null as number | null,
        }
      : null;
    const roomsForRender =
      hotelRooms.length > 0
        ? hotelRooms
        : fallbackHotelRoom
          ? [fallbackHotelRoom]
          : [];

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
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Thanh toán</div>
            <div>
              <Tag color={row.payment_method === "Cash" ? "gold" : "blue"}>
                {row.payment_method === "Cash"
                  ? "Tiền mặt"
                  : row.payment_method === "BankTransfer"
                    ? "Chuyển khoản"
                    : row.payment_method}
              </Tag>
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
                  {formatMoney(row.amount)}
                </div>
              </div>
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">
                      {rm.room_number || "-"}
                    </div>
                    <div className="font-bold">
                      {rm.total_amount != null
                        ? formatMoney(rm.total_amount)
                        : "-"}
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
                      {rm.total_amount != null
                        ? formatMoney(rm.total_amount)
                        : "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
        render: (v: number) => <b>{formatMoney(v)}</b>,
      },
      {
        title: "Thanh toán",
        dataIndex: "payment_method",
        render: (v: string) => (
          <Tag color={v === "Cash" ? "gold" : "blue"}>
            {v === "Cash"
              ? "Tiền mặt"
              : v === "BankTransfer"
                ? "Chuyển khoản"
                : v}
          </Tag>
        ),
      },
      {
        title: "Người thực hiện",
        dataIndex: ["processed_by", "name"],
        render: (_: unknown, row: HistoryRow) => {
          const exec = getExecDisplay(row);
          const r = exec.role;
          const roleLabel =
            r === "owner" ? "Owner" : r === "employee" ? "Nhân viên" : null;
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
        title: "Checkin/đặt trước",
        render: (_: unknown, row: HistoryRow) => {
          if (row.performed_by?.role !== "user") return "-";
          const name = row.performed_by?.name || "-";
          const phone = row.performed_by?.phone;
          return phone ? `${name} (${phone})` : name;
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
          if (row.performed_by?.role !== "user") return "-";
          return row.performed_by?.name || "-";
        },
      },
      {
        title: "SĐT",
        render: (_: unknown, row: HistoryRow) => {
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
        render: (v: string) => (
          <Tag color={v === "Cash" ? "gold" : "blue"}>
            {v === "Cash"
              ? "Tiền mặt"
              : v === "BankTransfer"
                ? "Chuyển khoản"
                : v}
          </Tag>
        ),
      },
      {
        title: "Người thực hiện",
        dataIndex: ["processed_by", "name"],
        render: (_: unknown, row: HistoryRow) => {
          const exec = getExecDisplay(row);
          const r = exec.role;
          const roleLabel =
            r === "owner" ? "Owner" : r === "employee" ? "Nhân viên" : null;
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

  const paymentColumns = useMemo<any[]>(
    () => (isHotelMode ? hotelColumns : restaurantColumns),
    [hotelColumns, isHotelMode, restaurantColumns],
  );

  const renderInvoiceItemsSummary = (items: TicketInvoiceItem[]) => {
    if (!items?.length) return "-";
    return items
      .map((it) => {
        const name = String(it.service_name || "-");
        const qty = Number(it.quantity || 0);
        return qty > 0 ? `${name} x${qty}` : name;
      })
      .filter(Boolean)
      .join(", ");
  };

  const topInvoices = useMemo(() => {
    const inv = invoiceSummary?.invoices ?? [];
    const sorted = [...inv].sort(
      (a, b) =>
        dayjs(b.payment_time).valueOf() - dayjs(a.payment_time).valueOf(),
    );
    return sorted;
  }, [invoiceSummary]);

  const invoiceColumns = useMemo<ColumnsType<TicketInvoiceRow>>(
    () => [
      {
        title: "Ngày giờ",
        dataIndex: "payment_time",
        width: 170,
        render: (v: unknown) => formatDateTimeVi(String(v || "")),
      },
      {
        title: "Nguồn",
        dataIndex: "source",
        width: 110,
        render: (v: TicketInvoiceRow["source"]) => (
          <Tag color={v === "pos" ? "geekblue" : "green"}>
            {v === "pos" ? "TẠI QUẦY" : "ONLINE"}
          </Tag>
        ),
      },
      {
        title: "Phương thức",
        dataIndex: "payment_method",
        width: 140,
        render: renderPaymentMethodTag,
      },
      {
        title: "Người bán",
        dataIndex: "seller_name",
        width: 180,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "Khách",
        dataIndex: "buyer_name",
        width: 160,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "SĐT",
        dataIndex: "buyer_phone",
        width: 140,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "Số lượng",
        dataIndex: "total_qty",
        width: 100,
        align: "right",
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Tổng tiền",
        dataIndex: "total_amount",
        width: 140,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "Nội dung",
        dataIndex: "items",
        render: (items: TicketInvoiceItem[]) =>
          renderInvoiceItemsSummary(Array.isArray(items) ? items : []),
      },
    ],
    [],
  );

  const itemColumns = useMemo<ColumnsType<TicketInvoiceItem>>(
    () => [
      {
        title: "Hạng vé",
        dataIndex: "service_name",
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "SL",
        dataIndex: "quantity",
        width: 80,
        align: "right",
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Đơn giá",
        dataIndex: "unit_price",
        width: 120,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "Thành tiền",
        dataIndex: "line_total",
        width: 140,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
    ],
    [],
  );

  return (
    <MainLayout>
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Card title="Lịch sử tổng hợp" loading={loading}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-600">Địa điểm</div>
              <Select
                style={{ minWidth: 260 }}
                value={locationId ?? undefined}
                placeholder="Chọn địa điểm"
                onChange={(v) => setLocationId(Number(v))}
                options={locations.map((l) => ({
                  label: l.location_name,
                  value: l.location_id,
                }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-end">
              <Segmented
                options={segmentedOptions}
                value={range}
                onChange={(v) => setRange(v as RangeKey)}
              />
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
              <Button onClick={() => void loadData()} loading={loading}>
                Tải lại
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                        range === "year" ? d.format("MM") : d.format("MM/YY");
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

                const onMove = (e: MouseEvent<SVGSVGElement>) => {
                  if (!chartSvgRef.current) return;
                  const rect = chartSvgRef.current.getBoundingClientRect();
                  if (!rect.width) return;
                  const mx = ((e.clientX - rect.left) / rect.width) * W;
                  const slotW = plotW / n;
                  const idx = Math.floor((mx - padX) / slotW);
                  const clamped = Math.max(0, Math.min(n - 1, idx));
                  setHoverChartIndex(clamped);
                };

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
                        onMouseMove={onMove}
                        onMouseLeave={onLeave}
                        onClick={() => {
                          if (!hp) return;
                          if (!canDrillDown) return;
                          selectDateFromChart(hp.rawDay);
                        }}
                      >
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

                        {points.map((p) => {
                          const ownerH = Math.max(0, p.y0 - p.yOwnerTop);
                          const commissionTop = p.yTotalTop;
                          const commissionH = Math.max(
                            0,
                            p.yOwnerTop - commissionTop,
                          );
                          return (
                            <g
                              key={`bar-${p.key}`}
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

        <Card title={isTouristLocation ? "Lịch sử vé" : "Lịch sử hóa đơn"}>
          {isTouristLocation ? (
            <Table<TicketInvoiceRow>
              rowKey={(r, idx) => String(r.payment_id ?? r.booking_id ?? idx)}
              loading={loading}
              dataSource={topInvoices}
              pagination={false}
              scroll={{ y: 420, x: true }}
              columns={invoiceColumns}
              expandable={{
                columnTitle: (
                  <span className="whitespace-nowrap">Chi tiết</span>
                ),
                expandedRowRender: (row) => (
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-semibold text-blue-800 mb-2">
                      Chi tiết vé
                    </div>
                    <Table<TicketInvoiceItem>
                      rowKey={(it, idx) =>
                        String(it.service_id ?? `${it.service_name}-${idx}`)
                      }
                      size="small"
                      pagination={false}
                      scroll={{ y: 240, x: true }}
                      dataSource={Array.isArray(row.items) ? row.items : []}
                      columns={itemColumns}
                    />
                  </div>
                ),
              }}
            />
          ) : (
            <Table<HistoryRow>
              rowKey={(r) => String(r.payment_id)}
              loading={loading}
              dataSource={history}
              pagination={false}
              scroll={{ y: 420, x: true }}
              expandable={{
                columnTitle: (
                  <span className="whitespace-nowrap">Chi tiết</span>
                ),
                expandIconColumnIndex: paymentColumns.length,
                columnWidth: 90,
                expandedRowRender: expandedInvoiceRender,
              }}
              columns={paymentColumns}
            />
          )}
        </Card>
      </Space>
    </MainLayout>
  );
}
