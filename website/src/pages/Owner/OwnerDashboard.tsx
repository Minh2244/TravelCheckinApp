import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  GiftOutlined,
  PlusOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { useNavigate } from "react-router-dom";
import { asRecord, getErrorMessage } from "../../utils/safe";
import dayjs from "dayjs";
import { formatDateTimeVi, formatDateVi } from "../../utils/formatDateVi";

type BookingRow = {
  booking_id: number;
  status: string;
  created_at?: string;
  user_name?: string;
  location_name?: string;
  service_name?: string;
  final_amount?: number;
};

type PaymentRow = {
  payment_id: number;
  status: string;
  amount: number;
  payment_time?: string;
  location_id?: number;
  location_name?: string;
};

type LocationRow = {
  location_id: number;
  location_name: string;
  status: string;
  location_type: string;
};

type CommissionRow = {
  status: string;
  total_due?: number | string | null;
};

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);

  const [chartSeries, setChartSeries] = useState<
    Array<{
      day: string;
      total: number;
      commission: number;
      after_commission: number;
    }>
  >([]);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [hoverChartIndex, setHoverChartIndex] = useState<number | null>(null);

  const [range, setRange] = useState<
    "today" | "week" | "month" | "year" | "all"
  >("today");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const role = String(asRecord(asRecord(asRecord(me).data).actor).role || "");

  const windowRange = useMemo(() => {
    if (selectedDate) {
      const from = dayjs(selectedDate, "YYYY-MM-DD").startOf("day");
      const to = dayjs(selectedDate, "YYYY-MM-DD").endOf("day");
      return { from, to };
    }

    const end = dayjs().endOf("day");
    if (range === "today") {
      return { from: dayjs().startOf("day"), to: end };
    }
    if (range === "week") {
      return { from: dayjs().subtract(6, "day").startOf("day"), to: end };
    }
    if (range === "month") {
      return { from: dayjs().subtract(1, "month").startOf("day"), to: end };
    }
    if (range === "year") {
      return { from: dayjs().subtract(1, "year").startOf("day"), to: end };
    }
    return { from: null, to: null };
  }, [range, selectedDate]);

  const periodLabel = useMemo(() => {
    if (selectedDate) return `ngày ${formatDateVi(selectedDate)}`;
    if (range === "today") return "hôm nay";
    if (range === "week") return "7 ngày";
    if (range === "month") return "1 tháng";
    if (range === "year") return "1 năm";
    return "tất cả";
  }, [range, selectedDate]);

  const inWindow = useMemo(() => {
    if (!windowRange.from || !windowRange.to) return () => true;
    const from = windowRange.from;
    const to = windowRange.to;
    return (raw: unknown) => {
      const s = String(raw || "").trim();
      if (!s) return false;
      const d = dayjs(s);
      if (!d.isValid()) return false;
      const t = d.valueOf();
      return t >= from.valueOf() && t <= to.valueOf();
    };
  }, [windowRange.from, windowRange.to]);

  const filteredBookings = useMemo(
    () => bookings.filter((b) => inWindow(b.created_at)),
    [bookings, inWindow],
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => inWindow(p.payment_time)),
    [payments, inWindow],
  );

  const stats = useMemo(() => {
    const totalLocations = locations.length;

    const pendingBookings = filteredBookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "pending" || s === "confirmed";
    }).length;

    const totalRevenue = filteredPayments.reduce((sum, p) => {
      if (String(p.status || "").toLowerCase() !== "completed") return sum;
      const v = Number(p.amount || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    const totalCommissionDue = commissions.reduce((sum, c) => {
      const status = String(c.status || "").toLowerCase();
      if (role === "owner" && status !== "pending") return sum;
      const v = Number(c.total_due || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    return {
      totalLocations,
      pendingBookings,
      totalRevenue,
      totalCommissionDue,
    };
  }, [commissions, filteredBookings, filteredPayments, locations.length, role]);

  const topRevenueLocation = useMemo(() => {
    const completed = filteredPayments.filter((p) => p.status === "completed");
    if (completed.length === 0) return null;

    const map = new Map<
      number,
      {
        location_id: number;
        location_name: string;
        revenue: number;
        count: number;
      }
    >();

    for (const p of completed) {
      const id = Number((p as PaymentRow).location_id);
      if (!Number.isFinite(id)) continue;
      const name = String(p.location_name || `Địa điểm #${id}`);
      const amount = Number(p.amount || 0);
      const prev = map.get(id);
      if (!prev) {
        map.set(id, {
          location_id: id,
          location_name: name,
          revenue: Number.isFinite(amount) ? amount : 0,
          count: 1,
        });
      } else {
        prev.revenue += Number.isFinite(amount) ? amount : 0;
        prev.count += 1;
      }
    }

    let best: {
      location_id: number;
      location_name: string;
      revenue: number;
      count: number;
    } | null = null;
    for (const v of map.values()) {
      if (!best || v.revenue > best.revenue) best = v;
    }
    return best;
  }, [filteredPayments]);

  const chartLocationId = useMemo(() => {
    const best = topRevenueLocation?.location_id;
    if (best && Number.isFinite(best)) return Number(best);
    const first = locations[0]?.location_id;
    return first && Number.isFinite(first) ? Number(first) : null;
  }, [locations, topRevenueLocation]);

  const chartRange = useMemo<"day" | "week" | "month" | "year" | "all">(() => {
    if (selectedDate) return "day";
    if (range === "today") return "day";
    if (range === "week") return "week";
    if (range === "month") return "month";
    if (range === "year") return "year";
    return "all";
  }, [range, selectedDate]);

  const chartPickedDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const paymentStatusStats = useMemo(() => {
    const map = new Map<
      string,
      { status: string; count: number; amount: number }
    >();

    for (const p of filteredPayments) {
      const status = String(p.status || "unknown").toLowerCase();
      const amount = Number(p.amount || 0);
      const prev = map.get(status);
      if (!prev) {
        map.set(status, {
          status,
          count: 1,
          amount: Number.isFinite(amount) ? amount : 0,
        });
      } else {
        prev.count += 1;
        prev.amount += Number.isFinite(amount) ? amount : 0;
      }
    }

    const order = [
      "completed",
      "pending",
      "confirmed",
      "failed",
      "cancelled",
      "unknown",
    ];

    const rows: Array<{ status: string; count: number; amount: number }> = [];
    for (const s of order) {
      const v = map.get(s);
      if (v) rows.push(v);
    }
    for (const v of map.values()) {
      if (!order.includes(v.status)) rows.push(v);
    }
    return rows;
  }, [filteredPayments]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [meRes, locRes, bookingRes, paymentRes] = await Promise.all([
          ownerApi.getMe(),
          ownerApi.getLocations(),
          ownerApi.getBookings({}),
          ownerApi.getPayments({}),
        ]);

        setMe(meRes);

        if (
          String(asRecord(asRecord(asRecord(meRes).data).actor).role || "") ===
          "employee"
        ) {
          navigate("/employee/front-office", { replace: true });
          return;
        }

        setLocations((locRes?.data || []) as LocationRow[]);
        setBookings((bookingRes?.data || []) as BookingRow[]);
        setPayments((paymentRes?.data || []) as PaymentRow[]);

        if (
          String(asRecord(asRecord(asRecord(meRes).data).actor).role || "") ===
          "owner"
        ) {
          const commRes = await ownerApi.getCommissions({});
          setCommissions((commRes?.data || []) as CommissionRow[]);
        } else {
          setCommissions([]);
        }
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải dữ liệu Owner"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const selectDateFromChart = useCallback(
    (rawDay: string) => {
      setHoverChartIndex(null);
      const raw = String(rawDay || "").trim();
      if (raw.length < 10) return;
      const d = dayjs(raw.slice(0, 10), "YYYY-MM-DD");
      if (!d.isValid()) return;
      setSelectedDate(d.format("YYYY-MM-DD"));
      setRange("today");
    },
    [setRange, setSelectedDate],
  );

  const loadChart = useCallback(async () => {
    if (!chartLocationId) {
      setChartSeries([]);
      return;
    }
    try {
      const res = await ownerApi.getPosPaymentsHistory({
        location_id: chartLocationId,
        range: chartRange,
        date: chartPickedDate,
      });
      const data = asRecord(asRecord(res).data);
      const s = Array.isArray(data.series) ? data.series : [];
      setChartSeries(
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
    } catch {
      setChartSeries([]);
    }
  }, [chartLocationId, chartPickedDate, chartRange]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  const recentBookings = filteredBookings.slice(0, 10);
  const recentPayments = useMemo(() => {
    return [...filteredPayments]
      .sort((a, b) => {
        const ta = a.payment_time ? dayjs(a.payment_time).valueOf() : 0;
        const tb = b.payment_time ? dayjs(b.payment_time).valueOf() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [filteredPayments]);

  const weekMeta = useMemo(() => {
    const anchor = dayjs(chartPickedDate, "YYYY-MM-DD");
    if (!anchor.isValid()) return null;
    const dow = anchor.day();
    const diffFromMonday = (dow + 6) % 7;
    const start = anchor.subtract(diffFromMonday, "day").startOf("day");
    const end = start.add(6, "day").startOf("day");
    return { start, end };
  }, [chartPickedDate]);

  return (
    <MainLayout>
      <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Tổng quan</h2>
            <p className="text-gray-500">Báo cáo theo {periodLabel}.</p>
          </div>
          <Space align="center" wrap>
            <Segmented
              value={range}
              options={[
                { label: "Hôm nay", value: "today" },
                { label: "7 ngày", value: "week" },
                { label: "1 tháng", value: "month" },
                { label: "1 năm", value: "year" },
                { label: "Tất cả", value: "all" },
              ]}
              onChange={(v) => {
                setSelectedDate(null);
                setRange(v as "today" | "week" | "month" | "year" | "all");
              }}
            />
            <DatePicker
              allowClear
              placeholder="Chọn ngày"
              value={selectedDate ? dayjs(selectedDate, "YYYY-MM-DD") : null}
              onChange={(d) =>
                setSelectedDate(d ? d.format("YYYY-MM-DD") : null)
              }
            />
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate("/owner/navigate")}
                >
                  Chuyển chế độ Vận hành (Front-office)
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    icon={<GiftOutlined />}
                    className="rounded-full"
                    onClick={() => navigate("/owner/vouchers")}
                  >
                    Tạo Voucher
                  </Button>
                  <Button
                    icon={<ShopOutlined />}
                    className="rounded-full"
                    onClick={() => navigate("/owner/services")}
                  >
                    Dịch vụ
                  </Button>
                  <Button
                    icon={<DollarOutlined />}
                    className="rounded-full"
                    onClick={() => navigate("/owner/payments")}
                  >
                    Lịch sử
                  </Button>
                  <Button
                    icon={<CheckCircleOutlined />}
                    className="rounded-full"
                    onClick={() => navigate("/owner/locations")}
                  >
                    Địa điểm
                  </Button>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden bg-blue-50"
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-blue-200 opacity-45" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <Statistic title="Số điểm" value={stats.totalLocations} />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <ShopOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden bg-indigo-50"
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-indigo-200 opacity-45" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <Statistic title="Booking chờ" value={stats.pendingBookings} />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <CheckCircleOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden bg-emerald-50"
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-emerald-200 opacity-45" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <Statistic
                  title={`Doanh thu (${periodLabel})`}
                  value={stats.totalRevenue}
                  formatter={(v) => formatMoney(Number(v))}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <DollarOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden bg-orange-50"
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-orange-200 opacity-45" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <Statistic
                  title={role === "owner" ? "Hoa hồng pending" : "Hoa hồng"}
                  value={stats.totalCommissionDue}
                  formatter={(v) => formatMoney(Number(v))}
                />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <GiftOutlined />
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              title="Biểu đồ doanh thu"
              loading={loading}
              className="text-slate-700"
              extra={
                topRevenueLocation ? (
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Địa điểm</div>
                    <div className="max-w-[260px] truncate text-sm text-gray-700">
                      {topRevenueLocation.location_name}
                    </div>
                  </div>
                ) : null
              }
            >
              {chartRange === "week" && weekMeta ? (
                <div className="mb-2 text-xs text-gray-500">
                  Tuần: {weekMeta.start.format("DD/MM/YYYY")} -{" "}
                  {weekMeta.end.format("DD/MM/YYYY")}
                </div>
              ) : null}

              {chartSeries.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">
                  Chưa có dữ liệu
                </div>
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

                    const canDrillDown =
                      chartRange === "week" || chartRange === "month";

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
                      const totalValue = Math.max(
                        0,
                        ownerValue + commissionValue,
                      );

                      const slotW = plotW / n;
                      const barW = Math.max(6, Math.min(28, slotW * 0.66));
                      const barX = padX + slotW * i + (slotW - barW) / 2;

                      const getDowLabel = (d: dayjs.Dayjs) =>
                        ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.day()];

                      let dayLabel = rawDay;
                      let subLabel = "";
                      let titleLabel = rawDay;

                      if (chartRange === "day") {
                        const hh = rawDay.includes("T")
                          ? rawDay.split("T")[1]?.slice(0, 2) || ""
                          : "";
                        dayLabel = hh;
                        titleLabel = rawDay.includes("T")
                          ? formatDateTimeVi(rawDay)
                          : formatDateTimeVi(rawDay);
                      } else if (
                        chartRange === "week" ||
                        chartRange === "month"
                      ) {
                        const d = dayjs(rawDay, "YYYY-MM-DD");
                        if (d.isValid()) {
                          titleLabel = d.format("DD/MM/YYYY");
                          if (chartRange === "week") {
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
                            chartRange === "year"
                              ? d.format("MM")
                              : d.format("MM/YY");
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

                    const getIndexFromEvent = (e: any) => {
                      if (!chartSvgRef.current) return null;
                      const rect = chartSvgRef.current.getBoundingClientRect();
                      if (!rect.width) return null;
                      const mx = ((e.clientX - rect.left) / rect.width) * W;
                      const slotW = plotW / n;
                      const idx = Math.floor((mx - padX) / slotW);
                      return Math.max(0, Math.min(n - 1, idx));
                    };

                    const onMove = (e: any) => {
                      const idx = getIndexFromEvent(e);
                      if (idx == null) return;
                      setHoverChartIndex(idx);
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
                            onClick={(e) => {
                              const idx = getIndexFromEvent(e);
                              if (idx == null) return;
                              setHoverChartIndex(idx);
                              if (!canDrillDown) return;
                              const p = points[idx];
                              if (!p) return;
                              selectDateFromChart(p.rawDay);
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
                                    setHoverChartIndex(null);
                                    if (!canDrillDown) return;
                                    selectDateFromChart(p.rawDay);
                                  }}
                                  style={{
                                    cursor: canDrillDown
                                      ? "pointer"
                                      : "default",
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
                                      ? (hp.commissionValue / hp.totalValue) *
                                        100
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
                                    cursor: canDrillDown
                                      ? "pointer"
                                      : "default",
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
          </Col>

          <Col xs={24} md={12}>
            <Card title={`Xu hướng đơn bán (${periodLabel})`} loading={loading}>
              <Table
                size="small"
                rowKey={(r) => String((r as any).status)}
                dataSource={paymentStatusStats}
                pagination={false}
                scroll={{ y: 180 }}
                columns={[
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    render: (s: string) => {
                      const v = String(s || "").toLowerCase();
                      const color =
                        v === "completed"
                          ? "green"
                          : v === "pending"
                            ? "orange"
                            : v === "confirmed"
                              ? "blue"
                              : v === "failed"
                                ? "red"
                                : "default";
                      return <Tag color={color}>{String(s).toUpperCase()}</Tag>;
                    },
                  },
                  {
                    title: "Số payments",
                    dataIndex: "count",
                    width: 140,
                    align: "right" as const,
                  },
                  {
                    title: "Tổng tiền",
                    dataIndex: "amount",
                    width: 160,
                    align: "right" as const,
                    render: (v: number) => formatMoney(Number(v || 0)),
                  },
                ]}
                locale={{ emptyText: "Chưa có dữ liệu" }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Booking gần đây" loading={loading}>
              <Table
                rowKey="booking_id"
                dataSource={recentBookings}
                pagination={false}
                scroll={{ y: 260 }}
                columns={[
                  { title: "#", dataIndex: "booking_id", width: 80 },
                  { title: "Khách", dataIndex: "user_name" },
                  { title: "Địa điểm", dataIndex: "location_name" },
                  { title: "Dịch vụ", dataIndex: "service_name" },
                  {
                    title: "Số tiền",
                    dataIndex: "final_amount",
                    render: (v) => formatMoney(Number(v || 0)),
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    render: (s) => {
                      const color =
                        s === "pending"
                          ? "orange"
                          : s === "confirmed"
                            ? "blue"
                            : s === "completed"
                              ? "green"
                              : "red";
                      return <Tag color={color}>{String(s).toUpperCase()}</Tag>;
                    },
                  },
                ]}
                locale={{
                  emptyText: (
                    <div className="py-8 text-center text-sm text-gray-500">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <PlusOutlined />
                      </div>
                      <div>Chưa có booking trong kỳ.</div>
                    </div>
                  ),
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Payments gần đây" loading={loading}>
              <Table
                size="small"
                rowKey="payment_id"
                dataSource={recentPayments}
                pagination={false}
                scroll={{ y: 260 }}
                columns={[
                  { title: "#", dataIndex: "payment_id", width: 80 },
                  {
                    title: "Địa điểm",
                    dataIndex: "location_name",
                    render: (v: string) => <div className="truncate">{v}</div>,
                  },
                  {
                    title: "Số tiền",
                    dataIndex: "amount",
                    width: 140,
                    align: "right" as const,
                    render: (v: number) => formatMoney(Number(v || 0)),
                  },
                  {
                    title: "Ngày",
                    dataIndex: "payment_time",
                    width: 170,
                    render: (v: string | undefined) =>
                      v ? formatDateTimeVi(v) : "-",
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 120,
                    render: (s: string) => {
                      const v = String(s || "").toLowerCase();
                      const color =
                        v === "completed"
                          ? "green"
                          : v === "pending"
                            ? "orange"
                            : v === "confirmed"
                              ? "blue"
                              : "default";
                      return <Tag color={color}>{String(s).toUpperCase()}</Tag>;
                    },
                  },
                ]}
                locale={{
                  emptyText: (
                    <div className="py-8 text-center text-sm text-gray-500">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <DollarOutlined />
                      </div>
                      <div>Chưa có payment trong kỳ.</div>
                      <Button
                        type="link"
                        className="p-0"
                        onClick={() => navigate("/owner/payments")}
                      >
                        Xem lịch sử thanh toán
                      </Button>
                    </div>
                  ),
                }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
};

export default OwnerDashboard;
