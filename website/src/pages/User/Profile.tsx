import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CameraOutlined,
  CustomerServiceOutlined,
  LockOutlined,
  TrophyOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import UserLayout from "../../layouts/UserLayout";
import AvatarCropper from "../../components/AvatarCropper";
import userApi from "../../api/userApi";
import type { UserProfile } from "../../types/user.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";

interface StoredUser {
  full_name?: string;
}

const parseStoredUser = (): StoredUser | null => {
  const raw = sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const user = parsed as Record<string, unknown>;
    return {
      full_name: typeof user.full_name === "string" ? user.full_name : undefined,
    };
  } catch {
    return null;
  }
};

const PERSON_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)*$/u;
const PHONE_PATTERN = /^0\d{9}$/;
const normalizePersonName = (value: string) => value.trim().replace(/\s+/g, " ");
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "-";

const achievementLevels = [
  { name: "Newbie", requirement: 1, description: "1 lần check-in", colors: "from-violet-500 to-indigo-600" },
  { name: "Explorer", requirement: 5, description: "5 lần check-in", colors: "from-sky-400 to-blue-600" },
  { name: "Traveler", requirement: 10, description: "10 lần check-in", colors: "from-lime-400 to-emerald-600" },
  { name: "Adventurer", requirement: 25, description: "25 lần check-in", colors: "from-amber-400 to-orange-600" },
  { name: "Globetrotter", requirement: 50, description: "50 lần check-in", colors: "from-fuchsia-400 to-purple-700" },
];

