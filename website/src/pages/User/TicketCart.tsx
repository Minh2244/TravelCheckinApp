import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import useTouristTicketSync from "../../modules/frontOffice/hooks/useTouristTicketSync";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatMoney } from "../../utils/formatMoney";
import type { UserTouristTicketItem } from "../../types/user.types";
import bookingApi from "../../api/bookingApi";
import { Modal, message } from "antd";

const TICKET_ISSUED_STORAGE_KEY = "ticket_issued_blocks_v1";

type CachedTicket = {
  ticketCode: string;
  serviceName?: string | null;
  serviceId?: number | null;
  locationId?: number | null;
  locationName?: string | null;
  useDate?: string | null;
};

const readCachedTickets = (): CachedTicket[] => {
  try {
    const raw = sessionStorage.getItem(TICKET_ISSUED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it: any) => ({
        ticketCode: String(it?.ticketCode || ""),
        serviceName:
          typeof it?.serviceName === "string" ? String(it.serviceName) : null,
        serviceId:
          it?.serviceId != null ? Number(it.serviceId) : (null as number | null),
        locationId:
          it?.locationId != null
            ? Number(it.locationId)
            : (null as number | null),
        locationName:
          typeof it?.locationName === "string" ? String(it.locationName) : null,
        useDate: typeof it?.useDate === "string" ? String(it.useDate) : null,
      }))
      .filter((it) => it.ticketCode);
  } catch {
    return [];
  }
};

const parseImages = (images: unknown): string[] => {
  if (Array.isArray(images)) return images.map((x) => String(x));
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {
      // ignore
    }
  }
  return [];
};

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

