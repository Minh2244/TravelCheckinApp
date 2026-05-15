import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatMoney } from "../../utils/formatMoney";
import type { UserTouristTicketItem } from "../../types/user.types";

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

const TicketCart = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<UserTouristTicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationIdNum = useMemo(() => {
    const raw = Number(searchParams.get("locationId"));
    return Number.isFinite(raw) ? raw : null;
  }, [searchParams]);

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
        const res = await userApi.getTouristTickets(
          locationIdNum ? { location_id: locationIdNum } : undefined,
        );
        if (!res?.success) {
          setError(res?.message || "Không thể tải vé đã mua");
          return;
        }
        setTickets(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        setError(e?.message || "Không thể tải vé đã mua");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [locationIdNum]);

  const locationName = useMemo(() => {
    const first = tickets.find((t) => t.location_name || t.location_id);
    return first?.location_name || null;
  }, [tickets]);

  return (
    <UserLayout title="Giỏ vé" subtitle="Giỏ vé" activeKey="/user/tickets">
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-100/50 blur-2xl" />
        <div className="absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-slate-100/60 blur-2xl" />

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              Vé đã mua
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900">
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
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
            Chưa có vé đã thanh toán cho địa điểm này.
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-emerald-100 bg-white/80 p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {tickets.map((ticket) => {
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
                  className={`group relative overflow-hidden rounded-[20px] border p-3 shadow-sm ${card}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-200" />
                  <div className="absolute -right-8 -top-10 h-20 w-20 rounded-full bg-white/70 blur-2xl" />

                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-base font-semibold text-emerald-800">
                        {ticket.service_name || "Vé du lịch"}
                      </div>
                      <div className="mt-1 text-sm text-emerald-700">
                        {ticket.location_name || ""}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-emerald-100 bg-white/70 p-2.5 flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={ticket.service_name || "Ticket"}
                            className="h-20 w-20 rounded-xl object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-xl bg-white flex items-center justify-center text-xs text-gray-400">
                            Ảnh vé
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Ngày sử dụng
                        </div>
                        <div className="mt-2 text-base font-semibold text-gray-900">
                          {useDateLabel}
                        </div>
                        <div className="mt-1 text-sm text-emerald-700">
                          Giá vé: {priceLabel}
                        </div>
                      </div>
                      <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-3">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span className="uppercase tracking-wide">Mã vé</span>
                          <span className="text-xs text-slate-400">:</span>
                          <span className="text-sm font-mono text-gray-900 break-all">
                            {ticket.ticket_code}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-2.5 flex items-center justify-center">
                      <img
                        src={buildTicketQrUrl(ticket.ticket_code, 120)}
                        alt="QR vé"
                        className="h-24 w-24"
                        loading="lazy"
                      />
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
};

export default TicketCart;
