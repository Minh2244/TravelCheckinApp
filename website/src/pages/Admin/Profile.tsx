import { useEffect, useState } from "react";
import { Avatar, Button, Form, Input, Tag, message } from "antd";
import { CameraOutlined, LockOutlined, SaveOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AvatarCropper from "../../components/AvatarCropper";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";

interface AdminProfileDto {
  user_id: number;
  email: string | null;
  phone: string | null;
  full_name: string;
  address?: string | null;
  username?: string | null;
  avatar_url: string | null;
  avatar_source?: string;
  background_url?: string | null;
  background_source?: string;
  has_avatar_blob?: boolean;
  has_password?: boolean;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  stats?: {
    total_users: number;
    total_locations: number;
    total_bookings: number;
    top_location: {
      location_name: string;
      booking_count: number;
      total_revenue: number;
      latest_booking: string | null;
      first_image: string | null;
    } | null;
    admin_rank?: string;
  };
}

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
    case "admin":
      return "Quản trị viên";
    case "owner":
      return "Chủ địa điểm";
    case "employee":
      return "Nhân viên";
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

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Live action counts
  const [pendingLocations, setPendingLocations] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [activeSos, setActiveSos] = useState(0);

  // Avatar upload
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  // Circular Avatar Cropper Modal state
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const [profileForm] = Form.useForm();

  const fetchProfile = async (): Promise<AdminProfileDto | null> => {
    try {
      const response = await adminApi.getAdminProfile();
      if (response?.success) {
        const raw = response.data as AdminProfileDto;
        const data: AdminProfileDto = {
          ...raw,
          avatar_url:
            typeof raw.avatar_url === "string" &&
              raw.avatar_url.trim().toLowerCase().startsWith("data:")
              ? null
              : raw.avatar_url,
        };
        setProfile(data);
        profileForm.setFieldsValue({
          full_name: data.full_name,
          phone: data.phone,
          address: data.address,
          avatar_url: "",
        });

        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        return data;
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Lỗi tải thông tin admin"));
    }
    return null;
  };

  const fetchActionCounts = async () => {
    try {
      const [locs, reps, drawsRaw, sos] = await Promise.all([
        adminApi.getLocations({ status: "pending" }),
        adminApi.getReports({ status: "pending" }),
        adminApi.getCommissionPaymentRequests(),
        adminApi.getSosAlerts({ status: "pending" })
      ]);

      if (locs?.success) setPendingLocations(locs.pagination?.total || locs.data?.length || 0);
      if (reps?.success) setPendingReports(reps.pagination?.total || reps.data?.length || 0);
      if (drawsRaw?.success && Array.isArray(drawsRaw.data)) {
        const pendingDraws = drawsRaw.data.filter((item: any) => item.status === "pending");
        setPendingWithdrawals(pendingDraws.length);
      } else if (drawsRaw?.success) {
        setPendingWithdrawals(drawsRaw.pagination?.total || drawsRaw.data?.length || 0);
      }
      if (sos?.success) setActiveSos(sos.pagination?.total || sos.data?.length || 0);
    } catch {
      // Fetch stats silently
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchActionCounts();
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLocalUser = (updates: {
    full_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
    address?: string | null;
  }) => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr) as Record<string, unknown>;
      sessionStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          ...updates,
        }),
      );
    } catch {
      // ignore
    }
  };

  // Avatar selection -> Opens cropper
  const onAvatarFileChange = (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      message.error("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error("Ảnh quá lớn (tối đa 50MB)");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setAvatarCropSrc(objectUrl);
  };

  // Handle crop confirm
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
    message.info("Đã chọn ảnh đại diện. Hãy bấm nút Lưu thay đổi để áp dụng.");
  };

  const handleCropCancel = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
  };

  const submitProfile = async () => {
    try {
      const values = (await profileForm.validateFields()) as {
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

      let avatarAction: "upload" | "url" | "remove" | "keep" = "keep";
      let finalAvatarUrl: string | null = null;

      if (pendingAvatarRemove) {
        avatarAction = "remove";
        finalAvatarUrl = null;
      } else if (pendingAvatarFile) {
        avatarAction = "upload";
        setUploadingAvatar(true);
        const uploadResp = await adminApi.uploadAdminAvatar(pendingAvatarFile);
        if (!uploadResp?.success) {
          message.error("Tải ảnh đại diện lên máy chủ thất bại.");
          setSaving(false);
          setUploadingAvatar(false);
          return;
        }
        finalAvatarUrl =
          (uploadResp.data?.avatar_url as string | null | undefined) ?? null;
        if (!finalAvatarUrl) {
          message.error("Lỗi lưu ảnh đại diện (thiếu URL).");
          setSaving(false);
          setUploadingAvatar(false);
          return;
        }
        avatarAction = "keep"; // Upload already handled it
      } else if (manualAvatarUrl) {
        avatarAction = "url";
        finalAvatarUrl = manualAvatarUrl;
      }

      const updateData: {
        full_name: string;
        phone: string | null;
        address: string | null;
        avatar_url?: string | null;
        skip_avatar?: boolean;
      } = {
        full_name: normalizedFullName,
        phone: normalizedPhone,
        address: normalizedAddress,
      };

      if (avatarAction === "keep") {
        updateData.skip_avatar = true;
      } else if (avatarAction === "remove") {
        updateData.avatar_url = null;
      } else if (avatarAction === "url") {
        updateData.avatar_url = finalAvatarUrl;
      }

      const response = await adminApi.updateAdminProfile(updateData);

      if (response?.success) {
        message.success("Đã cập nhật thông tin cá nhân thành công!");
        const refreshed = await fetchProfile();
        persistLocalUser({
          full_name: refreshed?.full_name || normalizedFullName,
          phone: refreshed?.phone ?? normalizedPhone,
          avatar_url: refreshed?.avatar_url ?? null,
          address: refreshed?.address ?? normalizedAddress,
        });
        window.dispatchEvent(new CustomEvent("tc-avatar-updated"));
        window.dispatchEvent(new Event("tc-profile-updated"));

        profileForm.setFieldsValue({ avatar_url: "" });
        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Lỗi cập nhật thông tin"));
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const initials = (profile?.full_name || "A")
    .trim()
    .charAt(0)
    .toUpperCase();

  const watchedAvatarUrl = Form.useWatch("avatar_url", profileForm);

  const avatarDisplayUrl =
    pendingAvatarPreview ||
    resolveBackendUrl(watchedAvatarUrl) ||
    resolveBackendUrl(profile?.avatar_url) ||
    undefined;

  const stats = profile?.stats;

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 bg-transparent">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hệ thống Admin</div>
            <h2 className="mt-1 text-2xl font-black text-slate-800 font-heading">
              Chi tiết tài khoản Admin 👑
            </h2>
          </div>
          <Button
            type="primary"
            shape="round"
            size="large"
            icon={<SaveOutlined />}
            onClick={submitProfile}
            loading={saving || uploadingAvatar}
            className="bg-indigo-600 border-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/10"
          >
            Lưu thay đổi
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">

          {/* Cột trái: Cover + Avatar, Thống kê bảo mật, Action Hub */}
          <div className="space-y-6">

            {/* Cover + Avatar Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)]">
              {/* Ảnh bìa gradient chuyên nghiệp */}
              <div className="relative h-32 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 overflow-hidden">
                <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/5 blur-xl opacity-60" />
                <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-indigo-500/10 blur-2xl opacity-60" />
                <div className="absolute inset-0 bg-black/10" />
              </div>

              {/* Avatar & Thông tin */}
              <div className="relative px-6 pb-6 text-center">
                <div className="relative -mt-16 mb-3 inline-block">
                  <Avatar
                    size={110}
                    src={avatarDisplayUrl}
                    className="border-4 border-white bg-white shadow-md mx-auto"
                  >
                    {!avatarDisplayUrl ? initials : null}
                  </Avatar>
                  <label className="absolute bottom-1 right-1 cursor-pointer p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md transition-colors duration-150 border-2 border-white">
                    <CameraOutlined className="text-xs" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        if (f) onAvatarFileChange(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <h3 className="text-xl font-bold text-slate-800 font-heading">
                  {profile?.full_name || "-"}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5 font-medium">
                  {profile?.email || "-"}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Tag color="purple" className="rounded-full px-3 py-0.5 text-xs font-semibold m-0 border-purple-200/50">
                    Vai trò: {stats?.admin_rank || "Master Admin 👑"}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Trạng thái Bảo mật & Phiên làm việc */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4 text-left">
              <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                🔒 Bảo mật & Phiên kết nối
              </h4>
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Địa chỉ kết nối:</span>
                  <span className="font-semibold text-slate-800">127.0.0.1 (An toàn)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Phiên làm việc:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Đang bảo mật
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Bảo mật 2 lớp:</span>
                  <span className="font-bold text-indigo-600">Đã bật (2FA)</span>
                </div>
                <div className="flex justify-between">
                  <span>Mức phân quyền:</span>
                  <span className="font-bold text-violet-600">Quản trị viên tối cao</span>
                </div>
              </div>
            </div>

            {/* Trung tâm xử lý nhanh (Admin Action Hub) */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)] p-6 space-y-4 text-left">
              <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                ⚡ Trung tâm xử lý công việc
              </h4>
              <p className="text-[11px] text-slate-400">Các công việc đang chờ bạn phê duyệt hoặc giải quyết:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/admin/locations")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/60 transition-all text-center group shadow-sm"
                >
                  <span className="text-lg mb-1 group-hover:scale-115 transition-transform">🏢</span>
                  <span className="text-[10px] font-bold text-indigo-900 leading-tight">Duyệt địa điểm</span>
                  <span className="mt-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white">
                    {pendingLocations} chờ duyệt
                  </span>
                </button>

                <button
                  onClick={() => navigate("/admin/reports")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-rose-50/40 border border-slate-200/60 transition-all text-center group shadow-sm"
                >
                  <span className="text-lg mb-1 group-hover:scale-115 transition-transform">⚠️</span>
                  <span className="text-[10px] font-bold text-rose-900 leading-tight">Báo cáo vi phạm</span>
                  <span className="mt-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold text-white">
                    {pendingReports} tin mới
                  </span>
                </button>

                <button
                  onClick={() => navigate("/admin/payments")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/60 transition-all text-center group shadow-sm"
                >
                  <span className="text-lg mb-1 group-hover:scale-115 transition-transform">💸</span>
                  <span className="text-[10px] font-bold text-emerald-900 leading-tight">Yêu cầu rút tiền</span>
                  <span className="mt-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white">
                    {pendingWithdrawals} yêu cầu
                  </span>
                </button>

                <button
                  onClick={() => navigate("/admin/sos")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-amber-50/40 border border-slate-200/60 transition-all text-center group shadow-sm"
                >
                  <span className="text-lg mb-1 group-hover:scale-115 transition-transform">🚨</span>
                  <span className="text-[10px] font-bold text-amber-900 leading-tight">Theo dõi SOS</span>
                  <span className="mt-1.5 rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-bold text-white">
                    {activeSos} khẩn cấp
                  </span>
                </button>
              </div>
            </div>

          </div>

          {/* Cột phải: Form thông tin quản trị */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-6">
            <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-200 pb-4">
              Thông tin định danh quản trị
            </h3>

            <Form form={profileForm} layout="vertical">
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
                  <Input placeholder="Họ và tên" maxLength={100} className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200" />
                </Form.Item>

                <Form.Item label="Tên đăng nhập (Username)">
                  <div className="relative">
                    <Input
                      value={profile?.username || "Chưa thiết lập"}
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
                      value={profile?.email || ""}
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
                      profileForm.setFieldValue(
                        "phone",
                        event.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 10),
                      );
                    }}
                    className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200"
                  />
                </Form.Item>
              </div>

              <Form.Item name="address" label="Địa chỉ làm việc">
                <Input placeholder="Địa chỉ của bạn" maxLength={255} className="rounded-xl py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-50 focus:bg-white transition-all duration-200" />
              </Form.Item>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-xs text-slate-400 mt-6">
                <div>Trạng thái hệ thống: <span className="font-semibold text-slate-600">{getStatusLabel(profile?.status)}</span></div>
                <div>Phân quyền chính thức: <span className="font-semibold text-slate-600">{getRoleLabel(profile?.role)}</span></div>
              </div>
            </Form>
          </div>

        </div>

      </div>
      {/* Avatar Cropper */}
      {avatarCropSrc ? (
        <AvatarCropper
          src={avatarCropSrc}
          title="Cắt ảnh đại diện Admin"
          accentColor="#0f172a"
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      ) : null}
    </MainLayout>
  );
};

export default Profile;
