// website/src/pages/Admin/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  DatePicker,
  Segmented,
  Space,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Tag,
  Table,
} from "antd";
import dayjs from "dayjs";
import {
  UserOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  FileTextOutlined,
  StarOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateVi } from "../../utils/formatDateVi";

interface RegionStat {
  region: string;
  count: number;
}

interface ProvinceStat {
  province: string;
  count: number;
}

interface TrendPoint {
  label: string | number;
  total: number;
}

interface TopUserRow {
  user_id: number;
  full_name: string;
  email: string;
  total_checkins: number;
  total_spent: number;
}

interface TopOwnerRow {
  user_id: number;
  full_name: string;
  email: string;
  total_locations: number;
  total_revenue: number;
}

interface DashboardStats {
  totalUsers: number;
  totalOwners: number;
  totalEmployees: number;
  totalItineraries: number;
  todayCheckins: number;
  pendingReports: number;
  totalRevenue: number;
  totalCommissions: number;
  commissionRate: string;
  totalReviews: number;
  regions: RegionStat[];
  provinces?: ProvinceStat[];
  searches?: { total: number; today: number };
  visits?: { total: number; today: number };
  kpis?: {
    monthCommission: number;
    monthCommissionGrowth: string;
    newUsersToday: number;
    activeLocations: number;
    inactiveLocations: number;
    pendingLocations: number;
  };
  actionable?: {
    pendingLocations: Array<{ location_id: number; location_name: string }>;
    overdueCommissions: Array<{
      commission_id: number;
      owner_name: string;
      owner_email?: string | null;
      total_due: number;
      due_date?: string | null;
    }>;
  };
  charts?: {
    revenueTrend: Array<{ month: string; total: number }>;
    serviceTypeDistribution: Array<{ service_type: string; count: number }>;
    checkinTrends?: {
      daily: TrendPoint[];
      monthly: TrendPoint[];
      yearly: TrendPoint[];
    };
  };
  top?: {
    users: TopUserRow[];
    owners: TopOwnerRow[];
  };
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ role?: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<
    "today" | "week" | "month" | "year" | "all"
  >("today");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (!userStr) {
        navigate("/login", { replace: true });
        return;
      }

      const userData = JSON.parse(userStr) as { role?: string };
      if (userData.role !== "admin") {
        navigate("/unauthorized", { replace: true });
        return;
      }

