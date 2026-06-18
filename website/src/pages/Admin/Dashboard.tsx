import { useEffect, useState, useCallback } from "react";
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
  Radio,
  DatePicker,
  Space
} from "antd";
import {
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
} from "recharts";
import dayjs from "dayjs";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import InvoiceExportModal from "../../components/InvoiceExportModal";
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

  if (!user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">Đang tải thông tin...</p>
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

  return (
    <MainLayout>
      <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tổng quan hệ thống</h2>
          <p className="text-gray-500">Các chỉ số hoạt động cốt lõi của nền tảng.</p>
        </div>
        
        <Space size="middle" className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => setIsInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/80 hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-100 font-semibold rounded-lg px-4 transition-all duration-300 shadow-sm hover:shadow"
          >
            Xuất file
          </Button>
          <Radio.Group value={rangeType} onChange={handleRangeChange} optionType="button" buttonStyle="solid">
            <Radio.Button value="today">Hôm nay</Radio.Button>
            <Radio.Button value="7days">7 ngày</Radio.Button>
            <Radio.Button value="month">1 tháng</Radio.Button>
            <Radio.Button value="year">1 năm</Radio.Button>
            <Radio.Button value="all">Tất cả</Radio.Button>
          </Radio.Group>
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
                            <Avatar size="large" src={record.avatar_url || undefined} icon={<UserOutlined />} className="border-2 border-indigo-100" />
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
                            <Avatar size="large" src={record.avatar_url || undefined} icon={<ShopOutlined />} className="border-2 border-blue-100" />
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
                
                {/* Custom Stacked Horizontal Bar */}
                <div className="mb-10 mt-2 relative z-10">
                  <div className="flex h-8 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                    <div className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 flex items-center justify-center text-xs font-bold text-white shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]" style={{ width: `${stats.serviceTrends?.restaurant || 0}%` }}>
                      {(stats.serviceTrends?.restaurant || 0) > 10 && `${stats.serviceTrends?.restaurant}%`}
                    </div>
                    <div className="bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-1000 flex items-center justify-center text-xs font-bold text-white shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]" style={{ width: `${stats.serviceTrends?.hotel || 0}%` }}>
                      {(stats.serviceTrends?.hotel || 0) > 10 && `${stats.serviceTrends?.hotel}%`}
                    </div>
                    <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 flex items-center justify-center text-xs font-bold text-white shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]" style={{ width: `${stats.serviceTrends?.tourist || 0}%` }}>
                      {(stats.serviceTrends?.tourist || 0) > 10 && `${stats.serviceTrends?.tourist}%`}
                    </div>
                  </div>
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
      <InvoiceExportModal
        open={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        role="admin"
        currentUserName={user?.full_name || "Admin"}
        invoices={invoices}
        locations={locations}
        owners={owners}
      />
    </MainLayout>
  );
};

export default AdminDashboard;
