import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Progress,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  FileExcelOutlined,
  GiftOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { useNavigate } from "react-router-dom";
import { asRecord, getErrorMessage } from "../../utils/safe";
import dayjs from "dayjs";
import InvoiceExportModal from "../../components/InvoiceExportModal";
import OwnerTempCloseModal from "../../components/OwnerTempCloseModal";
import { handleExportBatchExcel } from "../../utils/exportExcel";



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
  payment_method?: string;
  location_id?: number;
  location_name?: string;
  commission_amount?: number;
  owner_receivable?: number;
  // Fields từ JOIN với bookings/services/users
  booking_service_name?: string;
  booking_service_type?: string;
  booked_full_name?: string;
  booked_phone?: string;
  user_full_name?: string;
  user_phone?: string;
  booking_check_in_date?: string;
  booking_check_out_date?: string;
  booking_final_amount?: number;
  booking_status?: string;
};

type LocationRow = {
  location_id: number;
  location_name: string;
  status: string;
  location_type: string;
};


const OwnerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [rangeType, setRangeType] = useState<string>("today");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isTempCloseModalOpen, setIsTempCloseModalOpen] = useState(false);

  const ownerName = String(asRecord(asRecord(asRecord(me).data).actor).full_name || "Chủ địa điểm");

  useEffect(() => {
    const handleOpenModal = () => setIsInvoiceModalOpen(true);
    const handleTriggerExport = async (e?: any) => {
      console.log("[Export DEBUG] event.detail =", JSON.stringify(e?.detail));
      try {
        message.loading({ content: "Đang tải báo cáo...", key: "exporting" });

        let targetPayments = payments.filter(inv => String(inv.status).toLowerCase() === "completed").map(inv => ({ ...inv, location_name: inv.location_name || "" }));

        let excelStart = dayjs("2020-01-01");
        let excelEnd = dayjs();

        // Filter by dates from AI if provided
        if (e && e.detail) {
          if (e.detail.start_date || e.detail.end_date) {
            excelStart = e.detail.start_date ? dayjs(e.detail.start_date).startOf('day') : dayjs("2000-01-01");
            excelEnd = e.detail.end_date ? dayjs(e.detail.end_date).endOf('day') : dayjs().endOf('day');
            targetPayments = targetPayments.filter(inv => {
              const p = dayjs(inv.payment_time);
              return (p.isAfter(excelStart) || p.isSame(excelStart)) && (p.isBefore(excelEnd) || p.isSame(excelEnd));
            });
          } else {
            const targetMonths: number[] = [];
            if (e.detail.compare_months && Array.isArray(e.detail.compare_months)) {
              targetMonths.push(...e.detail.compare_months.map(Number));
            } else if (e.detail.target_month) {
              targetMonths.push(Number(e.detail.target_month));
            }

            if (targetMonths.length > 0) {
              targetPayments = targetPayments.filter(inv => {
                const m = dayjs(inv.payment_time).month() + 1; // dayjs month is 0-11
                return targetMonths.includes(m);
              });
              // Nếu AI chỉ đưa tháng, ta tạm thời không chỉnh sửa ngày chính xác ở tiêu đề, nhưng có thể cải thiện sau
            } else if (e.detail.time_range) {
              const tr = e.detail.time_range;
              excelEnd = dayjs().endOf('day');
              if (tr === "today") {
                excelStart = dayjs().startOf('day');
                targetPayments = targetPayments.filter(inv => dayjs(inv.payment_time).isSame(excelStart, 'day'));
              } else if (tr === "this_week") {
                excelStart = dayjs().subtract(7, 'day').startOf('day');
                targetPayments = targetPayments.filter(inv => dayjs(inv.payment_time).isAfter(excelStart));
              } else if (tr === "this_month") {
                excelStart = dayjs().startOf('month');
                targetPayments = targetPayments.filter(inv => dayjs(inv.payment_time).isSame(excelStart, 'month'));
              } else if (tr === "last_month") {
                excelStart = dayjs().subtract(1, 'month').startOf('month');
                excelEnd = dayjs().subtract(1, 'month').endOf('month');
                targetPayments = targetPayments.filter(inv => dayjs(inv.payment_time).isSame(excelStart, 'month'));
              }
            }
          }
        }

        await handleExportBatchExcel(
          targetPayments as any,
          ["restaurant", "hotel", "tourist"],
          [excelStart, excelEnd],
          ownerName
        );
        message.success({ content: "Tải báo cáo thành công!", key: "exporting" });
      } catch (err: any) {
        message.error({ content: "Lỗi tải báo cáo: " + err.message, key: "exporting" });
      }
    };
    window.addEventListener("open_export_modal", handleOpenModal);
    window.addEventListener("trigger_export_report", handleTriggerExport as any);
    return () => {
      window.removeEventListener("open_export_modal", handleOpenModal);
      window.removeEventListener("trigger_export_report", handleTriggerExport as any);
    };
  }, [payments, ownerName]);

  const windowRange = useMemo(() => {
    if (rangeType === "all") return { from: null, to: null };
    return { from: dateRange[0].startOf("day"), to: dateRange[1].endOf("day") };
  }, [rangeType, dateRange]);

  const periodLabel = useMemo(() => {
    if (rangeType === "custom") return `từ ${dateRange[0].format("DD/MM/YYYY")} đến ${dateRange[1].format("DD/MM/YYYY")}`;
    if (rangeType === "today") return "hôm nay";
    if (rangeType === "7days") return "7 ngày qua";
    if (rangeType === "month") return "1 tháng qua";
    if (rangeType === "year") return "1 năm qua";
    return "tất cả";
  }, [rangeType, dateRange]);

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

    const totalCommissionDue = filteredPayments.reduce((sum, p) => {
      if (String(p.status || "").toLowerCase() !== "completed") return sum;
      const v = Number(p.commission_amount || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    const totalReceivable = totalRevenue - totalCommissionDue;

    return {
      totalLocations,
      pendingBookings,
      totalRevenue,
      totalCommissionDue,
      totalReceivable,
    };
  }, [filteredBookings, filteredPayments, locations.length]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, locRes, bookingRes, paymentRes] = await Promise.all([
        ownerApi.getMe(),
        ownerApi.getLocations(),
        ownerApi.getBookings({ limit: "all" }),
        ownerApi.getPayments({ limit: "all" }),
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
        await ownerApi.getCommissions({});
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải dữ liệu Owner"));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRangeChange = (e: any) => {
    const val = e.target.value;
    setRangeType(val);
    const today = dayjs();
    if (val === "today") setDateRange([today, today]);
    else if (val === "7days") setDateRange([today.subtract(6, 'day'), today]);
    else if (val === "month") setDateRange([today.startOf('month'), today.endOf('month')]);
    else if (val === "year") setDateRange([today.startOf('year'), today.endOf('year')]);
    else if (val === "all") setDateRange([dayjs('2020-01-01'), today]);
  };

  // Lời chào theo thời gian thực
  const welcomeMessage = useMemo(() => {
    const hour = dayjs().hour();
    if (hour < 12) return `Chào buổi sáng, ${ownerName}!`;
    if (hour < 18) return `Chào buổi chiều, ${ownerName}!`;
    return `Chào buổi tối, ${ownerName}!`;
  }, [ownerName]);

  // Tính toán Cơ cấu Doanh thu dịch vụ
  const serviceRevenue = useMemo(() => {
    let hotelRev = 0;
    let restaurantRev = 0;
    let touristRev = 0;

    const locTypeMap = new Map<number, string>();
    locations.forEach(l => locTypeMap.set(l.location_id, l.location_type));

    filteredPayments.forEach(p => {
      if (String(p.status || "").toLowerCase() !== "completed") return;
      if (!p.location_id) return;

      const type = locTypeMap.get(p.location_id) || "other";
      const amt = Number(p.amount || 0);

      if (type === "hotel" || type === "resort") hotelRev += amt;
      else if (type === "restaurant" || type === "cafe") restaurantRev += amt;
      else if (type === "tourist") touristRev += amt;
      else touristRev += amt; // fallback cho các loại khác
    });

    const total = hotelRev + restaurantRev + touristRev;

    let hotelPct = 0, restaurantPct = 0, touristPct = 0;
    if (total > 0) {
      hotelPct = Math.round((hotelRev / total) * 100);
      restaurantPct = Math.round((restaurantRev / total) * 100);
      touristPct = 100 - hotelPct - restaurantPct;
    }

    return [
      { name: "Lưu trú & Phòng nghỉ", percentage: hotelPct, amount: hotelRev, color: "#3b82f6" },
      { name: "Ẩm thực & Nhà hàng", percentage: restaurantPct, amount: restaurantRev, color: "#10b981" },
      { name: "Vé dịch vụ & Tham quan", percentage: touristPct, amount: touristRev, color: "#f59e0b" },
    ];
  }, [filteredPayments, locations]);

  // Tính toán Top 3 Địa điểm có doanh thu tốt nhất trong kỳ lọc
  const topLocations = useMemo(() => {
    const completed = filteredPayments.filter((p) => String(p.status || "").toLowerCase() === "completed");

    const map = new Map<number, { name: string; revenue: number }>();

    // Khởi tạo tất cả địa điểm với doanh thu 0
    for (const loc of locations) {
      map.set(loc.location_id, { name: loc.location_name, revenue: 0 });
    }

    // Cộng dồn doanh thu thực tế
    for (const p of completed) {
      const id = p.location_id;
      if (!id) continue;
      const prev = map.get(id);
      const amount = Number(p.amount || 0);
      if (prev) {
        prev.revenue += amount;
      } else {
        map.set(id, { name: p.location_name || `Địa điểm #${id}`, revenue: amount });
      }
    }

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const maxRevenue = list[0]?.revenue || 1;

    return list.slice(0, 3).map((item, index) => ({
      ...item,
      rank: index + 1,
      percentage: Math.round((item.revenue / maxRevenue) * 100),
    }));
  }, [filteredPayments, locations]);

  // Con số tổng hợp vận hành (thay đổi theo kỳ lọc)
  const operations = useMemo(() => {
    const periodBookings = filteredBookings.length;
    const periodPayments = filteredPayments.filter((p) => p.status === "completed").length;
    return {
      periodBookings,
      periodPayments,
      activeLocations: locations.filter((l) => l.status === "active" || l.status === "approved").length || locations.length,
    };
  }, [filteredBookings, locations, filteredPayments]);

  return (
    <MainLayout>
      <div className="rounded-2xl bg-gradient-to-br from-slate-50/50 to-white p-4">
        {/* Header Dashboard */}
        <div className="mb-6 rounded-2xl border border-blue-100/70 bg-gradient-to-br from-white via-blue-50/50 to-slate-50 p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
                Tổng quan vận hành
              </div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {welcomeMessage}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Báo cáo theo {periodLabel}, tập trung vào doanh thu và vận hành địa điểm.
              </p>

              <div className="mt-4 inline-flex rounded-full border border-amber-100/70 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50/80 text-amber-500">
                    <EnvironmentOutlined />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 whitespace-nowrap">
                      Thời tiết hôm nay: Trời nắng đẹp, 29°C
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Space size="middle" wrap className="bg-white/90 p-2 rounded-xl shadow-sm border border-gray-100">
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => setIsInvoiceModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/80 hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-100 font-semibold rounded-lg px-4 transition-all duration-300 shadow-sm hover:shadow"
              >
                Xuất file
              </Button>
              <Select
                value={rangeType === "custom" ? "custom" : rangeType}
                onChange={(val) => handleRangeChange({ target: { value: val } })}
                style={{ width: 140 }}
                options={[
                  { value: "today", label: "Hôm nay" },
                  { value: "7days", label: "7 ngày qua" },
                  { value: "month", label: "1 tháng qua" },
                  { value: "year", label: "1 năm qua" },
                  { value: "all", label: "Tất cả" },
                  ...(rangeType === "custom" ? [{ value: "custom", label: "Tùy chỉnh" }] : []),
                ]}
              />
              <Space className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
                <DatePicker
                  value={dateRange[0]}
                  onChange={(d) => {
                    if (d) {
                      let end = dateRange[1];
                      if (end.isBefore(d, 'day')) end = d;
                      setDateRange([d, end]);
                      setRangeType("custom");
                    }
                  }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  className="w-32"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                  placeholder="Từ ngày"
                />
                <span className="text-gray-400">→</span>
                <DatePicker
                  value={dateRange[1]}
                  onChange={(d) => {
                    if (d) {
                      setDateRange([dateRange[0], d]);
                      setRangeType("custom");
                    }
                  }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  className="w-32"
                  disabledDate={(current) => current && (current > dayjs().endOf('day') || current < dateRange[0].startOf('day'))}
                  placeholder="Đến ngày"
                />
              </Space>
            </Space>
          </div>
        </div>

        <Row gutter={[16, 16]}>
          {/* Nút tiện ích & Chế độ Vận hành */}
          <Col span={24}>
            <Card className="shadow-md border-0 rounded-2xl bg-white/80 backdrop-blur-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Button
                    type="primary"
                    size="large"
                    icon={<ThunderboltOutlined className="animate-pulse" />}
                    onClick={() => navigate("/owner/navigate")}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-none rounded-xl text-sm font-bold h-12 shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    Chuyển chế độ Vận hành
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    icon={<GiftOutlined className="text-pink-500" />}
                    className="rounded-xl border-slate-100 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50/30 font-semibold h-11 px-4 transition-all duration-200"
                    onClick={() => navigate("/owner/vouchers")}
                  >
                    Tạo Voucher
                  </Button>
                  <Button
                    icon={<ShopOutlined className="text-blue-500" />}
                    className="rounded-xl border-slate-100 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 font-semibold h-11 px-4 transition-all duration-200"
                    onClick={() => navigate("/owner/services")}
                  >
                    Dịch vụ
                  </Button>
                  <Button
                    icon={<DollarOutlined className="text-emerald-500" />}
                    className="rounded-xl border-slate-100 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 font-semibold h-11 px-4 transition-all duration-200"
                    onClick={() => navigate("/owner/payments")}
                  >
                    Lịch sử thanh toán
                  </Button>
                  <Button
                    icon={<CheckCircleOutlined className="text-violet-500" />}
                    className="rounded-xl border-slate-100 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/30 font-semibold h-11 px-4 transition-all duration-200"
                    onClick={() => navigate("/owner/locations")}
                  >
                    Địa điểm
                  </Button>
                </div>
              </div>
            </Card>
          </Col>

          {/* 4 Thẻ Chỉ số Hiệu suất thiết kế Gradient Cực kỳ Sang trọng và Rực rỡ */}
          {/* Card 1: Số điểm */}
          <Col xs={24} sm={12} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md hover:scale-[1.03] transition-all duration-300"
              bodyStyle={{ padding: "20px" }}
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center opacity-30 text-3xl font-bold">
                <ShopOutlined />
              </div>
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">Số điểm</div>
                <div className="text-3xl font-extrabold mb-2">{stats.totalLocations}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <EnvironmentOutlined /> Đang vận hành hệ thống
                </div>
              </div>
            </Card>
          </Col>

          {/* Card 2: Doanh Thu */}
          <Col xs={24} sm={12} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md hover:scale-[1.03] transition-all duration-300"
              bodyStyle={{ padding: "20px" }}
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center opacity-30 text-3xl font-bold">
                <DollarOutlined />
              </div>
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">Doanh thu ({periodLabel})</div>
                <div className="text-2xl font-extrabold mb-2 truncate">{formatMoney(stats.totalRevenue)}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <ThunderboltOutlined /> Tổng doanh số gộp thực nhận
                </div>
              </div>
            </Card>
          </Col>

          {/* Card 3: Hoa Hồng */}
          <Col xs={24} sm={12} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-md hover:scale-[1.03] transition-all duration-300"
              bodyStyle={{ padding: "20px" }}
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center opacity-30 text-3xl font-bold">
                <GiftOutlined />
              </div>
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">Hoa hồng</div>
                <div className="text-2xl font-extrabold mb-2 truncate">{formatMoney(stats.totalCommissionDue)}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <CheckCircleOutlined /> Phí đối soát hệ thống
                </div>
              </div>
            </Card>
          </Col>

          {/* Card 4: Thực Nhận (Thay thế Booking Chờ) */}
          <Col xs={24} sm={12} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md hover:scale-[1.03] transition-all duration-300"
              bodyStyle={{ padding: "20px" }}
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center opacity-30 text-3xl font-bold">
                <WalletOutlined />
              </div>
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">Thực nhận ({periodLabel})</div>
                <div className="text-2xl font-extrabold mb-2 truncate">{formatMoney(stats.totalReceivable)}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <CheckCircleOutlined /> Doanh thu trừ hoa hồng
                </div>
              </div>
            </Card>
          </Col>

          {/* HÀNG TRANG TRÍ WIDGET 1 & 2 */}
          {/* Widget 1: Lời chào cá nhân hóa & Dự báo vận hành */}
          <Col xs={24} md={12}>
            <Card
              className="shadow-sm border-0 rounded-2xl h-full flex flex-col justify-between"
              bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px" }}
              loading={loading}
            >
              <div>
                <div className="text-2xl font-black text-slate-800 tracking-tight">Gợi ý vận hành hôm nay</div>
                <p className="text-slate-400 text-sm mt-1.5 font-medium">Một vài tín hiệu nhanh để bạn ưu tiên công việc trong ngày.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 mt-6 border border-slate-100/60">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">☀️</div>
                  <div>
                    <div className="font-bold text-slate-700 text-sm">Vận hành hôm nay: Trời nắng đẹp, 29°C</div>
                    <div className="text-xs text-slate-400 mt-0.5">Thời tiết tuyệt vời cho các hoạt động tham quan và nhận phòng nghỉ dưỡng ngoài trời.</div>
                  </div>
                </div>
              </div>

              <div className="text-xs italic text-slate-400 mt-6 font-medium">
                "Khách hàng không chỉ mua một dịch vụ tốt, họ mua một trải nghiệm tuyệt vời và đáng nhớ."
              </div>
            </Card>
          </Col>

          {/* Widget 2: Cơ cấu Doanh thu theo Dịch vụ (Không liên quan duyệt đồ) */}
          <Col xs={24} md={12}>
            <Card
              title={
                <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <DollarOutlined className="text-emerald-500" />
                  Cơ cấu doanh thu dịch vụ
                </span>
              }
              className="shadow-sm border-0 rounded-2xl h-full"
              bodyStyle={{ padding: "24px" }}
              loading={loading}
            >
              <div className="space-y-4">
                {serviceRevenue.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">{item.name}</span>
                      <span className="text-slate-800 font-extrabold">
                        {formatMoney(item.amount)} <span className="text-slate-400 font-medium">({item.percentage}%)</span>
                      </span>
                    </div>
                    <Progress
                      percent={item.percentage}
                      showInfo={false}
                      strokeColor={item.color}
                      trailColor="#f1f5f9"
                      strokeWidth={8}
                      className="m-0"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          {/* HÀNG TRANG TRÍ WIDGET 3 & 4 */}
          {/* Widget 3: Bảng xếp hạng doanh thu địa điểm */}
          <Col xs={24} md={12}>
            <Card
              title={
                <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <EnvironmentOutlined className="text-blue-500" />
                  Xếp hạng hiệu năng địa điểm
                </span>
              }
              className="shadow-sm border-0 rounded-2xl h-full"
              bodyStyle={{ padding: "24px" }}
              loading={loading}
            >
              {topLocations.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">Chưa có dữ liệu địa điểm.</div>
              ) : (
                <div className="space-y-4">
                  {topLocations.map((item) => {
                    const medal = item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉";
                    return (
                      <div key={item.name} className="flex items-center justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 max-w-[60%]">
                          <span className="text-lg">{medal}</span>
                          <span className="font-bold text-slate-700 text-sm truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 w-[40%] justify-end">
                          <span className="text-xs font-extrabold text-slate-800 whitespace-nowrap">{formatMoney(item.revenue)}</span>
                          <Progress
                            percent={item.percentage}
                            showInfo={false}
                            strokeColor={item.rank === 1 ? "#3b82f6" : item.rank === 2 ? "#10b981" : "#f59e0b"}
                            trailColor="#f8fafc"
                            strokeWidth={6}
                            className="w-16 hidden sm:block m-0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </Col>

          {/* Widget 4: Tóm tắt Hoạt động Vận hành */}
          <Col xs={24} md={12}>
            <Card
              title={
                <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <ThunderboltOutlined className="text-amber-500" />
                  Hiệu suất vận hành
                </span>
              }
              className="shadow-sm border-0 rounded-2xl h-full"
              bodyStyle={{ padding: "24px" }}
              loading={loading}
            >
              <Row gutter={[12, 12]}>
                <Col span={8}>
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 text-center flex flex-col items-center justify-center h-24">
                    <div className="text-xl">🏪</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">Đang mở</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{operations.activeLocations}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 text-center flex flex-col items-center justify-center h-24">
                    <div className="text-xl">📅</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">Lượt Booking</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{operations.periodBookings}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 text-center flex flex-col items-center justify-center h-24">
                    <div className="text-xl">💳</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">Lượt Giao dịch</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{operations.periodPayments}</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>

      <InvoiceExportModal
        open={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        role="owner"
        currentUserName={ownerName}
        invoices={payments.map((p) => ({
          ...p,
          payment_id: p.payment_id,
          booking_id: (p as any).booking_id,
          status: p.status,
          location_name: p.location_name || "",
          location_id: p.location_id,
          amount: p.amount,
          commission_amount: p.commission_amount,
          owner_receivable: p.owner_receivable,
          payment_time: p.payment_time || "",
          payment_method: p.payment_method || "",
          booking_service_name: p.booking_service_name,
          booking_service_type: p.booking_service_type,
          booked_full_name: p.booked_full_name,
          user_full_name: p.user_full_name,
          phone: p.booked_phone || p.user_phone,
          check_in_date: p.booking_check_in_date,
          check_out_date: p.booking_check_out_date,
          voucher_code: (p as any).voucher_code || (p as any).booking_voucher_code,
          booking_voucher_code: (p as any).booking_voucher_code,
          discount_amount: (p as any).discount_amount || (p as any).booking_discount_amount,
          booking_discount_amount: (p as any).booking_discount_amount,
          notes: (p as any).notes,
          qr_data: (p as any).qr_data,
        }))}
        locations={locations.map((l) => ({
          location_id: l.location_id,
          location_name: l.location_name,
        }))}
      />



      <OwnerTempCloseModal
        open={isTempCloseModalOpen}
        onClose={() => setIsTempCloseModalOpen(false)}
        locations={locations}
        onSuccess={() => loadData()}
      />
    </MainLayout>
  );
};

export default OwnerDashboard;
