// website/src/pages/Admin/Commissions.tsx
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  StopOutlined,
  UnlockOutlined,
} from "@ant-design/icons";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import { formatDateVi } from "../../utils/formatDateVi";

interface Commission {
  commission_id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  owner_status?: "active" | "locked" | "pending" | string;
  commission_amount: number;
  vat_amount: number;
  total_due: number;
  paid_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | string;
  payment_amount: number;
}

interface CommissionSummary {
  total_pending: number;
  total_paid: number;
  total_overdue: number;
}

interface CommissionPaymentRequest {
  request_id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  total_due: number;
  transfer_note: string | null;
  note: string | null;
  commission_ids: number[];
  created_at: string;
  unpaid_count: number;
  is_fully_paid: boolean;
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const ownerStatusColor = (status?: string) => {
  if (status === "locked") return "red";
  if (status === "active") return "green";
  if (status === "pending") return "orange";
  return "default";
};

const commissionStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: "orange",
    paid: "green",
    overdue: "red",
  };
  return colors[status] || "default";
};

const Commissions = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(false);

  const [paymentRequests, setPaymentRequests] = useState<
    CommissionPaymentRequest[]
  >([]);
  const [paymentRequestsLoading, setPaymentRequestsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [dateRange, setDateRange] = useState<
    [string | undefined, string | undefined]
  >([undefined, undefined]);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const { current, pageSize } = pagination;

  const [summary, setSummary] = useState<CommissionSummary>({
    total_pending: 0,
    total_paid: 0,
    total_overdue: 0,
  });

  const [selectedCommission, setSelectedCommission] =
    useState<Commission | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: current,
        limit: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      const [from, to] = dateRange;
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await adminApi.getCommissions(params);
      if (response.success) {
        const list = Array.isArray(response.data)
          ? (response.data as Commission[])
          : [];
        setCommissions(list);
        setSummary(
          response.summary || {
            total_pending: 0,
            total_paid: 0,
            total_overdue: 0,
          },
        );
        setPagination((p) => ({
          ...p,
          total: response.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi khi lấy danh sách hoa hồng"),
      );
    } finally {
      setLoading(false);
    }
  }, [current, dateRange, pageSize, statusFilter]);

  useEffect(() => {
    void fetchCommissions();
  }, [fetchCommissions]);

  const fetchPaymentRequests = useCallback(async () => {
    setPaymentRequestsLoading(true);
    try {
      const res = await adminApi.getCommissionPaymentRequests({
        page: 1,
        limit: 50,
      });
      if (res?.success) {
        setPaymentRequests((res.data || []) as CommissionPaymentRequest[]);
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi khi lấy danh sách yêu cầu thanh toán"),
      );
    } finally {
      setPaymentRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  const handleExportCsv = async () => {
    try {
      const [from, to] = dateRange;
      const blob = await adminApi.exportCommissionsCsv({
        status: statusFilter || undefined,
        from,
        to,
      });
      downloadBlob(
        blob,
        `commissions_${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi export CSV"));
    }
  };

  const handleViewDetail = async (commissionId: number) => {
    try {
      const response = await adminApi.getCommissionDetails(commissionId);
      if (response.success) {
        setSelectedCommission(response.data as Commission);
        setDetailModalVisible(true);
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi khi lấy thông tin chi tiết"),
      );
    }
  };

  const handleDeleteCommission = async (commissionId: number) => {
    try {
      const response = await adminApi.deleteCommission(commissionId);
      if (response?.success) {
        message.success("Đã xóa commission");
        fetchCommissions();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi xóa commission"));
    }
  };

  const columns: ColumnsType<Commission> = [
    {
      title: "ID",
      dataIndex: "commission_id",
      key: "commission_id",
      width: 80,
    },
    {
      title: "Owner",
      dataIndex: "owner_name",
      key: "owner_name",
      render: (_: string, r) => (
        <div>
          <div className="font-medium text-gray-800">{r.owner_name}</div>
          {r.owner_status ? (
            <div className="mt-1">
              <Tag color={ownerStatusColor(r.owner_status)}>
                {statusToVi(r.owner_status)}
              </Tag>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "owner_email",
      key: "owner_email",
    },
    {
      title: "Hoa hồng",
      dataIndex: "commission_amount",
      key: "commission_amount",
      align: "right",
      render: (amount: number) => formatMoney(amount),
    },
    {
      title: "VAT",
      dataIndex: "vat_amount",
      key: "vat_amount",
      align: "right",
      render: (amount: number) => formatMoney(amount),
    },
    {
      title: "Tổng phải trả",
      dataIndex: "total_due",
      key: "total_due",
      align: "right",
      render: (amount: number) => formatMoney(amount),
    },
    {
      title: "Đã trả",
      dataIndex: "paid_amount",
      key: "paid_amount",
      align: "right",
      render: (amount: number) => formatMoney(amount),
    },
    {
      title: "Hạn thanh toán",
      dataIndex: "due_date",
      key: "due_date",
      render: (v: string) => formatDateVi(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={commissionStatusColor(status)}>{statusToVi(status)}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right",
      width: 200,
      render: (_: unknown, record) => {
        const canOperate = record.status !== "paid";
        const isOverdue = record.status === "overdue";
        const ownerLocked =
          String(record.owner_status || "").toLowerCase() === "locked";

        return (
          <Space size={6}>
            <Tooltip title="Chi tiết">
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record.commission_id)}
              />
            </Tooltip>

            {canOperate ? (
              <Popconfirm
                title="Gửi nhắc nhở thanh toán cho Owner này?"
                onConfirm={async () => {
                  try {
                    const res = await adminApi.remindCommission(
                      record.commission_id,
                    );
                    if (res.success) {
                      message.success("Đã gửi nhắc nhở thanh toán");
                    }
                  } catch (err: unknown) {
                    message.error(getApiErrorMessage(err, "Lỗi gửi nhắc nhở"));
                  }
                }}
                okText="Gửi"
                cancelText="Hủy"
              >
                <Tooltip title="Nhắc nhở">
                  <Button size="small" type="text" icon={<BellOutlined />} />
                </Tooltip>
              </Popconfirm>
            ) : null}

            {canOperate ? (
              <Popconfirm
                title="Xác nhận Owner đã thanh toán khoản này?"
                onConfirm={async () => {
                  try {
                    const res = await adminApi.markCommissionsPaid({
                      commission_ids: [record.commission_id],
                    });
                    if (res?.success) {
                      message.success("Đã xác nhận thanh toán");
                      fetchCommissions();
                      fetchPaymentRequests();
                    }
                  } catch (err: unknown) {
                    message.error(
                      getApiErrorMessage(err, "Lỗi xác nhận thanh toán"),
                    );
                  }
                }}
                okText="Xác nhận"
                cancelText="Hủy"
              >
                <Tooltip title="Xác nhận đã thanh toán">
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckCircleOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            ) : null}

            {canOperate && isOverdue ? (
              <>
                <Popconfirm
                  title="Tạm ẩn địa điểm liên quan đến khoản nợ này?"
                  onConfirm={async () => {
                    try {
                      const res = await adminApi.hideCommissionLocation(
                        record.commission_id,
                      );
                      if (res.success) {
                        message.success("Đã tạm ẩn địa điểm");
                      }
                    } catch (err: unknown) {
                      message.error(
                        getApiErrorMessage(err, "Lỗi tạm ẩn địa điểm"),
                      );
                    }
                  }}
                  okText="Ẩn"
                  cancelText="Hủy"
                >
                  <Tooltip title="Ẩn địa điểm">
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<StopOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>

                <Popconfirm
                  title={
                    ownerLocked
                      ? "Owner đang bị khóa. Mở khóa tài khoản Owner này?"
                      : "Owner đang hoạt động. Khóa tài khoản Owner này?"
                  }
                  onConfirm={async () => {
                    try {
                      if (ownerLocked) {
                        const res = await adminApi.updateOwnerStatus(
                          record.owner_id,
                          "active",
                        );
                        if (res.success) {
                          message.success("Đã mở khóa tài khoản Owner");
                          fetchCommissions();
                        }
                      } else {
                        const res = await adminApi.lockCommissionOwner(
                          record.commission_id,
                        );
                        if (res.success) {
                          message.success("Đã khóa tài khoản Owner");
                          fetchCommissions();
                        }
                      }
                    } catch (err: unknown) {
                      message.error(
                        getApiErrorMessage(
                          err,
                          "Lỗi cập nhật trạng thái tài khoản",
                        ),
                      );
                    }
                  }}
                  okText={ownerLocked ? "Mở khóa" : "Khóa"}
                  cancelText="Hủy"
                  okButtonProps={ownerLocked ? undefined : { danger: true }}
                >
                  <Tooltip title={ownerLocked ? "Đang khóa" : "Đang mở"}>
                    <Button
                      size="small"
                      type="text"
                      icon={ownerLocked ? <LockOutlined /> : <UnlockOutlined />}
                      danger={!ownerLocked}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            ) : null}

            <Popconfirm
              title="Xóa commission này?"
              onConfirm={() => handleDeleteCommission(record.commission_id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Quản lý Hoa hồng & VAT
        </h2>
        <p className="text-gray-500">Theo dõi công nợ và thanh toán hoa hồng</p>
      </div>

      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng nợ chờ thanh toán"
              value={formatMoney(summary.total_pending)}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng đã thanh toán"
              value={formatMoney(summary.total_paid)}
              styles={{ content: { color: "#3f8600" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng nợ quá hạn"
              value={formatMoney(summary.total_overdue)}
              styles={{ content: { color: "#cf1322" } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="mb-6"
        title="Yêu cầu thanh toán từ Owner"
        loading={paymentRequestsLoading}
      >
        <Table
          rowKey="request_id"
          dataSource={paymentRequests}
          pagination={false}
          columns={[
            { title: "Mã", dataIndex: "request_id", width: 90 },
            {
              title: "Owner",
              dataIndex: "owner_name",
              render: (_: unknown, r: CommissionPaymentRequest) => (
                <div>
                  <div className="font-medium text-gray-800">
                    {r.owner_name}
                  </div>
                  <div className="text-xs text-gray-500">{r.owner_email}</div>
                </div>
              ),
            },
            {
              title: "Tổng",
              dataIndex: "total_due",
              align: "right",
              width: 140,
              render: (v: number) => formatMoney(v || 0),
            },
            {
              title: "Nội dung CK",
              dataIndex: "transfer_note",
              width: 180,
              render: (v: string | null) => v || "—",
            },
            {
              title: "Trạng thái",
              dataIndex: "is_fully_paid",
              width: 150,
              render: (_: unknown, r: CommissionPaymentRequest) => (
                <Tag color={r.is_fully_paid ? "green" : "orange"}>
                  {r.is_fully_paid
                    ? "Đã xử lý"
                    : `Chưa xử lý (${r.unpaid_count})`}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              key: "action",
              width: 170,
              render: (_: unknown, r: CommissionPaymentRequest) => (
                <Space size={6}>
                  <Button
                    size="small"
                    onClick={() => {
                      Modal.info({
                        title: `Chi tiết yêu cầu #${r.request_id}`,
                        content: (
                          <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="Owner">
                              {r.owner_name} ({r.owner_email})
                            </Descriptions.Item>
                            <Descriptions.Item label="Tổng">
                              {formatMoney(r.total_due || 0)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Nội dung CK">
                              {r.transfer_note || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ghi chú">
                              {r.note || "—"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Số khoản nợ">
                              {(r.commission_ids || []).length}
                            </Descriptions.Item>
                          </Descriptions>
                        ),
                      });
                    }}
                  >
                    Xem
                  </Button>

                  <Popconfirm
                    title="Xác nhận đã nhận tiền và đánh dấu các khoản nợ là đã thanh toán?"
                    onConfirm={async () => {
                      try {
                        const res =
                          await adminApi.confirmCommissionPaymentRequest(
                            r.request_id,
                          );
                        if (res?.success) {
                          message.success("Đã xác nhận thanh toán");
                          fetchCommissions();
                          fetchPaymentRequests();
                        }
                      } catch (err: unknown) {
                        message.error(
                          getApiErrorMessage(err, "Lỗi xác nhận thanh toán"),
                        );
                      }
                    }}
                    okText="Xác nhận"
                    cancelText="Hủy"
                    disabled={r.is_fully_paid}
                  >
                    <Button
                      size="small"
                      type="primary"
                      disabled={r.is_fully_paid}
                    >
                      Xác nhận
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
            allowClear
            style={{ width: 200 }}
          >
            <Select.Option value="pending">Chờ thanh toán</Select.Option>
            <Select.Option value="paid">Đã thanh toán</Select.Option>
            <Select.Option value="overdue">Quá hạn</Select.Option>
          </Select>

          <DatePicker.RangePicker
            onChange={(dates) => {
              const from = dates?.[0]?.startOf("day").toISOString();
              const to = dates?.[1]?.endOf("day").toISOString();
              setDateRange([from, to]);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
          />

          <Button onClick={handleExportCsv}>Xuất CSV</Button>
        </div>

        <Table
          columns={columns}
          dataSource={commissions}
          loading={loading}
          rowKey="commission_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} hoa hồng`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({
                ...p,
                current: page,
                pageSize: pageSize || 20,
              }));
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title="Chi tiết Hoa hồng"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedCommission ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Owner">
              {selectedCommission.owner_name}
            </Descriptions.Item>
            <Descriptions.Item label="Hoa hồng">
              {formatMoney(selectedCommission.commission_amount)}
            </Descriptions.Item>
            <Descriptions.Item label="VAT">
              {formatMoney(selectedCommission.vat_amount)}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng phải trả">
              {formatMoney(selectedCommission.total_due)}
            </Descriptions.Item>
            <Descriptions.Item label="Đã trả">
              {formatMoney(selectedCommission.paid_amount || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Hạn thanh toán">
              {formatDateVi(selectedCommission.due_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={commissionStatusColor(selectedCommission.status)}>
                {statusToVi(selectedCommission.status)}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </MainLayout>
  );
};

export default Commissions;
