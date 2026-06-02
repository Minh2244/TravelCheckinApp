import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import bookingApi from "../../api/bookingApi";
import { formatMoney } from "../../utils/formatMoney";
import type { TableReservationItem } from "../../types/booking.types";
import { Modal, message } from "antd";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

const formatDisplayDateTime = (value: string | null | undefined): string => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map((x) => Number(x));
    if (!y || !m || !d) return value;
    return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${String(y)}`;
  }
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return value;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

const buildQrUrl = (payload: string, size = 160) => {
  const safe = encodeURIComponent(String(payload || "").trim());
  if (!safe) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${safe}`;
};

const statusMeta = (status: string) => {
  switch (status) {
    case "pending":
      return {
        label: "CHỜ DUYỆT",
        badge: "bg-amber-100 text-amber-800 border border-amber-300",
        card: "border-amber-400 bg-amber-50/40 shadow-sm",
      };
    case "confirmed":
      return {
        label: "ĐÃ DUYỆT",
        badge: "bg-emerald-100 text-emerald-800 border border-emerald-300",
        card: "border-emerald-400 bg-emerald-50/30 shadow-sm",
      };
    case "completed":
      return {
        label: "ĐÃ DÙNG",
        badge: "bg-slate-200 text-slate-700 border border-slate-300",
        card: "border-slate-300 bg-slate-50/40 opacity-90 shadow-sm",
      };
    case "cancelled":
      return {
        label: "ĐÃ HỦY",
        badge: "bg-rose-100 text-rose-700 border border-rose-300",
        card: "border-rose-300 bg-rose-50/40 opacity-75 shadow-sm",
      };
    default:
      return {
        label: "KHÔNG RÕ",
        badge: "bg-slate-100 text-slate-600 border border-slate-200",
        card: "border-slate-200 bg-slate-50/40",
      };
  }
};