const Profile = () => {
  const navigate = useNavigate();
  const storedUser = useMemo(() => parseStoredUser(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setError(null);
    try {
      const response = await userApi.getProfile();
      if (response?.success) {
        setProfile(response.data);
        setFullName(response.data.full_name);
        setPhone(response.data.phone ?? "");
        setAddress(response.data.address ?? "");
      }
    } catch {
      setError("Không thể tải thông tin cá nhân của bạn.");
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  useEffect(() => () => {
    if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    if (avatarCropSrc) URL.revokeObjectURL(avatarCropSrc);
  }, [pendingAvatarPreview, avatarCropSrc]);

  const onAvatarFileChange = (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP).");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Ảnh quá lớn (tối đa 50MB).");
      return;
    }
    setAvatarCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = (blob: Blob) => {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(file);
    setPendingAvatarFile(file);
    setPendingAvatarPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return previewUrl;
    });
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
      const normalizedName = normalizePersonName(fullName);
      const normalizedPhone = phone.trim() || null;
      const normalizedAddress = address.trim() || null;

      if (!normalizedName) {
        setError("Vui lòng nhập họ và tên.");
        return;
      }
      if (!PERSON_NAME_PATTERN.test(normalizedName)) {
        setError("Họ và tên không được chứa ký tự đặc biệt.");
        return;
      }
      if (normalizedPhone && !PHONE_PATTERN.test(normalizedPhone)) {
        setError("Số điện thoại phải gồm 10 số, bắt đầu bằng 0.");
        return;
      }

      if (pendingAvatarFile) {
        const uploadResponse = await userApi.uploadAvatar(pendingAvatarFile);
        if (!uploadResponse?.success) {
          setError(uploadResponse?.message || "Tải ảnh đại diện lên máy chủ thất bại.");
          return;
        }
      }

      const response = await userApi.updateProfile({
        full_name: normalizedName,
        phone: normalizedPhone,
        address: normalizedAddress,
        skip_avatar: true,
      });

      if (response?.success) {
        await fetchProfile();
        setMessage("Đã cập nhật thông tin cá nhân thành công!");
        setPendingAvatarFile(null);
        setPendingAvatarPreview((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return null;
        });
        const rawUser = sessionStorage.getItem("user");
        if (rawUser) {
          try {
            const currentUser = JSON.parse(rawUser) as Record<string, unknown>;
            sessionStorage.setItem("user", JSON.stringify({
              ...currentUser,
              full_name: response.data.full_name,
              phone: response.data.phone,
              avatar_url: response.data.avatar_url,
              background_url: response.data.background_url,
              address: response.data.address,
            }));
          } catch {
            // Dữ liệu phiên không hợp lệ không ảnh hưởng đến hồ sơ vừa lưu.
          }
        }
        window.dispatchEvent(new Event("tc-avatar-updated"));
        window.dispatchEvent(new Event("tc-profile-updated"));
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Không thể cập nhật thông tin."));
    } finally {
      setSaving(false);
    }
  };

  const stats = profile?.stats;
  const checkinCount = stats?.checkin_count || 0;
  const currentAchievement = [...achievementLevels]
    .reverse()
    .find((level) => checkinCount >= level.requirement);
  const memberTier = currentAchievement?.name || "Chưa có huy hiệu";
  const displayName = fullName || storedUser?.full_name || "Lữ khách";
  const initials = displayName.trim().charAt(0).toUpperCase() || "U";
  const avatarDisplayUrl = pendingAvatarPreview || resolveBackendUrl(profile?.avatar_url) || null;

  return (
    <UserLayout
      title="Thông tin cá nhân"
      subtitle=""
      activeKey="/user/profile"
      flushTop
    >
      <section className="mx-auto max-w-[1120px] space-y-4 pb-6 pt-4">
        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">{message}</div> : null}

        <div
          className="relative overflow-hidden rounded-3xl px-5 py-5 text-white shadow-[0_14px_35px_rgba(49,70,160,0.18)] md:px-7"
          style={{ background: "linear-gradient(110deg, #5847d8 0%, #5269cf 52%, #3195b7 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_80%_15%,white_0,transparent_18%),radial-gradient(circle_at_95%_60%,white_0,transparent_15%)]" />
          <div className="pointer-events-none absolute -bottom-10 right-0 h-36 w-[48%] bg-indigo-800/20 [clip-path:polygon(0_100%,25%_38%,42%_70%,62%_18%,100%_100%)]" />
          <div className="pointer-events-none absolute -bottom-8 right-0 h-28 w-[40%] bg-sky-100/20 [clip-path:polygon(0_100%,38%_30%,54%_72%,72%_25%,100%_100%)]" />
          <div className="relative flex flex-col items-center gap-4 md:flex-row">
            <div className="relative shrink-0">
              {avatarDisplayUrl ? (
                <img src={avatarDisplayUrl} alt={displayName} className="h-24 w-24 rounded-full border-4 border-white/90 bg-white object-cover shadow-xl" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/90 bg-white/95 text-3xl font-black text-indigo-600 shadow-xl">{initials}</div>
              )}
              <label className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700" title="Đổi ảnh đại diện">
                <CameraOutlined />
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
                  onAvatarFileChange(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }} />
              </label>
            </div>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <h2 className="text-xl font-black tracking-tight md:text-2xl">Chào ngày mới, {displayName}! 🌍</h2>
              <p className="mt-1 text-sm text-white/85">Chúc bạn có một chuyến đi vui vẻ và tràn đầy trải nghiệm! ✈️</p>
              <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs md:justify-start">
                <div><span className="block text-xs text-white/70">Thành viên từ</span><strong>{formatDate(profile?.created_at)}</strong></div>
                <div><span className="block text-xs text-white/70">Cấp độ</span><strong>{memberTier}</strong></div>
                <div><span className="block text-xs text-white/70">Dấu chân</span><strong>{checkinCount} check-in</strong></div>
              </div>
              <div className="mx-auto mt-3 max-w-lg md:mx-0">
                <div className="mb-1 flex justify-between text-[10px] font-bold text-white/80"><span>Tiến trình thăng hạng</span><span>{checkinCount}/50</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (checkinCount / 50) * 100)}%` }} /></div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-center gap-2 self-center md:self-start">
              <button type="button" onClick={() => navigate("/user/support")} className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-slate-900/20 px-3.5 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-slate-900/30"><CustomerServiceOutlined /> Hỗ trợ</button>
              <button type="button" onClick={handleSaveProfile} disabled={saving} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-indigo-600 shadow-lg transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
            </div>
          </div>
        </div>

        <div className="user-profile-split">
          <article className="user-profile-side rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-800"><WalletOutlined className="text-teal-600" /> Lịch trình đã đặt</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tổng đơn đặt</span><strong className="mt-1 block text-xl text-slate-800">{stats?.total_orders || 0}</strong></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tổng chi tiêu</span><strong className="mt-1 block text-sm text-teal-600">{formatCurrency(stats?.total_spending || 0)}</strong></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tổng lần check-in</span><strong className="mt-1 block text-xl text-slate-800">{checkinCount}</strong></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Giao dịch gần nhất</span><strong className="mt-1 block text-xs text-slate-700">{formatDate(stats?.latest_order_date)}</strong></div>
            </div>
            <button type="button" onClick={() => navigate("/user/itineraries")} className="mt-3 w-full text-center text-xs font-bold text-indigo-600 transition hover:text-indigo-800">Xem tất cả lịch trình →</button>
          </article>

          <article className="user-profile-main rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
            <h3 className="border-b border-slate-200 pb-4 text-lg font-black text-slate-800">Thông tin liên hệ</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Họ và tên<input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" placeholder="Nhập họ và tên" /></label>
              <label className="text-sm font-bold text-slate-700">Email<div className="relative mt-1.5"><input type="email" value={profile?.email || ""} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-100 bg-slate-100 px-3.5 py-2.5 pr-10 text-sm font-semibold text-slate-400" /><LockOutlined className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div></label>
              <label className="text-sm font-bold text-slate-700">Số điện thoại<input type="text" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" placeholder="Nhập số điện thoại" /></label>
              <label className="text-sm font-bold text-slate-700">Địa chỉ thường trú<input type="text" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={200} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10" placeholder="Nhập địa chỉ của bạn" /></label>
            </div>
            <div className="mt-4 grid gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500 sm:grid-cols-2"><span>Đăng ký ngày: <strong className="text-slate-700">{formatDate(profile?.created_at)}</strong></span><span className="sm:text-right">Cập nhật gần nhất: <strong className="text-slate-700">{formatDate(profile?.updated_at)}</strong></span></div>
          </article>
        </div>

        <div className="user-profile-split">
          <article className="user-profile-side rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-black text-slate-800">Hoạt động gần đây</h3>
            <div className="mt-3 space-y-2">
              {stats?.favorite_location ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  {stats.favorite_location.first_image ? <img src={resolveBackendUrl(stats.favorite_location.first_image) || ""} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">📍</div>}
                  <div className="min-w-0"><span className="block text-[10px] text-slate-400">Địa điểm yêu thích</span><strong className="block truncate text-xs text-slate-700">{stats.favorite_location.location_name}</strong></div>
                </div>
              ) : null}
              {stats?.latest_order_date ? <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">🧳</div><div><span className="block text-[10px] text-slate-400">Lịch trình gần nhất</span><strong className="block text-xs text-slate-700">{stats.total_orders || 0} đơn · {formatDate(stats.latest_order_date)}</strong></div></div> : null}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">✓</div><div><span className="block text-[10px] text-slate-400">Thành viên Travel</span><strong className="block text-xs text-slate-700">{memberTier}</strong></div></div>
            </div>
          </article>

          <article className="user-profile-main rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-800"><TrophyOutlined className="text-amber-500" /> Thành tích &amp; Huy hiệu</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {achievementLevels.map((level) => {
                const unlocked = checkinCount >= level.requirement;
                return (
                  <div key={level.name} className={`text-center ${unlocked ? "" : "opacity-45 grayscale"}`}>
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${level.colors} text-lg text-white shadow-md ring-2 ring-white`}>{unlocked ? "★" : "🔒"}</div>
                    <strong className="mt-2 block text-xs text-slate-700">{level.name}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{level.description}</span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

      </section>

      {avatarCropSrc ? <AvatarCropper src={avatarCropSrc} title="Cắt ảnh đại diện" accentColor="#4f46e5" onConfirm={handleCropConfirm} onCancel={handleCropCancel} /> : null}
    </UserLayout>
  );
};

export default Profile;
