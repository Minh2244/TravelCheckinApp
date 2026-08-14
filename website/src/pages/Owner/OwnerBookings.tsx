import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  WalletOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { getErrorMessage } from "../../utils/safe";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

type BookingNextStatus = "confirmed" | "completed" | "cancelled";

type OwnerLocationOption = {
  location_id: number;
  location_name: string;
};

type BookingDetailItem = {
  kind: "table" | "room" | "ticket" | "menu" | "service";
  name: string;
  quantity: number;
};

type BookingFoodItem = {
  service_name: string;
  quantity: number;
};

type BookingRow = {
  booking_id: number;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  location_type?: string | null;
  service_name?: string | null;
  service_type?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  total_amount?: number | string | null;
  discount_amount?: number | string | null;
  final_amount?: number | string | null;
  voucher_code?: string | null;
  total_completed_paid_amount?: number | string | null;
  status: BookingStatus | string;
  notes?: string | null;
  latest_payment_id?: number | null;
  latest_payment_status?: string | null;
  latest_payment_amount?: number | string | null;
  can_confirm?: boolean;
  can_complete?: boolean;
  can_cancel?: boolean;
  can_create_payment?: boolean;
  action_warning?: string | null;
  quantity?: number | null;
  table_names?: string[] | null;
  room_names?: string[] | null;
  detail_items?: BookingDetailItem[] | null;
};

