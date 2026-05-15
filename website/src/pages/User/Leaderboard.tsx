import { useCallback, useEffect, useMemo, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import locationApi from "../../api/locationApi";
import type { LeaderboardRow } from "../../types/user.types";

const Leaderboard = () => {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [province, setProvince] = useState<string>("");
  const [provinceOptions, setProvinceOptions] = useState<string[]>([]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const res = await locationApi.getLocations();
        if (res.success) {
          const set = new Set<string>();
          (res.data || []).forEach((l) => {
            if (l.province) set.add(l.province);
          });
          setProvinceOptions(Array.from(set).sort());
        }
      } catch {
        // ignore
      }
    };
    loadProvinces();
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getLeaderboard({
        month,
        province: province || undefined,
      });
      if (res.success) {
        setRows(res.data || []);
      } else {
        setError(res.message || "Không lấy được bảng xếp hạng");
      }
    } catch {
      setError("Không lấy được bảng xếp hạng");
    } finally {
      setLoading(false);
    }
  }, [month, province]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const title = useMemo(() => {
    const provinceLabel = province ? ` · ${province}` : "";
    return `Bảng xếp hạng ${month}${provinceLabel}`;
  }, [month, province]);

  return (
    <UserLayout title="Bảng xếp hạng" activeKey="/user/leaderboard">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Xếp hạng theo số lần check-in trong tháng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <select
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">Tất cả tỉnh/thành</option>
              {provinceOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Đang tải bảng xếp hạng...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Chưa có dữ liệu bảng xếp hạng.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.user_id}
              className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {row.full_name || "Người dùng"}
                  </p>
                  <p className="text-xs text-gray-500">ID #{row.user_id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {Number(row.checkin_count || 0)} check-in
                </p>
                <p className="text-xs text-gray-500">Tháng {month}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </UserLayout>
  );
};

export default Leaderboard;
