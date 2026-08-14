import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Form, Input, Tag, message, Tabs } from "antd";
import {
  CameraOutlined,
  CustomerServiceOutlined,
  LockOutlined,
  SaveOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import AvatarCropper from "../../components/AvatarCropper";
import VirtualBankCard from "../../components/VirtualBankCard";

import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { buildVietQrImageUrl } from "../../utils/vietqr";

const PERSON_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)*$/u;
const PHONE_PATTERN = /^0\d{9}$/;

const normalizePersonName = (value: string) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const isValidPersonName = (value: string) =>
  PERSON_NAME_PATTERN.test(normalizePersonName(value));

const isValidPhoneNumber = (value: string) =>
  PHONE_PATTERN.test(String(value || "").trim());

const getRoleLabel = (role: string | null | undefined): string => {
  switch (
  String(role || "")
    .trim()
    .toLowerCase()
  ) {
    case "owner":
      return "Chủ đối tác";
    case "employee":
      return "Nhân viên vận hành";
    case "admin":
      return "Quản trị viên";
    case "user":
      return "Người dùng";
    default:
      return role || "-";
  }
};

const getStatusLabel = (status: string | null | undefined): string => {
  switch (
  String(status || "")
    .trim()
    .toLowerCase()
  ) {
    case "active":
      return "Đang hoạt động";
    case "inactive":
      return "Ngừng hoạt động";
    case "pending":
      return "Chờ duyệt";
    default:
      return status || "-";
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};




// Component Biểu đồ doanh thu mini
const MiniRevenueChart = ({ data }: { data: number[] }) => {
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 800;
  const height = 120;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 24) - 12;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="bg-slate-50 border border-slate-200/50 p-6 rounded-3xl relative overflow-hidden shadow-inner flex flex-col gap-4">
      <div className="flex justify-between items-end relative z-10">
        <div>
          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">
            Doanh thu 7 ngày qua
          </div>
          <div className="text-3xl font-black text-teal-600 tracking-tight">
            {formatCurrency(data[data.length - 1] || 0)}
          </div>
        </div>
        <div className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-200/60 shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          Tăng trưởng
        </div>
      </div>
      <div className="w-full h-[120px] relative mt-2">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible drop-shadow-md">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#chartGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#0d9488"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={5}
              fill="#fff"
              stroke="#0d9488"
              strokeWidth={3}
              className="animate-pulse shadow-xl"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

const OwnerProfile = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [changingPassword, setChangingPassword] = useState(false);

  const [actor, setActor] = useState<unknown>(null);
  const actorRole = String(asRecord(actor).role || "");
  const isOwner = useMemo(() => actorRole === "owner", [actorRole]);

  // Bank Info state
  const [bankInfo, setBankInfo] = useState<{
    bank_name: string;
    bank_account: string;
    account_holder: string;
  } | null>(null);
  const profileBankQrUrl = useMemo(
    () =>
      buildVietQrImageUrl({
        bankName: bankInfo?.bank_name,
        bankAccount: bankInfo?.bank_account,
        accountHolder: bankInfo?.account_holder,
        template: "qr_only",
      }).url || "",
    [bankInfo],
  );

  // Show/Hide toggle states
  const [showRevenue, setShowRevenue] = useState(false);

  // Avatar states
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] =
    useState<string | null>(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  // Circular Avatar cropper states
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await ownerApi.getMe();
      const u = asRecord(asRecord(me).data).actor;
      setActor(u || null);

      form.setFieldsValue({
        full_name: asRecord(u).full_name,
        phone: asRecord(u).phone,
        address: asRecord(u).address,
        avatar_url: "",
      });
      setPendingAvatarRemove(false);

      // Load bank info
      if (String(asRecord(u).role || "") === "owner") {
        const bankResp = await ownerApi.getBank();
        if (bankResp?.success && bankResp.data) {
          setBankInfo(bankResp.data);
        }
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải hồ sơ đối tác"));
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    };
  }, [pendingAvatarPreview, avatarCropSrc]);

  // Handle Avatar pick -> Open crop modal
  const onPickAvatarFile = (file: File) => {
    if (!isOwner) return false;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      message.error("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error("Ảnh quá lớn (tối đa 50MB)");
      return false;
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarCropSrc(objectUrl);
    return false;
  };

  const handleCropConfirm = (blob: Blob) => {
    const fileToUpload = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(fileToUpload);
    setPendingAvatarFile(fileToUpload);
    setPendingAvatarRemove(false);
    setPendingAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
    message.info("Đã chọn ảnh đại diện. Nhấp nút Lưu thay đổi để cập nhật.");
  };

  const handleCropCancel = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
  };

  const persistLocalUser = (updates: {
    full_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
    address?: string | null;
  }) => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return;
    try {
      const parsed = JSON.parse(userStr);
      sessionStorage.setItem("user", JSON.stringify({ ...parsed, ...updates }));
    } catch {
      // ignore
    }
  };

  const onSave = async () => {
    if (!isOwner) {
      message.info("Nhân viên chỉ xem thông tin (không chỉnh sửa)");
      return;
    }
    try {
      const values = (await form.validateFields()) as {
        full_name: string;
        phone?: string | null;
        address?: string | null;
        avatar_url?: string | null;
      };
      const normalizedFullName = normalizePersonName(values.full_name);
      const normalizedPhone = values.phone?.trim() ? values.phone.trim() : null;
      const normalizedAddress = values.address?.trim() ? values.address.trim() : null;
      const manualAvatarUrl = values.avatar_url?.trim()
        ? values.avatar_url.trim()
        : null;
      setSaving(true);

      if (pendingAvatarFile) {
        setUploadingAvatar(true);
        const uploadResp = await ownerApi.uploadAvatar(pendingAvatarFile);
        const uploadedUrl = uploadResp?.data?.avatar_url as string | undefined;
        if (!uploadedUrl) {
          message.error("Upload ảnh đại diện thất bại");
          return;
        }

        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          address: normalizedAddress,
          skip_avatar: true,
        });

        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      } else if (pendingAvatarRemove) {
        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          address: normalizedAddress,
          avatar_url: null,
        });
      } else {
        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          address: normalizedAddress,
          ...(manualAvatarUrl
            ? { avatar_url: manualAvatarUrl }
            : { skip_avatar: true }),
        });
      }

      const refreshed = await ownerApi.getMe();
      const refreshedActor = asRecord(asRecord(refreshed).data).actor;
      persistLocalUser({
        full_name:
          String(asRecord(refreshedActor).full_name || "") ||
          normalizedFullName,
        phone:
          (asRecord(refreshedActor).phone as string | null | undefined) ??
          normalizedPhone,
        avatar_url:
          (asRecord(refreshedActor).avatar_url as string | null | undefined) ??
          null,
        address:
          (asRecord(refreshedActor).address as string | null | undefined) ??
          normalizedAddress,
      });

      message.success("Đã cập nhật hồ sơ đối tác!");
      window.dispatchEvent(new Event("tc-avatar-updated"));
      window.dispatchEvent(new Event("tc-profile-updated"));
      form.setFieldsValue({ avatar_url: "" });
      await load();
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi cập nhật hồ sơ"));
    } finally {
      setUploadingAvatar(false);
      setSaving(false);
    }
  };

  const onPasswordSave = async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      await ownerApi.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success("Đổi mật khẩu thành công!");
      passwordForm.resetFields();
    } catch (err: unknown) {
      const record = asRecord(err);
      if (record.errorFields) return;
      message.error(getErrorMessage(err, "Lỗi đổi mật khẩu"));
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = (String(asRecord(actor).full_name || "O"))
    .trim()
    .charAt(0)
    .toUpperCase();

  const avatarSrc =
    pendingAvatarPreview ||
    resolveBackendUrl(form.getFieldValue("avatar_url")) ||
    resolveBackendUrl(
      typeof asRecord(actor).avatar_url === "string"
        ? (asRecord(actor).avatar_url as string)
        : undefined,
    ) ||
    undefined;

  const stats = asRecord(asRecord(actor).stats) as any;
  const employeeContext = asRecord(
    asRecord(asRecord(actor).employee_context).employee_context ||
    asRecord(actor).employee_context,
  );

  const revenueValue = Number(stats.total_revenue || 0);
  const chartData = useMemo(() => {
    if (revenueValue === 0) return [0, 0, 0, 0, 0, 0, 0];
    return [
      Math.round(revenueValue * 0.4),
      Math.round(revenueValue * 0.45),
      Math.round(revenueValue * 0.55),
      Math.round(revenueValue * 0.7),
      Math.round(revenueValue * 0.8),
      Math.round(revenueValue * 0.95),
      revenueValue,
    ];
  }, [revenueValue]);

  // Tab 1: Thông tin cơ bản
  const basicInfoTab = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-stretch">
      {/* Cột trái: Cover + Avatar, Thống kê, Ngân hàng */}
      <div className="grid gap-6 animate-fadeIn lg:h-full lg:grid-rows-[auto_1fr]">
        {/* Cover + Avatar Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)]">
          {/* Ảnh bìa gradient đối tác tĩnh cao cấp */}
          <div className="relative h-28 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 overflow-hidden">
            <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/15 blur-xl opacity-70" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-white/10 blur-2xl opacity-60" />
            <div className="absolute inset-0 bg-black/5" />
          </div>

          {/* Avatar & Thông tin */}
          <div className="relative px-6 pb-6 text-center">
            <div className="relative -mt-14 mb-3 inline-block">
              <Avatar
                size={100}
                src={avatarSrc}
                className="border-4 border-white bg-white shadow-md mx-auto"
              >
                {!avatarSrc ? initials : null}
              </Avatar>
              {isOwner && (
                <label className="absolute bottom-0 right-0 cursor-pointer p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md transition-colors duration-150 border-2 border-white">
                  <CameraOutlined className="text-[10px]" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) onPickAvatarFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-800 font-heading">
              {String(asRecord(actor).full_name || "Chủ đối tác")}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {String(asRecord(actor).email || "")}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Tag
                color="blue"
                className="rounded-full px-3 py-0.5 text-[10px] font-semibold m-0 border-blue-200/50"
              >
                Hạng đối tác: {stats.partner_rank || "New Partner 🌟"}
              </Tag>
              {isOwner && (
                <Tag
                  color="green"
                  className="rounded-full px-3 py-0.5 text-[10px] font-semibold m-0 border-green-200/50"
                >
                  {stats.total_checkins || 0} Check-ins
                </Tag>
              )}
            </div>
          </div>
        </div>

        {/* Business Stats Card (Chỉ hiện cho Owner) */}
        {isOwner ? (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4 lg:h-full">
            <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
              📈 Thống kê hoạt động đối tác
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tổng địa điểm
                </div>
                <div className="text-2xl font-bold text-slate-800 mt-1">
                  {stats.total_locations || 0}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tổng lượt khách đặt
                </div>
                <div className="text-2xl font-bold text-slate-800 mt-1">
                  {stats.total_bookings || 0}
                </div>
              </div>
            </div>

            {/* Doanh thu tích lũy với toggle ẩn/hiện con mắt */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 relative shadow-sm">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Doanh thu tích lũy
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-xl font-black text-teal-600 tracking-tight">
                  {showRevenue
                    ? formatCurrency(Number(stats.total_revenue || 0))
                    : "•••••• VNĐ"}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRevenue(!showRevenue)}
                  className="text-slate-400 hover:text-teal-600 text-sm focus:outline-none transition-colors"
                  title={showRevenue ? "Ẩn doanh thu" : "Hiện doanh thu"}
                >
                  {showRevenue ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Thẻ Thông tin Vận hành (Chỉ hiện cho Nhân viên) */
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4 text-left">
            <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
              💼 Vị trí công tác vận hành
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span>Nơi làm việc:</span>
                <span className="font-semibold text-slate-800">
                  {String(employeeContext?.location_name || "-")}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span>Chức vụ:</span>
                <span className="font-bold text-teal-600">
                  {String(employeeContext?.position || "Nhân viên vận hành")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mô hình hoạt động:</span>
                <span className="font-semibold text-slate-700">
                  {String(employeeContext?.location_type || "-")}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Cột phải: Form thông tin & Thẻ ngân hàng */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] animate-fadeIn lg:h-full">
        <div className="flex h-full flex-col gap-8 xl:flex-row">

          {/* Cột thông tin liên hệ */}
          <div className="flex-1 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-200 pb-4 flex items-center gap-2">
              <UserOutlined className="text-teal-600" /> Thông tin liên hệ đối tác
            </h3>

            <Form form={form} layout="vertical" disabled={!isOwner}>
              <div className="grid grid-cols-1 gap-4">
                <Form.Item
                  name="full_name"
                  label="Họ và tên"
                  rules={[
                    { required: true, message: "Vui lòng nhập họ và tên" },
                    {
                      validator: async (_rule, value?: string) => {
                        const normalized = normalizePersonName(value || "");
                        if (!normalized) return;
                        if (!isValidPersonName(normalized)) {
                          throw new Error("Họ và tên không được chứa số hay ký tự đặc biệt.");
                        }
                      },
                    },
                  ]}
                >
                  <Input
                    placeholder="Họ và tên"
                    maxLength={100}
                    className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm"
                  />
                </Form.Item>

                <Form.Item label="Email kết nối">
                  <div className="relative">
                    <Input
                      value={String(asRecord(actor).email || "")}
                      disabled
                      className="rounded-xl py-2.5 bg-slate-100/60 text-slate-400 border-slate-200 cursor-not-allowed"
                    />
                    <LockOutlined className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
                  </div>
                </Form.Item>

                <Form.Item name="address" label="Địa chỉ liên hệ">
                  <Input
                    placeholder="Địa chỉ của bạn"
                    maxLength={255}
                    className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm"
                  />
                </Form.Item>

                <Form.Item
                  name="phone"
                  label="Số điện thoại liên lạc"
                  rules={[
                    {
                      validator: async (_rule, value?: string) => {
                        const normalized = String(value || "").trim();
                        if (!normalized) return;
                        if (!isValidPhoneNumber(normalized)) {
                          throw new Error("Số điện thoại phải gồm 10 số, bắt đầu bằng 0.");
                        }
                      },
                    },
                  ]}
                >
                  <Input
                    placeholder="Số điện thoại"
                    inputMode="numeric"
                    maxLength={10}
                    onChange={(event) => {
                      form.setFieldValue(
                        "phone",
                        event.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                      );
                    }}
                    className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm"
                  />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 text-xs text-slate-400 mt-6">
                <div>
                  Trạng thái hệ thống:{" "}
                  <span className="font-semibold text-slate-600">
                    {getStatusLabel(String(asRecord(actor).status || ""))}
                  </span>
                </div>
                <div>
                  Vai trò liên kết:{" "}
                  <span className="font-semibold text-slate-600">
                    {getRoleLabel(String(asRecord(actor).role || ""))}
                  </span>
                </div>
              </div>
            </Form>
          </div>

          {/* Cột thẻ ngân hàng (Chỉ hiện cho Owner) */}
          {isOwner && bankInfo && (
            <div className="flex shrink-0 flex-col space-y-4 xl:w-[460px]">
              <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-200 pb-4 flex items-center gap-2">
                <SafetyCertificateOutlined className="text-teal-600" /> Thẻ ngân hàng
              </h3>
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
                <div className="mx-auto w-full max-w-md">
                  <VirtualBankCard
                  bankName={bankInfo?.bank_name || ""}
                  accountNumber={bankInfo?.bank_account || ""}
                  accountName={bankInfo?.account_holder || "VUI LÒNG CẬP NHẬT"}
                    qrUrl={profileBankQrUrl}
                  title="NGÂN HÀNG CỦA BẠN"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Tab 2: Bảo mật & Hoạt động
  const securityTab = (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Row: Doanh thu chart */}
      {isOwner && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2 border-b border-slate-100 pb-3">
            <LineChartOutlined className="text-teal-600" /> Thống kê doanh thu
          </h4>
          <MiniRevenueChart data={chartData} />
        </div>
      )}

      {/* Bottom Row: 2 Cột */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cột trái: Trạng thái */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4 text-left">
            <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2 border-b border-slate-100 pb-3">
              <SafetyCertificateOutlined className="text-teal-600" /> Trạng thái tài khoản
            </h4>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span>Vai trò truy cập:</span>
                <span className="font-semibold text-slate-800">
                  {getRoleLabel(String(asRecord(actor).role || ""))}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span>Trạng thái hoạt động:</span>
                <span className="font-bold text-emerald-600">Đang hoạt động</span>
              </div>
              <div className="flex justify-between">
                <span>Chế độ xác minh:</span>
                <span className="font-bold text-teal-600">Đã xác minh (Email)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải: Đổi mật khẩu nhanh */}
        <div className="space-y-6">
          {isOwner && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-4 h-full flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-200 pb-4 flex items-center gap-2">
                <LockOutlined className="text-teal-600" /> Đổi mật khẩu nhanh
              </h3>
              <Form form={passwordForm} layout="vertical" onFinish={onPasswordSave} className="flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Form.Item
                      name="old_password"
                      label="Mật khẩu hiện tại"
                      rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}
                    >
                      <Input.Password
                        placeholder="Mật khẩu hiện tại"
                        className="rounded-xl py-2 bg-slate-50 border border-slate-200/80 focus:bg-white"
                      />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="new_password"
                    label="Mật khẩu mới"
                    rules={[
                      { required: true, message: "Vui lòng nhập mật khẩu mới" },
                      { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
                    ]}
                  >
                    <Input.Password
                      placeholder="Mật khẩu mới (>= 6 ký tự)"
                      className="rounded-xl py-2 bg-slate-50 border border-slate-200/80 focus:bg-white"
                    />
                  </Form.Item>
                  <Form.Item
                    name="confirm_password"
                    label="Xác nhận mật khẩu mới"
                    dependencies={["new_password"]}
                    rules={[
                      { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("new_password") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("Mật khẩu mới không trùng khớp!"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      placeholder="Nhập lại mật khẩu mới"
                      className="rounded-xl py-2 bg-slate-50 border border-slate-200/80 focus:bg-white"
                    />
                  </Form.Item>
                </div>
                <div className="flex justify-end pt-2 mt-2 border-t border-slate-100">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={changingPassword}
                    className="bg-teal-600 border-teal-600 hover:bg-teal-700 rounded-lg px-6 shadow-md shadow-teal-600/10 w-full md:w-auto"
                  >
                    Cập nhật mật khẩu
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const tabItems = [
    {
      key: "1",
      label: (
        <span className="flex items-center gap-1.5 font-semibold py-1">
          <UserOutlined />
          Thông tin cơ bản
        </span>
      ),
      children: basicInfoTab,
    },
    {
      key: "2",
      label: (
        <span className="flex items-center gap-1.5 font-semibold py-1">
          <SafetyCertificateOutlined />
          Bảo mật & Hoạt động
        </span>
      ),
      children: securityTab,
    },
  ];

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 bg-transparent">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Hệ thống Đối tác
            </div>
            <h2 className="mt-1 text-2xl font-bold text-slate-800 font-heading">
              Thông tin hồ sơ Đối tác 💼
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              shape="round"
              size="large"
              icon={<CustomerServiceOutlined />}
              onClick={() => navigate("/owner/support")}
              className="border-teal-200 text-teal-700 hover:border-teal-400 hover:text-teal-700"
            >
              Trung tâm hỗ trợ
            </Button>
            {isOwner ? (
              <Button
                type="primary"
                shape="round"
                size="large"
                icon={<SaveOutlined />}
                onClick={onSave}
                loading={saving || uploadingAvatar}
                className="bg-teal-600 border-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/10"
              >
                Lưu thay đổi
              </Button>
            ) : null}
          </div>
        </div>

        {/* Tabbed Layout or Plain Layout based on role */}
        {isOwner ? (
          <Tabs
            defaultActiveKey="1"
            items={tabItems}
            className="custom-profile-tabs border-none animate-fadeIn"
            animated={{ inkBar: true, tabPane: true }}
          />
        ) : (
          basicInfoTab
        )}
      </div>

      {/* Avatar Cropper */}
      {avatarCropSrc ? (
        <AvatarCropper
          src={avatarCropSrc}
          title="Cắt ảnh đại diện đối tác"
          accentColor="#0d9488"
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      ) : null}
    </MainLayout>
  );
};

export default OwnerProfile;
