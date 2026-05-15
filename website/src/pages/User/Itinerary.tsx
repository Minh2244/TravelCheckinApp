import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { CreateItineraryPayload } from "../../api/userApi";
import type { ItineraryItem } from "../../types/user.types";

const Itinerary = () => {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.getItineraries();
      setItems(response.data ?? []);
    } catch {
      setError("Không thể tải lịch trình");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên lịch trình");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: CreateItineraryPayload = {
        name: name.trim(),
        description: description || null,
        is_ai_recommended: false,
      };
      await userApi.createItinerary(payload);
      setName("");
      setDescription("");
      await fetchData();
    } catch {
      setError("Không thể tạo lịch trình");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserLayout title="Lịch trình" activeKey="/user/itinerary">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">Lịch trình</h2>
        <p className="text-sm text-gray-500 mt-2">
          AI gợi ý lịch trình sẽ được cập nhật khi backend có dữ liệu.
        </p>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Tên lịch trình
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mô tả</label>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Tạo lịch trình"}
            </button>
          </div>

          <div>
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                Đang tải lịch trình...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
                {error}
              </div>
            ) : null}
            {!loading && items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
                Chưa có dữ liệu lịch trình từ hệ thống.
              </div>
            ) : null}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.itinerary_id}
                  className="rounded-2xl border border-gray-100 p-4"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.description ?? "Không có mô tả"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
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

export default Itinerary;
