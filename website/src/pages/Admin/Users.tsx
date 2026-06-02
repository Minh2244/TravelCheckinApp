// website/src/pages/Admin/Users.tsx
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  SearchOutlined,
  UnlockOutlined,
  UserOutlined,
} from "@ant-design/icons";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import OwnerDetailTabs from "../../components/admin/OwnerDetailTabs";
import { formatDateVi } from "../../utils/formatDateVi";

type UserRole = "user" | "owner" | "employee";

type User = {
  user_id: number;
  role: UserRole;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  status: "active" | "locked" | "pending" | string;
  is_verified: number;

  total_bookings: number;
  total_spent: number;
  total_locations: number;
  total_employee_locations: number;
  employee_work_locations?: string | null;
  employee_owners: string | null;
};

type LoginHistoryRow = {
  login_id: number;
  success: 0 | 1;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
};

type TravelHistoryRow = {
  checkin_id: number;
  checkin_time: string | null;
  status: string;
  location_id: number;
  location_name: string;
  address: string | null;
  province: string | null;
  location_type: string | null;
};

type ReviewHistoryRow = {
  review_id: number;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  location_id: number;
  location_name: string;
};

type FavoriteRow = {
  location_id: number;
  location_name: string;
  address: string | null;
  province: string | null;
  location_type: string | null;
  first_image: string | null;
};

