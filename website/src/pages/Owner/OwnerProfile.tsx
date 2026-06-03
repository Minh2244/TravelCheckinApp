import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Avatar, Button, Form, Input, Tag, message } from "antd";
import { CameraOutlined, LockOutlined, SaveOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import AvatarCropper from "../../components/AvatarCropper";

import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";

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

const OwnerProfile = () => {
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form] = Form.useForm();

  const [actor, setActor] = useState<unknown>(null);
  const actorRole = String(asRecord(actor).role || "");
  const isOwner = useMemo(() => actorRole === "owner", [actorRole]);

  // Bank Info state
  const [bankInfo, setBankInfo] = useState<{
    bank_name: string;
    bank_account: string;
    account_holder: string;
  } | null>(null);

  // Show/Hide toggle states
  const [showRevenue, setShowRevenue] = useState(false);
  const [showBankAccount, setShowBankAccount] = useState(false);

  // Avatar states
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  // Circular Avatar cropper states
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);

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
    setAvatarCropFile(file);
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
    setAvatarCropFile(null);
    message.info("Đã chọn ảnh đại diện. Nhấp nút Lưu thay đổi để cập nhật.");
  };

  const handleCropCancel = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
    setAvatarCropFile(null);
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
  const employeeContext = asRecord(asRecord(asRecord(actor).employee_context).employee_context || asRecord(actor).employee_context);

  const maskedBankAccount = bankInfo?.bank_account
    ? (showBankAccount ? bankInfo.bank_account : "••••••••" + bankInfo.bank_account.slice(-4))
    : "-";

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 bg-transparent">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hệ thống Đối tác</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-800 font-heading">
              Thông tin hồ sơ Đối tác 💼
            </h2>
          </div>
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">

          {/* Cột trái: Cover + Avatar, Thống kê, Ngân hàng */}
          <div className="space-y-6">

            {/* Cover + Avatar Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)]">
              {/* Ảnh bìa gradient đối tác tĩnh cao cấp */}
              <div className="relative h-32 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 overflow-hidden">
                <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/15 blur-xl opacity-70" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-white/10 blur-2xl opacity-60" />
                <div className="absolute inset-0 bg-black/5" />
              </div>

              {/* Avatar & Thông tin */}
              <div className="relative px-6 pb-6 text-center">
                <div className="relative -mt-16 mb-3 inline-block">
                  <Avatar
                    size={110}
                    src={avatarSrc}
                    className="border-4 border-white bg-white shadow-md mx-auto"
                  >
                    {!avatarSrc ? initials : null}
                  </Avatar>
                  {isOwner && (
                    <label className="absolute bottom-1 right-1 cursor-pointer p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-md transition-colors duration-150 border-2 border-white">
                      <CameraOutlined className="text-xs" />
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

                <h3 className="text-xl font-bold text-slate-800 font-heading">
                  {String(asRecord(actor).full_name || "Chủ đối tác")}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5 font-medium">
                  {String(asRecord(actor).email || "")}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Tag color="blue" className="rounded-full px-3 py-0.5 text-xs font-semibold m-0 border-blue-200/50">
                    Hạng đối tác: {stats.partner_rank || "New Partner 🌟"}
                  </Tag>
                  {isOwner && (
                    <Tag color="green" className="rounded-full px-3 py-0.5 text-xs font-semibold m-0 border-green-200/50">
                      {stats.total_checkins || 0} Check-ins
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            {/* Business Stats Card (Chỉ hiện cho Owner) */}
            {isOwner ? (
              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                  📈 Thống kê hoạt động đối tác
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 shadow-sm">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng địa điểm sở hữu</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total_locations || 0}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 shadow-sm">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng lượt khách đặt</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total_bookings || 0}</div>
                  </div>
                </div>

                {/* Doanh thu tích lũy với toggle ẩn/hiện con mắt */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/40 relative shadow-sm">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Doanh thu tích lũy</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xl font-black text-teal-600 tracking-tight">
                      {showRevenue ? formatCurrency(Number(stats.total_revenue || 0)) : "•••••• VNĐ"}
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

            {/* Thẻ tài khoản ngân hàng liên kết nhận tiền (Chỉ hiện cho Owner) */}
            {isOwner && bankInfo && (
              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-3 text-left">
                <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                  🏦 Ngân hàng liên kết nhận tiền
                </h4>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span>Ngân hàng:</span>
                    <span className="font-semibold text-slate-800">{bankInfo.bank_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span>Tên chủ thẻ:</span>
                    <span className="font-semibold text-slate-800 uppercase">{bankInfo.account_holder}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200/40 shadow-sm">
                    <span>Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{maskedBankAccount}</span>
                      <button
                        type="button"
                        onClick={() => setShowBankAccount(!showBankAccount)}
                        className="text-slate-400 hover:text-teal-600 text-xs focus:outline-none transition-colors"
                        title={showBankAccount ? "Ẩn số tài khoản" : "Hiện số tài khoản"}
                      >
                        {showBankAccount ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Cột phải: Form thông tin tài khoản */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-6">
            <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-200 pb-4">
              Thông tin liên hệ đối tác
            </h3>

            <Form form={form} layout="vertical" disabled={!isOwner}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <Input placeholder="Họ và tên" maxLength={100} className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm" />
                </Form.Item>

                <Form.Item label="Tên đăng nhập (Username)">
                  <div className="relative">
                    <Input
                      value={String(asRecord(actor).username || "Chưa thiết lập")}
                      disabled
                      className="rounded-xl py-2.5 bg-slate-100/60 text-slate-400 border-slate-200 cursor-not-allowed"
                    />
                    <LockOutlined className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Tên đăng nhập không thể thay đổi.</div>
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

                <Form.Item
                  name="phone"
                  label="Số điện thoại liên lạc"
                  rules={[
                    {
                      validator: async (_rule, value?: string) => {
                        const normalized = String(value || "").trim();
                        if (!normalized) return;
                        if (!isValidPhoneNumber(normalized)) {
                          throw new Error(
                            "Số điện thoại phải gồm 10 số, bắt đầu bằng 0.",
                          );
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
                        event.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 10),
                      );
                    }}
                    className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm"
                  />
                </Form.Item>
              </div>

              <Form.Item name="address" label="Địa chỉ liên hệ">
                <Input placeholder="Địa chỉ của bạn" maxLength={255} className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200 shadow-sm" />
              </Form.Item>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-xs text-slate-400 mt-6">
                <div>Trạng thái hệ thống: <span className="font-semibold text-slate-600">{getStatusLabel(String(asRecord(actor).status || ""))}</span></div>
                <div>Vai trò liên kết: <span className="font-semibold text-slate-600">{getRoleLabel(String(asRecord(actor).role || ""))}</span></div>
              </div>
            </Form>
          </div>

        </div>

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