const buildTicketQrUrl = (ticketCode: string, size = 160) => {
  const safe = encodeURIComponent(String(ticketCode || "").trim());
  if (!safe) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${safe}`;
};

const statusMeta = (status: string) => {
  switch (status) {
    case "pending":
      return {
        label: "Chờ duyệt",
        badge: "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse",
        card: "border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-amber-100/30",
      };
    case "unused":
      return {
        label: "Chưa dùng",
        badge: "bg-emerald-100 text-emerald-700",
        card: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60",
      };
    case "used":
      return {
        label: "Đã dùng",
        badge: "bg-slate-100 text-slate-600",
        card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60",
      };
    case "expired":
      return {
        label: "Hết hạn",
        badge: "bg-rose-100 text-rose-700",
        card: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100/60",
      };
    case "void":
      return {
        label: "Đã hủy",
        badge: "bg-slate-100 text-slate-600",
        card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60",
      };
    default:
      return {
        label: status || "Không rõ",
        badge: "bg-slate-100 text-slate-600",
        card: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60",
      };
  }
};

interface GroupedTickets {
  bookingId: number;
  locationId: number;
  locationName: string;
  useDate: string | null;
  tickets: UserTouristTicketItem[];
}

const PremiumTicketIcon = () => (
  <div className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md overflow-hidden group">
    <div className="absolute inset-1.5 sm:inset-2 border border-dashed border-white/30 rounded-xl" />
    <div className="absolute -left-1.5 sm:-left-2 top-1/2 -translate-y-1/2 w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-white shadow-inner" />
    <div className="absolute -right-1.5 sm:-right-2 top-1/2 -translate-y-1/2 w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-white shadow-inner" />
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-sm transform group-hover:scale-110 transition-transform duration-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v14" />
      <path d="M9 9h.01" />
      <path d="M9 13h.01" />
      <path d="M9 17h.01" />
    </svg>
  </div>
);

const getGroupStatus = (groupTickets: UserTouristTicketItem[]) => {
  const total = groupTickets.length;
  const pending = groupTickets.filter((t) => String(t.status) === "pending").length;
  const unused = groupTickets.filter((t) => String(t.status) === "unused").length;
  const used = groupTickets.filter((t) => String(t.status) === "used").length;
  const expired = groupTickets.filter((t) => String(t.status) === "expired").length;
  const voidCount = groupTickets.filter((t) => String(t.status) === "void").length;

  if (pending > 0) {
    return {
      label: "Chờ duyệt",
      badge: "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse",
      isUsedUp: false,
      isPending: true,
    };
  } else if (unused === total) {
    return {
      label: "Chưa dùng",
      badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      isUsedUp: false,
    };
  } else if (used === total) {
    return {
      label: "Đã dùng hết",
      badge: "bg-slate-100 text-slate-500 border border-slate-200",
      isUsedUp: true,
    };
  } else if (used > 0) {
    return {
      label: `Đã dùng ${used}/${total} vé`,
      badge: "bg-amber-100 text-amber-700 border border-amber-200",
      isUsedUp: false,
    };
  } else if (expired === total) {
    return {
      label: "Hết hạn",
      badge: "bg-rose-100 text-rose-700 border border-rose-200",
      isUsedUp: true,
    };
  } else if (voidCount === total) {
    return {
      label: "Đã hủy",
      badge: "bg-slate-100 text-slate-400 border border-slate-200",
      isUsedUp: true,
    };
  } else {
    return {
      label: `Đã dùng ${used}/${total}`,
      badge: "bg-slate-100 text-slate-500 border border-slate-200",
      isUsedUp: used === total,
    };
  }
};

const TicketCart = ({ isEmbedded }: { isEmbedded?: boolean }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<UserTouristTicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancelBooking = async (bookingId: number) => {
    Modal.confirm({
      title: <div className="text-lg font-bold text-slate-800">Xác nhận hủy đặt vé?</div>,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-rose-500 mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      content: (
        <div className="space-y-3 text-sm text-slate-600 mt-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
          <p className="font-semibold text-rose-600 leading-relaxed">
            Lưu ý: Hủy vé có thể không được hoàn trả tiền cọc tùy theo chính sách.
          </p>
          <p className="font-medium text-slate-700">Bạn có chắc chắn muốn hủy đơn đặt vé này không?</p>
        </div>
      ),
      okText: "Đồng ý hủy",
      okButtonProps: { danger: true, className: "font-semibold rounded-lg px-5 shadow-sm" },
      cancelButtonProps: { className: "font-semibold rounded-lg px-5 border-slate-300 text-slate-600" },
      cancelText: "Không, quay lại",
      centered: true,
      onOk: async () => {
        setCancellingId(bookingId);
        try {
          const res = await bookingApi.cancelMyBooking(bookingId);
          if (res.success) {
            Modal.success({
              title: "Hủy đặt vé thành công!",
              content: "Vé của bạn đã được hủy bỏ.",
              centered: true,
            });
            void loadTickets();
          } else {
            message.error(res.message || "Hủy đặt vé thất bại.");
          }
        } catch (err: any) {
          console.error("Lỗi khi hủy đặt vé:", err);
          message.error(err?.response?.data?.message || err?.message || "Không thể hủy vé.");
        } finally {
          setCancellingId(null);
        }
      }
    });
  };

  const locationIdNum = useMemo(() => {
    const raw = Number(searchParams.get("locationId"));
    return Number.isFinite(raw) ? raw : null;
  }, [searchParams]);

  const loadTickets = useCallback(async () => {
    try {
      const res = await userApi.getTouristTickets(
        locationIdNum ? { location_id: locationIdNum } : undefined,
      );
      if (res?.success) {
        setTickets(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // silent fail
    }
  }, [locationIdNum]);

  useTouristTicketSync({
    locationId: locationIdNum,
    onSync: () => {
      void loadTickets();
    },
  });

  useEffect(() => {
    const cached = readCachedTickets();
    if (!cached.length) return;

    const mapped: UserTouristTicketItem[] = cached
      .filter((t) =>
        locationIdNum ? Number(t.locationId) === Number(locationIdNum) : true,
      )
      .map((t, idx) => ({
        ticket_id: -(idx + 1),
        ticket_code: t.ticketCode,
        status: "unused",
        issued_at: null,
        used_at: null,
        service_id: Number(t.serviceId || 0),
        service_name: t.serviceName ?? null,
        service_images: null,
        booking_id: 0,
        use_date: t.useDate ?? null,
        location_id: Number(t.locationId || 0),
        location_name: t.locationName ?? null,
        payment_status: "completed",
      }));

    if (mapped.length) setTickets(mapped);
  }, [locationIdNum]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadTickets();
        sessionStorage.removeItem(TICKET_ISSUED_STORAGE_KEY);
      } catch (e: any) {
        setError(e?.message || "Không thể tải vé đã mua");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [locationIdNum, loadTickets]);

  const locationName = useMemo(() => {
    const first = tickets.find((t) => t.location_name || t.location_id);
    return first?.location_name || null;
  }, [tickets]);

  const groupedTickets = useMemo(() => {
    const groups: Record<string, GroupedTickets> = {};

    tickets.forEach((t) => {
      const key = t.booking_id && t.booking_id > 0 ? `booking_${t.booking_id}` : `ticket_${t.ticket_id}`;
      if (!groups[key]) {
        groups[key] = {
          bookingId: t.booking_id || 0,
          locationId: t.location_id,
          locationName: t.location_name || "",
          useDate: t.use_date,
          tickets: [],
        };
      }
      groups[key].tickets.push(t);
    });

    return Object.values(groups).sort((a, b) => {
      return b.bookingId - a.bookingId;
    });
  }, [tickets]);

  const content = (
      <section className="relative overflow-hidden user-section p-6 sm:p-8">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-100/50 blur-2xl" />
        <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-slate-100/60 blur-2xl" />

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              Vé đã mua
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900 font-heading">
              {locationName ? `Địa điểm: ${locationName}` : "Danh sách vé"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Chỉ hiển thị vé đã thanh toán.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-gray-500">Đang tải vé...</div>
        ) : tickets.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white px-4 py-6 text-sm text-gray-500">
            Chưa có vé đã thanh toán cho địa điểm này.
          </div>
        ) : (
          <div className="mt-6 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {groupedTickets.map((group) => {
              const groupKey = group.bookingId > 0 ? `booking_${group.bookingId}` : `ticket_${group.tickets[0].ticket_id}`;
              
              if (group.tickets.length === 1) {
                // Render as a single ticket card!
                const ticket = group.tickets[0];
                const { label, badge, card } = statusMeta(
                  String(ticket.status || ""),
                );
                const imgs = parseImages(ticket.service_images);
                const imgUrl = imgs[0] ? resolveBackendUrl(imgs[0]) : "";
                const useDateLabel = ticket.use_date
                  ? formatDisplayDateTime(ticket.use_date)
                  : "-";
                const priceLabel = Number.isFinite(Number(ticket.service_price))
                  ? formatMoney(Number(ticket.service_price))
                  : "-";
                return (
                  <div
                    key={String(ticket.ticket_id)}
                    className={`group relative overflow-hidden rounded-[24px] border p-0 shadow-sm transition-all duration-300 w-full ${card}`}
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-200" />
                    <div className="absolute -right-8 -top-10 h-20 w-20 rounded-full bg-white/70 blur-2xl" />

                    <div className="flex flex-col sm:flex-row items-stretch min-h-[140px]">
                      
                      {/* Left/Top: 1 ảnh to bên trái & Details */}
                      <div className="flex-1 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 sm:gap-6 items-center">
                      
                      {/* Left: 1 ảnh to bên trái */}
                      <div className="flex justify-center sm:justify-start">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={ticket.service_name || "Ticket"}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-100 shadow-sm"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-medium border border-slate-100">
                            Ảnh vé
                          </div>
                        )}
                      </div>

                      {/* Center: Loại vé, Ngày sử dụng, Giá vé, Mã vé */}
                      <div className="space-y-2 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                          <span className="text-[17px] font-extrabold text-slate-800 font-heading tracking-tight">
                            {ticket.service_name || "Vé du lịch"}
                          </span>
                          {ticket.booking_id > 0 && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full animate-pulse-none">
                            {ticket.invoice_code ? `Hóa đơn: ${ticket.invoice_code}` : `Đơn hàng #DL-${ticket.booking_id}`}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm font-bold text-emerald-800">
                          {ticket.location_name || ""}
                        </div>

                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                            <span className="text-slate-400">📅 Ngày sử dụng:</span>
                            <span className="font-bold text-slate-800">{useDateLabel}</span>
                          </div>
                          <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                            <span className="text-slate-400">💵 Giá vé:</span>
                            <span className="font-bold text-emerald-700">{priceLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 flex-wrap justify-center sm:justify-start">
                            {ticket.invoice_code && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3.5 py-1 rounded-xl font-mono text-[13.5px] font-bold shadow-sm">
                                Hóa đơn: {ticket.invoice_code}
                              </span>
                            )}
                            {ticket.booking_id > 0 && ticket.status === "pending" && (
                              <button
                                type="button"
                                disabled={cancellingId === ticket.booking_id}
                                onClick={() => void handleCancelBooking(ticket.booking_id)}
                                className="inline-flex items-center rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold px-3 py-1 shadow-sm transition-all ml-2"
                              >
                                {cancellingId === ticket.booking_id && (
                                  <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-1.5" />
                                )}
                                Hủy vé
                              </button>
                            )}

                          </div>
                        </div>
                      </div>
                      </div>
                      
                      {/* Right/Bottom: Trạng thái vé & Mã QR (Tear-off) */}
                      <div className="relative flex flex-col items-center justify-center p-5 sm:p-6 sm:w-[150px] bg-slate-50/50 border-t-2 sm:border-t-0 sm:border-l-2 border-slate-200 border-dashed">
                        {/* Perforated holes */}
                        <div className="hidden sm:block absolute -top-3 -left-3 w-6 h-6 rounded-full bg-white border border-slate-200" />
                        <div className="hidden sm:block absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-white border border-slate-200" />
                        <div className="block sm:hidden absolute -top-3 -left-3 w-6 h-6 rounded-full bg-white border border-slate-200" />
                        <div className="block sm:hidden absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white border border-slate-200" />
                        {ticket.status === "pending" ? (
                          <div className="relative p-1 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center overflow-hidden">
                            <img
                              src={buildTicketQrUrl(ticket.ticket_code, 120)}
                              alt="QR vé chờ duyệt"
                              className="w-28 h-28 opacity-10 blur-[2.5px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] p-1 text-center">
                              <span className="text-[9px] font-extrabold text-amber-700 leading-tight uppercase bg-amber-50 border border-amber-100/50 rounded-md px-1.5 py-0.5 animate-pulse">
                                Chờ duyệt
                              </span>
                            </div>
                          </div>
                        ) : ticket.status === "unused" ? (
                          <div className="p-1 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center">
                            <img
                              src={buildTicketQrUrl(ticket.ticket_code, 120)}
                              alt="QR vé"
                              className="w-28 h-28"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="relative p-1 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center overflow-hidden opacity-60">
                            <img
                              src={buildTicketQrUrl(ticket.ticket_code, 120)}
                              alt="QR vé"
                              className="w-28 h-28 opacity-30 blur-[2px] select-none pointer-events-none"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <span className={`mt-3 rounded-full px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge}`}>
                          {label}
                        </span>
                      </div>

                    </div>
                  </div>
                );
              }

              // Render Grouped Tickets
              const isExpanded = !!expandedGroups[groupKey];
              const { label: groupLabel, badge: groupBadge, isUsedUp } = getGroupStatus(group.tickets);
              
              // Group tickets by service_name
              const counts: Record<string, { count: number; price: number; img: string }> = {};
              group.tickets.forEach((t) => {
                const name = t.service_name || "Vé du lịch";
                const childImgs = parseImages(t.service_images);
                const childImgUrl = childImgs[0] ? (resolveBackendUrl(childImgs[0]) || "") : "";
                if (!counts[name]) {
                  counts[name] = { count: 0, price: Number(t.service_price || 0), img: childImgUrl };
                }
                counts[name].count += 1;
              });
              const ticketBreakdown = Object.entries(counts);

              const useDateLabel = group.useDate
                ? formatDisplayDateTime(group.useDate)
                : "-";

              const cardBgStyle = isUsedUp
                ? "border-slate-200 bg-slate-50/70 opacity-75 animate-pulse-none"
                : "border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 hover:shadow-md";

              return (
                <div
                  key={groupKey}
                  className={`col-span-1 lg:col-span-2 group relative overflow-hidden rounded-[24px] border p-5 sm:p-6 shadow-sm transition-all duration-300 w-full ${cardBgStyle}`}
                >
                  <style>{`
                    @keyframes slideDown {
                      from { opacity: 0; transform: translateY(-10px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-slideDown {
                      animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                    }
                  `}</style>
                  
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300" />
                  <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-50/30 blur-2xl" />

                  <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-5 sm:gap-6 items-center">
                    
                    {/* Left: Illustration */}
                    <div className="flex justify-center md:justify-start">
                      <PremiumTicketIcon />
                    </div>

                    {/* Middle: Details */}
                    <div className="space-y-2 text-center md:text-left flex-1 border-r-0 md:border-r-2 border-slate-200 border-dashed pr-0 md:pr-4">
                      <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                        <span className="text-lg font-extrabold text-slate-800 tracking-tight font-heading">
                          {group.tickets[0]?.invoice_code ? `Hóa đơn: ${group.tickets[0].invoice_code}` : `Mã đặt chỗ: #DL-${group.bookingId}`}
                        </span>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${groupBadge}`}>
                          {groupLabel}
                        </span>
                        {group.tickets[0]?.status === "pending" && (
                          <button
                            type="button"
                            disabled={cancellingId === group.bookingId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCancelBooking(group.bookingId);
                            }}
                            className="inline-flex items-center rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold px-3 py-1 shadow-sm transition-all ml-2"
                          >
                            {cancellingId === group.bookingId && (
                              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mr-1.5" />
                            )}
                            Hủy đơn
                          </button>
                        )}
                      </div>
                      
                      <div className="text-base font-bold text-emerald-800">
                        {group.locationName}
                      </div>

                      <div className="flex items-center justify-center md:justify-start gap-1.5 text-sm text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>Ngày sử dụng: <span className="font-semibold text-slate-800">{useDateLabel}</span></span>
                      </div>

                      <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                        {ticketBreakdown.map(([name, item]) => (
                          <div
                            key={name}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white shadow-sm px-3 py-1 text-xs text-slate-700"
                          >
                            <span className="font-bold text-emerald-700">🎫 {item.count}x</span>
                            <span className="font-semibold">{name}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-[11px] text-slate-500">{formatMoney(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Group QR Code */}
                    <div className="flex flex-col items-center justify-center md:pl-4">
                      {group.tickets[0]?.status === "pending" ? (
                        <div className="relative p-2.5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1 overflow-hidden select-none pointer-events-none">
                          <img
                            src={buildTicketQrUrl(`SB-${group.bookingId}-GROUP`, 130)}
                            alt="QR Nhóm chờ duyệt"
                            className="w-24 h-24 opacity-20 blur-[3px]"
                            loading="lazy"
                          />
                          <span className="text-[9px] font-extrabold text-amber-700 leading-none uppercase bg-amber-50 border border-amber-100/50 rounded-md px-1.5 py-0.5 mt-1 animate-pulse">
                            Vé chờ duyệt
                          </span>
                        </div>
                      ) : isUsedUp ? (
                        <div className="w-28 h-28 rounded-2xl bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-wider gap-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-[11px] font-extrabold tracking-wide">ĐÃ SỬ DỤNG</span>
                          <span className="text-[11.5px] font-mono text-slate-500 font-bold mt-1">
                            SB-{group.bookingId}-GROUP
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow transition-shadow flex flex-col items-center justify-center gap-1">
                          <img
                            src={buildTicketQrUrl(`SB-${group.bookingId}-GROUP`, 130)}
                            alt="QR Nhóm"
                            className="w-24 h-24"
                            loading="lazy"
                          />
                          <span className="text-[9px] font-extrabold text-emerald-800 tracking-wider uppercase text-center leading-none">
                            QUÉT 1 LẦN CẢ NHÓM
                          </span>
                          <span className="text-[12px] font-mono text-slate-600 font-extrabold bg-slate-50 border border-slate-200/80 rounded px-2 py-0.5 mt-1 select-all">
                            SB-{group.bookingId}-GROUP
                          </span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Toggle button */}
                  <button
                    type="button"
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl transition-all border border-emerald-100/60"
                  >
                    <span>{isExpanded ? "Ẩn danh sách vé chi tiết" : `Xem chi tiết từng vé (${group.tickets.length} vé)`}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-4 h-4 transform transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {/* Collapsible Details */}
                  {isExpanded && (
                    <div className="mt-4 p-5 rounded-[24px] bg-slate-50/60 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-5 animate-slideDown shadow-inner">
                      {group.tickets.map((ticket) => {
                        const childStatus = statusMeta(String(ticket.status || ""));
                        const useDate = ticket.use_date ? formatDisplayDateTime(ticket.use_date) : "-";
                        const price = Number.isFinite(Number(ticket.service_price)) ? formatMoney(Number(ticket.service_price)) : "-";
                        const childImgs = parseImages(ticket.service_images);
                        const childImgUrl = childImgs[0] ? resolveBackendUrl(childImgs[0]) : "";
                        const isChildUsed = ticket.status !== "unused" && ticket.status !== "pending";

                        return (
                          <div
                            key={ticket.ticket_id}
                            className={`group/child relative flex flex-col sm:flex-row items-stretch rounded-[20px] border bg-white shadow-sm transition-all hover:shadow-md overflow-hidden ${childStatus.card}`}
                          >
                            {/* Left/Top: Image and Info */}
                            <div className="flex-1 flex p-4 gap-4 items-center">
                              {/* Image */}
                              <div className="shrink-0 relative">
                                {childImgUrl ? (
                                  <img
                                    src={childImgUrl}
                                    alt={ticket.service_name || "Vé"}
                                    className="w-16 h-16 rounded-[14px] object-cover border border-slate-100 shadow-sm"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-[14px] bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm opacity-50 overflow-hidden transform scale-[0.6]">
                                    <PremiumTicketIcon />
                                  </div>
                                )}
                                {isChildUsed && (
                                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] rounded-[14px]" />
                                )}
                              </div>
                              
                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[15px] font-bold text-slate-900 truncate">
                                  {ticket.service_name || "Vé du lịch"}
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-1 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>Ngày: <span className="text-slate-700 font-bold">{useDate}</span></span>
                                    <span>Giá: <span className="text-emerald-700 font-bold">{price}</span></span>
                                  </div>
                                </div>
                                {ticket.invoice_code && (
                                  <div className="mt-1.5">
                                    <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                      Hóa đơn: {ticket.invoice_code}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Right/Bottom: QR and Status (Tear-off) */}
                            <div className="relative flex flex-col items-center justify-center p-4 sm:w-[120px] bg-slate-50/50 border-t-2 sm:border-t-0 sm:border-l-2 border-slate-200 border-dashed">
                              {/* Perforated holes */}
                              <div className="hidden sm:block absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-white border border-slate-200" />
                              <div className="hidden sm:block absolute -bottom-2.5 -left-2.5 w-5 h-5 rounded-full bg-white border border-slate-200" />
                              <div className="block sm:hidden absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-white border border-slate-200" />
                              <div className="block sm:hidden absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-white border border-slate-200" />
                              
                              {ticket.status === "unused" ? (
                                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                                  <img
                                    src={buildTicketQrUrl(ticket.ticket_code, 70)}
                                    alt="QR"
                                    className="w-12 h-12"
                                  />
                                </div>
                              ) : (
                                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 opacity-40">
                                  <img
                                    src={buildTicketQrUrl(ticket.ticket_code, 70)}
                                    alt="QR"
                                    className="w-12 h-12 select-none pointer-events-none"
                                  />
                                </div>
                              )}
                              
                              <div className="mt-2 text-center w-full">
                                <span className="text-[10px] text-slate-500 font-mono font-bold block truncate" title={ticket.ticket_code}>
                                  {ticket.ticket_code}
                                </span>
                              </div>
                              <span className={`mt-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${childStatus.badge}`}>
                                {childStatus.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
    <UserLayout title="Giỏ vé" activeKey="/user/tickets">
      {content}
    </UserLayout>
  );
};

export default TicketCart;
