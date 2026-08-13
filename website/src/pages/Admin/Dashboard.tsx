import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Row,
  Col,
  Empty,
  Spin,
  Statistic,
  Table,
  Avatar,
  Typography,
  Select,
  DatePicker,
  Space,
  message
} from "antd";
import {
  EnvironmentOutlined,
  FileExcelOutlined,
  ShopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import dayjs from "dayjs";
import MainLayout from "../../layouts/MainLayout";
import ManagerAiBubble from "../../components/ManagerAiBubble";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import InvoiceExportModal from "../../components/InvoiceExportModal";
import { handleExportBatchExcel } from "../../utils/exportExcel";
import type { InvoiceData } from "../../utils/exportExcel";

const { Title, Text } = Typography;

interface TopUserRow {
  user_id: number;
  full_name: string;
  email: string;
  avatar_url: string | null;
  total_spent: number;
}

interface TopOwnerRow {
  user_id: number;
  full_name: string;
  email: string;
  avatar_url: string | null;
  total_revenue: number;
}

interface DashboardStats {
  kpis?: {
    activeLocations: number;
    totalUsers: number;
    totalReviews: number;
    activeVouchers: number;
  };
  top?: {
    users: TopUserRow[];
    owners: TopOwnerRow[];
  };
  serviceTrends?: {
    restaurant: number;
    hotel: number;
    tourist: number;
  };
  charts?: {
    revenueTrend: Array<{ month: string; total: number }>;
  };
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ role?: string; full_name?: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [rangeType, setRangeType] = useState<string>("today");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [owners, setOwners] = useState<{ user_id: number; full_name: string }[]>([]);
  const [locations, setLocations] = useState<{ location_id: number; location_name: string }[]>([]);

  // Auth check: chỉ chạy 1 lần khi mount
  useEffect(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (!userStr) {
        navigate("/login", { replace: true });
        return;
      }

      const userData = JSON.parse(userStr) as { role?: string; full_name?: string };
      if (userData.role !== "admin") {
        navigate("/unauthorized", { replace: true });
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error("Lỗi loading user:", error);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Fetch data khi filter thay đổi
  useEffect(() => {
    if (!user) return;
    fetchDashboardStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeType, dateRange, user]);

  // Fetch invoices & owners cho modal xuất hóa đơn
  const fetchInvoiceData = useCallback(async () => {
    try {
      const [invRes, ownerRes, locRes] = await Promise.all([
        adminApi.getHistoryInvoices(),
        adminApi.getOwners(),
        adminApi.getLocations(),
      ]);
      setInvoices(invRes?.data || []);
      setOwners(ownerRes?.data || []);
      setLocations(locRes?.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user) fetchInvoiceData();
  }, [user, fetchInvoiceData]);

  useEffect(() => {
    const handleOpenModal = () => setIsInvoiceModalOpen(true);
    const handleTriggerExport = async (e: any) => {
      try {
        let targetPayments = [...invoices];
        let excelStart = dayjs("2000-01-01");
        let excelEnd = dayjs();

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
                const m = dayjs(inv.payment_time).month() + 1;
                return targetMonths.includes(m);
              });
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
          "Hệ thống"
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
  }, [invoices]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      const fromStr = dateRange[0].format("YYYY-MM-DD");
      const toStr = dateRange[1].format("YYYY-MM-DD");
      
      let queryType = "day";
      if (rangeType === "all") {
        queryType = "all";
      } else if (rangeType === "year") {
        queryType = "year";
      } else {
        queryType = "month";
      }

      const response = await adminApi.getDashboardStats({
        type: queryType,
        from: fromStr,
        to: toStr
      });
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Lỗi lấy thống kê:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { monthKey: string; month: number; year: number; total: number }>();
    for (const invoice of invoices) {
      const date = dayjs(invoice.payment_time);
      if (!date.isValid()) continue;
      const key = date.format("YYYY-MM");
      const prev = map.get(key) || {
        monthKey: key,
        month: date.month() + 1,
        year: date.year(),
        total: 0,
      };
      prev.total += Number(invoice.amount || 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [invoices]);

  const managerAiContext = useMemo(
    () => ({
      periodLabel:
        rangeType === "today"
          ? "hôm nay"
          : rangeType === "7days"
            ? "7 ngày"
            : rangeType === "month"
              ? "1 tháng"
              : rangeType === "year"
                ? "1 năm"
                : rangeType === "all"
                  ? "tất cả"
                  : `${dateRange[0].format("DD/MM/YYYY")} - ${dateRange[1].format("DD/MM/YYYY")}`,
      activeLocations: stats?.kpis?.activeLocations || 0,
      totalUsers: stats?.kpis?.totalUsers || 0,
      totalReviews: stats?.kpis?.totalReviews || 0,
      activeVouchers: stats?.kpis?.activeVouchers || 0,
      serviceTrends: stats?.serviceTrends || {},
      revenueTrend: stats?.charts?.revenueTrend || [],
      monthlyRevenue,
      topUsers: stats?.top?.users || [],
      topOwners: stats?.top?.owners || [],
    }),
    [dateRange, monthlyRevenue, rangeType, stats],
  );

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Chuẩn bị dữ liệu cho biểu đồ Line Chart
  const lineChartData = (stats?.charts?.revenueTrend || []).map((item) => ({
    name: item.month,
    DoanhThu: Number(item.total),
  }));

  // Chuẩn bị dữ liệu cho biểu đồ Bar ngang dịch vụ
  const serviceData = [
    { name: "Ăn uống", value: stats?.serviceTrends?.restaurant || 0, color: "#f59e0b" }, // amber-500
    { name: "Khách sạn", value: stats?.serviceTrends?.hotel || 0, color: "#3b82f6" }, // blue-500
    { name: "Du lịch", value: stats?.serviceTrends?.tourist || 0, color: "#10b981" }, // emerald-500
  ];

class DashboardErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <MainLayout>
          <div className="p-10">
            <h1 className="text-red-500 font-bold text-2xl">Lỗi Render!</h1>
            <pre className="bg-gray-100 p-4 mt-4 overflow-auto">{String(this.state.error?.stack || this.state.error)}</pre>
          </div>
        </MainLayout>
      );
    }
    return this.props.children;
  }
}

  return (
    <DashboardErrorBoundary>
    <MainLayout>
      <Spin spinning={loading} size="large">
      <div className="mb-6 rounded-2xl border border-rose-100/70 bg-gradient-to-br from-white via-rose-50/40 to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-rose-500">
              Trung tâm điều hành
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Tổng quan hệ thống</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Theo dõi sức khỏe nền tảng, đối tác, người dùng và voucher trong một màn hình.
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

      {stats ? (
        <>
          {/* Hàng 1: 4 KPIs */}
          <Row gutter={[16, 16]} className="mb-8">
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable className="rounded-2xl border-none shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden">
                <Statistic
                  title={<span className="font-semibold text-indigo-100 uppercase tracking-wider text-xs">Địa điểm</span>}
                  value={stats.kpis?.activeLocations || 0}
                  styles={{ content: { fontSize: "36px", fontWeight: "900", color: "#ffffff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable className="rounded-2xl border-none shadow-md bg-gradient-to-br from-sky-400 to-blue-600 overflow-hidden">
                <Statistic
                  title={<span className="font-semibold text-blue-100 uppercase tracking-wider text-xs">Người dùng</span>}
                  value={stats.kpis?.totalUsers || 0}
                  styles={{ content: { fontSize: "36px", fontWeight: "900", color: "#ffffff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable className="rounded-2xl border-none shadow-md bg-gradient-to-br from-amber-400 to-orange-500 overflow-hidden">
                <Statistic
                  title={<span className="font-semibold text-orange-100 uppercase tracking-wider text-xs">Đánh giá</span>}
                  value={stats.kpis?.totalReviews || 0}
                  styles={{ content: { fontSize: "36px", fontWeight: "900", color: "#ffffff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable className="rounded-2xl border-none shadow-md bg-gradient-to-br from-rose-400 to-pink-600 overflow-hidden">
                <Statistic
                  title={<span className="font-semibold text-pink-100 uppercase tracking-wider text-xs">Voucher</span>}
                  value={stats.kpis?.activeVouchers || 0}
                  styles={{ content: { fontSize: "36px", fontWeight: "900", color: "#ffffff" } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Hàng 2: Top Users, Top Owners, Biểu đồ dịch vụ */}
          <Row gutter={[16, 16]} className="mb-6 flex items-stretch">
            {/* Cột trái: Top User & Owner */}
            <Col xs={24} xl={14} className="flex flex-col gap-4">
              <Card 
                title={<span className="text-lg font-bold text-emerald-800">Top 3 Khách hàng chi tiêu cao nhất</span>} 
                className="rounded-2xl border border-emerald-100 shadow-sm flex-1 bg-gradient-to-br from-emerald-50/50 to-white"
                styles={{ body: { padding: '0 24px 24px 24px' } }}
              >
                <Table
                  size="middle"
                  rowKey="user_id"
                  dataSource={stats.top?.users || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Khách hàng",
                      key: "user",
                      render: (_, record, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div className="flex items-center gap-3">
                            <div className="text-2xl drop-shadow-sm w-8 text-center">{medals[index] || ''}</div>
                            <Avatar size="large" src={record.avatar_url ? resolveBackendUrl(record.avatar_url) : undefined} icon={<UserOutlined />} className="border-2 border-indigo-100" />
                            <div>
                              <div className="font-bold text-slate-700">{record.full_name}</div>
                              <div className="text-xs text-slate-400">{record.email}</div>
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: "Tổng chi tiêu",
                      dataIndex: "total_spent",
                      key: "total_spent",
                      align: "right",
                      render: (v: number) => (
                        <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full inline-block font-bold border border-emerald-100 shadow-sm">
                          {formatMoney(v)}
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>

              <Card 
                title={<span className="text-lg font-bold text-blue-800">Top 3 Đối tác doanh thu cao nhất</span>} 
                className="rounded-2xl border border-blue-100 shadow-sm flex-1 bg-gradient-to-br from-blue-50/50 to-white"
                styles={{ body: { padding: '0 24px 24px 24px' } }}
              >
                <Table
                  size="middle"
                  rowKey="user_id"
                  dataSource={stats.top?.owners || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Đối tác",
                      key: "owner",
                      render: (_, record, index) => {
                        const medals = ['🥇', '🥈', '🥉'];
                        return (
                          <div className="flex items-center gap-3">
                            <div className="text-2xl drop-shadow-sm w-8 text-center">{medals[index] || ''}</div>
                            <Avatar size="large" src={record.avatar_url ? resolveBackendUrl(record.avatar_url) : undefined} icon={<ShopOutlined />} className="border-2 border-blue-100" />
                            <div>
                              <div className="font-bold text-slate-700">{record.full_name}</div>
                              <div className="text-xs text-slate-400">{record.email}</div>
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: "Tổng doanh thu",
                      dataIndex: "total_revenue",
                      key: "total_revenue",
                      align: "right",
                      render: (v: number) => (
                        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-block font-bold border border-blue-100 shadow-sm">
                          {formatMoney(v)}
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>

            {/* Cột phải: Biểu đồ xu hướng dịch vụ */}
            <Col xs={24} xl={10} className="flex">
              <Card 
                className="rounded-2xl border border-amber-100 shadow-sm w-full flex flex-col relative overflow-hidden bg-gradient-to-br from-amber-50/50 to-white"
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '32px' } }}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-100 to-orange-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
                
                <Title level={4} className="!mt-0 !mb-1 text-slate-800 relative z-10">Xu hướng dịch vụ</Title>
                <Text type="secondary" className="mb-8 block relative z-10">Phân bổ doanh thu theo từng mảng kinh doanh</Text>
                
                {/* Pie Chart */}
                <div className="mb-10 mt-2 relative z-10 h-[220px] w-full flex justify-center items-center">
                  {stats.serviceTrends && (stats.serviceTrends.restaurant > 0 || stats.serviceTrends.hotel > 0 || stats.serviceTrends.tourist > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {serviceData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-4 mt-auto relative z-10">
                  {serviceData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl bg-white border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-300 group">
                      <div className="flex items-center gap-4">
                        <div className="h-5 w-5 rounded-full shadow-inner transform group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-700 text-base">{item.name}</span>
                      </div>
                      <div className="text-xl font-black" style={{ color: item.color }}>{item.value}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Hàng 3: Biểu đồ doanh thu */}
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                title={<span className="text-lg font-bold text-slate-800">
                  {rangeType === 'all' 
                    ? `Xu hướng doanh thu qua các năm`
                    : rangeType === 'year'
                      ? `Xu hướng doanh thu trong Năm ${dateRange[0].format('YYYY')}`
                      : `Xu hướng doanh thu trong Tháng ${dateRange[0].format('M/YYYY')}`
                  }
                </span>}
                className="rounded-2xl border-none shadow-sm"
              >
                {lineChartData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <AreaChart data={lineChartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                          tickFormatter={(value) => {
                            if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                            return value;
                          }}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any) => [`${formatMoney(Number(value))}`, 'Doanh thu']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="DoanhThu" 
                          stroke="#3b82f6" 
                          strokeWidth={4}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty description="Chưa có dữ liệu doanh thu" />
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <Card className="rounded-2xl border-none shadow-sm mb-6">
          <Empty description="Chưa có dữ liệu thống kê" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      )}
      </Spin>
      <InvoiceExportModal
        open={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        role="admin"
        currentUserName={user?.full_name || "Admin"}
        invoices={invoices}
        locations={locations}
        owners={owners}
      />
      <ManagerAiBubble screenContext={managerAiContext} />
    </MainLayout>
    </DashboardErrorBoundary>
  );
};

export default AdminDashboard;
