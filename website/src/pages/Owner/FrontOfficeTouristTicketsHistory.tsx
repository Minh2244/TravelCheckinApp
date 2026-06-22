import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  DatePicker,
  Segmented,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import ownerApi from "../../api/ownerApi";
import FrontOfficeLayout from "../../layouts/FrontOfficeLayout";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";
import PosCard from "../../modules/frontOffice/components/PosCard";
import PosStatCard from "../../modules/frontOffice/components/PosStatCard";

type RangeKey = "day" | "week" | "month" | "year" | "all";

type TicketInvoiceItem = {
  service_id: number | null;
  service_name: string;
  quantity: number;
  used_quantity?: number;
  unit_price: number;
  line_total: number;
};

type TicketInvoiceRow = {
  source: "booking" | "pos";
  payment_id: number | null;
  booking_id: number | null;
  invoice_no?: number;
  payment_time: string;
  payment_method?: string | null;
  booking_status?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  total_qty: number;
  total_amount: number;
  commission_amount?: number;
  owner_receivable?: number;
  check_in_date?: string | null;
  voucher_code?: string | null;
  discount_amount?: number;
  items: TicketInvoiceItem[];
};

type InvoiceSummary = {
  date: string;
  invoices: TicketInvoiceRow[];
};

type PaymentsSummary = {
  total: number;
  cash: number;
  transfer: number;
  commission_amount?: number;
};

type SeriesPoint = {
  day: string;
  total: number;
  commission: number;
  after_commission: number;
};

const STORAGE_KEY = "tc_front_office_location_id";
const DATE_UI_FORMAT = "DD/MM/YYYY";

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

