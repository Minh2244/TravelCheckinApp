// website/src/pages/Admin/Owners.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Table,
  Card,
  Input,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Select,
  Popconfirm,
  Tooltip,
  Descriptions,
} from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import { formatDateVi } from "../../utils/formatDateVi";
import OwnerDetailTabs from "../../components/admin/OwnerDetailTabs";

interface Owner {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  status: string;
  is_verified?: number;
  created_at: string;
  approval_status: string;
  total_revenue: number;
  membership_level: string;
  total_locations: number;
  pending_locations?: number;
  approved_locations?: number;
  rejected_locations?: number;
}

interface OwnerProfile {
  bank_account: string;
  bank_name: string;
  account_holder: string;
  business_license: string | null;
  cccd_number: string | null;
  cccd_front_url: string | null;
  cccd_back_url: string | null;
  terms_accepted_at: string | null;
  terms_accepted_ip: string | null;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const Owners = () => {
  const LIST_LIMIT = 200;
  const LIST_SCROLL_Y = 280;

  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<string | undefined>(
    undefined,
  );
  const [locationStatusFilter, setLocationStatusFilter] = useState<
    string | undefined
  >(undefined);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page: 1,
        limit: LIST_LIMIT,
      };
      if (searchText) params.search = searchText;
      if (approvalFilter) params.approval_status = approvalFilter;
      if (locationStatusFilter) params.location_status = locationStatusFilter;

      const response = await adminApi.getOwners(params);
      if (response.success) {
        setOwners(response.data || []);
        setPagination((p) => ({
          ...p,
          total: response.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi lấy danh sách owner"));
    } finally {
      setLoading(false);
    }
  }, [LIST_LIMIT, approvalFilter, locationStatusFilter, searchText]);

  useEffect(() => {
    void fetchOwners();
  }, [fetchOwners]);

  const handleApprove = async (ownerId: number) => {
    try {
      const response = await adminApi.approveOwner(ownerId);
      if (response.success) {
        message.success("Duyệt owner thành công");
        await fetchOwners();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi duyệt owner"));
    }
  };

  const handleReject = async (ownerId: number) => {
    Modal.confirm({
      title: "Từ chối Owner",
      content: "Bạn có chắc chắn muốn từ chối owner này?",
      onOk: async () => {
        try {
          const response = await adminApi.rejectOwner(
            ownerId,
            "Từ chối bởi Admin",
          );
          if (response.success) {
            message.success("Từ chối owner thành công");
            await fetchOwners();
          }
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, "Lỗi từ chối owner"));
        }
      },
    });
  };

  const handleViewDetail = async (ownerId: number) => {
    try {
      const ownerResponse = await adminApi.getOwnerById(ownerId);
      if (ownerResponse.success) {
        setSelectedOwner(ownerResponse.data.owner as Owner);
        setOwnerProfile(
          ownerResponse.data.owner_profile as OwnerProfile | null,
        );
        setDetailModalVisible(true);
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi khi lấy thông tin chi tiết"),
      );
    }
  };

