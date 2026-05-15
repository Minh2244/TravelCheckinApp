import { useEffect, useMemo, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { UserLoginHistoryItem, UserProfile } from "../../types/user.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";

// Vì sao: đảm bảo dữ liệu lấy từ sessionStorage luôn đúng kiểu để tránh lỗi hiển thị
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

const getRoleLabel = (role: string | null | undefined): string => {
  switch (
    String(role || "")
      .trim()
      .toLowerCase()
  ) {
    case "user":
      return "Người dùng";
    case "admin":
      return "Quản trị viên";
    case "owner":
      return "Chủ địa điểm";
    case "employee":
      return "Nhân viên";
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
      return "Hoạt động";
    case "inactive":
      return "Ngừng hoạt động";
    case "pending":
      return "Chờ duyệt";
    default:
      return status || "-";
  }
};

const Profile = () => {
  const storedUser = useMemo(() => parseStoredUser(), []);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    full_name: "",
    phone: "",
    avatar_url: "",
  });
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<
    string | null
  >(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);
  const [history, setHistory] = useState<UserLoginHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await userApi.getProfile();
        if (resp?.success) {
          setProfile(resp.data);
          setFormState({
            full_name: resp.data.full_name,
            phone: resp.data.phone ?? "",
            avatar_url: "",
          });
        }
      } catch {
        setError("Không thể tải hồ sơ người dùng");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    };
  }, [pendingAvatarPreview]);

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const resp = await userApi.getLoginHistory({ limit: 50 });
        if (resp?.success) {
          setHistory(resp.data ?? []);
        }
      } catch {
        setError("Không thể tải lịch sử đăng nhập");
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, []);

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

    const previewUrl = URL.createObjectURL(file);
    setPendingAvatarFile(file);
    setPendingAvatarRemove(false);
    setPendingAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setFormState((prev) => ({ ...prev, avatar_url: "" }));
    setMessage("Đã chọn ảnh. Bấm Lưu thay đổi để áp dụng.");
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const fullName = normalizePersonName(formState.full_name);
      const phone = formState.phone.trim() ? formState.phone.trim() : null;
      const avatarUrl = formState.avatar_url.trim()
        ? formState.avatar_url.trim()
        : null;

      if (!fullName) {
        setError("Vui lòng nhập họ tên");
        return;
      }
      if (!isValidPersonName(fullName)) {
        setError("Họ tên không được chứa ký tự đặc biệt");
        return;
      }
      if (phone && !isValidPhoneNumber(phone)) {
        setError(
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
        );
        return;
      }

      const wantsAvatarUrl = Boolean(avatarUrl);
      const wantsAvatarUpload = Boolean(pendingAvatarFile);
      const wantsAvatarRemove = Boolean(pendingAvatarRemove);

      if (wantsAvatarUpload && pendingAvatarFile) {
        const up = await userApi.uploadAvatar(pendingAvatarFile);
        if (!up?.success) {
          setError(up?.message || "Upload ảnh thất bại");
          return;
        }
      }

      const resp = await userApi.updateProfile({
        full_name: fullName,
        phone,
        ...(wantsAvatarRemove ? { avatar_url: null } : {}),
        ...(wantsAvatarUrl && !wantsAvatarUpload && !wantsAvatarRemove
          ? { avatar_url: avatarUrl }
          : {}),
        ...(!wantsAvatarUrl && !wantsAvatarUpload && !wantsAvatarRemove
          ? { skip_avatar: true }
          : {}),
        ...(wantsAvatarUpload ? { skip_avatar: true } : {}),
      });
      if (resp?.success) {
        setProfile(resp.data);
        setMessage("Đã cập nhật hồ sơ");
        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        const userStr = sessionStorage.getItem("user");
        if (userStr) {
          try {
            const user = JSON.parse(userStr) as Record<string, unknown>;
            sessionStorage.setItem(
              "user",
              JSON.stringify({
                ...user,
                full_name: resp.data.full_name,
                phone: resp.data.phone,
                avatar_url: resp.data.avatar_url,
                background_url: resp.data.background_url,
              }),
            );
          } catch {
            // ignore
          }
        }

        window.dispatchEvent(new Event("tc-avatar-updated"));
        window.dispatchEvent(new Event("tc-profile-updated"));

        setFormState((prev) => ({
          ...prev,
          avatar_url: "",
        }));
      }
    } catch (error) {
      setError(getErrorMessage(error, "Không thể cập nhật hồ sơ"));
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.full_name || storedUser?.full_name || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const avatarDisplayUrl =
    pendingAvatarPreview ||
    resolveBackendUrl(formState.avatar_url) ||
    resolveBackendUrl(profile?.avatar_url) ||
    null;

  return (
    <UserLayout title="Thông tin cá nhân" activeKey="/user/profile">
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Hồ sơ của bạn
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Cập nhật thông tin cá nhân và theo dõi lịch sử đăng nhập.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Đang tải hồ sơ...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-600">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-gray-100 p-4 text-center sm:p-5">
            <div className="rounded-2xl border border-gray-100 bg-slate-50 px-6 py-8">
              <div className="flex justify-center">
                {avatarDisplayUrl ? (
                  <img
                    src={avatarDisplayUrl}
                    alt="avatar"
                    className="h-24 w-24 rounded-full object-cover border-4 border-white bg-white shadow-sm"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-3xl font-semibold text-blue-600 border-4 border-white shadow-sm">
                    {initials}
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Ảnh đại diện hiển thị tại đây.
              </div>
            </div>
            <h3 className="mt-6 text-lg font-semibold text-gray-900">
              {profile?.full_name ?? storedUser?.full_name ?? "Người dùng"}
            </h3>
            <p className="text-xs text-gray-500">
              {profile?.email ?? storedUser?.email ?? "Chưa có email"}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                {getRoleLabel(profile?.role ?? storedUser?.role ?? "user")}
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-600">
                {getStatusLabel(profile?.status ?? "active")}
              </span>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Tạo lúc:{" "}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleString()
                : "-"}
            </p>

            <div className="mt-5 space-y-2">
              <label className="block w-full">
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
                <span className="block w-full cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white hover:bg-blue-700">
                  Tải ảnh lên
                </span>
              </label>

              <button
                type="button"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  setPendingAvatarFile(null);
                  setPendingAvatarRemove(true);
                  setPendingAvatarPreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setFormState((prev) => ({ ...prev, avatar_url: "" }));
                  setMessage(
                    "Đã chọn xóa avatar. Bấm Lưu thay đổi để áp dụng.",
                  );
                }}
              >
                Xóa avatar
              </button>

              <div className="text-xs text-gray-400">
                Hỗ trợ JPG/PNG/WebP, tối đa 50MB.
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 p-4 sm:p-5">
              <h4 className="text-base font-semibold text-gray-900">
                Thông tin cá nhân
              </h4>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-600">
                  Họ tên
                  <input
                    value={formState.full_name}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        full_name: event.target.value,
                      }))
                    }
                    maxLength={100}
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="Nhập họ tên"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Email
                  <input
                    value={profile?.email ?? storedUser?.email ?? ""}
                    disabled
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-500"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Số điện thoại
                  <input
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        phone: event.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 10),
                      }))
                    }
                    inputMode="numeric"
                    maxLength={10}
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="Nhập số điện thoại"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Ảnh đại diện (URL)
                  <input
                    value={formState.avatar_url}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        avatar_url: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="https://..."
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Dán URL http/https (không hỗ trợ data URL). Hoặc upload ảnh
                    từ thiết bị.
                  </p>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-semibold text-gray-900">
                  Lịch sử đăng nhập
                </h4>
                <span className="text-xs text-gray-500">
                  Hiển thị 50 lần đăng nhập gần nhất
                </span>
              </div>

              {historyLoading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                  Đang tải lịch sử đăng nhập...
                </div>
              ) : null}
              {!historyLoading && history.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                  Chưa có lịch sử đăng nhập.
                </div>
              ) : null}

              {history.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
                  <div className="hidden md:grid grid-cols-[220px_120px_180px_minmax(260px,1fr)] gap-3 border-b bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <div>Thời gian</div>
                    <div>Thành công</div>
                    <div>Địa chỉ IP</div>
                    <div>Thiết bị / trình duyệt</div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 bg-white">
                    {history.map((item) => (
                      <div
                        key={item.login_id}
                        className="px-4 py-3 text-sm text-gray-700"
                      >
                        <div className="hidden md:grid md:grid-cols-[220px_120px_180px_minmax(260px,1fr)] md:gap-3">
                          <div>
                            {new Date(item.created_at).toLocaleString()}
                          </div>
                          <div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                item.success
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {item.success ? "Thành công" : "Thất bại"}
                            </span>
                          </div>
                          <div>{item.ip_address ?? "-"}</div>
                          <div className="break-words">
                            {item.device_info ?? item.user_agent ?? "-"}
                          </div>
                        </div>
                        <div className="space-y-2 md:hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-gray-400">
                                Thời gian
                              </div>
                              <div className="mt-1 font-medium text-gray-900">
                                {new Date(item.created_at).toLocaleString()}
                              </div>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                item.success
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {item.success ? "Thành công" : "Thất bại"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-gray-400">
                                Địa chỉ IP
                              </div>
                              <div className="mt-1">
                                {item.ip_address ?? "-"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-gray-400">
                                Thiết bị / trình duyệt
                              </div>
                              <div className="mt-1 break-words">
                                {item.device_info ?? item.user_agent ?? "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default Profile;
