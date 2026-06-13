import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
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

        return (
          <div>
            <div style={{ fontWeight: 600, color: "#1f2937" }}>
              {formatMoney(finalAmount)}
              {hasDiscount && (
                <Tag color="magenta" style={{ fontSize: "10px", padding: "0 4px", marginLeft: 4, border: 0 }}>
                  VC
                </Tag>
              )}
            </div>
            <div style={{ marginTop: 2 }}>
              <Tag color={tagColor} style={{ fontSize: "11px", margin: 0 }}>
                {tagText}
              </Tag>
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
        <div style={{ overflowX: "auto", width: "100%" }}>
          <Table
            rowKey="booking_id"
            loading={loading}
            dataSource={filteredItems}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 1160 }}
          />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Card 1: Khách hàng */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <UserOutlined style={{ color: "#3b82f6", fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: "#475569", fontSize: 14 }}>Khách hàng</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Họ tên:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{activeBooking.user_name || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Số điện thoại:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>
                    <a href={`tel:${activeBooking.contact_phone || activeBooking.user_phone || ""}`} style={{ color: "#3b82f6" }}>
                      {activeBooking.contact_phone || activeBooking.user_phone || "-"}
                    </a>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Email:</span>
                  <span style={{ fontWeight: 500, color: "#1e293b" }}>{activeBooking.contact_email || activeBooking.user_email || "-"}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Dịch vụ */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <EnvironmentOutlined style={{ color: "#10b981", fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: "#475569", fontSize: 14 }}>Dịch vụ đặt chỗ</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Địa điểm:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{activeBooking.location_name || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Tên dịch vụ:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{activeBooking.service_name || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ color: "#64748b" }}>Chi tiết đặt:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b", textAlign: "right" }}>
                    {(() => {
                      const groups = getGroupedDetailLines(
                        activeBooking,
                        foodItemsByBookingId[activeBooking.booking_id] || [],
                      );
                      if (groups.length === 0) return "-";
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {groups.map((group, index) => (
                            <span key={`${group.label}-${index}`}>
                              <Tag color="blue" style={{ margin: 0, fontWeight: 500 }}>
                                {group.label}: {group.value}
                              </Tag>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Thời gian */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <CalendarOutlined style={{ color: "#f59e0b", fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: "#475569", fontSize: 14 }}>Thời gian</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Ngày nhận / Vào</span>
                  <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{formatDisplayDateTime(activeBooking.check_in_date || "")}</span>
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 16 }}>➜</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Ngày trả / Ra</span>
                  <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{formatDisplayDateTime(activeBooking.check_out_date || "") || "-"}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Thanh toán */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <WalletOutlined style={{ color: "#8b5cf6", fontSize: 15 }} />
                <span style={{ fontWeight: 700, color: "#475569", fontSize: 14 }}>Chi tiết thanh toán</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Tiền dịch vụ gốc:</span>
                  <span style={{ fontWeight: 500, color: "#475569" }}>{formatMoney(Number(activeBooking.total_amount || 0))}</span>
                </div>

                {activeBooking.voucher_code && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Mã giảm giá (Voucher):</span>
                    <div>
                      <Tag color="magenta" style={{ margin: 0, fontWeight: 600 }}>{activeBooking.voucher_code}</Tag>
                      {Number(activeBooking.discount_amount) > 0 && (
                        <span style={{ color: "#dc2626", marginLeft: 8, fontWeight: 600 }}>
                          -{formatMoney(Number(activeBooking.discount_amount))}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed #e2e8f0" }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Tổng tiền phải trả:</span>
                  <span style={{ fontWeight: 700, color: "#2563eb", fontSize: 15 }}>{formatMoney(Number(activeBooking.final_amount || 0))}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ color: "#64748b" }}>Đã thanh toán thực tế:</span>
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>
                    {formatMoney(Number(activeBooking.total_completed_paid_amount || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 5: Ghi chú */}
            <div style={{ backgroundColor: "#fef08a40", borderRadius: 8, padding: 12, border: "1px solid #fef08a", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileTextOutlined style={{ color: "#ca8a04", fontSize: 13 }} />
                <span style={{ fontWeight: 600, color: "#854d0e", fontSize: 12 }}>Ghi chú / Lưu ý</span>
              </div>
              <div style={{ color: "#713f12", fontSize: 12, fontStyle: "italic", lineHeight: "1.4" }}>
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
