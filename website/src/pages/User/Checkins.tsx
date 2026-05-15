import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { CheckinItem } from "../../types/user.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

const Checkins = () => {
  const [items, setItems] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const navigate = useNavigate();

  const itemsWithKind = useMemo(() => {
    return items.map((item) => {
      const isUserCreated = Number(item.is_user_created) === 1;
      return {
        ...item,
        isUserCreated,
        kindLabel: isUserCreated ? "Tự check-in" : "Của owner",
      };
    });
  }, [items]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await userApi.getCheckins();
        setItems(response.data ?? []);
      } catch {
        setError("Không thể tải dữ liệu check-in");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleShare = async (locationId: number) => {
    const url = `${window.location.origin}/user/location/${locationId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        setShareStatus("Đã chia sẻ liên kết");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Đã copy link");
      } else {
        setShareStatus(url);
      }
    } catch {
      setShareStatus("Không thể chia sẻ");
    }
    setTimeout(() => setShareStatus(null), 3000);
  };

  const handleViewOnMap = (item: CheckinItem) => {
    const latRaw = item.location_latitude ?? item.checkin_latitude;
    const lngRaw = item.location_longitude ?? item.checkin_longitude;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;

    navigate("/user/map", {
      state: {
        focusCheckin: {
          checkin_id: item.checkin_id,
          location_id: item.location_id,
          location_name: item.location_name,
          address: item.address,
          status: item.status,
          is_user_created: item.is_user_created,
          location_owner_id: item.location_owner_id ?? null,
          lat: hasCoords ? lat : null,
          lng: hasCoords ? lng : null,
        },
      },
    });
  };

  const handleDelete = async (item: CheckinItem) => {
    const isUserCreated = Number(item.is_user_created) === 1;
    const confirmText = isUserCreated
      ? "Xóa check-in tự do sẽ xóa luôn địa điểm bạn tự tạo. Bạn chắc chắn muốn xóa?"
      : "Bạn muốn xóa lịch sử check-in của địa điểm này?";

    if (!window.confirm(confirmText)) return;

    setDeletingId(item.checkin_id);
    setError(null);
    try {
      const resp = await userApi.deleteCheckin(item.checkin_id);
      if (!resp.success) {
        throw new Error(resp.message ?? "Xóa thất bại");
      }
      setItems((prev) => prev.filter((x) => x.checkin_id !== item.checkin_id));
    } catch {
      setError("Không thể xóa check-in");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <UserLayout title="Điểm đã ghé thăm" activeKey="/user/checkins">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Điểm đã ghé thăm
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Danh sách check-in sẽ được đồng bộ từ backend.
        </p>
        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Đang tải dữ liệu check-in...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : null}
        {shareStatus ? (
          <div className="mt-4 text-xs text-emerald-600 text-center">
            {shareStatus}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Chưa có dữ liệu check-in từ hệ thống.
          </div>
        ) : null}
        <div className="mt-6 max-h-[68vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {itemsWithKind.map((item) => {
              const imageUrl = resolveBackendUrl(item.first_image);
              return (
                <div
                  key={item.checkin_id}
                  className="rounded-2xl border border-gray-100 p-3"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.location_name}
                      className="h-24 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-24 rounded-xl bg-slate-100" />
                  )}
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                      {item.location_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {item.address}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {new Date(item.checkin_time).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">
                        {item.status}
                      </span>
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                        {item.kindLabel}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50"
                        onClick={() => handleViewOnMap(item)}
                      >
                        Xem bản đồ
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700 hover:bg-red-100"
                        onClick={() => void handleDelete(item)}
                        disabled={deletingId === item.checkin_id}
                      >
                        {deletingId === item.checkin_id ? "Đang xóa..." : "Xóa"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-xl border border-gray-200 px-2 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50"
                      onClick={() => handleShare(item.location_id)}
                    >
                      Chia sẻ địa điểm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default Checkins;
