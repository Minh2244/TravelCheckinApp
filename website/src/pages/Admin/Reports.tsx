// website/src/pages/Admin/Reports.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Table,
  Card,
  Input,
  Button,
  Tag,
  Modal,
  message,
  Select,
  Descriptions,
  Popconfirm,
  Tooltip,
  Space,
  DatePicker,
} from "antd";
import {
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { statusToVi } from "../../utils/statusText";

const { TextArea } = Input;

interface Report {
  report_id: number;
  reporter_name: string;
  reported_user_name: string | null;
  reported_location_name: string | null;
  report_type: string;
  severity?: "low" | "medium" | "high" | "critical";
  description: string;
  status: string;
  created_at: string;
  resolution_notes?: string | null;
}

interface ReportDetail extends Report {
  resolved_by?: number | null;
  resolved_at?: string | null;
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

const Reports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [severityFilter, setSeverityFilter] = useState<
    Report["severity"] | undefined
  >(undefined);
  const [dateRange, setDateRange] = useState<
    [string | undefined, string | undefined]
  >([undefined, undefined]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(
    null,
  );
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [enforcement, setEnforcement] = useState<"none" | "ban">("none");

  const exportParams = useMemo(() => {
    const [from, to] = dateRange;
    return {
      status: statusFilter,
      report_type: typeFilter,
      severity: severityFilter,
      from,
      to,
    };
  }, [dateRange, severityFilter, statusFilter, typeFilter]);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.current,
    pagination.pageSize,
    statusFilter,
    typeFilter,
    severityFilter,
    dateRange,
  ]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.report_type = typeFilter;
      if (severityFilter) params.severity = severityFilter;
      const [from, to] = dateRange;
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await adminApi.getReports(params);
      if (response.success) {
        setReports(response.data || []);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0,
        });
      }
    } catch (err: unknown) {
      console.error("Lỗi lấy danh sách reports:", err);
      message.error("Lỗi khi lấy danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (reportId: number) => {
    try {
      const response = await adminApi.getReportById(reportId);
      if (response.success) {
        setSelectedReport(response.data as ReportDetail);
        setResolveModalVisible(true);
      }
    } catch {
      message.error("Lỗi khi lấy thông tin chi tiết");
    }
  };

  const handleResolve = async (status: "resolved" | "rejected") => {
    if (!selectedReport) return;

    try {
      const response = await adminApi.resolveReport(selectedReport.report_id, {
        status,
        resolution_notes: resolutionNotes,
        enforcement,
      });
      if (response.success) {
        message.success("Xử lý báo cáo thành công");
        setResolveModalVisible(false);
        setResolutionNotes("");
        setEnforcement("none");
        fetchReports();
      }
    } catch {
      message.error("Lỗi xử lý báo cáo");
    }
  };

  const handleToggleLock = async (record: Report) => {
    const currentStatus = String(record.status || "");
    const nextStatus = currentStatus === "reviewing" ? "pending" : "reviewing";
    try {
      const response = await adminApi.updateReportLockStatus(
        record.report_id,
        nextStatus as "pending" | "reviewing",
      );
      if (response?.success) {
        message.success("Đã cập nhật trạng thái báo cáo");
        fetchReports();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khóa/mở báo cáo"));
    }
  };

  const handleRemind = async (record: Report) => {
    try {
      const response = await adminApi.remindReport(record.report_id);
      if (response?.success) {
        message.success("Đã gửi nhắc nhở");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi gửi nhắc nhở"));
    }
  };

  const handleDeleteReport = async (record: Report) => {
    try {
      const response = await adminApi.deleteReport(record.report_id);
      if (response?.success) {
        message.success("Đã xóa báo cáo");
        fetchReports();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi xóa báo cáo"));
    }
  };

  const handleWarnUser = async () => {
    if (!selectedReport) return;
    try {
      const response = await adminApi.warnReportedUser(
        selectedReport.report_id,
      );
      if (response?.success) {
        message.success("Đã gửi cảnh báo user");
      }
    } catch {
      message.error("Lỗi gửi cảnh báo user");
    }
  };

  const handleWarnOwner = async () => {
    if (!selectedReport) return;
    try {
      const response = await adminApi.warnReportedOwner(
        selectedReport.report_id,
      );
      if (response?.success) {
        message.success("Đã gửi cảnh báo owner");
      }
    } catch {
      message.error("Lỗi gửi cảnh báo owner");
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedReport) return;
    try {
      const response = await adminApi.deleteReportedReview(
        selectedReport.report_id,
      );
      if (response?.success) {
        message.success("Đã xóa đánh giá vi phạm");
      }
    } catch {
      message.error("Lỗi xóa đánh giá vi phạm");
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await adminApi.exportReportsCsv(exportParams);
      downloadBlob(
        blob,
        `reports_${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch {
      message.error("Lỗi export CSV");
    }
  };

  const columns: ColumnsType<Report> = [
    {
      title: "ID",
      dataIndex: "report_id",
      key: "report_id",
      width: 80,
    },
    {
      title: "Người báo cáo",
      dataIndex: "reporter_name",
      key: "reporter_name",
    },
    {
      title: "Loại",
      dataIndex: "report_type",
      key: "report_type",
      render: (type: string) => {
        const colors: { [key: string]: string } = {
          spam: "orange",
          inappropriate: "red",
          fraud: "purple",
          other: "default",
        };
        return <Tag color={colors[type]}>{type}</Tag>;
      },
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const colors: { [key: string]: string } = {
          pending: "orange",
          reviewing: "blue",
          resolved: "green",
          rejected: "red",
        };
        return <Tag color={colors[status]}>{statusToVi(status)}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right",
      width: 240,
      render: (_, record) => {
        const isResolved =
          record.status === "resolved" || record.status === "rejected";
        const isLocked = record.status === "reviewing";

        return (
          <Space size={6}>
            <Tooltip title="Xem chi tiết">
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record.report_id)}
              />
            </Tooltip>

            <Popconfirm
              title={isLocked ? "Mở khóa báo cáo này?" : "Khóa báo cáo này?"}
              onConfirm={() => handleToggleLock(record)}
              okText="Xác nhận"
              cancelText="Hủy"
              disabled={isResolved}
            >
              <Tooltip
                title={
                  isResolved
                    ? "Báo cáo đã xử lý"
                    : isLocked
                      ? "Mở khóa"
                      : "Khóa"
                }
              >
                <Button
                  size="small"
                  type="text"
                  disabled={isResolved}
                  icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
                />
              </Tooltip>
            </Popconfirm>

            <Popconfirm
              title="Gửi nhắc nhở đến user/owner liên quan?"
              onConfirm={() => handleRemind(record)}
              okText="Gửi"
              cancelText="Hủy"
            >
              <Tooltip title="Nhắc nhở">
                <Button size="small" type="text" icon={<BellOutlined />} />
              </Tooltip>
            </Popconfirm>

            <Popconfirm
              title="Xóa báo cáo này?"
              onConfirm={() => handleDeleteReport(record)}
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
        <h2 className="text-2xl font-bold text-gray-800">Quản lý Báo cáo</h2>
        <p className="text-gray-500">Xử lý các báo cáo vi phạm từ người dùng</p>
      </div>

      <Card>
        <div className="mb-4 flex gap-4">
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 200 }}
          >
            <Select.Option value="pending">
              {statusToVi("pending")}
            </Select.Option>
            <Select.Option value="reviewing">
              {statusToVi("reviewing")}
            </Select.Option>
            <Select.Option value="resolved">
              {statusToVi("resolved")}
            </Select.Option>
            <Select.Option value="rejected">
              {statusToVi("rejected")}
            </Select.Option>
          </Select>
          <Select
            placeholder="Lọc theo loại"
            value={typeFilter}
            onChange={setTypeFilter}
            allowClear
            style={{ width: 200 }}
          >
            <Select.Option value="spam">Spam (rác)</Select.Option>
            <Select.Option value="inappropriate">
              Nội dung không phù hợp
            </Select.Option>
            <Select.Option value="fraud">Gian lận</Select.Option>
            <Select.Option value="other">Khác</Select.Option>
          </Select>

          <Select
            placeholder="Lọc severity"
            value={severityFilter}
            onChange={(v) => {
              setSeverityFilter(v);
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
            style={{ width: 170 }}
          >
            <Select.Option value="low">Thấp</Select.Option>
            <Select.Option value="medium">Trung bình</Select.Option>
            <Select.Option value="high">Cao</Select.Option>
            <Select.Option value="critical">Khẩn cấp</Select.Option>
          </Select>

          <DatePicker.RangePicker
            onChange={(dates) => {
              const from = dates?.[0]?.startOf("day").toISOString();
              const to = dates?.[1]?.endOf("day").toISOString();
              setDateRange([from, to]);
              setPagination({ ...pagination, current: 1 });
            }}
          />

          <Button onClick={handleExportCsv}>Export CSV</Button>
        </div>

        <Table
          columns={columns}
          dataSource={reports}
          loading={loading}
          rowKey="report_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} báo cáo`,
            onChange: (page, pageSize) => {
              setPagination({
                ...pagination,
                current: page,
                pageSize: pageSize || 20,
              });
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="Chi tiết Báo cáo & Xử lý"
        open={resolveModalVisible}
        onCancel={() => {
          setResolveModalVisible(false);
          setResolutionNotes("");
          setEnforcement("none");
        }}
        footer={null}
        width={800}
      >
        {selectedReport && (
          <div className="space-y-4">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Người báo cáo">
                {selectedReport.reporter_name}
              </Descriptions.Item>
              <Descriptions.Item label="Loại báo cáo">
                <Tag>{selectedReport.report_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Tag>
                  {String(selectedReport.severity || "medium").toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả">
                {selectedReport.description}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    selectedReport.status === "pending" ? "orange" : "green"
                  }
                >
                  {selectedReport.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleWarnUser}>Cảnh báo User</Button>
              <Button onClick={handleWarnOwner}>Cảnh báo Owner</Button>
              <Popconfirm
                title="Xóa review vi phạm?"
                onConfirm={handleDeleteReview}
              >
                <Button danger>Xóa review</Button>
              </Popconfirm>
            </div>

            {selectedReport.status === "pending" && (
              <div className="mt-4">
                <div className="mb-2">
                  <strong>Ghi chú xử lý:</strong>
                </div>
                <TextArea
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Nhập ghi chú xử lý..."
                />
                <div className="mt-3">
                  <div className="mb-2">
                    <strong>Biện pháp:</strong>
                  </div>
                  <Select
                    value={enforcement}
                    onChange={(value) => setEnforcement(value)}
                    style={{ width: 280 }}
                    options={[
                      { value: "none", label: "Chỉ xử lý báo cáo" },
                      {
                        value: "ban",
                        label: "Cấm tài khoản + chặn email/số điện thoại",
                      },
                    ]}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setResolveModalVisible(false);
                      setResolutionNotes("");
                    }}
                  >
                    Hủy
                  </Button>
                  <Button danger onClick={() => handleResolve("rejected")}>
                    Từ chối
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleResolve("resolved")}
                  >
                    Xử lý xong
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};

export default Reports;
