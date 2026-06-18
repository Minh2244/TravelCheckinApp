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
  message,
} from "antd";
import dayjs from "dayjs";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  FileTextOutlined,
  WarningOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import { exportCommissionExcel } from "../../utils/exportCommissionExcel";

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const commissionStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: "orange",
    paid: "green",
    overdue: "red",
  };
  return colors[status] || "default";
};

const disabledDate = (current: dayjs.Dayjs) => {
  return current && current.isAfter(dayjs().endOf('day'));
};

interface Commission {
  commission_id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  owner_status?: "active" | "locked" | "pending" | string;
  billing_period?: string;
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

interface OverdueCommission {
  commission_id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  owner_status?: string;
  billing_period?: string;
  commission_amount?: number;
  total_due: number;
  paid_amount?: number;
  due_date: string;
  status: string;
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
  billing_period?: string | null;
}

// ─── Detail Modal Component ───────────────────────────────────────────────────
const DetailModal = ({
  request,
  open,
  onClose,
}: {
  request: CommissionPaymentRequest | null;
  open: boolean;
  onClose: () => void;
}) => {
  if (!request) return null;
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>
            Chi tiết yêu cầu #{request.request_id}
          </span>
          <Tag
            color={request.is_fully_paid ? 'green' : 'orange'}
            style={{ borderRadius: 20, fontWeight: 600, fontSize: 11, marginLeft: 4 }}
          >
            {request.is_fully_paid ? 'Đã xử lý' : `Chưa xử lý (${request.unpaid_count})`}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
    >
      <Descriptions bordered column={1} size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label="Owner">
          <div style={{ fontWeight: 600 }}>{request.owner_name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{request.owner_email}</div>
        </Descriptions.Item>
        <Descriptions.Item label="Kỳ đối soát">
          {request.billing_period || <span style={{ color: '#94a3b8' }}>—</span>}
        </Descriptions.Item>
        <Descriptions.Item label="Tổng thanh toán">
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 15 }}>
            {formatMoney(request.total_due || 0)}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Nội dung CK">
          {request.transfer_note || <span style={{ color: '#94a3b8' }}>—</span>}
        </Descriptions.Item>
        <Descriptions.Item label="Ghi chú">
          {request.note || <span style={{ color: '#94a3b8' }}>—</span>}
        </Descriptions.Item>
        <Descriptions.Item label="Số khoản hoa hồng">
          {(request.commission_ids || []).length}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Commissions = () => {
  const [, setCommissions] = useState<Commission[]>([]);
  const [, setLoading] = useState(false);

  const [paymentRequests, setPaymentRequests] = useState<CommissionPaymentRequest[]>([]);
  const [paymentRequestsLoading, setPaymentRequestsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([undefined, undefined]);

  const [pagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const { current, pageSize } = pagination;

  const [summary, setSummary] = useState<CommissionSummary>({
    total_pending: 0,
    total_paid: 0,
    total_overdue: 0,
  });

  // Detail modal state
  const [detailRequest, setDetailRequest] = useState<CommissionPaymentRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Unused but kept for confirm handler
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [ownerHistory, setOwnerHistory] = useState<Commission[]>([]);
  const [ownerHistoryLoading, setOwnerHistoryLoading] = useState(false);

  useEffect(() => {
    if (selectedCommission?.owner_id) {
      setOwnerHistoryLoading(true);
      adminApi.getCommissions({ owner_id: selectedCommission.owner_id })
        .then((res) => {
          if (res.success) {
            setOwnerHistory((res.data || []) as Commission[]);
          }
        })
        .catch(() => {})
        .finally(() => {
          setOwnerHistoryLoading(false);
        });
    } else {
      setOwnerHistory([]);
    }
  }, [selectedCommission]);

  // All owner commissions (all statuses)
  const [ownerCommissions, setOwnerCommissions] = useState<OverdueCommission[]>([]);
  const [ownerCommissionsLoading, setOwnerCommissionsLoading] = useState(false);

  const fetchOwnerCommissions = useCallback(async () => {
    setOwnerCommissionsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: 1,
        limit: 100,
      };
      if (statusFilter) params.status = statusFilter;
      const [from, to] = dateRange;
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await adminApi.getCommissions(params);
      if (res.success) {
        setOwnerCommissions((Array.isArray(res.data) ? res.data : []) as OverdueCommission[]);
      }
    } catch {
      // silent
    } finally {
      setOwnerCommissionsLoading(false);
    }
  }, [statusFilter, dateRange]);

  useEffect(() => {
    void fetchOwnerCommissions();
  }, [fetchOwnerCommissions]);

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
        const list = Array.isArray(response.data) ? (response.data as Commission[]) : [];
        setCommissions(list);
        setSummary(
          response.summary || { total_pending: 0, total_paid: 0, total_overdue: 0 },
        );
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi lấy danh sách hoa hồng"));
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
      const res = await adminApi.getCommissionPaymentRequests({ page: 1, limit: 50 });
      if (res?.success) {
        setPaymentRequests((res.data || []) as CommissionPaymentRequest[]);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi lấy danh sách yêu cầu xác nhận nộp hoa hồng"));
    } finally {
      setPaymentRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  const handleViewDetail = async (commissionId: number) => {
    try {
      const response = await adminApi.getCommissionDetails(commissionId);
      if (response.success) {
        setSelectedCommission(response.data as Commission);
        setDetailModalVisible(true);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi lấy thông tin chi tiết"));
    }
  };

  // Suppress unused warning
  void handleViewDetail;
  const pendingCount = paymentRequests.filter((r) => !r.is_fully_paid).length;
  const processedCount = paymentRequests.filter((r) => r.is_fully_paid).length;
  const overdueCount = ownerCommissions.filter(c => c.status === 'overdue').length;

  const openOwnerCommissionDetail = (r: OverdueCommission) => {
    // Re-use selectedCommission modal with cast data
    setSelectedCommission(r as unknown as Commission);
    setDetailModalVisible(true);
  };

  return (
    <MainLayout>
      <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Hoa hồng</h2>
          <p className="text-gray-500" style={{ margin: 0 }}>Tra cứu lịch sử thanh toán, và yêu cầu xác nhận nộp hoa hồng</p>
        </div>
        <Space size={12} wrap>
          {/* Bộ lọc thời gian */}
          <Space size={0} style={{ background: '#fff', padding: '2px 8px', borderRadius: 8, border: '1px solid #d9d9d9', display: 'inline-flex', alignItems: 'center' }}>
            <Button
              type={(!dateRange[0] && !dateRange[1]) ? "link" : "text"}
              onClick={() => setDateRange([undefined, undefined])}
              style={{
                fontWeight: (!dateRange[0] && !dateRange[1]) ? 700 : 500,
                color: (!dateRange[0] && !dateRange[1]) ? '#6366f1' : '#64748b',
                padding: '0 8px',
                height: 'auto',
              }}
            >
              Tất cả
            </Button>
            <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 8px' }} />
            <DatePicker.RangePicker
              value={
                dateRange[0] && dateRange[1]
                  ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                  : null
              }
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([
                    dates[0].format("YYYY-MM-DD"),
                    dates[1].format("YYYY-MM-DD"),
                  ]);
                } else {
                  setDateRange([undefined, undefined]);
                }
              }}
              disabledDate={disabledDate}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              bordered={false}
              style={{ padding: '4px 0' }}
            />
          </Space>

          {/* Bộ lọc trạng thái xử lý */}
          <Select
            value={statusFilter || "all"}
            onChange={(value) => {
              setStatusFilter(value === "all" ? undefined : value);
            }}
            style={{ width: 180 }}
            size="middle"
            dropdownStyle={{ borderRadius: 8 }}
          >
            <Select.Option value="all">Tất cả trạng thái</Select.Option>
            <Select.Option value="pending">Chờ thanh toán</Select.Option>
            <Select.Option value="overdue">Quá hạn</Select.Option>
            <Select.Option value="paid">Đã thanh toán</Select.Option>
          </Select>
        </Space>
      </div>

      {/* ── Stat Cards ── */}
      <Row gutter={[16, 16]} className="mb-6">
        {/* Nợ chờ thanh toán */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
              boxShadow: '0 4px 20px rgba(251,191,36,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Nợ chờ thanh toán
                </div>
                <Statistic
                  value={formatMoney(summary.total_pending)}
                  styles={{ content: { fontSize: 22, fontWeight: 800, color: '#d97706' } }}
                />
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
              }}>
                <ClockCircleFilled style={{ fontSize: 20, color: '#fff' }} />
              </div>
            </div>
          </Card>
        </Col>

