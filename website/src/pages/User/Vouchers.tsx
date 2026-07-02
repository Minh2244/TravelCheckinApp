import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { CalendarOutlined, EnvironmentOutlined, ClockCircleOutlined } from "@ant-design/icons";

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

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2 max-h-[650px] overflow-y-auto pr-1">
          {filtered.map((v) => {
            const isExpired = new Date(v.end_date) < now;
            const maxUses = Number(v.max_uses_per_user);
            const used = Number(v.user_used_count || 0);
            const remainingUses = maxUses > 0 ? Math.max(0, maxUses - used) : null;
            const isPercent = v.discount_type === "percent" || v.discount_type === "percentage";

            const discountLabel = isPercent
              ? `-${Number(v.discount_value)}%`
              : `-${(Number(v.discount_value) / 1000).toFixed(0)}k`;

            const locationText = (() => {
              const locNames: string[] = Array.isArray(v.location_names)
                ? v.location_names.filter((n: any) => n)
                : typeof v.location_names === "string"
                ? (() => {
                    try {
                      return (JSON.parse(v.location_names) as string[]).filter(Boolean);
                    } catch {
                      return [];
                    }
                  })()
                : [];
              if (locNames.length > 0) return locNames.join(", ");
              if (v.location_name) return v.location_name;
              return "Toàn hệ thống";
            })();

            return (
              <div
                key={v.voucher_id}
                className={`relative flex flex-row rounded-2xl overflow-hidden border shadow-sm transition-all hover:shadow-md ${
                  isExpired
                    ? "border-slate-200 bg-slate-50 opacity-60 grayscale-[0.5]"
                    : "border-slate-100 bg-white"
                }`}
                style={{ height: "140px" }}
              >
                {/* Left Violet Stub */}
                <div className="relative w-32 bg-indigo-600 flex flex-col justify-center items-center text-white shrink-0 p-4 select-none">
                  {/* Decorative Sparkle */}
                  <div className="absolute top-2 right-2 opacity-50">
                    <svg className="w-3.5 h-3.5 text-indigo-200 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>
                    </svg>
                  </div>
                  
                  {/* Silhouette buildings */}
                  <div className="absolute bottom-0 left-0 w-full h-7 flex flex-row items-end opacity-10 px-2 justify-between pointer-events-none">
                    <div className="w-[12%] h-[60%] bg-white rounded-t-sm" />
                    <div className="w-[15%] h-[80%] bg-white rounded-t-sm" />
                    <div className="w-[10%] h-[40%] bg-white rounded-t-sm" />
                    <div className="w-[18%] h-[90%] bg-white rounded-t-sm" />
                    <div className="w-[14%] h-[70%] bg-white rounded-t-sm" />
                    <div className="w-[12%] h-[50%] bg-white rounded-t-sm" />
                  </div>

                  <div className="text-2xl font-black tracking-tight">{discountLabel}</div>
                  <div className="text-[9px] font-bold tracking-widest text-indigo-200 mt-0.5 uppercase">GIẢM GIÁ</div>
                </div>

                {/* Perforated Separator 1 */}
                <div className="relative w-3 shrink-0 flex flex-col items-center justify-between py-1 bg-white select-none">
                  <div className="absolute -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                  <div className="h-full border-l border-dashed border-slate-200" />
                  <div className="absolute -bottom-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                </div>

                {/* Middle Info Block */}
                <div className="flex-1 p-3.5 pl-1.5 bg-white flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="bg-indigo-50 text-indigo-700 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        MÃ GIẢM GIÁ
                      </span>
                      {remainingUses !== null && (
                        <span className="bg-rose-50 text-rose-600 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ClockCircleOutlined className="text-[8px]" /> Còn {remainingUses}
                        </span>
                      )}
                    </div>

                    <h3 className="text-[13px] font-extrabold text-slate-800 flex items-center gap-1 line-clamp-1 leading-snug">
                      {v.campaign_name || "Voucher đặc biệt"} <span className="text-xs select-none">🎉</span>
                    </h3>
                    {v.campaign_description && (
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
                        {v.campaign_description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    {v.discount_type === "percent" && v.max_discount_amount && (
                      <div className="text-[9px] text-purple-600 font-semibold leading-none">
                        Giảm tối đa: {Number(v.max_discount_amount).toLocaleString("vi-VN")}đ
                      </div>
                    )}
                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="text-[10px] font-semibold text-slate-600 leading-none">
                        Đơn tối thiểu: {Number(v.min_order_value) > 0 ? `${Number(v.min_order_value).toLocaleString("vi-VN")}đ` : "0đ"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Perforated Separator 2 */}
                <div className="relative w-3 shrink-0 flex flex-col items-center justify-between py-1 bg-white select-none">
                  <div className="absolute -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                  <div className="h-full border-l border-dashed border-slate-200" />
                  <div className="absolute -bottom-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                </div>

                {/* Right Metadata Block */}
                <div className="w-32 p-3 bg-slate-50/50 flex flex-col justify-between border-l border-transparent shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-start gap-1 text-[10px] text-slate-500">
                      <CalendarOutlined className="text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[8px] font-bold text-slate-400 leading-none">NSD</div>
                        <div className="font-semibold text-slate-600 mt-0.5 leading-none">{new Date(v.start_date).toLocaleDateString("vi-VN")}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1 text-[10px] text-slate-500">
                      <CalendarOutlined className="text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[8px] font-bold text-slate-400 leading-none">HSD</div>
                        <div className="font-semibold text-slate-600 mt-0.5 leading-none">{new Date(v.end_date).toLocaleDateString("vi-VN")}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex items-start gap-1 text-[8px] text-slate-400 w-full relative min-w-0">
                    <EnvironmentOutlined className="text-rose-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-tight flex-1" title={locationText}>
                      <span className="font-bold text-slate-500 block text-[8px] leading-none mb-0.5">Áp dụng tại</span>
                      {locationText}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </UserLayout>
  );
};

export default Vouchers;
