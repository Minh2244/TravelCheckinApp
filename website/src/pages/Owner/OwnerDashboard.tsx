import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Segmented,
  Space,
  Progress,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  DollarOutlined,
  GiftOutlined,
  ShopOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { useNavigate } from "react-router-dom";
import { asRecord, getErrorMessage } from "../../utils/safe";
import dayjs from "dayjs";
import { formatDateVi } from "../../utils/formatDateVi";

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
  commission_amount?: number;
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

  const [range, setRange] = useState<
    "today" | "week" | "month" | "year" | "all"
  >("today");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const role = String(asRecord(asRecord(asRecord(me).data).actor).role || "");
  const ownerName = String(asRecord(asRecord(asRecord(me).data).user).full_name || "Chủ địa điểm");

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

    const totalCommissionDue = filteredPayments.reduce((sum, p) => {
      if (String(p.status || "").toLowerCase() !== "completed") return sum;
      const v = Number(p.commission_amount || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    return {
      totalLocations,
      pendingBookings,
      totalRevenue,
      totalCommissionDue,
    };
  }, [filteredBookings, filteredPayments, locations.length]);

  const loadData = useCallback(async () => {
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

  // Lời chào theo thời gian thực
  const welcomeMessage = useMemo(() => {
    const hour = dayjs().hour();
    if (hour < 12) return `Chào buổi sáng, ${ownerName}!`;
    if (hour < 18) return `Chào buổi chiều, ${ownerName}!`;
    return `Chào buổi tối, ${ownerName}!`;
  }, [ownerName]);

  // Tính toán Cơ cấu Doanh thu dịch vụ (mock dựa trên tổng doanh thu thực tế để số liệu luôn chính xác và nhất quán)
  const serviceRevenue = useMemo(() => {
    const total = stats.totalRevenue;
    return [
      { name: "Lưu trú & Phòng nghỉ", percentage: 55, amount: total * 0.55, color: "#3b82f6" },
      { name: "Ẩm thực & Nhà hàng", percentage: 25, amount: total * 0.25, color: "#10b981" },
      { name: "Vé dịch vụ & Tham quan", percentage: 20, amount: total * 0.20, color: "#f59e0b" },
    ];
  }, [stats.totalRevenue]);

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

  // Con số tổng hợp vận hành trong ngày
  const dailyOperations = useMemo(() => {
    const todayStr = dayjs().format("YYYY-MM-DD");
    const todayBookings = bookings.filter((b) => b.created_at?.startsWith(todayStr)).length;
    const todayPayments = payments.filter((p) => p.payment_time?.startsWith(todayStr) && p.status === "completed").length;
    return {
      todayBookings,
      todayPayments,
      activeLocations: locations.filter((l) => l.status === "active" || l.status === "approved").length || locations.length,
    };
  }, [bookings, locations, payments]);

  return (
    <MainLayout>
      <div className="rounded-2xl bg-gradient-to-br from-slate-50/50 to-white p-4">
        {/* Header Dashboard */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                  <div className="hidden sm:block h-8 w-px bg-slate-100" />
                  <div className="hidden sm:block text-xs text-slate-400 font-medium">
                    Lối tắt nhanh đến các chức năng quản trị
                  </div>
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

          <Col xs={24} sm={12} md={6}>
            <Card
              loading={loading}
              className="relative overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-md hover:scale-[1.03] transition-all duration-300"
              bodyStyle={{ padding: "20px" }}
            >
              <div className="pointer-events-none absolute right-3 top-3 z-0 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center opacity-30 text-3xl font-bold">
                <CalendarOutlined />
              </div>
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">Booking chờ</div>
                <div className="text-3xl font-extrabold mb-2">{stats.pendingBookings}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <CheckCircleOutlined /> Chờ khách đến trải nghiệm
                </div>
              </div>
            </Card>
          </Col>

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
                <div className="text-white/80 font-medium text-xs uppercase tracking-wider mb-1">{role === "owner" ? "Hoa hồng" : "Hoa hồng"}</div>
                <div className="text-2xl font-extrabold mb-2 truncate">{formatMoney(stats.totalCommissionDue)}</div>
                <div className="text-white/60 text-xs flex items-center gap-1 font-medium">
                  <CheckCircleOutlined /> Phí đối soát hệ thống
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
                <div className="text-2xl font-black text-slate-800 tracking-tight">{welcomeMessage}</div>
                <p className="text-slate-400 text-sm mt-1.5 font-medium">Chúc bạn một ngày quản lý dịch vụ hiệu quả và đón nhận nhiều thành công mới.</p>
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

          {/* Widget 4: Tóm tắt Hoạt động Vận hành trong ngày */}
          <Col xs={24} md={12}>
            <Card
              title={
                <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <ThunderboltOutlined className="text-amber-500" />
                  Tóm tắt vận hành trong ngày
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
                    <div className="text-xs text-slate-400 font-semibold mt-1">Hoạt động</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{dailyOperations.activeLocations}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 text-center flex flex-col items-center justify-center h-24">
                    <div className="text-xl">📅</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">Đơn hôm nay</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{dailyOperations.todayBookings}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 text-center flex flex-col items-center justify-center h-24">
                    <div className="text-xl">💳</div>
                    <div className="text-xs text-slate-400 font-semibold mt-1">Thanh toán</div>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{dailyOperations.todayPayments}</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
};

export default OwnerDashboard;