const formatDisplayDateTime = (value: string | null | undefined): string => {
  if (!value) return "";
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return String(value);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

const bookingStatusLabel = (value: string): string => {
  const status = String(value || "").toLowerCase();
  if (status === "pending") return "Chờ xác nhận";
  if (status === "confirmed") return "Đã xác nhận";
  if (status === "completed") return "Hoàn tất";
  if (status === "cancelled") return "Đã hủy";
  return String(value || "-");
};

const isTravelBooking = (row: BookingRow): boolean => {
  const locationType = String(row.location_type || "").toLowerCase();
  const serviceType = String(row.service_type || "").toLowerCase();

  return (
    serviceType === "ticket" ||
    serviceType === "tour" ||
    locationType === "tourist"
  );
};

const isFoodOrHotelBooking = (row: BookingRow): boolean => {
  const locationType = String(row.location_type || "").toLowerCase();
  const serviceType = String(row.service_type || "").toLowerCase();
  return (
    serviceType === "table" ||
    serviceType === "room" ||
    locationType === "food" ||
    locationType === "hotel"
  );
};

const normalizeOwnerBookingNotes = (row: BookingRow): string => {
  const raw = String(row.notes || "").trim();
  if (!raw) return "-";

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const systemLine = (l: string) => {
    const s = l.toLowerCase();
    return (
      s.startsWith("[system]") ||
      s.startsWith("system") ||
      s.includes("auto-cancel") ||
      s.includes("ticket expired")
    );
  };

  const userLines = lines.filter((l) => !systemLine(l));
  const hasSystem = lines.some(systemLine);

  if (userLines.length > 0) return userLines.join("; ");
  if (!hasSystem) return raw;

  if (isTravelBooking(row)) return "vé quá hạn";
  if (isFoodOrHotelBooking(row)) return "trễ hơn 1 tiếng";
  return raw;
};

const formatBookingDetailLine = (item: BookingDetailItem): string => {
  const qty = Math.max(1, Number(item.quantity || 1));
  return `${item.name} x${qty}`;
};

const stripDuplicatedPrefix = (
  label: "Bàn" | "Món" | "Phòng" | "Vé",
  rawName: string,
): string => {
  const name = String(rawName || "").trim();
  if (!name) return name;
  if (label === "Bàn") return name.replace(/^bàn\s*/i, "").trim() || name;
  if (label === "Phòng") return name.replace(/^phòng\s*/i, "").trim() || name;
  if (label === "Vé") return name.replace(/^vé\s*/i, "").trim() || name;
  return name;
};

const getDetailItemsForDisplay = (row: BookingRow): BookingDetailItem[] => {
  if (Array.isArray(row.detail_items) && row.detail_items.length > 0) {
    return row.detail_items
      .map((item) => ({
        kind: item.kind,
        name: String(item.name || "").trim(),
        quantity: Number(item.quantity || 1),
      }))
      .filter((item) => Boolean(item.name));
  }

  return [
    {
      kind: "service",
      name: String(row.service_name || "Dịch vụ"),
      quantity: Math.max(1, Number(row.quantity || 1)),
    },
  ];
};

const getGroupedDetailLines = (
  row: BookingRow,
  externalFoodItems: BookingFoodItem[] = [],
): Array<{ label: "Bàn" | "Món" | "Phòng" | "Vé"; value: string }> => {
  const details = getDetailItemsForDisplay(row);
  const byLabel = new Map<
    "Bàn" | "Món" | "Phòng" | "Vé",
    Array<{ name: string; quantity: number }>
  >();

  const push = (
    label: "Bàn" | "Món" | "Phòng" | "Vé",
    value: { name: string; quantity: number },
  ) => {
    const cur = byLabel.get(label) || [];
    cur.push(value);
    byLabel.set(label, cur);
  };

  for (const item of details) {
    const normalizedItem = {
      name: String(item.name || "").trim(),
      quantity: Math.max(1, Number(item.quantity || 1)),
    };

    if (item.kind === "table") push("Bàn", normalizedItem);
    else if (item.kind === "menu") push("Món", normalizedItem);
    else if (item.kind === "room") push("Phòng", normalizedItem);
    else if (item.kind === "ticket") push("Vé", normalizedItem);
    else {
      const serviceType = String(row.service_type || "").toLowerCase();
      const locationType = String(row.location_type || "").toLowerCase();
      if (serviceType === "table" || locationType === "food")
        push("Bàn", normalizedItem);
      else if (serviceType === "room" || locationType === "hotel")
        push("Phòng", normalizedItem);
      else if (
        serviceType === "ticket" ||
        serviceType === "tour" ||
        locationType === "tourist"
      )
        push("Vé", normalizedItem);
      else push("Món", normalizedItem);
    }
  }

  for (const item of externalFoodItems) {
    const name = String(item.service_name || "").trim();
    const quantity = Math.max(1, Number(item.quantity || 1));
    if (!name) continue;
    push("Món", { name, quantity });
  }

  const order: Array<"Bàn" | "Món" | "Phòng" | "Vé"> = [
    "Bàn",
    "Món",
    "Phòng",
    "Vé",
  ];

  return order
    .map((label) => {
      const values = byLabel.get(label) || [];
      if (values.length === 0) return null;
      const text = values
        .map((item) => {
          const name = stripDuplicatedPrefix(label, item.name);
          return `${name} x${item.quantity}`;
        })
        .join(", ");
      return { label, value: text };
    })
    .filter(Boolean) as Array<{
    label: "Bàn" | "Món" | "Phòng" | "Vé";
    value: string;
  }>;
};

const OwnerBookings = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BookingRow[]>([]);
  const [activeBooking, setActiveBooking] = useState<BookingRow | null>(null);
  const [cancelBooking, setCancelBooking] = useState<BookingRow | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [foodItemsByBookingId, setFoodItemsByBookingId] = useState<
    Record<number, BookingFoodItem[]>
  >({});

  const [statusFilter, setStatusFilter] = useState<
    "confirmed" | "cancelled" | "all" | undefined
  >("all");
  const [locations, setLocations] = useState<OwnerLocationOption[]>([]);
  const [locationFilter, setLocationFilter] = useState<number | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { location_id?: number } = {};
      if (locationFilter !== "all") {
        params.location_id = locationFilter;
      }
      const res = await ownerApi.getBookings(params);
      setItems((res?.data || []) as BookingRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải bookings"));
    } finally {
      setLoading(false);
    }
  }, [locationFilter]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await ownerApi.getLocations();
        setLocations((res?.data || []) as OwnerLocationOption[]);
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    };
    void fetchLocations();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeBooking) return;
    const refreshed = items.find(
      (it) => it.booking_id === activeBooking.booking_id,
    );
    if (refreshed) setActiveBooking(refreshed);
  }, [activeBooking, items]);

  useEffect(() => {
    const bookingId = activeBooking?.booking_id;
    if (!bookingId) return;
    const serviceType = String(activeBooking?.service_type || "").toLowerCase();
    const locationType = String(
      activeBooking?.location_type || "",
    ).toLowerCase();
    const isFoodLike = serviceType === "table" || locationType === "food";
    if (!isFoodLike || foodItemsByBookingId[bookingId]) return;

    let mounted = true;
    void ownerApi
      .getBookingFoodItems(bookingId)
      .then((res) => {
        if (!mounted) return;
        const data = Array.isArray(res?.data)
          ? (res.data as BookingFoodItem[])
          : [];
        setFoodItemsByBookingId((prev) => ({ ...prev, [bookingId]: data }));
      })
      .catch(() => {
        if (!mounted) return;
        setFoodItemsByBookingId((prev) => ({ ...prev, [bookingId]: [] }));
      });

    return () => {
      mounted = false;
    };
  }, [activeBooking, foodItemsByBookingId]);

  const statusTag = (s: string) => {
    const color =
      s === "pending"
        ? "orange"
        : s === "confirmed"
          ? "blue"
          : s === "completed"
            ? "green"
            : "red";
    return <Tag color={color}>{bookingStatusLabel(s)}</Tag>;
  };

  const setStatus = useCallback(
    async (
      bookingId: number,
      status: BookingNextStatus,
      notes?: string,
    ): Promise<boolean> => {
      try {
        setSubmitting(true);
        await ownerApi.updateBookingStatus(bookingId, {
          status,
          notes: notes ?? null,
        });
        message.success("Đã cập nhật booking");
        await load();
        return true;
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi cập nhật booking"));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [load],
  );

  const closeCancelModal = () => {
    setCancelModalOpen(false);
    setCancelBooking(null);
    setCancelReason("");
  };

  const openCancelModal = (row: BookingRow) => {
    setCancelBooking(row);
    setCancelModalOpen(true);
  };

  const submitCancel = async () => {
    const bookingId = cancelBooking?.booking_id;
    if (!bookingId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      message.warning("Vui lòng nhập lý do hủy booking");
      return;
    }
    const ok = await setStatus(bookingId, "cancelled", reason);
    if (ok) closeCancelModal();
  };

  const columns: ColumnsType<BookingRow> = [
    {
      title: "Số thứ tự",
      width: 60,
      align: "center",
      render: (_: unknown, __: BookingRow, index: number) => filteredItems.length - index,
    },
    {
      title: "Khách hàng / Liên hệ",
      width: 220,
      render: (_: unknown, row: BookingRow) => {
        const name = row.user_name || "-";
        const email = String(row.contact_email || row.user_email || "").trim();
        const phone = String(row.contact_phone || row.user_phone || "").trim();
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, color: "#1f2937" }}>{name}</span>
            {phone && <span style={{ fontSize: "12px", color: "#4b5563" }}>{phone}</span>}
            {email && (
              <span
                style={{ fontSize: "11px", color: "#9ca3af" }}
                className="truncate block"
                title={email}
              >
                {email}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Địa điểm",
      dataIndex: "location_name",
      width: 130,
      ellipsis: true,
    },
    {
      title: "Dịch vụ",
      width: 180,
      render: (_: unknown, row: BookingRow) => {
        const details = getDetailItemsForDisplay(row);
        const brief = details
          .slice(0, 2)
          .map((item) => formatBookingDetailLine(item))
          .join(", ");
        const more = details.length > 2 ? ` +${details.length - 2}` : "";
        return (
          <div style={{ maxWidth: 164 }}>
            <div
              style={{
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.service_name || "-"}
            >
              {row.service_name || "-"}
            </div>
            <div
              style={{
                color: "#6b7280",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={brief + more}
            >
              {brief || "-"}
              {more}
            </div>
          </div>
        );
      },
    },
    {
      title: "Thời gian",
      width: 150,
      render: (_: unknown, row: BookingRow) => {
        const checkIn = formatDisplayDateTime(row.check_in_date || "");
        const checkOut = formatDisplayDateTime(row.check_out_date || "");
        if (checkIn && checkOut) {
          return (
            <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
              <div>{checkIn}</div>
              <div style={{ color: "#9ca3af", fontSize: "11px" }}>đến {checkOut}</div>
            </div>
          );
        }
        return <div style={{ fontSize: "12px" }}>{checkIn || checkOut || "-"}</div>;
      },
    },
    {
      title: "Thanh toán",
      width: 140,
      render: (_: unknown, row: BookingRow) => {
        const finalAmount = Number(row.final_amount || 0);
        const paidAmount = Number(row.total_completed_paid_amount || 0);
        const isPaid = paidAmount >= finalAmount && finalAmount > 0;

        const s = String(row.latest_payment_status || "");
        let tagColor = "default";
        let tagText = "Chưa thanh toán";

        if (row.latest_payment_id) {
          if (s === "completed") {
            tagColor = "green";
            tagText = "Đã thanh toán";
          } else if (s === "pending") {
            tagColor = "orange";
            tagText = "Chờ thanh toán";
          } else {
            tagColor = "red";
            tagText = "Lỗi/Đã hủy";
          }
        }

        if (isPaid) {
          tagColor = "green";
          tagText = "Đã thanh toán";
        }

        const hasDiscount = Number(row.discount_amount || 0) > 0;

        const extraAmount = paidAmount > finalAmount ? paidAmount - finalAmount : 0;
        const displayAmount = finalAmount + extraAmount;

        return (
          <div className="flex flex-col gap-1">
            <div className="font-semibold text-slate-800">
              {formatMoney(displayAmount)}
              {hasDiscount && (
                <Tag color="magenta" className="text-[10px] px-1 ml-1 border-0">
                  VC
                </Tag>
              )}
            </div>
            <div>
              <Tag color={tagColor} className="text-[11px] m-0">
                {tagText}
              </Tag>
            </div>
            <div className="text-[11px] font-medium text-emerald-600 mt-0.5">
              Đã trả: {formatMoney(paidAmount)}
            </div>
          </div>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 100,
      align: "center",
      render: (s: string) => statusTag(s),
    },
    {
      title: "Hành động",
      width: 180,
      align: "center",
      render: (_: unknown, row: BookingRow) => {
        const isConfirmEnabled = row.can_confirm && !submitting;
        const isCancelEnabled = row.can_cancel && !submitting;
        return (
          <Space size="small">
            <Button
              size="small"
              shape="round"
              style={{
                color: "#4f46e5",
                borderColor: "#c7d2fe",
                backgroundColor: "#f5f3ff",
                fontWeight: 600,
              }}
              onClick={() => setActiveBooking(row)}
            >
              Chi tiết
            </Button>
            <Button
              size="small"
              shape="round"
              style={
                isConfirmEnabled
                  ? {
                      color: "#2563eb",
                      borderColor: "#bfdbfe",
                      backgroundColor: "#eff6ff",
                      fontWeight: 600,
                    }
                  : { fontWeight: 600 }
              }
              onClick={() => setStatus(row.booking_id, "confirmed")}
              disabled={!row.can_confirm || submitting}
            >
              Duyệt
            </Button>
            <Button
              size="small"
              shape="round"
              style={
                isCancelEnabled
                  ? {
                      color: "#dc2626",
                      borderColor: "#fecaca",
                      backgroundColor: "#fef2f2",
                      fontWeight: 600,
                    }
                  : { fontWeight: 600 }
              }
              onClick={() => openCancelModal(row)}
              disabled={!row.can_cancel || submitting}
            >
              Hủy
            </Button>
          </Space>
        );
      },
    },
  ];

  void columns;

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (
        statusFilter &&
        statusFilter !== "all" &&
        String(row.status).toLowerCase() !== statusFilter
      ) {
        return false;
      }

      if (
        locationFilter &&
        locationFilter !== "all" &&
        row.location_id !== locationFilter
      ) {
        return false;
      }

      return true;
    });
  }, [items, statusFilter, locationFilter]);

  return (
    <MainLayout>
      <Card
        title={
          <Space wrap size="middle" align="center">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-extrabold text-xl">
              Quản lí đặt chỗ
            </span>
            <Select
              allowClear={false}
              placeholder="Trạng thái"
              style={{ width: 170 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { value: "all", label: "Tất cả" },
                { value: "confirmed", label: "Đã xác nhận" },
                { value: "cancelled", label: "Đã hủy" },
              ]}
            />
            <Select
              placeholder="Chọn địa điểm"
              style={{ width: 220 }}
              value={locationFilter}
              onChange={(v) => setLocationFilter(v)}
              options={[
                { value: "all", label: "Tất cả địa điểm" },
                ...locations.map((loc) => ({
                  value: loc.location_id,
                  label: loc.location_name,
                })),
              ]}
            />
          </Space>
        }
      >
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <div className="mb-2 hidden rounded-xl bg-white px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 shadow-sm xl:grid xl:grid-cols-[56px_minmax(170px,0.75fr)_minmax(240px,0.9fr)_minmax(145px,0.55fr)_220px] xl:items-center xl:gap-2">
            <span>STT</span>
            <span>Khách hàng</span>
            <span>Đặt chỗ</span>
            <span>Thanh toán</span>
            <span className="text-center">Hành động</span>
          </div>

          <div className="max-h-[calc(100vh-360px)] min-h-[360px] overflow-y-auto pr-1 sleek-scrollbar">
            {loading ? (
              <div className="flex h-44 items-center justify-center text-sm font-semibold text-slate-400">
                Đang tải danh sách đặt chỗ...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-sm font-semibold text-slate-400">
                Chưa có đặt chỗ phù hợp
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((row, index) => {
                  const details = getDetailItemsForDisplay(row);
                  const brief = details
                    .slice(0, 2)
                    .map((item) => formatBookingDetailLine(item))
                    .join(", ");
                  const more = details.length > 2 ? ` +${details.length - 2}` : "";
                  const finalAmount = Number(row.final_amount || 0);
                  const paidAmount = Number(row.total_completed_paid_amount || 0);
                  const isPaid = paidAmount >= finalAmount && finalAmount > 0;
                  const paymentStatus = String(row.latest_payment_status || "");
                  const paymentText = isPaid || paymentStatus === "completed"
                    ? "Đã thanh toán"
                    : paymentStatus === "pending"
                      ? "Chờ thanh toán"
                      : "Chưa thanh toán";
                  const paymentColor = isPaid || paymentStatus === "completed"
                    ? "green"
                    : paymentStatus === "pending"
                      ? "orange"
                      : row.latest_payment_id
                        ? "red"
                        : "default";
                  const extraAmount = paidAmount > finalAmount ? paidAmount - finalAmount : 0;
                  const displayAmount = finalAmount + extraAmount;
                  const checkIn = formatDisplayDateTime(row.check_in_date || "");
                  const checkOut = formatDisplayDateTime(row.check_out_date || "");
                  const email = String(row.contact_email || row.user_email || "").trim();
                  const phone = String(row.contact_phone || row.user_phone || "").trim();
                  const isConfirmEnabled = row.can_confirm && !submitting;
                  const isCancelEnabled = row.can_cancel && !submitting;

                  return (
                    <div
                      key={row.booking_id}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:border-blue-100 hover:shadow-md xl:grid xl:grid-cols-[56px_minmax(170px,0.75fr)_minmax(240px,0.9fr)_minmax(145px,0.55fr)_220px] xl:items-center xl:gap-2"
                    >
                      <div className="mb-3 flex items-center justify-between xl:mb-0 xl:block">
                        <span className="text-xs font-bold text-slate-400 xl:hidden">STT</span>
                        <span className="text-base font-semibold text-slate-700">
                          {filteredItems.length - index}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{row.user_name || "-"}</div>
                        {phone ? <div className="text-sm text-slate-600">{phone}</div> : null}
                        {email ? (
                          <div className="truncate text-xs text-slate-400" title={email}>
                            {email}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 min-w-0 xl:mt-0">
                        <div className="truncate font-semibold text-slate-800" title={row.location_name || "-"}>
                          {row.location_name || "-"}
                        </div>
                        <div className="truncate text-sm text-slate-500" title={`${row.service_name || "-"} • ${brief}${more}`}>
                          {row.service_name || "-"}
                        </div>
                        <div className="truncate text-xs text-slate-400" title={brief + more}>
                          {brief || "-"}{more}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {checkIn || checkOut || "-"}
                        </div>
                        {checkIn && checkOut ? (
                          <div className="text-xs text-slate-400">đến {checkOut}</div>
                        ) : null}
                      </div>

                      <div className="mt-3 xl:mt-0">
                        <div className="font-bold text-slate-900">{formatMoney(displayAmount)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Tag color={paymentColor} className="m-0 text-[11px]">
                            {paymentText}
                          </Tag>
                          {statusTag(row.status)}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-emerald-600">
                          Đã trả: {formatMoney(paidAmount)}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap justify-start gap-2 xl:mt-0 xl:justify-end">
                        <Button
                          size="small"
                          shape="round"
                          className="font-semibold"
                          style={{
                            color: "#4f46e5",
                            borderColor: "#c7d2fe",
                            backgroundColor: "#f5f3ff",
                          }}
                          onClick={() => setActiveBooking(row)}
                        >
                          Chi tiết
                        </Button>
                        <Button
                          size="small"
                          shape="round"
                          className="font-semibold"
                          style={
                            isConfirmEnabled
                              ? {
                                  color: "#2563eb",
                                  borderColor: "#bfdbfe",
                                  backgroundColor: "#eff6ff",
                                }
                              : undefined
                          }
                          onClick={() => setStatus(row.booking_id, "confirmed")}
                          disabled={!row.can_confirm || submitting}
                        >
                          Duyệt
                        </Button>
                        <Button
                          size="small"
                          shape="round"
                          className="font-semibold"
                          style={
                            isCancelEnabled
                              ? {
                                  color: "#dc2626",
                                  borderColor: "#fecaca",
                                  backgroundColor: "#fef2f2",
                                }
                              : undefined
                          }
                          onClick={() => openCancelModal(row)}
                          disabled={!row.can_cancel || submitting}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Drawer
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingRight: 24 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1f2937" }}>
              Chi tiết Đặt chỗ #{activeBooking?.booking_id}
            </span>
            {activeBooking && statusTag(activeBooking.status)}
          </div>
        }
        open={Boolean(activeBooking)}
        onClose={() => setActiveBooking(null)}
        width={480}
      >
        {activeBooking && (
          <div className="flex flex-col gap-4">
            {/* Card 1: Khách hàng */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <UserOutlined className="text-blue-500 text-base" />
                <span className="font-bold text-slate-700 text-sm">Khách hàng</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Họ tên:</span>
                  <span className="font-semibold text-slate-800">{activeBooking.user_name || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Số điện thoại:</span>
                  <span className="font-semibold text-slate-800">
                    <a href={`tel:${activeBooking.contact_phone || activeBooking.user_phone || ""}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                      {activeBooking.contact_phone || activeBooking.user_phone || "-"}
                    </a>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Email:</span>
                  <span className="font-medium text-slate-800">{activeBooking.contact_email || activeBooking.user_email || "-"}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Dịch vụ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <EnvironmentOutlined className="text-emerald-500 text-base" />
                <span className="font-bold text-slate-700 text-sm">Dịch vụ đặt chỗ</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Địa điểm:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[60%]">{activeBooking.location_name || "-"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Tên dịch vụ:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[60%]">{activeBooking.service_name || "-"}</span>
                </div>
                
                <div className="mt-2">
                  <span className="text-slate-500 text-sm font-medium mb-2 block">Chi tiết đặt:</span>
                  {(() => {
                    const groups = getGroupedDetailLines(
                      activeBooking,
                      foodItemsByBookingId[activeBooking.booking_id] || [],
                    );
                    if (groups.length === 0) return <span className="text-slate-400 font-medium italic text-sm">Không có chi tiết</span>;
                    return (
                      <div className="flex flex-col gap-3">
                        {groups.map((group, index) => {
                          const items = group.value.split(",").map(i => i.trim());
                          return (
                            <div key={`${group.label}-${index}`} className="bg-slate-50 rounded-xl p-3 border border-slate-100/80">
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">{group.label}</div>
                              <div className="flex flex-wrap gap-2">
                                {items.map((item, idx) => (
                                  <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-sm font-medium px-3 py-1 rounded-lg shadow-sm">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Card 3: Thời gian */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 shadow-sm border border-orange-100/50 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-200/50">
                <CalendarOutlined className="text-orange-500 text-base" />
                <span className="font-bold text-orange-900 text-sm">Thời gian</span>
              </div>
              <div className="flex justify-between items-center bg-white/60 rounded-xl p-3 border border-orange-100">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-orange-600/80 uppercase font-bold tracking-wider">Ngày nhận / Vào</span>
                  <span className="font-bold text-slate-800 text-sm">{formatDisplayDateTime(activeBooking.check_in_date || "")}</span>
                </div>
                <div className="text-orange-300 text-lg">➜</div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[10px] text-orange-600/80 uppercase font-bold tracking-wider">Ngày trả / Ra</span>
                  <span className="font-bold text-slate-800 text-sm">{formatDisplayDateTime(activeBooking.check_out_date || "") || "-"}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Thanh toán */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <WalletOutlined className="text-violet-500 text-base" />
                <span className="font-bold text-slate-700 text-sm">Chi tiết thanh toán</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">Tiền dịch vụ gốc:</span>
                  <span className="font-medium text-slate-600">{formatMoney(Number(activeBooking.total_amount || 0))}</span>
                </div>

                {activeBooking.voucher_code && (
                  <div className="flex justify-between items-center bg-pink-50/50 p-2.5 rounded-xl border border-pink-100">
                    <span className="text-pink-600/80 text-sm font-medium">Mã giảm giá (Voucher):</span>
                    <div className="flex items-center gap-2">
                      <Tag color="magenta" className="m-0 font-bold px-2 py-0.5 rounded-md border-pink-200">{activeBooking.voucher_code}</Tag>
                      {Number(activeBooking.discount_amount) > 0 && (
                        <span className="text-pink-600 font-bold text-sm">
                          -{formatMoney(Number(activeBooking.discount_amount))}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(() => {
                  const finalAmount = Number(activeBooking.final_amount || 0);
                  const paidAmount = Number(activeBooking.total_completed_paid_amount || 0);
                  const extraAmount = paidAmount > finalAmount ? paidAmount - finalAmount : 0;
                  
                  return (
                    <>
                      {extraAmount > 0 && (
                        <div className="flex justify-between items-center bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 mt-1">
                          <span className="text-orange-700/80 text-sm font-medium">Tiền phát sinh (Gọi món...):</span>
                          <span className="font-bold text-orange-600 text-sm">+{formatMoney(extraAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-200 mt-2">
                        <span className="font-semibold text-slate-800 text-sm">
                          {extraAmount > 0 ? "Tổng cộng các khoản:" : "Tổng tiền phải trả:"}
                        </span>
                        <span className="font-bold text-blue-600 text-lg">
                          {formatMoney(finalAmount + extraAmount)}
                        </span>
                      </div>
                    </>
                  );
                })()}

                <div className="flex justify-between items-center mt-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-emerald-700/80 text-sm font-medium">Đã thanh toán thực tế:</span>
                  <span className="font-bold text-emerald-600 text-base">
                    {formatMoney(Number(activeBooking.total_completed_paid_amount || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 5: Ghi chú */}
            <div className="bg-yellow-50 rounded-2xl p-3.5 border border-yellow-200/60 shadow-sm flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <FileTextOutlined className="text-yellow-600 text-sm" />
                <span className="font-bold text-yellow-800 text-xs tracking-wide uppercase">Ghi chú / Lưu ý</span>
              </div>
              <div className="text-yellow-900/80 text-sm italic leading-relaxed pl-5">
                {normalizeOwnerBookingNotes(activeBooking)}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title={`Lý do hủy booking #${cancelBooking?.booking_id || ""}`}
        open={cancelModalOpen}
        onCancel={closeCancelModal}
        onOk={submitCancel}
        okText="Xác nhận hủy"
        cancelText="Đóng"
        confirmLoading={submitting}
      >
        <Input.TextArea
          rows={4}
          placeholder="Nhập lý do hủy để gửi hệ thống"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </MainLayout>
  );
};

export default OwnerBookings;