      setUser(userData);
      fetchDashboardStats();
    } catch (error) {
      console.error("Lỗi loading user:", error);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      const params = selectedDate ? { date: selectedDate } : { range };
      const response = await adminApi.getDashboardStats(params);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Lỗi lấy thống kê:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedDate]);

  const periodLabel = (() => {
    if (selectedDate) return `ngày ${formatDateVi(selectedDate)}`;
    if (range === "today") return "hôm nay";
    if (range === "week") return "7 ngày";
    if (range === "month") return "1 tháng";
    if (range === "year") return "1 năm";
    return "tất cả";
  })();

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spin size="large" />
          <p className="text-gray-600 mt-4">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Tổng quan hệ thống
          </h2>
          <p className="text-gray-500">Báo cáo theo {periodLabel}.</p>
        </div>
        <Space align="center">
          <Segmented
            value={range}
            options={[
              { label: "Hôm nay", value: "today" },
              { label: "1 tuần", value: "week" },
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
            onChange={(d) => setSelectedDate(d ? d.format("YYYY-MM-DD") : null)}
          />
        </Space>
      </div>

      {/* KPI hàng trên */}
      {stats ? (
        <>
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title={`Hoa hồng (${periodLabel})`}
                  value={formatMoney(stats.kpis?.monthCommission || 0)}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#faad14" } }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  Tăng trưởng:{" "}
                  <span
                    className={
                      Number(stats.kpis?.monthCommissionGrowth || "0") >= 0
                        ? "text-green-600 font-semibold"
                        : "text-red-600 font-semibold"
                    }
                  >
                    {stats.kpis?.monthCommissionGrowth || "0.00"}%
                  </span>{" "}
                  so với kỳ trước
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title={`Check-in (${periodLabel})`}
                  value={stats.todayCheckins}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: "#3f8600" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="Địa điểm đang hoạt động"
                  value={stats.kpis?.activeLocations || 0}
                  prefix={<ShopOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  Tạm ngưng / chờ duyệt:{" "}
                  <span className="font-semibold text-red-500">
                    {(stats.kpis?.inactiveLocations || 0) +
                      (stats.kpis?.pendingLocations || 0)}
                  </span>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title={`Người dùng mới (${periodLabel})`}
                  value={stats.kpis?.newUsersToday || 0}
                  prefix={<UserOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Thống kê tổng quan khác */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title={`Tổng doanh thu (${periodLabel})`}
                  value={formatMoney(stats.totalRevenue)}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#faad14" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title={`Hoa hồng thu được (${periodLabel})`}
                  value={formatMoney(stats.totalCommissions)}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="Tỷ lệ hoa hồng"
                  value={stats.commissionRate}
                  suffix="%"
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#13c2c2" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="Báo cáo chờ xử lý"
                  value={stats.pendingReports}
                  prefix={<WarningOutlined />}
                  styles={{ content: { color: "#ff4d4f" } }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="Tìm kiếm hôm nay"
                  value={stats.searches?.today || 0}
                  prefix={<FileTextOutlined />}
                  styles={{ content: { color: "#1677ff" } }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  Tổng: {stats.searches?.total || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable>
                <Statistic
                  title="Lượt truy cập hôm nay"
                  value={stats.visits?.today || 0}
                  prefix={<ShopOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  Tổng: {stats.visits?.total || 0}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={12}>
              <Card>
                <div className="text-gray-500 mb-2">Theo tỉnh/thành</div>
                <div className="flex flex-wrap gap-2">
                  {(stats.provinces || []).slice(0, 12).map((p) => (
                    <Tag key={p.province} color="blue">
                      {p.province}: {p.count}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Thống kê bổ sung & phân bố khu vực */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng Employee"
                  value={stats.totalEmployees}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng lịch trình"
                  value={stats.totalItineraries}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng đánh giá"
                  value={stats.totalReviews}
                  prefix={<StarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <div className="text-gray-500 mb-2">Phân bố theo khu vực</div>
                <div className="space-y-1">
                  {stats.regions && stats.regions.length > 0 ? (
                    stats.regions.map((region: RegionStat) => (
                      <Tag key={region.region} color="blue">
                        {region.region}: {region.count}
                      </Tag>
                    ))
                  ) : (
                    <span className="text-gray-400">Chưa có dữ liệu</span>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} lg={12}>
              <Card title="Top User hoạt động">
                <Table
                  size="small"
                  rowKey="user_id"
                  dataSource={stats.top?.users || []}
                  pagination={false}
                  columns={[
                    { title: "User", dataIndex: "full_name", key: "full_name" },
                    { title: "Email", dataIndex: "email", key: "email" },
                    {
                      title: "Check-in",
                      dataIndex: "total_checkins",
                      key: "total_checkins",
                      width: 100,
                      align: "right",
                    },
                    {
                      title: "Chi tiêu",
                      dataIndex: "total_spent",
                      key: "total_spent",
                      width: 140,
                      align: "right",
                      render: (v: number) => formatMoney(v),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Top Owner hoạt động">
                <Table
                  size="small"
                  rowKey="user_id"
                  dataSource={stats.top?.owners || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Owner",
                      dataIndex: "full_name",
                      key: "full_name",
                    },
                    { title: "Email", dataIndex: "email", key: "email" },
                    {
                      title: "Địa điểm",
                      dataIndex: "total_locations",
                      key: "total_locations",
                      width: 110,
                      align: "right",
                    },
                    {
                      title: "Doanh thu",
                      dataIndex: "total_revenue",
                      key: "total_revenue",
                      width: 140,
                      align: "right",
                      render: (v: number) => formatMoney(v),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} lg={8}>
              <Card title="Check-in theo ngày (14 ngày)">
                <Table
                  size="small"
                  rowKey="label"
                  dataSource={stats.charts?.checkinTrends?.daily || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Ngày",
                      dataIndex: "label",
                      key: "label",
                      render: (v: string | number) => formatDateVi(String(v)),
                    },
                    {
                      title: "Số lượt",
                      dataIndex: "total",
                      key: "total",
                      width: 100,
                      align: "right",
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Check-in theo tháng (12 tháng)">
                <Table
                  size="small"
                  rowKey="label"
                  dataSource={stats.charts?.checkinTrends?.monthly || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Tháng",
                      dataIndex: "label",
                      key: "label",
                      render: (v: string | number) => formatDateVi(String(v)),
                    },
                    {
                      title: "Số lượt",
                      dataIndex: "total",
                      key: "total",
                      width: 100,
                      align: "right",
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Check-in theo năm">
                <Table
                  size="small"
                  rowKey="label"
                  dataSource={stats.charts?.checkinTrends?.yearly || []}
                  pagination={false}
                  columns={[
                    {
                      title: "Năm",
                      dataIndex: "label",
                      key: "label",
                      render: (v: string | number) => formatDateVi(String(v)),
                    },
                    {
                      title: "Số lượt",
                      dataIndex: "total",
                      key: "total",
                      width: 100,
                      align: "right",
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          {/* Actionable widgets */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} lg={12}>
              <Card
                title="Địa điểm chờ phê duyệt (Top 5)"
                extra={<ShopOutlined />}
              >
                {stats.actionable?.pendingLocations &&
                stats.actionable.pendingLocations.length > 0 ? (
                  <div className="space-y-3">
                    {stats.actionable.pendingLocations.map(
                      (loc: {
                        location_id: number;
                        location_name: string;
                        location_type?: string | null;
                        address?: string | null;
                        owner_name?: string | null;
                        owner_email?: string | null;
                      }) => (
                        <div
                          key={loc.location_id}
                          className="flex justify-between items-start border-b pb-2 last:border-b-0"
                        >
                          <div>
                            <div className="font-semibold">
                              {loc.location_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {loc.location_type} • {loc.address}
                            </div>
                            <div className="text-xs text-gray-400">
                              Chủ: {loc.owner_name} ({loc.owner_email})
                            </div>
                          </div>
                          <Tag color="orange">Chờ duyệt</Tag>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Không có địa điểm nào đang chờ duyệt.
                  </p>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title="Nợ hoa hồng quá hạn (Top 5)"
                extra={<DollarOutlined />}
              >
                {stats.actionable?.overdueCommissions &&
                stats.actionable.overdueCommissions.length > 0 ? (
                  <div className="space-y-3">
                    {stats.actionable.overdueCommissions.map((c) => (
                      <div
                        key={c.commission_id}
                        className="flex justify-between items-start border-b pb-2 last:border-b-0"
                      >
                        <div>
                          <div className="font-semibold">{c.owner_name}</div>
                          <div className="text-xs text-gray-500">
                            {c.owner_email}
                          </div>
                          <div className="text-xs text-red-600 font-semibold mt-1">
                            Nợ: {formatMoney(c.total_due)} • Hạn:{" "}
                            {formatDateVi(c.due_date)}
                          </div>
                        </div>
                        <Tag color="red">Quá hạn</Tag>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Không có khoản nợ hoa hồng quá hạn.
                  </p>
                )}
              </Card>
            </Col>
          </Row>

          {/* Charts (simple visual using progress bars) */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card title="Xu hướng doanh thu 6 tháng gần nhất">
                {stats.charts?.revenueTrend &&
                stats.charts.revenueTrend.length > 0 ? (
                  <div className="space-y-2">
                    {stats.charts.revenueTrend.map((item) => (
                      <div key={item.month}>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{item.month}</span>
                          <span>{formatMoney(item.total)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-2"
                            style={{ width: "70%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Chưa có dữ liệu doanh thu.
                  </p>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Cơ cấu loại hình dịch vụ">
                {stats.charts?.serviceTypeDistribution &&
                stats.charts.serviceTypeDistribution.length > 0 ? (
                  <div className="space-y-2">
                    {stats.charts.serviceTypeDistribution.map((item) => (
                      <div key={item.service_type}>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{item.service_type}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-green-500 h-2"
                            style={{ width: "60%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Chưa có dữ liệu loại hình dịch vụ.
                  </p>
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <Card className="mb-6">
          <Empty
            description="Chưa có dữ liệu thống kê"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      {/* Khu vực quản lý nhanh */}
      <Card title="Quản lý nhanh" className="shadow-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate("/admin/users")}
            className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <UserOutlined className="text-3xl mb-2" />
            <p className="font-semibold">Quản lý người dùng</p>
          </button>

          <button
            onClick={() => navigate("/admin/locations")}
            className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <ShopOutlined className="text-3xl mb-2" />
            <p className="font-semibold">Duyệt địa điểm</p>
          </button>

          <button
            onClick={() => navigate("/admin/reports")}
            className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <WarningOutlined className="text-3xl mb-2" />
            <p className="font-semibold">Xem báo cáo</p>
          </button>

          <button
            onClick={() => navigate("/admin/settings")}
            className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <CheckCircleOutlined className="text-3xl mb-2" />
            <p className="font-semibold">Cài đặt hệ thống</p>
          </button>
        </div>
      </Card>
    </MainLayout>
  );
};

export default AdminDashboard;
