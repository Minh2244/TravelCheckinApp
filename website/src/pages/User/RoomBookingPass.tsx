import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import bookingApi from "../../api/bookingApi";
import { formatMoney } from "../../utils/formatMoney";
import type { RoomReservationItem } from "../../types/booking.types";
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

export default function RoomBookingPass({ isEmbedded }: { isEmbedded?: boolean }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<RoomReservationItem[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadPasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await bookingApi.getMyRoomPass();
      if (res.success) {
        setPasses(res.data || []);
      } else {
        setError(res.message || "Không thể tải danh sách vỏ vé đặt phòng");
      }
    } catch (err: any) {
      console.error("Lỗi loadRoomPasses:", err);
      setError(err?.response?.data?.message || err?.message || "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPasses();

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
            content: "✅ Đơn đặt phòng của bạn đã được xác nhận thành công!",
            duration: 4,
            key: `confirm_${bid}`,
          });
          return;
        }

        if (data?.type === "booking_checked_in") {
          const bid = Number(data.booking_id);
          if (!Number.isFinite(bid) || bid <= 0) return;
          setPasses((prev) =>
            prev.map((p) =>
              Number(p.bookingId) === bid
                ? { ...p, bookingStatus: "completed", canCancel: false }
                : p,
            ),
          );
          message.success({
            content: "🏨 Bạn đã check-in khách sạn thành công! Chúc bạn có một kỳ nghỉ tuyệt vời.",
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
      title: "Xác nhận hủy đặt phòng?",
      content: (
        <div className="space-y-2 text-sm text-slate-600 mt-2">
          <p className="font-semibold text-red-600">
            ⚠️ Chính sách hủy: Hủy phòng trong vòng 24 giờ trước ngày nhận phòng sẽ KHÔNG được hoàn tiền đặt cọc dưới mọi hình thức.
          </p>
          <p>Bạn có chắc chắn muốn hủy đơn đặt phòng này và giải phóng phòng lập tức không?</p>
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
              title: "Hủy phòng thành công!",
              content: "Căn phòng đã được giải phóng và hoàn thành thủ tục hủy đặt chỗ.",
              centered: true,
            });
            void loadPasses();
          } else {
            message.error(res.message || "Hủy đặt phòng thất bại.");
          }
        } catch (err: any) {
          console.error("Lỗi khi hủy đặt phòng:", err);
          message.error(err?.response?.data?.message || err?.message || "Không thể hủy đơn hàng.");
        } finally {
          setCancellingId(null);
        }
      }
    });
  };

  const content = (
      <section className="relative overflow-hidden user-section p-6 sm:p-8 min-h-[70vh]">

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/60 px-3.5 py-1.5 text-xs font-bold text-indigo-800 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Vé Đặt Phòng Nghỉ
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
              Quét mã QR tại lễ tân để nhận phòng (Check-in) nhanh chóng và tận hưởng các tiện ích đi kèm.
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
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3.5 text-sm text-rose-700 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500 animate-pulse">Đang tải danh sách vỏ vé khách sạn...</p>
          </div>
        ) : passes.length === 0 ? (
          <div className="mt-8 rounded-[24px] border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/20 via-white to-indigo-50/5 py-16 px-6 text-center max-w-2xl mx-auto shadow-sm">
            <div className="text-4xl">🏨</div>
            <h3 className="mt-4 text-base font-bold text-slate-800">Chưa có vỏ vé đặt phòng nào</h3>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Khi bạn hoàn thành đặt phòng tại các khách sạn hay khu nghỉ dưỡng trên TravelCheckin, chiếc vé check-in cao cấp sẽ xuất hiện tại đây.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold text-xs px-5 py-2.5 shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all"
            >
              Tìm Kiếm Khách Sạn Đẹp
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {passes.map((pass) => {
                const bookingId = Number(pass.bookingId);
                const { label, badge, card } = statusMeta(String(pass.bookingStatus || ""));
                const checkInLabel = formatDisplayDateTime(pass.checkInDate);
                const checkOutLabel = formatDisplayDateTime(pass.checkOutDate);
                const priceLabel = pass.totalAmount ? formatMoney(Number(pass.totalAmount)) : "Miễn phí";

                // Generate QR string
                const qrPayload = pass.qrPayload || `ROOM_BOOKING:${bookingId}`;

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
                            Mã vé: {pass.secureCode || `#RS-${bookingId}`}
                          </span>
                          <span className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider ${badge}`}>
                            {label}
                          </span>
                        </div>

                        <div className="text-base font-extrabold text-slate-800">
                          {pass.locationName || "Khách sạn / Resort"}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600">
                          <div>
                            <span className="text-slate-500 font-medium">Ngày nhận/trả:</span>{" "}
                            <span className="font-bold text-slate-800">
                              {checkInLabel} ➡️ {checkOutLabel}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Số đêm:</span>{" "}
                            <span className="font-bold text-slate-800">{pass.nightCount} đêm</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Số phòng:</span>{" "}
                            <span className="font-bold text-blue-700">{pass.roomNames?.join(", ") || "Đang sắp xếp"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium">Tổng tiền phòng:</span>{" "}
                            <span className="font-bold text-emerald-700">{priceLabel}</span>
                          </div>
                          {pass.contactName && (
                            <div className="sm:col-span-2">
                              <span className="text-slate-500 font-medium">Khách hàng:</span>{" "}
                              <span className="font-semibold text-slate-700">{pass.contactName} ({pass.contactPhone})</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          {pass.canCancel && pass.bookingStatus !== "cancelled" && (
                            <button
                              type="button"
                              disabled={cancellingId === bookingId}
                              onClick={() => void handleCancelBooking(bookingId)}
                              className="inline-flex items-center rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold px-4 py-2 shadow-sm transition-all"
                            >
                              {cancellingId === bookingId && (
                                <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-1.5" />
                              )}
                              Hủy phòng nghỉ
                            </button>
                          )}


                        </div>
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
                          Mã vé: {pass.secureCode || `#RS-${bookingId}`}
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
    );

  if (isEmbedded) return content;
  return (
    <UserLayout title="Vỏ vé khách sạn" subtitle="" activeKey="/user/room-pass">
      {content}
    </UserLayout>
  );
}