  const handleDeleteOwner = async (ownerId: number) => {
    Modal.confirm({
      title: "Xóa owner",
      content:
        "Hành động này sẽ xóa owner và dữ liệu liên quan theo ràng buộc database. Bạn có chắc chắn?",
      okText: "Xóa",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const response = await adminApi.deleteOwner(ownerId);
          if (response.success) {
            message.success("Xóa owner thành công");
            setDetailModalVisible(false);
            await fetchOwners();
          }
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, "Lỗi xóa owner"));
        }
      },
    });
  };

  const handleToggleOwnerStatus = async (ownerId: number, status: string) => {
    const nextStatus = status === "locked" ? "active" : "locked";
    try {
      const response = await adminApi.updateOwnerStatus(ownerId, nextStatus);
      if (response?.success) {
        message.success("Đã cập nhật trạng thái owner");
        fetchOwners();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật trạng thái owner"));
    }
  };

  const handleSendTermsEmail = async () => {
    if (!selectedOwner) return;
    try {
      const response = await adminApi.sendOwnerTermsEmail(
        selectedOwner.user_id,
      );
      if (response?.success) {
        message.success("Đã gửi email điều khoản");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi gửi email điều khoản"));
    }
  };

  const handleMarkTermsAccepted = async () => {
    if (!selectedOwner) return;
    try {
      const response = await adminApi.markOwnerTermsAccepted(
        selectedOwner.user_id,
        {
          ip: "admin",
          user_agent: "admin",
        },
      );
      if (response?.success) {
        message.success("Đã ghi nhận điều khoản");
        handleViewDetail(selectedOwner.user_id);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi ghi nhận điều khoản"));
    }
  };

  const columns: ColumnsType<Owner> = [
    {
      title: "ID",
      dataIndex: "user_id",
      key: "user_id",
      width: 80,
    },
    {
      title: "Họ tên",
      dataIndex: "full_name",
      key: "full_name",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Trạng thái duyệt",
      dataIndex: "approval_status",
      key: "approval_status",
      render: (status: string) => {
        const colors: { [key: string]: string } = {
          approved: "green",
          pending: "orange",
          rejected: "red",
        };
        return (
          <Tag color={colors[status]}>{statusToVi(status || "pending")}</Tag>
        );
      },
    },
    {
      title: "Doanh thu",
      dataIndex: "total_revenue",
      key: "total_revenue",
      render: (amount: number) => formatMoney(amount || 0),
    },
    {
      title: "Số địa điểm",
      dataIndex: "total_locations",
      key: "total_locations",
      align: "right",
    },
    {
      title: "Chờ duyệt",
      dataIndex: "pending_locations",
      key: "pending_locations",
      width: 110,
      align: "right",
      render: (v: number | undefined) => <Tag color="orange">{v || 0}</Tag>,
    },
    {
      title: "Đã duyệt",
      dataIndex: "approved_locations",
      key: "approved_locations",
      width: 110,
      align: "right",
      render: (v: number | undefined) => <Tag color="green">{v || 0}</Tag>,
    },
    {
      title: "Từ chối",
      dataIndex: "rejected_locations",
      key: "rejected_locations",
      width: 110,
      align: "right",
      render: (v: number | undefined) => <Tag color="red">{v || 0}</Tag>,
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right",
      width: 190,
      render: (_: unknown, record: Owner) => (
        <Space size={6}>
          <Tooltip title="Chi tiết">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record.user_id)}
            />
          </Tooltip>

          {record.approval_status === "pending" ? null : (
            <Popconfirm
              title={
                String(record.status).toLowerCase() === "locked"
                  ? "Owner đang bị khóa. Mở khóa owner này?"
                  : "Owner đang hoạt động. Khóa owner này?"
              }
              onConfirm={() =>
                handleToggleOwnerStatus(record.user_id, record.status)
              }
              okText="Có"
              cancelText="Không"
            >
              <Tooltip
                title={
                  String(record.status).toLowerCase() === "locked"
                    ? "Đang khóa"
                    : "Đang mở"
                }
              >
                <Button
                  size="small"
                  type="text"
                  danger={String(record.status).toLowerCase() !== "locked"}
                  icon={
                    String(record.status).toLowerCase() === "locked" ? (
                      <LockOutlined />
                    ) : (
                      <UnlockOutlined />
                    )
                  }
                />
              </Tooltip>
            </Popconfirm>
          )}

          {record.approval_status === "pending" ? (
            <>
              <Popconfirm
                title="Duyệt owner này?"
                onConfirm={() => handleApprove(record.user_id)}
                okText="Duyệt"
                cancelText="Hủy"
              >
                <Tooltip title="Duyệt">
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckCircleOutlined />}
                  />
                </Tooltip>
              </Popconfirm>

              <Popconfirm
                title="Từ chối owner này?"
                onConfirm={() => handleReject(record.user_id)}
                okText="Từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Từ chối">
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<CloseCircleOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          ) : null}

          <Popconfirm
            title="Xóa owner này?"
            description="Hành động không thể hoàn tác."
            onConfirm={() => handleDeleteOwner(record.user_id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined style={{ color: "#ff4d4f" }} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Quản lý Owner & Duyệt Địa điểm
        </h2>
        <p className="text-gray-500">
          Danh sách owner đã đăng ký và có địa điểm trên hệ thống
        </p>
      </div>

      <Card>
        <div className="mb-4 flex gap-4">
          <Input
            placeholder="Tìm kiếm theo email, tên..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPagination({ ...pagination, current: 1 });
            }}
            className="max-w-md"
            allowClear
          />
          <Select
            placeholder="Lọc theo trạng thái duyệt"
            value={approvalFilter}
            onChange={(v) => {
              setApprovalFilter(v);
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
            style={{ width: 200 }}
          >
            <Select.Option value="pending">Chờ duyệt</Select.Option>
            <Select.Option value="approved">Đã duyệt</Select.Option>
            <Select.Option value="rejected">Từ chối</Select.Option>
          </Select>

          <Select
            placeholder="Lọc theo trạng thái địa điểm"
            value={locationStatusFilter}
            onChange={(v) => {
              setLocationStatusFilter(v);
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
            style={{ width: 220 }}
          >
            <Select.Option value="pending">Địa điểm chờ duyệt</Select.Option>
            <Select.Option value="approved">Địa điểm đã duyệt</Select.Option>
            <Select.Option value="rejected">Địa điểm bị từ chối</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={owners}
          loading={loading}
          rowKey="user_id"
          pagination={false}
          scroll={{ y: LIST_SCROLL_Y }}
        />
      </Card>

      <Modal
        title="Chi tiết Owner"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={920}
      >
        {selectedOwner && (
          <OwnerDetailTabs
            owner={selectedOwner}
            infoExtra={
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Trạng thái duyệt:</strong>{" "}
                  <Tag
                    color={
                      selectedOwner.approval_status === "approved"
                        ? "green"
                        : selectedOwner.approval_status === "rejected"
                          ? "red"
                          : "orange"
                    }
                  >
                    {statusToVi(selectedOwner.approval_status || "pending")}
                  </Tag>
                </div>
                <div>
                  <strong>Membership:</strong>{" "}
                  {selectedOwner.membership_level || "-"}
                </div>
                <div>
                  <strong>Doanh thu:</strong>{" "}
                  {formatMoney(selectedOwner.total_revenue || 0)}
                </div>
                <div>
                  <strong>Số địa điểm:</strong>{" "}
                  {selectedOwner.total_locations || 0}
                </div>
              </div>
            }
            extraTabs={[
              {
                key: "documents",
                label: "Giấy tờ & Điều khoản",
                children: (
                  <div className="space-y-4">
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="Số CCCD">
                        {ownerProfile?.cccd_number || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Giấy phép kinh doanh">
                        {ownerProfile?.business_license ? (
                          <a
                            href={ownerProfile.business_license}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem file
                          </a>
                        ) : (
                          "-"
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="CCCD mặt trước">
                        {ownerProfile?.cccd_front_url ? (
                          <a
                            href={ownerProfile.cccd_front_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem ảnh
                          </a>
                        ) : (
                          "-"
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="CCCD mặt sau">
                        {ownerProfile?.cccd_back_url ? (
                          <a
                            href={ownerProfile.cccd_back_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Xem ảnh
                          </a>
                        ) : (
                          "-"
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Xác nhận điều khoản">
                        {ownerProfile?.terms_accepted_at
                          ? formatDateVi(ownerProfile.terms_accepted_at)
                          : "Chưa xác nhận"}
                      </Descriptions.Item>
                      <Descriptions.Item label="IP xác nhận">
                        {ownerProfile?.terms_accepted_ip || "-"}
                      </Descriptions.Item>
                    </Descriptions>
                    <Space>
                      <Button onClick={handleSendTermsEmail}>
                        Gửi điều khoản
                      </Button>
                      <Button
                        type="primary"
                        onClick={handleMarkTermsAccepted}
                        disabled={Boolean(ownerProfile?.terms_accepted_at)}
                      >
                        Ghi nhận đã chấp nhận
                      </Button>
                    </Space>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </MainLayout>
  );
};

export default Owners;
