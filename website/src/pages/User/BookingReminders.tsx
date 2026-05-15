import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { BookingReminderItem } from "../../types/user.types";

const BookingReminders = () => {
  const [items, setItems] = useState<BookingReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await userApi.getBookingReminders();
        if (res.success) {
          setItems(res.data || []);
        } else {
          setError(res.message || "Không lấy được lịch nhắc");
        }
      } catch {
        setError("Không lấy được lịch nhắc");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <UserLayout title="Nhắc lịch trình" activeKey="/user/booking-reminders">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Nhắc lịch trình
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Hệ thống sẽ gửi nhắc trước khi check-in/check-out.
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Đang tải dữ liệu...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Chưa có lịch trình sắp tới.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.booking_id}
              className="rounded-2xl border border-gray-100 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {item.location_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{item.address}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${
                    item.reminder_sent
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {item.reminder_sent ? "Đã nhắc" : "Sắp nhắc"}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Check-in: {new Date(item.check_in_date).toLocaleString()}
              </div>
              {item.check_out_date ? (
                <div className="mt-1 text-xs text-gray-500">
                  Check-out: {new Date(item.check_out_date).toLocaleString()}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </UserLayout>
  );
};

export default BookingReminders;
