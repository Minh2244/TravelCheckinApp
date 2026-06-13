import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";

const Vouchers = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ticket" | "food" | "room">("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await userApi.getMySavedVouchers();
        setItems(response.data ?? []);
      } catch {
        setError("Không thể tải voucher");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const now = new Date();
  const filtered = items
    .filter((v) => new Date(v.end_date) >= now)
    .filter((v) => {
      if (filter === "all") return true;
      return v.apply_to_service_type === "all" || v.apply_to_service_type === filter;
    });

  return (
    <UserLayout title="Voucher" activeKey="/user/vouchers">
      <section className="user-section p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-900 font-heading">
          Voucher của tôi
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Các voucher bạn đã lưu từ trang chi tiết địa điểm.
        </p>

        <div className="mt-4 flex gap-2">
          {(["all", "ticket", "food", "room"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                filter === key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {key === "all"
                ? "Tất cả"
                : key === "ticket"
                ? "Du lịch"
                : key === "food"
                ? "Ăn uống"
                : "Khách sạn"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
            Đang tải voucher...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
            {items.length === 0
              ? "Chưa có voucher nào. Hãy vào trang chi tiết địa điểm và bấm Lưu voucher."
              : "Không có voucher nào trong bộ lọc này."}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((v) => {
            const isExpired = new Date(v.end_date) < now;
            return (
              <div
                key={v.voucher_id}
                className={`rounded-2xl border p-4 ${
                  isExpired
                    ? "border-slate-200 bg-slate-50 opacity-60"
                    : "border-rose-100 bg-gradient-to-br from-rose-50 via-amber-50 to-white"
                }`}
              >
                <div className="text-base font-bold text-rose-700">
                  🎫{" "}
                  {v.discount_type === "percent"
                    ? `GIẢM ${Number(v.discount_value) % 1 === 0 ? Number(v.discount_value) : Number(v.discount_value).toFixed(0)}% hóa đơn`
                    : `GIẢM ${Number(v.discount_value).toLocaleString("vi-VN")}đ`}
                  {v.max_uses_per_user > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      x{Math.max(0, v.max_uses_per_user - (v.user_used_count || 0))}
                    </span>
                  )}
                </div>
                {v.discount_type === "percent" && v.max_discount_amount ? (
                  <div className="mt-1 text-xs text-rose-600 font-semibold">
                    Tối đa: {Number(v.max_discount_amount).toLocaleString("vi-VN")}đ
                  </div>
                ) : null}
                <div className="mt-2 text-sm text-slate-700 font-semibold">
                  {v.campaign_name || "Voucher"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {v.campaign_description || "Ưu đãi đặc biệt"}
                </div>
                {Number(v.min_order_value) > 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    Đơn tối thiểu: {Number(v.min_order_value).toLocaleString("vi-VN")}đ
                  </div>
                )}
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                  <span>NSD: {new Date(v.start_date).toLocaleDateString("vi-VN")}</span>
                  <span>HSD: {new Date(v.end_date).toLocaleDateString("vi-VN")}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Địa điểm: {(() => {
                    const locNames: string[] = Array.isArray(v.location_names)
                      ? v.location_names.filter((n: any) => n)
                      : [];
                    if (locNames.length > 0) return locNames.join(", ");
                    if (v.location_name) return v.location_name;
                    return "Toàn hệ thống";
                  })()}
                </div>
                {isExpired && (
                  <div className="mt-2 text-xs font-semibold text-red-500">Đã hết hạn</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </UserLayout>
  );
};

export default Vouchers;
