import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { VoucherItem } from "../../types/user.types";

const Vouchers = () => {
  const [items, setItems] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await userApi.getVouchers();
        setItems(response.data ?? []);
      } catch {
        setError("Không thể tải voucher");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <UserLayout title="Voucher" activeKey="/user/vouchers">
      <section className="user-section p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-900 font-heading">
          Voucher của tôi
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Voucher sẽ được cập nhật tự động theo hệ thống khuyến mãi.
        </p>

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
        {!loading && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
            Chưa có dữ liệu voucher từ hệ thống.
          </div>
        ) : null}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((voucher) => (
            <div
              key={voucher.voucher_id}
              className="user-sub-card p-5 card-lift"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {voucher.campaign_name ?? voucher.code}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {voucher.campaign_description ?? "Không có mô tả"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-teal-700 font-semibold shadow-sm">
                  {new Date(voucher.end_date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Địa điểm: {voucher.location_name ?? "Toàn hệ thống"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Giảm: {voucher.discount_type === "percent" ? "%" : "đ"}
                {Number(voucher.discount_value)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </UserLayout>
  );
};

export default Vouchers;