        {/* Đã thanh toán */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)',
              boxShadow: '0 4px 20px rgba(34,197,94,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#14532d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Đã thanh toán
                </div>
                <Statistic
                  value={formatMoney(summary.total_paid)}
                  styles={{ content: { fontSize: 22, fontWeight: 800, color: '#16a34a' } }}
                />
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
              }}>
                <CheckCircleFilled style={{ fontSize: 20, color: '#fff' }} />
              </div>
            </div>
          </Card>
        </Col>

        {/* Nợ quá hạn */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)',
              boxShadow: '0 4px 20px rgba(239,68,68,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#7f1d1d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Nợ quá hạn
                </div>
                <Statistic
                  value={formatMoney(summary.total_overdue)}
                  styles={{ content: { fontSize: 22, fontWeight: 800, color: '#dc2626' } }}
                />
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
              }}>
                <ExclamationCircleFilled style={{ fontSize: 20, color: '#fff' }} />
              </div>
            </div>
          </Card>
        </Col>

        {/* Yêu cầu chờ xử lý */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)',
              boxShadow: '0 4px 20px rgba(139,92,246,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#4c1d95', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Yêu cầu chờ xử lý
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>
                  {pendingCount}
                  <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500, marginLeft: 6 }}>
                    / {processedCount} đã xử lý
                  </span>
                </div>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
              }}>
                <FileTextOutlined style={{ fontSize: 20, color: '#fff' }} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Payment Requests Table ── */}
      <Card
        className="mb-6"
        title={
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
            Yêu cầu xác nhận nộp hoa hồng từ Owner
          </span>
        }
        loading={paymentRequestsLoading}
        style={{
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(99,102,241,0.07)',
          border: '1px solid #e8e8f0',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <Table
            rowKey="request_id"
            dataSource={paymentRequests}
            pagination={false}
            size="middle"
            scroll={{ x: 860 }}
            rowClassName={(_, index) => index % 2 === 0 ? '' : 'ant-table-row-alt'}
            columns={[
              {
                title: <span style={{ color: '#6366f1', fontWeight: 700 }}>STT</span>,
                key: "stt",
                width: 60,
                align: 'center' as const,
                render: (_: unknown, __: CommissionPaymentRequest, index: number) => (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                  }}>{index + 1}</span>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Mã</span>,
                dataIndex: "request_id",
                width: 80,
                render: (v: number) => (
                  <span style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 600, fontSize: 13 }}>
                    #{v}
                  </span>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Owner</span>,
                dataIndex: "owner_name",
                width: 180,
                render: (_: unknown, r: CommissionPaymentRequest) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{r.owner_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{r.owner_email}</div>
                  </div>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Kỳ đối soát</span>,
                dataIndex: "billing_period",
                width: 180,
                render: (v: string | null | undefined) => v
                  ? <span style={{ fontSize: 13, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '3px 9px', display: 'inline-block', border: '1px solid #e2e8f0' }}>{v}</span>
                  : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>,
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Tổng</span>,
                dataIndex: "total_due",
                width: 130,
                render: (v: number) => (
                  <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>{formatMoney(v || 0)}</span>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Nội dung CK</span>,
                dataIndex: "transfer_note",
                width: 200,
                render: (v: string | null) => v
                  ? <span style={{ fontSize: 12, color: '#334155', background: '#fffbeb', borderRadius: 5, padding: '2px 7px', border: '1px solid #fde68a' }}>{v}</span>
                  : <span style={{ color: '#cbd5e1' }}>—</span>,
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Trạng thái</span>,
                dataIndex: "is_fully_paid",
                width: 150,
                align: 'center' as const,
                render: (_: unknown, r: CommissionPaymentRequest) => (
                  <Tag
                    color={r.is_fully_paid ? "green" : "orange"}
                    style={{ borderRadius: 20, fontWeight: 600, padding: '2px 12px', fontSize: 12 }}
                  >
                    {r.is_fully_paid ? "Đã xử lý" : `Chưa xử lý (${r.unpaid_count})`}
                  </Tag>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Thao tác</span>,
                key: "action",
                width: 160,
                fixed: 'right' as const,
                render: (_: unknown, r: CommissionPaymentRequest) => (
                  <Space size={6}>
                    <Button
                      size="small"
                      style={{ borderRadius: 8 }}
                      onClick={() => {
                        setDetailRequest(r);
                        setDetailOpen(true);
                      }}
                    >
                      Xem
                    </Button>

                    <Popconfirm
                      title="Xác nhận đã nhận tiền và đánh dấu các khoản nợ là đã thanh toán?"
                      onConfirm={async () => {
                        try {
                          const res = await adminApi.confirmCommissionPaymentRequest(r.request_id);
                          if (res?.success) {
                            message.success("Đã xác nhận thanh toán");
                            fetchCommissions();
                            fetchPaymentRequests();
                          }
                        } catch (err: unknown) {
                          message.error(getApiErrorMessage(err, "Lỗi xác nhận thanh toán"));
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
                        style={{ borderRadius: 8 }}
                      >
                        Xác nhận
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* ── Detail Modal (custom) ── */}
      <DetailModal
        request={detailRequest}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* ── All Owner Commissions Table ── */}
      <Card
        className="mb-6"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Hoa hồng theo Owner</span>
            {overdueCount > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: 20,
                padding: '1px 9px', fontSize: 11, fontWeight: 700,
              }}>{overdueCount} quá hạn</span>
            )}
            <div style={{ flex: 1 }} />
            <Button
              icon={<FileExcelOutlined />}
              onClick={async () => {
                try {
                  await exportCommissionExcel(ownerCommissions, "Admin");
                } catch (err: any) {
                  message.error(err.message || "Lỗi khi xuất Excel");
                }
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200/80 hover:border-emerald-400 hover:from-emerald-100 hover:to-teal-100 font-semibold rounded-lg px-4 transition-all duration-300 shadow-sm hover:shadow"
            >
              Xuất file
            </Button>
          </div>
        }
        loading={ownerCommissionsLoading}
        style={{
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(99,102,241,0.07)',
          border: '1px solid #e8e8f0',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <Table
            rowKey="commission_id"
            dataSource={ownerCommissions}
            pagination={false}
            size="middle"
            scroll={{ x: 860 }}
            columns={[
              {
                title: <span style={{ color: '#6366f1', fontWeight: 700 }}>STT</span>,
                key: 'stt',
                width: 60,
                align: 'center' as const,
                render: (_: unknown, __: OverdueCommission, idx: number) => (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                    color: '#fff', fontWeight: 700, fontSize: 12,
                  }}>{idx + 1}</span>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Owner</span>,
                dataIndex: 'owner_name',
                width: 200,
                render: (_: unknown, r: OverdueCommission) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{r.owner_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{r.owner_email}</div>
                  </div>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Kỳ đối soát</span>,
                dataIndex: 'billing_period',
                width: 170,
                render: (v: string | undefined) => v
                  ? <span style={{ fontSize: 13, color: '#475569', background: '#f1f5f9', borderRadius: 6, padding: '3px 9px', border: '1px solid #e2e8f0' }}>{v}</span>
                  : <span style={{ color: '#cbd5e1' }}>—</span>,
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Số tiền</span>,
                dataIndex: 'total_due',
                width: 130,
                render: (v: number, r: OverdueCommission) => (
                  <span style={{
                    fontWeight: 700,
                    color: r.status === 'paid' ? '#16a34a' : r.status === 'overdue' ? '#dc2626' : '#d97706',
                    fontSize: 14,
                  }}>{formatMoney(v || 0)}</span>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Trạng thái</span>,
                dataIndex: 'status',
                width: 140,
                align: 'center' as const,
                render: (v: string) => (
                  <Tag
                    color={v === 'paid' ? 'green' : v === 'overdue' ? 'red' : 'orange'}
                    style={{ borderRadius: 20, fontWeight: 600, padding: '2px 12px', fontSize: 12 }}
                  >
                    {v === 'paid' ? 'Đã thanh toán' : v === 'overdue' ? 'Quá hạn' : 'Chờ thanh toán'}
                  </Tag>
                ),
              },
              {
                title: <span style={{ fontWeight: 700, color: '#374151' }}>Thao tác</span>,
                key: 'action',
                width: 280,
                fixed: 'right' as const,
                render: (_: unknown, r: OverdueCommission) => (
                  <Space size={6} wrap>
                    {/* Xem chi tiết */}
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      style={{ borderRadius: 8 }}
                      onClick={() => openOwnerCommissionDetail(r)}
                    >
                      Xem
                    </Button>

                    {/* Thông báo quá hạn */}
                    <Popconfirm
                      title={`Gửi thông báo quá hạn đến ${r.owner_name}?`}
                      description="Owner sẽ nhận thông báo nhắc hoa hồng quá hạn."
                      onConfirm={async () => {
                        try {
                          const res = await adminApi.createPushNotification({
                            title: '⚠️ Hoa hồng quá hạn!',
                            body: `Kỳ đối soát ${r.billing_period || ''} của bạn đã quá hạn. Vui lòng thanh toán ngay để tránh bị khóa tài khoản.`,
                            target_audience: 'specific_user',
                            target_user_id: r.owner_id,
                          });
                          if (res?.success) message.success('Đã gửi thông báo quá hạn');
                        } catch (err) {
                          message.error(getApiErrorMessage(err, 'Lỗi gửi thông báo'));
                        }
                      }}
                      okText="Gửi"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        size="small"
                        icon={<WarningOutlined />}
                        style={{
                          borderRadius: 8,
                          borderColor: '#ef4444',
                          color: '#dc2626',
                        }}
                      >
                        Quá hạn
                      </Button>
                    </Popconfirm>

                    {/* Thông báo sắp hết hạn */}
                    <Popconfirm
                      title={`Gửi nhắc nhở hết hạn đến ${r.owner_name}?`}
                      description="Owner sẽ nhận thông báo nhắc kỳ đối soát sắp đến hạn."
                      onConfirm={async () => {
                        try {
                          const res = await adminApi.createPushNotification({
                            title: '⏰ Nhắc nhở thanh toán hoa hồng',
                            body: `Kỳ đối soát ${r.billing_period || ''} sắp đến hạn. Vui lòng chuẩn bị thanh toán đúng hạn.`,
                            target_audience: 'specific_user',
                            target_user_id: r.owner_id,
                          });
                          if (res?.success) message.success('Đã gửi nhắc nhở');
                        } catch (err) {
                          message.error(getApiErrorMessage(err, 'Lỗi gửi thông báo'));
                        }
                      }}
                      okText="Gửi"
                      cancelText="Hủy"
                    >
                      <Button
                        size="small"
                        icon={<ClockCircleOutlined />}
                        style={{
                          borderRadius: 8,
                          borderColor: '#f59e0b',
                          color: '#d97706',
                        }}
                      >
                        Hết hạn
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* ── Commission Detail Modal (Owner table Xem) ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EyeOutlined style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Chi tiết hoa hồng & Lịch sử</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={850}
        centered
      >
        {selectedCommission ? (
          <Row gutter={24} style={{ marginTop: 16 }}>
            <Col xs={24} md={10}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 12 }}>Kỳ đối soát đang chọn</div>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Owner">
                  <div style={{ fontWeight: 600 }}>{selectedCommission.owner_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{selectedCommission.owner_email}</div>
                </Descriptions.Item>
                <Descriptions.Item label="Kỳ đối soát">
                  {selectedCommission.billing_period || <span style={{ color: '#94a3b8' }}>—</span>}
                </Descriptions.Item>
                {selectedCommission.commission_amount != null && (
                  <Descriptions.Item label="Hoa hồng">{formatMoney(selectedCommission.commission_amount)}</Descriptions.Item>
                )}
                <Descriptions.Item label="Tổng phải trả">
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatMoney(selectedCommission.total_due)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Đã trả">{formatMoney(selectedCommission.paid_amount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={commissionStatusColor(selectedCommission.status)}>
                    {statusToVi(selectedCommission.status)}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={14}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 12 }}>Tất cả các kỳ hoa hồng (Lịch sử)</div>
              <Table
                dataSource={ownerHistory}
                rowKey="commission_id"
                loading={ownerHistoryLoading}
                size="small"
                pagination={{ pageSize: 5 }}
                columns={[
                  {
                    title: "Kỳ đối soát",
                    dataIndex: "billing_period",
                    key: "billing_period",
                    render: (v: string) => v || "—",
                  },
                  {
                    title: "Số tiền",
                    dataIndex: "total_due",
                    key: "total_due",
                    render: (v: number) => <span style={{ fontWeight: 600 }}>{formatMoney(v || 0)}</span>,
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    key: "status",
                    render: (v: string) => (
                      <Tag color={commissionStatusColor(v)}>
                        {statusToVi(v)}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        ) : null}
      </Modal>
    </MainLayout>
  );
};

export default Commissions;
