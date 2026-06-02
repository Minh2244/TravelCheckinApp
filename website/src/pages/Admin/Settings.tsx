// website/src/pages/Admin/Settings.tsx

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Image,
  Input,
  Modal,
  Popover,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { asRecord } from "../../utils/safe";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatDateVi } from "../../utils/formatDateVi";

interface Log {
  log_id: number;
  user_id?: number | null;
  action: string;
  details: string;
  created_at: string;
}

interface BackgroundScheduleRow {
  schedule_id: number;
  title: string;
  image_url: string;
  start_date: string;
  end_date: string;
  is_active: number;
}

type SystemSettings = Record<string, string | null | undefined>;

const normalizeBankKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/vietcombank/g, "vcb")
    .replace(/vietinbank/g, "ctg")
    .replace(/bidv/g, "bidv")
    .replace(/agribank/g, "vba");

const BANK_BIN_MAP: Record<string, string> = {
  vcb: "970436",
  ctg: "970415",
  bidv: "970418",
  vba: "970405",
  acb: "970416",
  tcb: "970407",
  mb: "970422",
  vpbank: "970432",
  tpbank: "970423",
  sacombank: "970403",
  vpb: "970432",
  shb: "970443",
  hdbank: "970437",
  ocb: "970448",
  msb: "970426",
  eximbank: "970431",
  seabank: "970440",
};

