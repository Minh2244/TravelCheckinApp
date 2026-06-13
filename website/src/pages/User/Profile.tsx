import { useEffect, useMemo, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { UserProfile } from "../../types/user.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";
import { CameraOutlined, LockOutlined, TrophyOutlined, WalletOutlined } from "@ant-design/icons";
import AvatarCropper from "../../components/AvatarCropper";

interface StoredUser {
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
}

const parseStoredUser = (): StoredUser | null => {
  const raw = sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    return {
      full_name: typeof obj.full_name === "string" ? obj.full_name : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
      phone: typeof obj.phone === "string" ? obj.phone : null,
      role: typeof obj.role === "string" ? obj.role : undefined,
    };
  } catch {
    return null;
  }
};

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const Profile = () => {
  const storedUser = useMemo(() => parseStoredUser(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Avatar upload & preview
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  // Crop modal
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setError(null);
    try {
      const resp = await userApi.getProfile();
      if (resp?.success) {
        setProfile(resp.data);
        setFullName(resp.data.full_name);
        setPhone(resp.data.phone ?? "");
        setAddress(resp.data.address ?? "");
        setAvatarUrl("");
      }
    } catch {
      setError("Không thể tải thông tin cá nhân của bạn.");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    };
  }, [pendingAvatarPreview, avatarCropSrc]);

  // Avatar pick trigger -> Opens circular cropper modal
  const onAvatarFileChange = (file: File | null) => {
    setError(null);
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Ảnh quá lớn (tối đa 50MB)");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarCropSrc(objectUrl);
  };

  // Handle crop confirm from AvatarCropper
  const handleCropConfirm = (blob: Blob) => {
    const fileToUpload = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(fileToUpload);
    setPendingAvatarFile(fileToUpload);
    setPendingAvatarRemove(false);
    setPendingAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setAvatarUrl("");
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
    setMessage("Đã cắt ảnh đại diện. Hãy nhấn Lưu thay đổi để áp dụng.");
  };

  const handleCropCancel = () => {
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
    setAvatarCropSrc(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const nFullName = normalizePersonName(fullName);
      const nPhone = phone.trim() ? phone.trim() : null;
      const nAddress = address.trim() ? address.trim() : null;
      const mAvatarUrl = avatarUrl.trim() ? avatarUrl.trim() : null;

      if (!nFullName) {
        setError("Vui lòng nhập họ và tên.");
        setSaving(false);
        return;
      }
      if (!isValidPersonName(nFullName)) {
        setError("Họ và tên không được chứa ký tự đặc biệt.");
        setSaving(false);
        return;
      }
      if (nPhone && !isValidPhoneNumber(nPhone)) {
        setError(
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0.",
        );
        setSaving(false);
        return;
      }

      const wantsAvatarUrl = Boolean(mAvatarUrl);
      const wantsAvatarUpload = Boolean(pendingAvatarFile);
      const wantsAvatarRemove = Boolean(pendingAvatarRemove);

      if (wantsAvatarUpload && pendingAvatarFile) {
        const up = await userApi.uploadAvatar(pendingAvatarFile);
        if (!up?.success) {
          setError(up?.message || "Tải ảnh đại diện lên máy chủ thất bại.");
          setSaving(false);
          return;
        }
      }

      const resp = await userApi.updateProfile({
        full_name: nFullName,
        phone: nPhone,
        address: nAddress,
        ...(wantsAvatarRemove ? { avatar_url: null } : {}),
        ...(wantsAvatarUrl && !wantsAvatarUpload && !wantsAvatarRemove
          ? { avatar_url: mAvatarUrl }
          : {}),
        ...(!wantsAvatarUrl && !wantsAvatarUpload && !wantsAvatarRemove
          ? { skip_avatar: true }
          : {}),
        ...(wantsAvatarUpload ? { skip_avatar: true } : {}),
      });

      if (resp?.success) {
        // Goi lai fetchProfile de lay day du stats (checkin_count, member_tier...)
        await fetchProfile();
        setMessage("Đã cập nhật thông tin cá nhân thành công!");
        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        const userStr = sessionStorage.getItem("user");
        if (userStr) {
          try {
            const parsed = JSON.parse(userStr) as Record<string, unknown>;
            sessionStorage.setItem(
              "user",
              JSON.stringify({
                ...parsed,
                full_name: resp.data.full_name,
                phone: resp.data.phone,
                avatar_url: resp.data.avatar_url,
                background_url: resp.data.background_url,
                address: resp.data.address,
              }),
            );
          } catch {
            // ignore
          }
        }

        window.dispatchEvent(new Event("tc-avatar-updated"));
        window.dispatchEvent(new Event("tc-profile-updated"));
        setAvatarUrl("");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Không thể cập nhật thông tin."));
    } finally {
      setSaving(false);
    }
  };

  const initials = (fullName || storedUser?.full_name || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const avatarDisplayUrl =
    pendingAvatarPreview ||
    resolveBackendUrl(avatarUrl) ||
    resolveBackendUrl(profile?.avatar_url) ||
    null;

  const stats = profile?.stats;

  return (
    <UserLayout title="Hành trình lữ hành" activeKey="/user/profile">
      <section className="bg-transparent max-w-6xl mx-auto space-y-6">

        {/* Welcome Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 font-heading tracking-tight">
              Chào ngày mới, {fullName || "Lữ khách"}! 🌍
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Chúc bạn có một chuyến đi vui vẻ và tràn đầy trải nghiệm! ✈️
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-600">
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">

          {/* Cột trái: Card trang trí + Stats */}
          <div className="space-y-6">

            {/* Card Avatar & Banner tĩnh */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.035)]">
              {/* Ảnh bìa gradient nghệ thuật tĩnh cao cấp */}
              <div className="relative h-36 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl opacity-70" />
                <div className="absolute -bottom-16 -right-16 w-44 h-44 rounded-full bg-pink-400/20 blur-2xl opacity-70" />
                <div className="absolute inset-0 bg-black/5" />
              </div>

              {/* Avatar & Thông tin cơ bản */}
              <div className="relative px-6 pb-6 text-center">
                <div className="relative -mt-16 mb-3 inline-block">
                  {avatarDisplayUrl ? (
                    <img
                      src={avatarDisplayUrl}
                      alt="avatar"
                      className="h-28 w-28 rounded-full object-cover border-4 border-white bg-white shadow-md mx-auto"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-50 text-4xl font-bold text-indigo-600 border-4 border-white shadow-md mx-auto">
                      {initials}
                    </div>
                  )}
                  <label className="absolute bottom-1 right-1 cursor-pointer p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md transition-colors duration-150 border-2 border-white">
                    <CameraOutlined className="text-xs" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        onAvatarFileChange(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <h3 className="text-xl font-bold text-slate-800 font-heading">
                  {fullName || "Người dùng"}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5 font-medium">
                  {profile?.email || storedUser?.email || "Chưa cập nhật email"}
                </p>

                {/* Huy hiệu lữ hành */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-600 border border-indigo-100/50">
                    Huy hiệu: {stats?.member_tier || "Newbie 🌟"}
                  </span>
                  <span className="rounded-full bg-slate-100/70 px-3.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200/50">
                    {stats?.checkin_count || 0} Dấu chân check-in
                  </span>
                </div>

                {/* Thanh tiến trình thăng hạng check-in */}
                <div className="space-y-2 mt-5 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span>Tiến trình thăng hạng</span>
                    <span>{stats?.checkin_count || 0}/50 check-ins</span>
                  </div>
                  <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-teal-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((stats?.checkin_count || 0) / 50) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Tích lũy thêm check-in để nâng cấp huy hiệu cao hơn nhé!</p>
                </div>
              </div>
            </div>

            {/* Thẻ Thống kê lịch trình đặt */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-4">
              <h4 className="text-base font-bold text-slate-800 font-heading flex items-center gap-2">
                <WalletOutlined className="text-teal-600" />
                Lịch trình đã đặt
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/45 shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Đơn Đặt</div>
                  <div className="text-2xl font-bold text-slate-800 mt-1">{stats?.total_orders || 0}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/45 shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Chi Tiêu</div>
                  <div className="text-lg font-extrabold text-teal-600 mt-1.5 break-words">
                    {formatCurrency(stats?.total_spending || 0)}
                  </div>
                </div>
              </div>
              {stats?.latest_order_date ? (
                <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/45 shadow-sm">
                  <span>Giao dịch gần nhất:</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(stats.latest_order_date).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Thẻ Địa điểm Yêu thích nhất */}
            {stats?.favorite_location ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-4">
                <h4 className="text-base font-bold text-slate-800 font-heading flex items-center gap-2">
                  <TrophyOutlined className="text-amber-500" />
                  Địa điểm yêu thích
                </h4>
                <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200/40 shadow-sm">
                  {stats.favorite_location.first_image ? (
                    <img
                      src={resolveBackendUrl(stats.favorite_location.first_image) || ""}
                      alt={stats.favorite_location.location_name}
                      className="h-16 w-16 rounded-xl object-cover border border-slate-200/50 shadow-sm animate-fade-in"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 font-bold border border-teal-100">
                      Fav
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{stats.favorite_location.location_name}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>{stats.favorite_location.visit_count} lần ghé thăm</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold text-teal-600">{formatCurrency(stats.favorite_location.total_spent)}</span>
                    </div>
                  </div>
                </div>
                {stats.favorite_location.latest_visit ? (
                  <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
                    <span>Ghé thăm gần nhất:</span>
                    <span className="font-semibold text-slate-600">
                      {new Date(stats.favorite_location.latest_visit).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

          </div>

          {/* Cột phải: Form thông tin liên hệ */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.035)] space-y-6">
            <h3 className="text-lg font-bold text-slate-800 font-heading border-b border-slate-150 pb-4">
              Thông tin liên hệ
            </h3>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Họ và tên
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={100}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none transition-all duration-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white shadow-sm"
                  placeholder="Nhập họ và tên"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Tên đăng nhập (Username)
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={profile?.username || ""}
                    disabled
                    className="w-full rounded-xl border border-slate-100 bg-slate-100/60 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    placeholder="Chưa thiết lập"
                  />
                  <LockOutlined className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-normal">Tên đăng nhập không thể thay đổi.</p>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Email
                <div className="relative mt-2">
                  <input
                    type="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full rounded-xl border border-slate-100 bg-slate-100/60 px-4 py-2.5 pr-10 text-sm font-semibold text-slate-400 cursor-not-allowed"
                  />
                  <LockOutlined className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" />
                </div>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Số điện thoại
                <input
                  type="text"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))
                  }
                  inputMode="numeric"
                  maxLength={10}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none transition-all duration-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white shadow-sm"
                  placeholder="Nhập số điện thoại"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Địa chỉ thường trú
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={255}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 focus:outline-none transition-all duration-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white shadow-sm"
                placeholder="Nhập địa chỉ của bạn"
              />
            </label>

            <div className="border-t border-slate-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
              <div>Đồng hành từ ngày: <span className="font-semibold text-slate-500">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("vi-VN") : "-"}</span></div>
              <div>Cập nhật gần nhất: <span className="font-semibold text-slate-500">{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString("vi-VN") : "-"}</span></div>
            </div>

          </div>

        </div>
      </section>

      {/* Avatar Cropper */}
      {avatarCropSrc ? (
        <AvatarCropper
          src={avatarCropSrc}
          title="Cắt ảnh đại diện"
          accentColor="#4f46e5"
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      ) : null}
    </UserLayout>
  );
};

export default Profile;

