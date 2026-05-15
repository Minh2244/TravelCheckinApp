import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { Location } from "../../types/location.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";

const SavedLocations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await userApi.getFavorites();
        if (!cancelled) {
          setLocations(response.success ? response.data || [] : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Không thể tải địa điểm đã lưu"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (locationId: number) => {
    try {
      setRemovingId(locationId);
      await userApi.removeFavorite(locationId);
      setLocations((prev) =>
        prev.filter((item) => item.location_id !== locationId),
      );
      setMessage("Đã bỏ lưu địa điểm");
    } catch (removeError) {
      setError(
        getErrorMessage(removeError, "Không thể cập nhật địa điểm đã lưu"),
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <UserLayout title="Địa điểm đã lưu" activeKey="/user/saved-locations">
      <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Địa điểm đã lưu
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Những địa điểm bạn lưu để xem lại nhanh hoặc đặt trước sau.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            {locations.length} địa điểm
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Đang tải danh sách đã lưu...
          </div>
        ) : null}

        {!loading && locations.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            Bạn chưa lưu địa điểm nào.
          </div>
        ) : null}

        {locations.length > 0 ? (
          <div className="mt-6 max-h-[68vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 items-stretch gap-3 xl:grid-cols-4">
              {locations.map((item) => {
                const imageUrl = resolveBackendUrl(item.first_image);
                return (
                  <article
                    key={item.location_id}
                    className="flex h-full flex-col overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-sm"
                  >
                    <div className="aspect-[16/10] bg-slate-100">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.location_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <div>
                        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                          {item.location_type}
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-900 line-clamp-1">
                          {item.location_name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {item.address}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="text-amber-700">
                          ★ {Number(item.rating || 0).toFixed(1)}
                        </div>
                        <div className="text-slate-500">
                          {Number(item.total_reviews || 0)} đánh giá
                        </div>
                      </div>

                      <div className="mt-auto flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          onClick={() =>
                            navigate(`/user/location/${item.location_id}`)
                          }
                        >
                          Xem chi tiết
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => void handleRemove(item.location_id)}
                          disabled={removingId === item.location_id}
                        >
                          {removingId === item.location_id
                            ? "Đang bỏ..."
                            : "Bỏ lưu"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </UserLayout>
  );
};

export default SavedLocations;
