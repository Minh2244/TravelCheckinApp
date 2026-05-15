import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { CreateDiaryPayload } from "../../api/userApi";
import type { DiaryItem } from "../../types/user.types";

const Diary = () => {
  const [items, setItems] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<CreateDiaryPayload["mood"]>("happy");
  const [locationId, setLocationId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.getDiaries();
      setItems(response.data ?? []);
    } catch {
      setError("Không thể tải nhật ký");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await userApi.createDiary({
        notes: notes || null,
        mood: mood ?? "happy",
        location_id: locationId ? Number(locationId) : null,
      });
      setNotes("");
      setLocationId("");
      await fetchData();
    } catch {
      setError("Không thể tạo nhật ký");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserLayout title="Nhật ký hành trình" activeKey="/user/diary">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Nhật ký hành trình
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Nhật ký sẽ hiển thị khi backend trả dữ liệu.
        </p>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Địa điểm (location_id)
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Tâm trạng
              </label>
              <select
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                value={mood}
                onChange={(event) =>
                  setMood(event.target.value as CreateDiaryPayload["mood"])
                }
              >
                <option value="happy">Vui</option>
                <option value="excited">Hào hứng</option>
                <option value="neutral">Bình thường</option>
                <option value="sad">Buồn</option>
                <option value="angry">Tức giận</option>
                <option value="tired">Mệt</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Ghi chú
              </label>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu nhật ký"}
            </button>
          </div>

          <div>
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                Đang tải nhật ký...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
                {error}
              </div>
            ) : null}
            {!loading && items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                Chưa có dữ liệu nhật ký từ hệ thống.
              </div>
            ) : null}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.diary_id}
                  className="rounded-2xl border border-gray-100 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.location_name ?? "Nhật ký"}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Tâm trạng: {item.mood}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {item.notes ?? "Không có ghi chú"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default Diary;