export default function TableBookingPass() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<TableReservationItem[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadPasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await bookingApi.getMyTablePass();
      if (res.success) {
        setPasses(res.data || []);
      } else {
        setError(res.message || "Không thể tải danh sách vé");
      }
    } catch (err: any) {
      console.error("Lỗi loadTablePasses:", err);
      setError(err?.response?.data?.message || err?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPasses();
  }, [loadPasses]);

  // SSE: nhận trạng thái vé realtime từ server
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    const url = resolveBackendUrl(`/api/events?token=${encodeURIComponent(token)}`);
    if (!url) return;

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type?: string;
          booking_id?: number;
          new_status?: string;
        };

        if (data?.type === "booking_confirmed") {
          const bid = Number(data.booking_id);
          if (!Number.isFinite(bid) || bid <= 0) return;
          setPasses((prev) =>
            prev.map((p) =>
              Number(p.bookingId) === bid
                ? { ...p, bookingStatus: "confirmed" }
                : p,
            ),
          );
          message.success({
            content: "✅ Vé đặt bàn của bạn đã được chủ cơ sở xác nhận thành công!",
            duration: 4,
            key: `confirm_${bid}`,
          });
          return;
        }

        if (data?.type === "booking_checked_in") {
          const bid = Number(data.booking_id);
          if (!Number.isFinite(bid) || bid <= 0) return;
          // Cập nhật trạng thái ngay trong state — không cần reload API
          setPasses((prev) =>
            prev.map((p) =>
              Number(p.bookingId) === bid
                ? { ...p, bookingStatus: "completed", canCancel: false }
                : p,
            ),
          );
          message.success({
            content: "✅ Vé đã được check-in thành công! Chúc bạn dùng bữa ngon miệng.",
            duration: 4,
            key: `checkin_${bid}`,
          });
          return;
        }

        if (data?.type === "booking_cancelled" || data?.type === "booking_expired") {
          const bid = Number(data.booking_id);
          if (!Number.isFinite(bid) || bid <= 0) return;
          setPasses((prev) =>
            prev.map((p) =>
              Number(p.bookingId) === bid
                ? { ...p, bookingStatus: "cancelled", canCancel: false }
                : p,
            ),
          );
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      es.close();
    };
  }, []);

  const handleCancelBooking = async (bookingId: number) => {
    Modal.confirm({
      title: "Xác nhận hủy đặt bàn?",
      content: (
        <div className="space-y-2 text-sm text-slate-600 mt-2">
          <p className="font-semibold text-red-600">
            Lưu ý: Hủy đặt bàn trước giờ hẹn có thể không được hoàn trả tiền cọc hoặc món ăn đặt trước tùy theo chính sách của nhà hàng.
          </p>
          <p>Bạn có chắc chắn muốn hủy đặt bàn này không?</p>
        </div>
      ),
      okText: "Đồng ý hủy",
      okType: "danger",
      cancelText: "Quay lại",
      centered: true,
      onOk: async () => {
        setCancellingId(bookingId);
        try {
          const res = await bookingApi.cancelMyBooking(bookingId);
          if (res.success) {
            Modal.success({
              title: "Hủy đặt bàn thành công!",
              content: "Chỗ ăn của bạn đã được giải phóng và hoàn tất quy trình hủy đặt bàn.",
              centered: true,
            });
            void loadPasses();
          } else {
            message.error(res.message || "Hủy đặt bàn thất bại.");
          }
        } catch (err: any) {
          console.error("Lỗi khi hủy đặt bàn:", err);
          message.error(err?.response?.data?.message || err?.message || "Không thể hủy bàn.");
        } finally {
          setCancellingId(null);
        }
      }
    });
  };

  return (
    <UserLayout title="Vỏ vé ăn uống" subtitle="" activeKey="/user/table-pass">
      <section className="relative overflow-hidden user-section p-6 sm:p-8 min-h-[70vh]">

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-amber-500" />
              Vé Đặt Bàn Ẩm Thực
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 font-heading tracking-tight sm:text-3xl">
              Vỏ Vé Ăn Uống của tôi
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
              Xuất trình mã QR tại nhà hàng/quán cafe để check-in dùng bàn và các dịch vụ đi kèm.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3.5 text-sm text-rose-700 flex items-center gap-2">
            <span className="font-bold text-rose-600">[Lỗi]</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Đang tải danh sách vỏ vé ăn uống...</p>
          </div>
        ) : passes.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-amber-200 bg-amber-50/5 py-16 px-6 text-center max-w-2xl mx-auto shadow-sm">
            <h3 className="text-lg font-bold text-slate-800">Chưa có vé đặt bàn nào</h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Khi bạn đặt trước bàn ăn hoặc món ăn tại các địa điểm ẩm thực trực tuyến, vé check-in QR sẽ hiển thị đầy đủ tại đây.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-5 rounded-full bg-amber-500 text-white font-bold text-xs px-5 py-2.5 shadow-md shadow-amber-500/20 hover:shadow-lg transition-all"
            >
              Khám phá Địa Điểm Ẩm Thực
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-amber-100 bg-white p-5 sm:p-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {passes.map((pass) => {
                const bookingId = Number(pass.bookingId);
                const { label, badge, card } = statusMeta(String(pass.bookingStatus || ""));
                const checkInLabel = formatDisplayDateTime(pass.checkInDate || pass.startTime);
                const priceLabel = pass.totalAmount ? formatMoney(Number(pass.totalAmount)) : "Miễn phí";
                const qrPayload = pass.qrPayload || `TABLE_BOOKING:${bookingId}`;

                return (
                  <div
                    key={bookingId}
                    className={`group relative overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300 ${card}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
                      
                      {/* Left: Ticket Info */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <span className="text-xl font-extrabold text-slate-900 tracking-tight font-mono">
                            Mã vé: {pass.secureCode || `#DI-${bookingId}`}
                          </span>
                          <span className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider ${badge}`}>
                            {label}
                          </span>
                        </div>

                        <div className="text-base font-extrabold text-slate-800">
                          {pass.locationName || "Địa điểm ăn uống"}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600">
                          <div>
                            <span className="text-slate-500 font-medium">Thời gian:</span>{" "}
                            <span className="font-bold text-slate-800">{checkInLabel}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Bàn ăn:</span>{" "}
                            <span className="font-bold text-blue-700">{pass.tableNames?.join(", ") || "Chưa gán bàn"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Đặt cọc:</span>{" "}
                            <span className="font-bold text-amber-700">{priceLabel}</span>
                          </div>
                          {pass.contactName && (
                            <div className="sm:col-span-2">
                              <span className="text-slate-500 font-medium">Khách hàng:</span>{" "}
                              <span className="font-semibold text-slate-700">{pass.contactName} ({pass.contactPhone})</span>
                            </div>
                          )}
                        </div>

                        {pass.canCancel && pass.bookingStatus !== "cancelled" && (
                          <div className="pt-2">
                            <button
                              type="button"
                              disabled={cancellingId === bookingId}
                              onClick={() => void handleCancelBooking(bookingId)}
                              className="inline-flex items-center rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold px-4 py-2 shadow-sm transition-all"
                            >
                              {cancellingId === bookingId && (
                                <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-1.5" />
                              )}
                              Hủy đặt bàn
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: QR Code Block */}
                      <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 shrink-0 w-full md:w-[180px]">
                        {pass.bookingStatus === "pending" ? (
                          <div className="relative p-2 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
                            <img
                              src={buildQrUrl(qrPayload, 110)}
                              alt="QR pending"
                              className="w-28 h-28 opacity-10 blur-[3px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 p-2 text-center">
                              <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">
                                Chờ duyệt
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">
                                Mã QR sẽ hiển thị sau khi duyệt
                              </span>
                            </div>
                          </div>
                        ) : pass.bookingStatus === "confirmed" ? (
                          <div className="p-2 rounded-xl border-2 border-emerald-400 bg-white shadow-sm flex flex-col items-center justify-center">
                            <img
                              src={buildQrUrl(qrPayload, 110)}
                              alt="QR code"
                              className="w-28 h-28"
                              loading="lazy"
                            />
                          </div>
                        ) : pass.bookingStatus === "completed" ? (
                          <div className="relative p-2 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden opacity-60">
                            <img
                              src={buildQrUrl(qrPayload, 110)}
                              alt="QR completed"
                              className="w-28 h-28 opacity-10 blur-[3.5px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 p-2 text-center">
                              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                ĐÃ DÙNG
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative p-2 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden opacity-60">
                            <img
                              src={buildQrUrl(qrPayload, 110)}
                              alt="QR cancelled"
                              className="w-28 h-28 opacity-10 blur-[3.5px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 p-2 text-center">
                              <span className="text-xs font-extrabold text-rose-700 uppercase tracking-wider">
                                ĐÃ HỦY
                              </span>
                            </div>
                          </div>
                        )}
                        <span className="text-[10.5px] font-extrabold text-slate-850 mt-2 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                          Mã vé: {pass.secureCode || `#DI-${bookingId}`}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </UserLayout>
  );
}
