import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import {
  DollarOutlined,
  WalletOutlined,
  CreditCardOutlined,
  ReloadOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ShopOutlined,
  PrinterOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { useReactToPrint } from "react-to-print";
import { exportInvoiceExcel } from "../../utils/exportInvoiceExcel";
import InvoicePrintTemplate from "../../components/InvoicePrintTemplate";

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



type HistoryRow = {
  payment_id: number;
  payment_time: string;
  amount: number;
  payment_method: string;
  transaction_source?: string;
  booking_id?: number | null;
  booking_ids?: number[];
  booking_status?: string | null;
  invoice_code?: string | null;
  invoice_no?: number;
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
  voucher_code?: string | null;
  discount_amount?: number;
  final_amount?: number;
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
  invoice_no?: number;
  invoice_code?: string | null;
  payment_time: string;
  payment_method?: string | null;
  booking_status?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  total_qty: number;
  total_amount: number;
  voucher_code?: string | null;
  discount_amount?: number;
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

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(
    null,
  );

  // No chart state variables needed

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

  // selectDateFromChart removed

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
              booking_status:
                r.booking_status == null ? null : String(r.booking_status),
              invoice_code:
                r.invoice_code == null ? null : String(r.invoice_code),
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
              voucher_code: r.voucher_code == null ? null : String(r.voucher_code),
              discount_amount: r.discount_amount == null ? undefined : Number(r.discount_amount),
              final_amount: r.final_amount == null ? undefined : Number(r.final_amount),
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

  // weekMeta and chartSeries removed

  const isHotelMode = useMemo(
    () => history.some((r) => Boolean(r.hotel)),
    [history],
  );

  const opStats = useMemo(() => {
    let totalOrders = 0;
    let totalQty = 0;
    let onlineOrders = 0;
    let onlineRevenue = 0;
    let posOrders = 0;
    let posRevenue = 0;

    if (isTouristLocation) {
      const invs = invoiceSummary?.invoices ?? [];
      totalOrders = invs.length;
      invs.forEach((row) => {
        const qty = Number(row.total_qty || 0);
        const amt = Number(row.total_amount || 0);
        totalQty += qty;
        if (row.source === "pos") {
          posOrders++;
          posRevenue += amt;
        } else {
          onlineOrders++;
          onlineRevenue += amt;
        }
      });
    } else {
      totalOrders = history.length;
      history.forEach((row) => {
        const qty = Number(row.total_qty || 0);
        const amt = Number(row.amount || 0);
        totalQty += qty;
        
        const isOnline = (row.booking_id != null && Number(row.booking_id) > 0) || row.transaction_source === "online_booking";
        if (isOnline) {
          onlineOrders++;
          onlineRevenue += amt;
        } else {
          posOrders++;
          posRevenue += amt;
        }
      });
    }

    return {
      totalOrders,
      totalQty,
      onlineOrders,
      onlineRevenue,
      posOrders,
      posRevenue,
    };
  }, [history, invoiceSummary, isTouristLocation]);

  const getExecDisplay = useCallback((row: HistoryRow) => {
    const role = row.performed_by?.role;
    let label = "Hệ thống";
    if (role === "owner" || role === "employee") {
      label = row.performed_by.name || "Nhân viên";
    } else if (role === "user") {
      label = "Khách hàng";
    }
    return { role, label };
  }, []);

  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<HistoryRow | null>(null);

  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
    documentTitle: printData
      ? (() => {
          const t = printData.hotel ? "hotel" : printData.items ? "restaurant" : "tourist";
          const pfx = t === "hotel" ? "RS" : t === "restaurant" ? "DI" : "SB";
          const code = printData.booking_id && Number(printData.booking_id) > 0
            ? `${pfx}-${printData.booking_id}`
            : `${pfx}-POS-${printData.payment_id}`;
          return `Hoa_don_${code}`;
        })()
      : "Hoa_don",
  });

  const handlePrintRow = useCallback((row: HistoryRow) => {
    setPrintData(row);
    setTimeout(() => {
      handlePrintTrigger();
    }, 100);
  }, [handlePrintTrigger]);

  const handleExportRowExcel = useCallback(async (row: HistoryRow) => {
    try {
      await exportInvoiceExcel(row as any, getExecDisplay(row).label, row);
      message.success("Xuất Excel thành công!");
    } catch (err: any) {
      message.error("Lỗi xuất Excel: " + err?.message);
    }
  }, [getExecDisplay]);

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

    const isHotel = roomsForRender.length > 0;
    const prefix = isHotel ? "RS" : isTouristLocation ? "SB" : "DI";

    return (
      <div className="rounded-2xl border bg-white p-4 font-sans">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-base font-semibold text-blue-800 flex items-center flex-wrap gap-2">
              {row.invoice_code ? `Hóa đơn ${row.invoice_code}` : `Hóa đơn ${row.booking_id != null && Number(row.booking_id) > 0 ? `#${prefix}-${row.booking_id}` : `#${prefix}-POS-${row.payment_id}`}`}
              {row.booking_status === "cancelled" && (
                <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-xs">ĐÃ HỦY ĐƠN</span>
              )}
              {row.booking_status === "partial_cancelled" && (
                <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded text-xs">HỦY MỘT PHẦN</span>
              )}
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

        {row.voucher_code ? (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="text-sm font-semibold text-emerald-800">🎫 Voucher áp dụng</div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Mã:</span>
                <span className="ml-1 font-semibold">{row.voucher_code}</span>
              </div>
              <div>
                <span className="text-slate-500">Giảm:</span>
                <span className="ml-1 font-semibold text-red-600">-{formatMoney(row.discount_amount || 0)}</span>
              </div>
              <div>
                <span className="text-slate-500">Thực tế:</span>
                <span className="ml-1 font-semibold">{formatMoney(row.final_amount || row.amount)}</span>
              </div>
            </div>
          </div>
        ) : null}

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
                  className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm font-sans"
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
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrintRow(row)}
          >
            In PDF
          </Button>
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={() => handleExportRowExcel(row)}
          >
            Xuất Excel
          </Button>
        </div>
      </div>
    );
  }, [handlePrintRow, handleExportRowExcel]);

  const hotelColumns = useMemo(
    () => [
      {
        title: "Hóa đơn",
        render: (_: unknown, row: HistoryRow) => {
          const vcTag = row.voucher_code ? <Tag color="purple" className="ml-1">VC</Tag> : null;
          const cancelTag = row.booking_status === "cancelled" ? (
            <span className="bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1 block mt-1 w-fit">ĐÃ HỦY ĐƠN</span>
          ) : row.booking_status === "partial_cancelled" ? (
            <span className="bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1 block mt-1 w-fit">HỦY MỘT PHẦN</span>
          ) : null;
          if (row.booking_ids && row.booking_ids.length > 1) {
            return (
              <div className="flex flex-col gap-1 items-start">
                <span className="font-semibold text-blue-700">
                  {row.invoice_code ? (
                    <>
                      {row.invoice_code}
                      {vcTag}
                    </>
                  ) : (
                    <>
                      #RS-BATCH{vcTag}
                      <br />
                      <span className="text-xs text-gray-500 font-normal">
                        ({row.booking_ids.map(id => `#RS-${id}`).join(", ")})
                      </span>
                    </>
                  )}
                </span>
                <span className="mt-1">
                  <Tag color="blue" className="ml-1 px-1 py-0 text-[10px]">Đặt trước</Tag>
                </span>
                {cancelTag}
              </div>
            );
          }
          const singleId = row.booking_id != null && Number(row.booking_id) > 0 ? row.booking_id : (row.booking_ids && row.booking_ids.length === 1 ? row.booking_ids[0] : null);
          if (singleId) {
            return (
              <div>
                <span className="font-semibold text-blue-700">
                  {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#RS-{singleId}{vcTag}</>}
                </span>
                <span className="mt-1">
                  <Tag color="blue" className="ml-1 px-1 py-0 text-[10px]">Đặt trước</Tag>
                </span>
                {cancelTag}
              </div>
            );
          }
          return (
            <div>
              <span className="font-medium text-blue-700">
                {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#RS-POS-{row.payment_id}{vcTag}</>}
              </span>
              <span className="mt-1">
                <Tag color="orange" className="ml-1 px-1 py-0 text-[10px]">Tại quầy</Tag>
              </span>
              {cancelTag}
            </div>
          );
        },
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
        render: (_: unknown, row: HistoryRow) => {
          const vcTag = row.voucher_code ? <Tag color="purple" className="ml-1">VC</Tag> : null;
          const cancelTag = row.booking_status === "cancelled" ? (
            <span className="bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1 block mt-1 w-fit">ĐÃ HỦY ĐƠN</span>
          ) : null;
          if (row.booking_id != null && Number(row.booking_id) > 0) {
            return (
              <div>
                <span className="font-semibold text-blue-700">
                  {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#DI-{row.booking_id}{vcTag}</>}
                </span>
                <span className="mt-1">
                  <Tag color="blue" className="ml-1 px-1 py-0 text-[10px]">Đặt trước</Tag>
                </span>
                {cancelTag}
              </div>
            );
          }
          return (
            <div>
              <span className="font-semibold text-blue-700">
                {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#DI-POS-{row.payment_id}{vcTag}</>}
              </span>
              <span className="mt-1">
                <Tag color="orange" className="ml-1 px-1 py-0 text-[10px]">Tại quầy</Tag>
              </span>
              {cancelTag}
            </div>
          );
        },
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
        title: "Hóa đơn",
        width: 140,
        render: (_: unknown, row: TicketInvoiceRow) => {
          const vcTag = row.voucher_code ? <Tag color="purple" className="ml-1">VC</Tag> : null;
          const cancelTag = row.booking_status === "cancelled" ? (
            <span className="bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[10px] ml-1 block mt-1 w-fit">ĐÃ HỦY ĐƠN</span>
          ) : null;
          if (row.booking_id != null && Number(row.booking_id) > 0) {
            return (
              <div>
                <span className="font-semibold text-blue-700">
                  {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#SB-{row.booking_id}{vcTag}</>}
                </span>
                <span className="mt-1">
                  <Tag color="blue" className="ml-1 px-1 py-0 text-[10px]">Đặt trước</Tag>
                </span>
                {cancelTag}
              </div>
            );
          }
          return (
            <div>
              <span className="font-semibold text-blue-700">
                {row.invoice_code ? <>{row.invoice_code}{vcTag}</> : <>#SB-POS-{row.payment_id}{vcTag}</>}
              </span>
              <span className="mt-1">
                <Tag color="orange" className="ml-1 px-1 py-0 text-[10px]">Tại quầy</Tag>
              </span>
              {cancelTag}
            </div>
          );
        },
      },
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
      Table.EXPAND_COLUMN,
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
        <Card loading={loading} className="shadow-sm border-slate-100 rounded-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 mb-1">Lịch sử tổng hợp</h1>
              <p className="text-xs text-slate-400">Xem và đối soát doanh thu của các địa điểm theo thời gian</p>
            </div>
            
            <div className="flex flex-wrap flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Địa điểm:</span>
                <Select
                  style={{ minWidth: 220 }}
                  value={locationId ?? undefined}
                  placeholder="Chọn địa điểm"
                  onChange={(v) => setLocationId(Number(v))}
                  options={locations.map((l) => ({
                    label: l.location_name,
                    value: l.location_id,
                  }))}
                  className="rounded-lg hover:border-emerald-500 transition-colors"
                />
              </div>

              <div className="hidden sm:block h-6 w-px bg-slate-200" />

              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  options={segmentedOptions}
                  value={range}
                  onChange={(v) => setRange(v as RangeKey)}
                  className="bg-slate-100 p-0.5 rounded-lg text-xs"
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
                  className="rounded-lg py-1.5"
                />
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => void loadData()} 
                  loading={loading}
                  className="rounded-lg flex items-center border-slate-200 hover:border-emerald-500 text-slate-600 hover:text-emerald-600"
                >
                  Tải lại
                </Button>
              </div>
            </div>
          </div>
        </Card>


        <div style={{ display: "none" }}>
          {printData && (
            <InvoicePrintTemplate
              ref={printRef}
              invoice={printData as any}
              currentUserName={getExecDisplay(printData).label}
              detailPayment={printData as any}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Tổng doanh thu</div>
              <div className="text-2xl font-extrabold text-emerald-950">
                {formatMoney(summary.total)}
              </div>
            </div>
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-inner">
              <DollarOutlined style={{ fontSize: "22px" }} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Tiền mặt</div>
              <div className="text-2xl font-extrabold text-amber-950">
                {formatMoney(summary.cash)}
              </div>
            </div>
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-inner">
              <WalletOutlined style={{ fontSize: "22px" }} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Chuyển khoản</div>
              <div className="text-2xl font-extrabold text-blue-950">
                {formatMoney(summary.transfer)}
              </div>
            </div>
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-inner">
              <CreditCardOutlined style={{ fontSize: "22px" }} />
            </div>
          </div>
        </div>

        {/* Operational Statistics widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50/50 border border-violet-100 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">
                {isTouristLocation ? "Tổng số vé đã bán" : "Tổng số hóa đơn"}
              </div>
              <div className="text-xl font-bold text-violet-950">
                {isTouristLocation ? `${opStats.totalQty} vé` : `${opStats.totalOrders} đơn`}
              </div>
              <div className="text-xs text-violet-500 mt-1">
                {isTouristLocation ? `Từ ${opStats.totalOrders} lượt thanh toán` : `Hoàn tất giao dịch`}
              </div>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">
              <FileTextOutlined style={{ fontSize: "18px" }} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 border border-sky-100 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider mb-1">Đặt trước (Online)</div>
              <div className="text-xl font-bold text-sky-950">
                {formatMoney(opStats.onlineRevenue)}
              </div>
              <div className="text-xs text-sky-500 mt-1">
                {opStats.onlineOrders} {isTouristLocation ? "lượt đặt vé" : "hóa đơn"}
              </div>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">
              <GlobalOutlined style={{ fontSize: "18px" }} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100 rounded-2xl p-4 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1">Bán tại quầy (POS)</div>
              <div className="text-xl font-bold text-rose-950">
                {formatMoney(opStats.posRevenue)}
              </div>
              <div className="text-xs text-rose-500 mt-1">
                {opStats.posOrders} {isTouristLocation ? "lượt mua quầy" : "hóa đơn"}
              </div>
            </div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <ShopOutlined style={{ fontSize: "18px" }} />
            </div>
          </div>
        </div>

        <Card 
          title={
            <div className="flex items-center justify-between w-full">
              <span>{isTouristLocation ? "Lịch sử vé" : "Lịch sử hóa đơn"}</span>
              <span className="text-xs font-normal text-slate-400">
                Hiển thị {isTouristLocation ? `${topInvoices.length} lượt` : `${history.length} hóa đơn`}
              </span>
            </div>
          }
        >
          {isTouristLocation ? (
            <Table<TicketInvoiceRow>
              rowKey={(r, idx) => String(r.payment_id ?? r.booking_id ?? idx)}
              loading={loading}
              dataSource={topInvoices}
              pagination={false}
              scroll={{ y: 420, x: 'max-content' }}
              columns={invoiceColumns}
              expandable={{
                columnTitle: (
                  <span className="whitespace-nowrap">Chi tiết</span>
                ),
                columnWidth: 90,
                expandedRowRender: (row) => (
                  <div className="rounded-2xl border bg-white p-4 font-sans">
                    {row.voucher_code && row.voucher_code.trim() && (
                      <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
                        <span className="text-sm font-bold text-emerald-700">
                          🎫 Voucher: {row.voucher_code}
                        </span>
                        {Number(row.discount_amount || 0) > 0 && (
                          <span className="text-sm font-semibold text-rose-600">
                            Giảm: -{formatMoney(Number(row.discount_amount))}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-sm font-semibold text-blue-800 mb-2">
                      Chi tiết vé
                    </div>
                    <Table<TicketInvoiceItem>
                      rowKey={(it, idx) =>
                        String(it.service_id ?? `${it.service_name}-${idx}`)
                      }
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
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
              scroll={{ y: 420, x: 'max-content' }}
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