const buildVietQrUrl = (opts: {
  bankName?: string | null;
  bankBin?: string | null;
  bankAccount?: string | null;
  addInfo?: string;
}): { url: string | null; error: string | null } => {
  const bankName = String(opts.bankName || "").trim();
  const bankAccount = String(opts.bankAccount || "").trim();
  const cleanedBin = String(opts.bankBin || "").trim();

  if (!bankName || !bankAccount) return { url: null, error: null };

  const inferredBin = BANK_BIN_MAP[normalizeBankKey(bankName)] || "";
  const resolvedBin = cleanedBin || inferredBin;
  if (!resolvedBin) {
    return {
      url: null,
      error:
        "Không xác định được mã BIN. Vui lòng nhập 'Mã BIN' (vd Vietcombank: 970436).",
    };
  }

  const note = String(opts.addInfo || "Thanh toan").trim() || "Thanh toan";
  const url = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
    bankAccount,
  )}-qr_only.png?addInfo=${encodeURIComponent(note)}`;
  return { url, error: null };
};

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

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logAction, setLogAction] = useState<string>("");
  const [logUserId, setLogUserId] = useState<string>("");
  const [logDateRange, setLogDateRange] = useState<
    [string | undefined, string | undefined]
  >([undefined, undefined]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  });

  const [bgRows, setBgRows] = useState<BackgroundScheduleRow[]>([]);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgPagination, setBgPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [bgForm] = Form.useForm();
  const watchedScheduleImageUrl = Form.useWatch("image_url", bgForm);

  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [backgroundTab, setBackgroundTab] = useState<"url" | "upload">("url");
  const [backgroundTarget, setBackgroundTarget] = useState<"app" | "login">(
    "app",
  );
  const [backgroundUrlInput, setBackgroundUrlInput] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    null,
  );
  const [backgroundSaving, setBackgroundSaving] = useState(false);

  const adminBankQr = useMemo(
    () =>
      buildVietQrUrl({
        bankName: settings.admin_bank_name,
        bankAccount: settings.admin_bank_account,
        bankBin: settings.admin_bank_bin,
        addInfo: "Thanh toan hoa hong",
      }),
    [
      settings.admin_bank_account,
      settings.admin_bank_bin,
      settings.admin_bank_name,
    ],
  );

  useEffect(() => {
    fetchSettings();
    fetchLogs();
    fetchBackgroundSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.current,
    pagination.pageSize,
    logAction,
    logUserId,
    logDateRange,
    bgPagination.current,
    bgPagination.pageSize,
  ]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSystemSettings();
      if (response.success) {
        setSettings(response.data || {});
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const [from, to] = logDateRange;
      const params: Record<string, string | number> = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (logAction) params.action = logAction;
      if (logUserId) params.user_id = Number(logUserId);
      if (from) params.from = from;
      if (to) params.to = to;
      const response = await adminApi.getSystemLogs(params);
      if (response.success) {
        setLogs(response.data || []);
        setPagination((p) => ({
          ...p,
          total: response.pagination?.total || 0,
        }));
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchBackgroundSchedules = async () => {
    try {
      setBgLoading(true);
      const response = await adminApi.getBackgroundSchedules({
        page: bgPagination.current,
        limit: bgPagination.pageSize,
      });
      if (response?.success) {
        setBgRows(response.data || []);
        setBgPagination((p) => ({
          ...p,
          total: response.pagination?.total || 0,
        }));
      }
    } finally {
      setBgLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await adminApi.updateSystemSettings(settings);
      if (response.success) {
        message.success("Cập nhật cài đặt thành công");
        window.dispatchEvent(new CustomEvent("tc-settings-updated"));
      }
    } catch {
      message.error("Lỗi cập nhật cài đặt");
    }
  };

  const handleExportLogsCsv = async () => {
    try {
      const [from, to] = logDateRange;
      const blob = await adminApi.exportSystemLogsCsv({
        user_id: logUserId ? Number(logUserId) : undefined,
        action: logAction || undefined,
        from,
        to,
      });
      downloadBlob(blob, `system-logs-${Date.now()}.csv`);
    } catch {
      message.error("Xuất CSV thất bại");
    }
  };

  const handleCreateBackground = async () => {
    try {
      const values = await bgForm.validateFields();
      const [start, end] = values.date_range || [];
      const response = await adminApi.createBackgroundSchedule({
        title: values.title,
        image_url: values.image_url,
        start_date: start?.toISOString(),
        end_date: end?.toISOString(),
        is_active: Boolean(values.is_active),
      });
      if (response?.success) {
        message.success("Đã tạo lịch nền");
        bgForm.resetFields();
        fetchBackgroundSchedules();
      }
    } catch {
      message.error("Tạo lịch nền thất bại");
    }
  };

  const handleToggleBackground = async (scheduleId: number) => {
    try {
      const response = await adminApi.toggleBackgroundSchedule(scheduleId);
      if (response?.success) {
        message.success("Đã đổi trạng thái lịch nền");
        fetchBackgroundSchedules();
      }
    } catch {
      message.error("Không thể đổi trạng thái lịch nền");
    }
  };

  const getBackgroundKey = (target: "app" | "login") =>
    target === "app" ? "app_background_url" : "login_background_url";

  const clearBackgroundPreview = () => {
    setBackgroundPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const openBackgroundModal = async (target: "app" | "login") => {
    const key = getBackgroundKey(target);
    const current = settings[key] || "";
    setBackgroundTarget(target);
    setBackgroundTab("url");
    setBackgroundUrlInput("");
    setBackgroundFile(null);
    clearBackgroundPreview();
    setBackgroundPreview(current ? resolveBackendUrl(current) : null);
    setBackgroundModalOpen(true);
  };

  const handlePreviewUrl = (value: string) => {
    setBackgroundUrlInput(value);
    setBackgroundFile(null);
    const trimmed = value.trim();
    if (!trimmed) {
      clearBackgroundPreview();
      return;
    }
    clearBackgroundPreview();
    setBackgroundPreview(resolveBackendUrl(trimmed) || trimmed);
  };

  const handleApplyBackground = async () => {
    try {
      setBackgroundSaving(true);
      if (backgroundTab === "url") {
        const url = backgroundUrlInput.trim();
        if (!/^https?:\/\//i.test(url)) {
          message.error("URL phải bắt đầu bằng http/https");
          return;
        }
        const resp = await adminApi.setBackgroundUrl(backgroundTarget, url);
        if (resp?.success) {
          message.success("Đã đổi ảnh nền");
        } else {
          message.error(resp?.message || "Lưu ảnh nền thất bại");
          return;
        }
      } else {
        if (!backgroundFile) {
          message.error("Vui lòng chọn ảnh trước khi Save");
          return;
        }
        const resp = await adminApi.uploadBackgroundImage(
          backgroundTarget,
          backgroundFile,
        );
        if (resp?.success) {
          message.success("Đã upload ảnh nền");
        } else {
          message.error(resp?.message || "Upload ảnh nền thất bại");
          return;
        }
      }

      setBackgroundUrlInput("");
      setBackgroundFile(null);
      clearBackgroundPreview();
      setBackgroundModalOpen(false);
      await fetchSettings();
      window.dispatchEvent(new CustomEvent("tc-settings-updated"));
    } catch {
      message.error("Lưu ảnh nền thất bại");
    } finally {
      setBackgroundSaving(false);
    }
  };

  const handleDeleteBackground = async (target: "app" | "login") => {
    try {
      const key = getBackgroundKey(target);
      await adminApi.updateSystemSettings({ [key]: null });
      message.success("Đã xóa ảnh nền");
      clearBackgroundPreview();
      await fetchSettings();
      window.dispatchEvent(new CustomEvent("tc-settings-updated"));
    } catch {
      message.error("Xóa ảnh nền thất bại");
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    try {
      const resp = await adminApi.deleteBackgroundSchedule(scheduleId);
      if (resp?.success) {
        message.success("Đã xóa lịch nền");
        fetchBackgroundSchedules();
      } else {
        message.error(resp?.message || "Xóa lịch nền thất bại");
      }
    } catch {
      message.error("Xóa lịch nền thất bại");
    }
  };

  const handleUploadScheduleImage = async (file: File) => {
    try {
      const resp = await adminApi.uploadBackgroundImage("login", file, {
        apply: false,
      });
      if (resp?.success) {
        const url = (resp.data?.image_url as string | undefined) || "";
        if (url) {
          bgForm.setFieldsValue({ image_url: url });
          message.success("Đã upload ảnh cho lịch nền");
        }
      }
    } catch {
      message.error("Upload ảnh cho lịch nền thất bại");
    }
  };

  const extractUploadFile = (info: unknown): File | null => {
    const root = asRecord(info);
    const file = asRecord(root.file);
    const fileList = Array.isArray(root.fileList) ? root.fileList : [];
    const first = asRecord(fileList[0]);

    const candidate =
      file.originFileObj ?? first.originFileObj ?? (root.file as unknown);

    if (!candidate) return null;

    // In browsers, File extends Blob
    if (typeof candidate !== "object") return null;
    const maybeFile = candidate as { size?: unknown; type?: unknown };
    const isBlobLike =
      typeof maybeFile.size === "number" && typeof maybeFile.type === "string";

    return isBlobLike ? (candidate as File) : null;
  };

  const parseLogDetails = (raw: string): unknown | null => {
    if (!raw || typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const getActionTagColor = (action: string): string => {
    const a = String(action || "").toUpperCase();
    if (a.startsWith("DELETE")) return "red";
    if (a.startsWith("CREATE") || a.startsWith("UPLOAD")) return "blue";
    if (a.startsWith("UPDATE")) return "green";
    if (a.includes("LOGIN") || a.includes("AUTH")) return "purple";
    if (a.includes("SCHEDULE") || a.includes("BACKGROUND")) return "gold";
    return "default";
  };

  const logColumns: ColumnsType<Log> = [
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (v: string) => formatDateVi(v),
    },
    {
      title: "User",
      dataIndex: "user_id",
      key: "user_id",
      width: 90,
      render: (v: number | null | undefined) => (
        <Typography.Text type={v ? undefined : "secondary"}>
          {v ?? "-"}
        </Typography.Text>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 260,
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <Tag color={getActionTagColor(v)} style={{ marginInlineEnd: 0 }}>
            {v}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: "Details",
      dataIndex: "details",
      key: "details",
      render: (raw: string) => {
        const parsed = parseLogDetails(raw);
        const pretty = parsed ? JSON.stringify(parsed, null, 2) : raw;
        return (
          <Popover
            title="Chi tiết"
            trigger="click"
            placement="topLeft"
            content={
              <pre className="max-w-[560px] max-h-[360px] overflow-auto text-xs whitespace-pre-wrap">
                {pretty}
              </pre>
            }
          >
            <div className="cursor-pointer">
              <Typography.Text strong className="text-blue-600">
                Xem
              </Typography.Text>
              <Typography.Text
                type="secondary"
                className="ml-2"
                ellipsis
                style={{ maxWidth: 520, display: "inline-block" }}
              >
                {raw}
              </Typography.Text>
            </div>
          </Popover>
        );
      },
    },
  ];

  const bgColumns: ColumnsType<BackgroundScheduleRow> = [
    { title: "Tiêu đề", dataIndex: "title", key: "title" },
    {
      title: "Bắt đầu",
      dataIndex: "start_date",
      key: "start_date",
      width: 180,
      render: (v: string) => formatDateVi(v),
    },
    {
      title: "Kết thúc",
      dataIndex: "end_date",
      key: "end_date",
      width: 180,
      render: (v: string) => formatDateVi(v),
    },
    {
      title: "Kích hoạt",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (v: number) => (v ? "Bật" : "Tắt"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 200,
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="small"
            onClick={() => handleToggleBackground(row.schedule_id)}
          >
            Đổi trạng thái
          </Button>
          <Button
            size="small"
            danger
            onClick={() => handleDeleteSchedule(row.schedule_id)}
          >
            Xóa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cài đặt Hệ thống</h2>
        <p className="text-gray-500">
          Quản lý cài đặt hệ thống và nhật ký hoạt động.
        </p>
      </div>

      <Card title="Cài đặt Hệ thống" className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 font-semibold">VAT Rate (%)</label>
            <Input
              type="number"
              value={settings.vat_rate || ""}
              onChange={(e) =>
                setSettings({ ...settings, vat_rate: e.target.value })
              }
              placeholder="10"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">
              Commission Rate Mặc định (%)
            </label>
            <Input
              type="number"
              value={settings.default_commission_rate || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_commission_rate: e.target.value,
                })
              }
              placeholder="2.5"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 font-semibold">
              Ảnh nền đăng nhập (mặc định)
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="primary"
                onClick={() => openBackgroundModal("login")}
              >
                Đổi ảnh nền
              </Button>
              <Button onClick={() => handleDeleteBackground("login")}>
                Xóa
              </Button>
              <span className="text-xs text-gray-500">
                Upload/URL chỉ PREVIEW. Ảnh chỉ áp dụng khi bấm Save.
              </span>
            </div>
            {settings.login_background_url ? (
              <img
                src={
                  resolveBackendUrl(settings.login_background_url) || undefined
                }
                alt="Login background preview"
                className="mt-2 w-full max-h-40 object-cover rounded"
              />
            ) : null}
          </div>
          <div>
            <label className="block mb-2 font-semibold">
              Ảnh nền trang chủ Users
            </label>
            <div className="flex items-center gap-3">
              <Button type="primary" onClick={() => openBackgroundModal("app")}>
                Đổi ảnh nền
              </Button>
              <Button onClick={() => handleDeleteBackground("app")}>Xóa</Button>
              <span className="text-xs text-gray-500">
                Ảnh này chỉ áp dụng cho trang chủ Users (/user/dashboard).
              </span>
            </div>

            {settings.app_background_url ? (
              <img
                src={
                  resolveBackendUrl(settings.app_background_url) || undefined
                }
                alt="User home background preview"
                className="mt-2 w-full max-h-40 object-cover rounded"
              />
            ) : (
              <div className="mt-2 text-xs text-gray-400">Chưa có ảnh nền.</div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="block mb-2 font-semibold">Ngân hàng Admin</label>
            <Input
              value={settings.admin_bank_name || ""}
              onChange={(e) =>
                setSettings({ ...settings, admin_bank_name: e.target.value })
              }
              placeholder="VD: Vietcombank"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">Số tài khoản</label>
            <Input
              value={settings.admin_bank_account || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  admin_bank_account: e.target.value,
                })
              }
              placeholder="VD: 0123456789"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">Chủ tài khoản</label>
            <Input
              value={settings.admin_bank_holder || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  admin_bank_holder: e.target.value,
                })
              }
              placeholder="VD: Travel Checkin"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">
              Mã BIN (tùy chọn)
            </label>
            <Input
              value={settings.admin_bank_bin || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  admin_bank_bin: e.target.value,
                })
              }
              placeholder="VD: 970436"
            />
            <div className="mt-1 text-xs text-gray-500">
              Dùng để tạo VietQR chính xác nếu không nhận diện được theo tên
              ngân hàng.
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        <div>
          <div className="font-semibold">Mã QR chuyển khoản (VietQR)</div>
          <div className="text-xs text-gray-500 mb-3">
            QR sẽ tự tạo theo thông tin ngân hàng bên trên (preview ngay cả khi
            chưa bấm Lưu).
          </div>

          {adminBankQr.error ? (
            <div className="text-sm text-red-500">{adminBankQr.error}</div>
          ) : adminBankQr.url ? (
            <div className="flex flex-wrap items-start gap-6">
              <div className="rounded-lg border p-3 bg-white">
                <Image
                  src={adminBankQr.url}
                  alt="VietQR admin"
                  width={220}
                  height={220}
                  style={{ objectFit: "contain" }}
                  preview={{ mask: "Phóng to" }}
                />
              </div>
              <div className="text-sm text-gray-700">
                <div>
                  <strong>Ngân hàng:</strong> {settings.admin_bank_name || "-"}
                </div>
                <div>
                  <strong>Số TK:</strong> {settings.admin_bank_account || "-"}
                </div>
                <div>
                  <strong>Chủ TK:</strong> {settings.admin_bank_holder || "-"}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Bấm vào mã QR để phóng to.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Nhập Ngân hàng + Số tài khoản để tạo preview QR.
            </div>
          )}
        </div>

        <Button
          className="mt-4"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSaveSettings}
          loading={loading}
        >
          Lưu Cài đặt
        </Button>
      </Card>

      <Card title="Nhật ký Hệ thống (Audit Logs)" className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Space>
            <span className="text-sm text-gray-600">User ID</span>
            <Input
              value={logUserId}
              onChange={(e) => {
                setLogUserId(e.target.value);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              placeholder="VD: 14"
              style={{ width: 140 }}
            />
          </Space>

          <Space>
            <span className="text-sm text-gray-600">Action</span>
            <Input
              value={logAction}
              onChange={(e) => {
                setLogAction(e.target.value);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              placeholder="VD: DELETE_USER"
              style={{ width: 220 }}
            />
          </Space>

          <DatePicker.RangePicker
            onChange={(dates) => {
              const from = dates?.[0]?.startOf("day").toISOString();
              const to = dates?.[1]?.endOf("day").toISOString();
              setLogDateRange([from, to]);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
          />

          <Button onClick={handleExportLogsCsv}>Export CSV</Button>
        </div>

        <Table
          columns={logColumns}
          dataSource={logs}
          loading={logsLoading}
          rowKey="log_id"
          size="middle"
          bordered
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Tổng ${total} log`,
            onChange: (page, pageSize) => {
              setPagination({
                ...pagination,
                current: page,
                pageSize: pageSize || 5,
              });
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Card title="Ảnh nền đăng nhập theo lịch" className="mb-6">
        <Form layout="vertical" form={bgForm} className="mb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              label="Tiêu đề"
              name="title"
              rules={[{ required: true, message: "Nhập tiêu đề" }]}
            >
              <Input placeholder="Tết 2026" />
            </Form.Item>
            <Form.Item
              label="Image URL"
              name="image_url"
              rules={[{ required: true, message: "Nhập URL ảnh" }]}
            >
              <div className="flex items-center gap-2">
                <Input placeholder="https://..." />
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={(info) => {
                    const file = extractUploadFile(info);
                    if (file) handleUploadScheduleImage(file);
                  }}
                >
                  <Button>Upload</Button>
                </Upload>
              </div>
            </Form.Item>

            <Form.Item label="Xem trước" colon={false}>
              {watchedScheduleImageUrl ? (
                <img
                  src={
                    resolveBackendUrl(String(watchedScheduleImageUrl)) ||
                    String(watchedScheduleImageUrl)
                  }
                  alt="Schedule background preview"
                  className="w-full max-h-40 object-cover rounded border"
                />
              ) : (
                <div className="text-xs text-gray-500">
                  Chưa có ảnh preview.
                </div>
              )}
            </Form.Item>
            <Form.Item
              label="Thời gian áp dụng"
              name="date_range"
              rules={[{ required: true, message: "Chọn thời gian" }]}
            >
              <DatePicker.RangePicker className="w-full" showTime />
            </Form.Item>
            <Form.Item
              label="Kích hoạt"
              name="is_active"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>
          <Button type="primary" onClick={handleCreateBackground}>
            Tạo lịch nền
          </Button>
        </Form>

        <Table
          columns={bgColumns}
          dataSource={bgRows}
          loading={bgLoading}
          rowKey="schedule_id"
          pagination={{
            current: bgPagination.current,
            pageSize: bgPagination.pageSize,
            total: bgPagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setBgPagination((p) => ({
                ...p,
                current: page,
                pageSize: pageSize || p.pageSize,
              })),
          }}
        />
      </Card>

      <Modal
        title={
          backgroundTarget === "app"
            ? "Đổi ảnh nền (Trang chủ Users)"
            : "Đổi ảnh nền (Đăng nhập)"
        }
        open={backgroundModalOpen}
        onCancel={() => {
          setBackgroundModalOpen(false);
          setBackgroundFile(null);
          setBackgroundUrlInput("");
          clearBackgroundPreview();
        }}
        footer={null}
        width={820}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { key: "url", title: "Nhập URL" },
            { key: "upload", title: "Upload ảnh" },
          ].map((item) => (
            <Card
              key={item.key}
              onClick={() => setBackgroundTab(item.key as typeof backgroundTab)}
              className={`cursor-pointer border ${
                backgroundTab === item.key
                  ? "border-blue-500"
                  : "border-gray-200"
              }`}
            >
              <Typography.Text strong>{item.title}</Typography.Text>
              <div className="text-xs text-gray-500 mt-1">
                Bấm để mở tùy chọn
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-4">
          {backgroundTab === "url" && (
            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold mb-2">Nhập URL ảnh nền</div>
              <Input
                value={backgroundUrlInput}
                onChange={(e) => handlePreviewUrl(e.target.value)}
                placeholder="https://..."
              />
              <div className="mt-2 text-xs text-gray-500">
                Nhập URL rồi bấm Save. Trường URL sẽ tự trống sau khi lưu.
              </div>
              <div className="mt-3">
                <Button
                  type="primary"
                  onClick={handleApplyBackground}
                  loading={backgroundSaving}
                >
                  Save
                </Button>
                <Button
                  className="ml-2"
                  onClick={() => setBackgroundModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {backgroundTab === "upload" && (
            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold mb-2">Upload ảnh nền</div>
              <Upload
                accept="image/png,image/jpeg,image/webp"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={(info) => {
                  const file = extractUploadFile(info);
                  if (file) {
                    clearBackgroundPreview();
                    const preview = URL.createObjectURL(file);
                    setBackgroundFile(file);
                    setBackgroundPreview(preview);
                    setBackgroundUrlInput("");
                  } else {
                    message.error(
                      "Không đọc được file ảnh. Vui lòng chọn lại.",
                    );
                  }
                }}
              >
                <Button type="primary">Chọn ảnh để upload</Button>
              </Upload>
              <div className="mt-2 text-xs text-gray-500">
                Hỗ trợ JPG/PNG/WebP, tối đa 50MB.
              </div>
              <div className="mt-3">
                <Button
                  type="primary"
                  onClick={handleApplyBackground}
                  loading={backgroundSaving}
                  disabled={!backgroundFile}
                >
                  Save
                </Button>
                <Button
                  className="ml-2"
                  onClick={() => setBackgroundModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">Preview</div>
          {backgroundPreview ? (
            <img
              src={backgroundPreview}
              alt="Background preview"
              className="w-full max-h-64 object-cover rounded"
            />
          ) : (
            <div className="text-xs text-gray-500">Chưa có ảnh preview.</div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
};

export default Settings;
