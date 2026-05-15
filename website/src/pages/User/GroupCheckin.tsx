import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { GroupCheckinItem, GroupInfo } from "../../types/user.types";

const GroupCheckin = () => {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<GroupCheckinItem[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getGroupStatus();
      if (res.success) {
        setGroup(res.data?.group ?? null);
        setRecentCheckins(res.data?.recent_checkins ?? []);
      } else {
        setError(res.message || "Không lấy được dữ liệu nhóm");
      }
    } catch {
      setError("Không lấy được dữ liệu nhóm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroup();
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.createGroup();
      if (res.success) {
        setGroup(res.data);
        await loadGroup();
      } else {
        setError(res.message || "Không thể tạo nhóm");
      }
    } catch {
      setError("Không thể tạo nhóm");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!codeInput.trim()) {
      setError("Vui lòng nhập mã nhóm");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.joinGroup(codeInput.trim());
      if (res.success) {
        setGroup(res.data);
        await loadGroup();
      } else {
        setError(res.message || "Không thể tham gia nhóm");
      }
    } catch {
      setError("Không thể tham gia nhóm");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLoading(true);
    setError(null);
    try {
      await userApi.leaveGroup();
      setGroup(null);
      setRecentCheckins([]);
    } catch {
      setError("Không thể rời nhóm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout title="Đi cùng bạn bè" activeKey="/user/group-checkin">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">Đi cùng bạn bè</h2>
        <p className="text-sm text-gray-500 mt-2">
          Tạo nhóm tạm thời để xem bạn bè check-in gần đây. Nhóm tự hết hạn sau
          24h.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-100 p-4">
            <h3 className="text-base font-semibold text-gray-900">
              Tạo nhóm mới
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Chia sẻ mã nhóm cho bạn bè.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
              onClick={handleCreate}
              disabled={loading}
            >
              Tạo nhóm
            </button>
          </div>

          <div className="rounded-2xl border border-gray-100 p-4">
            <h3 className="text-base font-semibold text-gray-900">
              Tham gia nhóm
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Nhập mã nhóm để xem check-in của bạn bè.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Nhập mã nhóm"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
              />
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                onClick={handleJoin}
                disabled={loading}
              >
                Tham gia
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Nhóm của bạn
              </h3>
              <p className="text-sm text-gray-500">
                {group ? `Mã nhóm: ${group.code}` : "Chưa tham gia nhóm"}
              </p>
            </div>
            {group ? (
              <button
                type="button"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                onClick={handleLeave}
                disabled={loading}
              >
                Rời nhóm
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
              Đang tải dữ liệu nhóm...
            </div>
          ) : null}

          {!loading && group ? (
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>Thành viên: {group.members.length}</p>
              <p>Hết hạn: {new Date(group.expires_at).toLocaleString()}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 p-4">
          <h3 className="text-base font-semibold text-gray-900">
            Check-in gần đây của nhóm
          </h3>
          {!group ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
              Tham gia nhóm để xem check-in.
            </div>
          ) : null}
          {group && recentCheckins.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
              Chưa có check-in trong 24h gần đây.
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {recentCheckins.map((item) => (
              <div
                key={item.checkin_id}
                className="rounded-2xl border border-gray-100 px-4 py-3"
              >
                <p className="font-semibold text-gray-900">
                  {item.user_name || "Bạn"} · {item.location_name}
                </p>
                <p className="text-xs text-gray-500 mt-1">{item.address}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(item.checkin_time).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default GroupCheckin;