export default function FrontOfficeTouristTicketsHistory() {
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

  const [summary, setSummary] = useState<PaymentsSummary>({
    total: 0,
    cash: 0,
    transfer: 0,
  });
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(
    null,
  );

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

  const loadData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [payRes, invoiceRes] = await Promise.all([
        ownerApi.getPosPaymentsHistory({
          location_id: locationId,
          range,
          date: pickedDate,
        }),
        ownerApi.getTouristTicketInvoices({
          location_id: locationId,
          range,
          date: pickedDate,
        }),
      ]);

      const payData = asRecord(asRecord(payRes).data);
      setSummary({
        total: Number(asRecord(payData.summary).total || 0),
        cash: Number(asRecord(payData.summary).cash || 0),
        transfer: Number(asRecord(payData.summary).transfer || 0),
        commission_amount: Number(asRecord(payData.summary).commission_amount || 0),
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

      setInvoiceSummary((invoiceRes?.data as InvoiceSummary) || null);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải lịch sử vé"));
    } finally {
      setLoading(false);
    }
  }, [locationId, pickedDate, range]);

  useEffect(() => {
    void loadMeAndLocation();
  }, [loadMeAndLocation]);

  useEffect(() => {
    if (!locationId) return;
    void loadLocationHeader(locationId);
  }, [loadLocationHeader, locationId]);

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

  const chartSeries = useMemo(() => series, [series]);

  const weekMeta = useMemo(() => {
    const anchor = dayjs(pickedDate, "YYYY-MM-DD");
    if (!anchor.isValid()) return null;
    const dow = anchor.day(); // 0=Sun
    const diffFromMonday = (dow + 6) % 7;
    const start = anchor.subtract(diffFromMonday, "day").startOf("day");
    const end = start.add(6, "day").startOf("day");
    return { start, end };
  }, [pickedDate]);

  const topInvoices = useMemo(() => {
    const inv = invoiceSummary?.invoices ?? [];
    const sorted = [...inv].sort(
      (a, b) =>
        dayjs(b.payment_time).valueOf() - dayjs(a.payment_time).valueOf(),
    );
    return sorted;
  }, [invoiceSummary]);

  const ticketStats = useMemo(() => {
    let soldOnline = 0;
    let soldPos = 0;
    let usedOnline = 0;
    let revenueOnline = 0;
    let revenuePos = 0;

    topInvoices.forEach((inv) => {
      const amount = Number(inv.total_amount || 0);
      if (inv.source === "pos") {
        soldPos += Number(inv.total_qty || 0);
        revenuePos += amount;
      } else {
        soldOnline += Number(inv.total_qty || 0);
        revenueOnline += amount;
        if (Array.isArray(inv.items)) {
          inv.items.forEach((it) => {
            usedOnline += Number(it.used_quantity || 0);
          });
        }
      }
    });

    const totalUsed = usedOnline + soldPos;

    return {
      soldOnline,
      soldPos,
      usedOnline,
      totalUsed,
      revenueOnline,
      revenuePos,
    };
  }, [topInvoices]);

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
                  #SB-{row.booking_id}
                  {vcTag}
                </span>
                {cancelTag}
              </div>
            );
          }
          return (
            <div>
              <span className="font-semibold text-blue-700">
                #SB-POS-{row.payment_id}
                {vcTag}
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
        title: "Ngày sử dụng",
        dataIndex: "check_in_date",
        width: 155,
        render: (v: unknown, row: TicketInvoiceRow) => {
          if (row.source === "pos") {
            return <span className="text-gray-600 font-medium">{formatDateTimeVi(String(row.payment_time || ""))}</span>;
          }
          return v ? (
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
              {dayjs(String(v)).format("DD/MM/YYYY")}
            </span>
          ) : "-";
        },
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
        title: "Hoa hồng",
        dataIndex: "commission_amount",
        width: 130,
        align: "right",
        render: (v: number) => (
          <span className="font-semibold text-amber-700">
            {v && v > 0 ? formatMoney(v) : "0 đ"}
          </span>
        ),
      },
      {
        title: "Thực nhận",
        dataIndex: "owner_receivable",
        width: 140,
        align: "right",
        render: (v: number, row: TicketInvoiceRow) => {
          const rec = v != null ? Number(v) : (Number(row.total_amount || 0) - Number(row.commission_amount || 0));
          return (
            <span className="font-bold text-green-700">
              {formatMoney(rec)}
            </span>
          );
        },
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
    <FrontOfficeLayout
      title="Lịch sử vé"
      locationName={locationName}
      locationImageUrl={locationImageUrl}
      locationId={locationId}
      onBack={() => navigate(frontOfficePath, { replace: true })}
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <PosCard>
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
                  <Button onClick={() => void loadData()} loading={loading}>
                    Tải lại
                  </Button>
                </div>
              </div>
            </PosCard>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <PosStatCard
                label="Tổng doanh thu"
                value={formatMoney(summary.total)}
                tone="slate"
              />
              <PosStatCard
                label="Tiền mặt"
                value={formatMoney(summary.cash)}
                tone="amber"
              />
              <PosStatCard
                label="Chuyển khoản"
                value={formatMoney(summary.transfer)}
                tone="sky"
              />
              <PosStatCard
                label="Hoa hồng"
                value={formatMoney(summary.commission_amount || 0)}
                tone="amber"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-center flex flex-col justify-between">
                <div>
                  <div className="text-xs text-sky-600 font-semibold uppercase tracking-wider">Đặt trước Online</div>
                  <div className="text-xl font-bold text-sky-800 mt-1">{ticketStats.soldOnline} vé</div>
                </div>
                <div className="text-xs text-sky-500 font-semibold mt-1 border-t border-sky-100/50 pt-1">
                  {formatMoney(ticketStats.revenueOnline)}
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex flex-col justify-between">
                <div>
                  <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Bán tại quầy</div>
                  <div className="text-xl font-bold text-emerald-800 mt-1">{ticketStats.soldPos} vé</div>
                </div>
                <div className="text-xs text-emerald-500 font-semibold mt-1 border-t border-emerald-100/50 pt-1">
                  {formatMoney(ticketStats.revenuePos)}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center flex flex-col justify-between">
                <div>
                  <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Đặt trước đã soát</div>
                  <div className="text-xl font-bold text-blue-800 mt-1">{ticketStats.usedOnline} vé</div>
                </div>
                <div className="text-xs text-blue-400 font-medium mt-1 border-t border-blue-100/50 pt-1">
                  Soát chi tiết
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-center flex flex-col justify-between">
                <div>
                  <div className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Tổng đã soát</div>
                  <div className="text-xl font-bold text-amber-800 mt-1">{ticketStats.totalUsed} vé</div>
                </div>
                <div className="text-xs text-amber-400 font-medium mt-1 border-t border-amber-100/50 pt-1">
                  Đã hoàn tất
                </div>
              </div>
            </div>

            <PosCard title="Biểu đồ doanh thu">
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
                  <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#f59e0b" }} />
                  <span>Hoa hồng</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#059669" }} />
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
                                fill="#059669"
                                opacity={0.95}
                              />
                              <rect
                                x={p.barX}
                                y={commissionTop}
                                width={p.barW}
                                height={commissionH}
                                rx={3}
                                fill="#f59e0b"
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
                              const boxH = 92;
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
                                  <text
                                    x={boxX + 12}
                                    y={boxY + 42}
                                    fontSize={12}
                                    fill="#fff"
                                  >
                                    {`Owner nhận: ${formatMoney(hp.ownerValue)}`}
                                  </text>
                                  <text
                                    x={boxX + 12}
                                    y={boxY + 60}
                                    fontSize={12}
                                    fill="#fff"
                                  >
                                    {`Hoa hồng: ${formatMoney(hp.commissionValue)}`}
                                  </text>
                                  <text
                                    x={boxX + 12}
                                    y={boxY + 78}
                                    fontSize={12}
                                    fill="#fff"
                                  >
                                    {`Tổng: ${formatMoney(hp.totalValue)} (${pct.toFixed(1)}%)`}
                                  </text>
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
                            <g key={`lbl-${p.key}`}>
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
            </PosCard>

            <PosCard title="Lịch sử vé" className="mt-1" bodyClassName="px-1">
              <Table
                rowKey={(r) =>
                  `${r.source}-${String(r.payment_id ?? "")}-${String(
                    r.booking_id ?? "",
                  )}-${String(r.payment_time || "")}`
                }
                dataSource={topInvoices}
                size="middle"
                pagination={false}
                sticky
                scroll={{ x: 'max-content', y: 260 }}
                columns={invoiceColumns}
                expandable={{
                  columnTitle: (
                    <span className="whitespace-nowrap">Chi tiết</span>
                  ),
                  expandIconColumnIndex: invoiceColumns.length,
                  columnWidth: 90,
                  expandedRowRender: (row) => {
                    const items = Array.isArray(row.items)
                      ? (row.items as TicketInvoiceItem[])
                      : [];
                    const hasVoucher = row.voucher_code && row.voucher_code.trim();
                    const discount = Number(row.discount_amount || 0);
                    return (
                      <div className="px-6 py-2">
                        {hasVoucher && (
                          <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
                            <span className="text-sm font-bold text-emerald-700">
                              🎫 Voucher: {row.voucher_code}
                            </span>
                            {discount > 0 && (
                              <span className="text-sm font-semibold text-rose-600">
                                Giảm: -{formatMoney(discount)}
                              </span>
                            )}
                          </div>
                        )}
                        <Table
                          rowKey={(it, idx) =>
                            `${String(it.service_id ?? "x")}-${idx}`
                          }
                          dataSource={items}
                          size="small"
                          pagination={false}
                          scroll={{ x: 'max-content' }}
                          columns={itemColumns}
                        />
                      </div>
                    );
                  },
                  rowExpandable: (row) =>
                    Array.isArray(row.items) && row.items.length > 0,
                }}
                locale={{ emptyText: "Chưa có dữ liệu." }}
              />
            </PosCard>
      </Space>
    </FrontOfficeLayout>
  );
}
