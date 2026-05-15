import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { parseLatLngMaybeSwap } from "../../utils/latLng";
import { getErrorMessage } from "../../utils/safe";
import {
  isOwnerCreatedLocation,
  type Location,
  type LocationType,
} from "../../types/location.types";

type Feedback = { type: "success" | "error"; message: string };

type EditDraft = {
  location_name: string;
  location_type: LocationType;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  status: "active" | "inactive";
};

const normalizeNumberString = (value: number | string | null | undefined) => {
  if (value == null) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
};

const MyCreatedLocations = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [userId, setUserId] = useState<number | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [editing, setEditing] = useState<Location | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await userApi.getProfile();
        if (profile.success) setUserId(profile.data.user_id);

        const resp = await userApi.getMyCreatedLocations();
        if (!resp.success)
          throw new Error(resp.message ?? "Không lấy được địa điểm bạn đã tạo");
        setLocations(resp.data);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Lỗi tải dữ liệu"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const myCreated = useMemo(() => {
    if (!userId) return locations;
    return locations.filter((l) => Number(l.owner_id) === userId);
  }, [locations, userId]);

  const handleOpenEdit = (loc: Location) => {
    setFeedback(null);
    setEditing(loc);
    setDraft({
      location_name: loc.location_name,
      location_type: loc.location_type,
      address: loc.address,
      description: loc.description ?? "",
      latitude: normalizeNumberString(loc.latitude),
      longitude: normalizeNumberString(loc.longitude),
      status: loc.status === "inactive" ? "inactive" : "active",
    });
  };

  const handleCloseEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!editing || !draft) return;

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        location_name: draft.location_name,
        location_type: draft.location_type,
        address: draft.address,
        description: draft.description ? draft.description : null,
        latitude: draft.latitude ? Number(draft.latitude) : null,
        longitude: draft.longitude ? Number(draft.longitude) : null,
        status: draft.status,
      };

      const resp = await userApi.updateMyCreatedLocation(
        editing.location_id,
        payload,
      );
      if (!resp.success) throw new Error(resp.message ?? "Lỗi lưu");

      const next = resp.data;
      setLocations((prev) =>
        prev.map((item) =>
          item.location_id === next.location_id ? next : item,
        ),
      );

      setFeedback({ type: "success", message: "Đã lưu thay đổi" });
      handleCloseEdit();
    } catch (e: unknown) {
      setFeedback({ type: "error", message: getErrorMessage(e, "Lỗi lưu") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc: Location) => {
    if (
      !window.confirm(
        "Xóa địa điểm sẽ ẩn địa điểm khỏi bản đồ và danh sách. Bạn chắc chắn muốn xóa?",
      )
    ) {
      return;
    }

    setDeletingId(loc.location_id);
    setFeedback(null);
    try {
      const resp = await userApi.deleteMyCreatedLocation(loc.location_id);
      if (!resp.success) {
        throw new Error(resp.message ?? "Không thể xóa địa điểm");
      }

      setLocations((prev) =>
        prev.filter((item) => item.location_id !== loc.location_id),
      );

      if (editing?.location_id === loc.location_id) {
        handleCloseEdit();
      }
      setFeedback({ type: "success", message: "Đã xóa địa điểm" });
    } catch (e: unknown) {
      setFeedback({
        type: "error",
        message: getErrorMessage(e, "Không thể xóa địa điểm"),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewOnMap = (loc: Location) => {
    const coords = parseLatLngMaybeSwap(loc.latitude, loc.longitude);

    navigate("/user/map", {
      state: {
        focusCheckin: {
          checkin_id: -1,
          location_id: loc.location_id,
          location_name: loc.location_name,
          address: loc.address,
          status: undefined,
          is_user_created: 1,
          location_owner_id: loc.owner_id ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
      },
    });
  };

  return (
    <UserLayout
      title="Địa điểm tôi tạo"
      subtitle="My created locations"
      activeKey="/user/my-created-locations"
    >
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Danh sách địa điểm do bạn tạo
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Bạn có thể chỉnh sửa hoặc ẩn/hiện địa điểm.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Đang tải...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {!loading && !error && myCreated.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-500">
            Bạn chưa tạo địa điểm nào.
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {myCreated.map((loc) => (
            <div
              key={loc.location_id}
              className="rounded-2xl border border-gray-100 p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {loc.location_name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{loc.address}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] ${
                    loc.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : loc.status === "inactive"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {loc.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  {loc.location_type}
                </span>
                {isOwnerCreatedLocation(loc) ? (
                  <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700">
                    tự tạo
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => handleViewOnMap(loc)}
                >
                  Xem trên map
                </button>
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => handleOpenEdit(loc)}
                >
                  Chỉnh sửa / Ẩn
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
                  onClick={() => void handleDelete(loc)}
                  disabled={deletingId === loc.location_id}
                >
                  {deletingId === loc.location_id ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {feedback ? (
          <div
            className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </section>

      {editing && draft ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCloseEdit();
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Chỉnh sửa địa điểm
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                location_id: {editing.location_id}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Tên</label>
                  <input
                    value={draft.location_name}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, location_name: e.target.value }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Loại</label>
                  <select
                    value={draft.location_type}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              location_type: e.target.value as LocationType,
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  >
                    <option value="hotel">Khách sạn</option>
                    <option value="restaurant">Ăn uống</option>
                    <option value="tourist">Du lịch / Tham quan</option>
                    <option value="cafe">Quán cà phê</option>
                    <option value="resort">Resort</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Địa chỉ</label>
                  <input
                    value={draft.address}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, address: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Vĩ độ</label>
                  <input
                    value={draft.latitude}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, latitude: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Kinh độ</label>
                  <input
                    value={draft.longitude}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, longitude: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Mô tả</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Trạng thái</label>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as EditDraft["status"],
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={handleCloseEdit}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </UserLayout>
  );
};

export default MyCreatedLocations;