const statusColor = (status: string) => {
  if (status === "active") return "green";
  if (status === "locked") return "red";
  if (status === "pending") return "orange";
  return "default";
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const Users = () => {
  const LIST_LIMIT = 200;
  const LIST_SCROLL_Y = 280;

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [minSpent, setMinSpent] = useState<string>("");
  const [maxSpent, setMaxSpent] = useState<string>("");
  const [provinceFilter, setProvinceFilter] = useState<string>("");

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryPagination, setLoginHistoryPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [travelHistory, setTravelHistory] = useState<TravelHistoryRow[]>([]);
  const [travelHistoryLoading, setTravelHistoryLoading] = useState(false);
  const [travelHistoryPagination, setTravelHistoryPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryRow[]>([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);
  const [reviewHistoryPagination, setReviewHistoryPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [favoriteRows, setFavoriteRows] = useState<FavoriteRow[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritePagination, setFavoritePagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [activeTab, setActiveTab] = useState("info");

  const [dataByRole, setDataByRole] = useState<Record<UserRole, User[]>>({
    user: [],
    owner: [],
    employee: [],
  });
  const [loadingByRole, setLoadingByRole] = useState<Record<UserRole, boolean>>(
    {
      user: false,
      owner: false,
      employee: false,
    },
  );
  const [, setPaginationByRole] = useState<
    Record<UserRole, { current: number; pageSize: number; total: number }>
  >({
    user: { current: 1, pageSize: LIST_LIMIT, total: 0 },
    owner: { current: 1, pageSize: LIST_LIMIT, total: 0 },
    employee: { current: 1, pageSize: LIST_LIMIT, total: 0 },
  });

  const fetchUsers = async (role: UserRole) => {
    try {
      setLoadingByRole((prev) => ({ ...prev, [role]: true }));

      const params: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        role,
        page: 1,
        limit: LIST_LIMIT,
      };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (minSpent) params.min_spent = Number(minSpent);
      if (maxSpent) params.max_spent = Number(maxSpent);
      if (provinceFilter) params.province = provinceFilter;

      const response = await adminApi.getUsers(params);
      if (response?.success) {
        setDataByRole((prev) => ({ ...prev, [role]: response.data || [] }));
        setPaginationByRole((prev) => ({
          ...prev,
          [role]: {
            current: 1,
            pageSize: LIST_LIMIT,
            total: response.pagination?.total ?? prev[role].total,
          },
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách người dùng"));
    } finally {
      setLoadingByRole((prev) => ({ ...prev, [role]: false }));
    }
  };

  useEffect(() => {
    fetchUsers("user");
    fetchUsers("owner");
    fetchUsers("employee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, statusFilter, minSpent, maxSpent, provinceFilter]);

  const handleViewDetail = async (userId: number) => {
    try {
      const response = await adminApi.getUserById(userId);
      if (response?.success) {
        const user = response.data.user as User;
        setSelectedUser(user);
        setActiveTab("info");
        setLoginHistory([]);
        setLoginHistoryPagination((p) => ({ ...p, current: 1, total: 0 }));
        setTravelHistory([]);
        setTravelHistoryPagination((p) => ({ ...p, current: 1, total: 0 }));
        setReviewHistory([]);
        setReviewHistoryPagination((p) => ({ ...p, current: 1, total: 0 }));
        setFavoriteRows([]);
        setFavoritePagination((p) => ({ ...p, current: 1, total: 0 }));

        setDetailModalVisible(true);

        if (user.role !== "owner") {
          fetchLoginHistory(userId, 1, loginHistoryPagination.pageSize);
          fetchTravelHistory(userId, 1, travelHistoryPagination.pageSize);
          fetchReviewHistory(userId, 1, reviewHistoryPagination.pageSize);
          fetchFavorites(userId, 1, favoritePagination.pageSize);
        }
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi khi lấy thông tin chi tiết"),
      );
    }
  };

  const fetchLoginHistory = async (
    userId: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setLoginHistoryLoading(true);
      const resp = await adminApi.getUserLoginHistory(userId, {
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setLoginHistory((resp.data || []) as LoginHistoryRow[]);
        setLoginHistoryPagination((p) => ({
          ...p,
          current: page,
          pageSize,
          total: resp.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải lịch sử đăng nhập"));
    } finally {
      setLoginHistoryLoading(false);
    }
  };

  const fetchTravelHistory = async (
    userId: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setTravelHistoryLoading(true);
      const resp = await adminApi.getUserTravelHistory(userId, {
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setTravelHistory((resp.data || []) as TravelHistoryRow[]);
        setTravelHistoryPagination((p) => ({
          ...p,
          current: page,
          pageSize,
          total: resp.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải lịch sử nơi đã đi"));
    } finally {
      setTravelHistoryLoading(false);
    }
  };

  const fetchReviewHistory = async (
    userId: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setReviewHistoryLoading(true);
      const resp = await adminApi.getUserReviewHistory(userId, {
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setReviewHistory((resp.data || []) as ReviewHistoryRow[]);
        setReviewHistoryPagination((p) => ({
          ...p,
          current: page,
          pageSize,
          total: resp.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải lịch sử đánh giá"));
    } finally {
      setReviewHistoryLoading(false);
    }
  };

  const fetchFavorites = async (
    userId: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setFavoriteLoading(true);
      const resp = await adminApi.getUserFavorites(userId, {
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setFavoriteRows((resp.data || []) as FavoriteRow[]);
        setFavoritePagination((p) => ({
          ...p,
          current: page,
          pageSize,
          total: resp.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách yêu thích"));
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleStatusChange = async (userId: number, status: string) => {
    try {
      const response = await adminApi.updateUserStatus(userId, status);
      if (response?.success) {
        message.success("Cập nhật trạng thái thành công");
        fetchUsers("user");
        fetchUsers("owner");
        fetchUsers("employee");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật trạng thái"));
    }
  };

  const handleDelete = async (userId: number) => {
    try {
      const response = await adminApi.deleteUser(userId);
      if (response?.success) {
        message.success("Xóa tài khoản thành công");
        fetchUsers("user");
        fetchUsers("owner");
        fetchUsers("employee");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi xóa tài khoản"));
    }
  };

  const handlePromoteOwner = async (userId: number) => {
    try {
      const response = await adminApi.promoteUserToOwner(userId);
      if (response?.success) {
        message.success("Đã chuyển user thành owner");
        fetchUsers("user");
        fetchUsers("owner");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi chuyển user thành owner"));
    }
  };

  const actionCol: ColumnsType<User>[number] = {
    title: "Thao tác",
    key: "actions",
    fixed: "right",
    width: 92,
    align: "center",
    render: (_, record) => (
      <Space size={2}>
        <Tooltip title="Chi tiết">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetail(record.user_id);
            }}
          />
        </Tooltip>

        {String(record.status).toLowerCase() === "locked" ? (
          <Popconfirm
            title="Tài khoản đang bị khóa. Mở khóa tài khoản này?"
            onConfirm={() => handleStatusChange(record.user_id, "active")}
          >
            <Tooltip title="Đang khóa">
              <Button size="small" type="text" icon={<LockOutlined />} />
            </Tooltip>
          </Popconfirm>
        ) : (
          <Popconfirm
            title="Tài khoản đang hoạt động. Khóa tài khoản này?"
            onConfirm={() => handleStatusChange(record.user_id, "locked")}
          >
            <Tooltip title="Đang mở">
              <Button
                size="small"
                type="text"
                danger
                icon={<UnlockOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        )}

        {record.role === "user" && (
          <Popconfirm
            title="Chuyển user này thành owner?"
            onConfirm={() => handlePromoteOwner(record.user_id)}
          >
            <Tooltip title="Chuyển thành Owner">
              <Button size="small" type="text" icon={<UserOutlined />} />
            </Tooltip>
          </Popconfirm>
        )}

        <Popconfirm
          title="Xóa tài khoản này?"
          description="Tài khoản sẽ bị xóa mềm (ẩn khỏi hệ thống) và có thể khôi phục khi cần."
          onConfirm={() => handleDelete(record.user_id)}
        >
          <Tooltip title="Xóa">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  };

  const baseCols: ColumnsType<User> = [
    {
      title: "ID",
      dataIndex: "user_id",
      key: "user_id",
      width: 70,
    },
    {
      title: "Họ tên",
      dataIndex: "full_name",
      key: "full_name",
      width: 200,
      render: (text: string, record: User) => (
        <div className="flex items-center gap-2">
          {record.avatar_url ? (
            <img
              src={resolveBackendUrl(record.avatar_url) || undefined}
              alt={text}
              className="h-7 w-7 rounded-full"
            />
          ) : (
            <UserOutlined className="text-gray-400" />
          )}
          <span className="truncate">{text}</span>
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 220,
      ellipsis: true,
    },
    {
      title: "SĐT",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (text: string | null) => text || "-",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: string) => (
        <Tag color={statusColor(status)}>{statusToVi(status)}</Tag>
      ),
    },
    {
      title: "Xác thực",
      dataIndex: "is_verified",
      key: "is_verified",
      width: 120,
      render: (verified: number) => (
        <Tag color={verified ? "green" : "default"}>
          {verified ? "Đã xác thực" : "Chưa"}
        </Tag>
      ),
    },
  ];

  const columnsByRole: Record<UserRole, ColumnsType<User>> = {
    user: [
      ...baseCols,
      {
        title: "Đặt chỗ",
        dataIndex: "total_bookings",
        key: "total_bookings",
        width: 95,
        align: "right",
      },
      {
        title: "Chi tiêu",
        dataIndex: "total_spent",
        key: "total_spent",
        width: 130,
        align: "right",
        render: (amount: number) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatMoney(amount)}
          </span>
        ),
      },
      actionCol,
    ],
    owner: [
      ...baseCols,
      {
        title: "Địa điểm",
        dataIndex: "total_locations",
        key: "total_locations",
        width: 95,
        align: "right",
      },
      actionCol,
    ],
    employee: [
      ...baseCols,
      {
        title: "Owner quản lý",
        dataIndex: "employee_owners",
        key: "employee_owners",
        width: 240,
        ellipsis: true,
        render: (v: string | null) => v || "-",
      },
      {
        title: "Nơi làm việc",
        dataIndex: "employee_work_locations",
        key: "employee_work_locations",
        width: 240,
        ellipsis: true,
        render: (v: string | null | undefined) => v || "-",
      },
      actionCol,
    ],
  };

  const renderTable = (role: UserRole) => {
    const data = dataByRole[role];

    const roleTitle =
      role === "user" ? "Users" : role === "owner" ? "Owners" : "Employees";

    return (
      <Card
        key={role}
        className="mb-4"
        title={`Danh sách ${roleTitle}`}
        styles={{ body: { padding: 12 } }}
      >
        <Table
          size="small"
          tableLayout="fixed"
          columns={columnsByRole[role]}
          dataSource={data}
          loading={loadingByRole[role]}
          rowKey="user_id"
          pagination={false}
          scroll={{ x: "max-content", y: LIST_SCROLL_Y }}
        />
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Người dùng</h2>
        <p className="text-gray-500">
          Tìm kiếm / lọc theo vai trò và trạng thái
        </p>
      </div>

      <Card className="mb-4" styles={{ body: { padding: 12 } }}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Tìm theo email, họ tên, SĐT..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            allowClear
            style={{ width: 360 }}
          />

          <Select
            placeholder="Lọc theo vai trò"
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            style={{ width: 180 }}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "user", label: "User" },
              { value: "owner", label: "Owner" },
              { value: "employee", label: "Employee" },
            ]}
          />

          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            allowClear
            style={{ width: 180 }}
          >
            <Select.Option value="active">{statusToVi("active")}</Select.Option>
            <Select.Option value="locked">{statusToVi("locked")}</Select.Option>
            <Select.Option value="pending">
              {statusToVi("pending")}
            </Select.Option>
          </Select>

          <Input
            placeholder="Chi tiêu tối thiểu"
            value={minSpent}
            onChange={(e) => {
              setMinSpent(e.target.value);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            className="w-[160px]"
          />

          <Input
            placeholder="Chi tiêu tối đa"
            value={maxSpent}
            onChange={(e) => {
              setMaxSpent(e.target.value);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            className="w-[160px]"
          />

          <Input
            placeholder="Tỉnh/Thành"
            value={provinceFilter}
            onChange={(e) => {
              setProvinceFilter(e.target.value);
              setPaginationByRole((prev) => ({
                user: { ...prev.user, current: 1 },
                owner: { ...prev.owner, current: 1 },
                employee: { ...prev.employee, current: 1 },
              }));
            }}
            className="w-[180px]"
          />
        </div>
      </Card>

      {roleFilter === "all" || roleFilter === "user"
        ? renderTable("user")
        : null}
      {roleFilter === "all" || roleFilter === "owner"
        ? renderTable("owner")
        : null}
      {roleFilter === "all" || roleFilter === "employee"
        ? renderTable("employee")
        : null}

      <Modal
        title={
          selectedUser?.role === "owner"
            ? "Chi tiết Owner"
            : "Chi tiết Người dùng"
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedUser &&
          (selectedUser.role === "owner" ? (
            <OwnerDetailTabs owner={selectedUser} />
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key)}
              items={[
                {
                  key: "info",
                  label: "Thông tin",
                  children: (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Họ tên:</strong> {selectedUser.full_name}
                      </div>
                      <div>
                        <strong>Email:</strong> {selectedUser.email}
                      </div>
                      <div>
                        <strong>Số điện thoại:</strong>{" "}
                        {selectedUser.phone || "-"}
                      </div>
                      <div>
                        <strong>Trạng thái:</strong>{" "}
                        <Tag color={statusColor(selectedUser.status)}>
                          {statusToVi(selectedUser.status)}
                        </Tag>
                      </div>
                      <div>
                        <strong>Vai trò:</strong> {selectedUser.role}
                      </div>
                      <div>
                        <strong>Xác thực:</strong>{" "}
                        <Tag
                          color={selectedUser.is_verified ? "green" : "default"}
                        >
                          {selectedUser.is_verified ? "Đã xác thực" : "Chưa"}
                        </Tag>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "login",
                  label: "Đăng nhập",
                  children: (
                    <Table
                      size="small"
                      rowKey="login_id"
                      loading={loginHistoryLoading}
                      dataSource={loginHistory}
                      columns={
                        [
                          {
                            title: "Thời gian",
                            dataIndex: "created_at",
                            key: "created_at",
                            width: 180,
                            render: (v: string) => formatDateVi(v),
                          },
                          {
                            title: "Kết quả",
                            dataIndex: "success",
                            key: "success",
                            width: 120,
                            render: (v: 0 | 1) => (
                              <Tag color={v === 1 ? "green" : "red"}>
                                {v === 1 ? "Thành công" : "Thất bại"}
                              </Tag>
                            ),
                          },
                          {
                            title: "IP",
                            dataIndex: "ip_address",
                            key: "ip_address",
                            width: 160,
                            render: (v: string | null) => v || "-",
                          },
                          {
                            title: "User-Agent",
                            dataIndex: "user_agent",
                            key: "user_agent",
                            ellipsis: true,
                            render: (v: string | null) => v || "-",
                          },
                        ] as ColumnsType<LoginHistoryRow>
                      }
                      pagination={{
                        current: loginHistoryPagination.current,
                        pageSize: loginHistoryPagination.pageSize,
                        total: loginHistoryPagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} lần đăng nhập`,
                        onChange: (page, pageSize) => {
                          if (!selectedUser) return;
                          fetchLoginHistory(
                            selectedUser.user_id,
                            page,
                            pageSize || loginHistoryPagination.pageSize,
                          );
                        },
                      }}
                    />
                  ),
                },
                {
                  key: "travel",
                  label: "Nơi đã đi",
                  children: (
                    <Table
                      size="small"
                      rowKey="checkin_id"
                      loading={travelHistoryLoading}
                      dataSource={travelHistory}
                      columns={
                        [
                          {
                            title: "Thời gian",
                            dataIndex: "checkin_time",
                            key: "checkin_time",
                            width: 180,
                            render: (v: string | null) => formatDateVi(v),
                          },
                          {
                            title: "Địa điểm",
                            dataIndex: "location_name",
                            key: "location_name",
                          },
                          {
                            title: "Tỉnh",
                            dataIndex: "province",
                            key: "province",
                            width: 140,
                            render: (v: string | null) => v || "-",
                          },
                          {
                            title: "Trạng thái",
                            dataIndex: "status",
                            key: "status",
                            width: 120,
                          },
                        ] as ColumnsType<TravelHistoryRow>
                      }
                      pagination={{
                        current: travelHistoryPagination.current,
                        pageSize: travelHistoryPagination.pageSize,
                        total: travelHistoryPagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} lượt`,
                        onChange: (page, pageSize) => {
                          if (!selectedUser) return;
                          fetchTravelHistory(
                            selectedUser.user_id,
                            page,
                            pageSize || travelHistoryPagination.pageSize,
                          );
                        },
                      }}
                    />
                  ),
                },
                {
                  key: "reviews",
                  label: "Đánh giá",
                  children: (
                    <Table
                      size="small"
                      rowKey="review_id"
                      loading={reviewHistoryLoading}
                      dataSource={reviewHistory}
                      columns={
                        [
                          {
                            title: "Thời gian",
                            dataIndex: "created_at",
                            key: "created_at",
                            width: 180,
                            render: (v: string) => formatDateVi(v),
                          },
                          {
                            title: "Địa điểm",
                            dataIndex: "location_name",
                            key: "location_name",
                          },
                          {
                            title: "Sao",
                            dataIndex: "rating",
                            key: "rating",
                            width: 80,
                          },
                          {
                            title: "Trạng thái",
                            dataIndex: "status",
                            key: "status",
                            width: 120,
                          },
                          {
                            title: "Đã xóa",
                            dataIndex: "deleted_at",
                            key: "deleted_at",
                            width: 140,
                            render: (v: string | null) => (v ? "Có" : "Không"),
                          },
                        ] as ColumnsType<ReviewHistoryRow>
                      }
                      pagination={{
                        current: reviewHistoryPagination.current,
                        pageSize: reviewHistoryPagination.pageSize,
                        total: reviewHistoryPagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} đánh giá`,
                        onChange: (page, pageSize) => {
                          if (!selectedUser) return;
                          fetchReviewHistory(
                            selectedUser.user_id,
                            page,
                            pageSize || reviewHistoryPagination.pageSize,
                          );
                        },
                      }}
                    />
                  ),
                },
                {
                  key: "favorites",
                  label: "Yêu thích",
                  children: (
                    <Table
                      size="small"
                      rowKey="location_id"
                      loading={favoriteLoading}
                      dataSource={favoriteRows}
                      columns={
                        [
                          {
                            title: "Địa điểm",
                            dataIndex: "location_name",
                            key: "location_name",
                          },
                          {
                            title: "Tỉnh",
                            dataIndex: "province",
                            key: "province",
                            width: 140,
                            render: (v: string | null) => v || "-",
                          },
                          {
                            title: "Loại",
                            dataIndex: "location_type",
                            key: "location_type",
                            width: 140,
                            render: (v: string | null) => v || "-",
                          },
                        ] as ColumnsType<FavoriteRow>
                      }
                      pagination={{
                        current: favoritePagination.current,
                        pageSize: favoritePagination.pageSize,
                        total: favoritePagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} địa điểm`,
                        onChange: (page, pageSize) => {
                          if (!selectedUser) return;
                          fetchFavorites(
                            selectedUser.user_id,
                            page,
                            pageSize || favoritePagination.pageSize,
                          );
                        },
                      }}
                    />
                  ),
                },
              ]}
            />
          ))}
      </Modal>
    </MainLayout>
  );
};

export default Users;
