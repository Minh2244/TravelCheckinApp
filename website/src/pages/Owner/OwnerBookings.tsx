import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
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
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { getErrorMessage } from "../../utils/safe";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

type BookingNextStatus = "confirmed" | "completed" | "cancelled";

type TimeFilter = "next3" | "prev7" | "prev1m" | "prev1y" | "all";

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
  location_name?: string | null;
  location_type?: string | null;
  service_name?: string | null;
  service_type?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  final_amount?: number | string | null;
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

const paymentStatusLabel = (value: string): string => {
  const status = String(value || "").toLowerCase();
  if (!status) return "Chưa có";
  if (status === "completed") return "Đã thanh toán";
  if (status === "pending") return "Chờ thanh toán";
  if (status === "failed") return "Thanh toán lỗi";
  if (status === "cancelled") return "Đã hủy thanh toán";
  return String(value || "-");
};

const parseBookingDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("next3");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getBookings({});
      setItems((res?.data || []) as BookingRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải bookings"));
    } finally {
      setLoading(false);
    }
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
      title: "Thứ tự",
      width: 60,
      align: "center",
      render: (_: unknown, __: BookingRow, index: number) => index + 1,
    },
    {
      title: "Khách",
      dataIndex: "user_name",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Liên hệ",
      width: 220,
      render: (_: unknown, row: BookingRow) => {
        const email = String(row.contact_email || row.user_email || "").trim();
        const phone = String(row.contact_phone || row.user_phone || "").trim();
        if (!email && !phone) return "-";
        if (email && phone) return `${email} - ${phone}`;
        return email || phone;
      },
    },
    {
      title: "Địa điểm",
      dataIndex: "location_name",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Dịch vụ",
      width: 210,
      render: (_: unknown, row: BookingRow) => {
        const details = getDetailItemsForDisplay(row);
        const brief = details
          .slice(0, 2)
          .map((item) => formatBookingDetailLine(item))
          .join(", ");
        const more = details.length > 2 ? ` +${details.length - 2}` : "";
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{row.service_name || "-"}</div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {brief || "-"}
              {more}
            </div>
          </div>
        );
      },
    },
    {
      title: "Thời gian",
      width: 170,
      render: (_: unknown, row: BookingRow) => {
        const checkIn = formatDisplayDateTime(row.check_in_date || "");
        const checkOut = formatDisplayDateTime(row.check_out_date || "");
        if (checkIn && checkOut) return `${checkIn} -> ${checkOut}`;
        return checkIn || checkOut || "-";
      },
    },
    {
      title: "Số tiền",
      dataIndex: "final_amount",
      width: 100,
      align: "right",
      render: (v: unknown) => formatMoney(Number(v || 0)),
    },
    {
      title: "Thanh toán",
      dataIndex: "latest_payment_status",
      width: 110,
      render: (_: unknown, row: BookingRow) => {
        const s = String(row.latest_payment_status || "");
        if (!row.latest_payment_id) return <Tag>Chưa có</Tag>;
        const color =
          s === "completed" ? "green" : s === "pending" ? "orange" : "red";
        return <Tag color={color}>{paymentStatusLabel(s)}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 90,
      align: "center",
      render: (s: string) => statusTag(s),
    },
    {
      title: "Hành động",
      width: 170,
      align: "center",
      render: (_: unknown, row: BookingRow) => (
        <Space>
          <Button size="small" onClick={() => setActiveBooking(row)}>
            Chi tiết
          </Button>
          <Button
            size="small"
            onClick={() => setStatus(row.booking_id, "confirmed")}
            disabled={!row.can_confirm || submitting}
          >
            Duyệt
          </Button>
          <Button
            size="small"
            danger
            onClick={() => openCancelModal(row)}
            disabled={!row.can_cancel || submitting}
          >
            Hủy
          </Button>
        </Space>
      ),
    },
  ];

  const filteredItems = useMemo(() => {
    const now = new Date();

    let start: Date | null = null;
    let end: Date | null = null;

    if (timeFilter === "next3") {
      const today = startOfDay(now);
      start = today;
      end = endOfDay(addDays(today, 2));
    } else if (timeFilter === "prev7") {
      const today = endOfDay(now);
      end = today;
      start = startOfDay(addDays(today, -6));
    } else if (timeFilter === "prev1m") {
      end = endOfDay(now);
      const s = new Date(now);
      s.setMonth(s.getMonth() - 1);
      start = startOfDay(s);
    } else if (timeFilter === "prev1y") {
      end = endOfDay(now);
      const s = new Date(now);
      s.setFullYear(s.getFullYear() - 1);
      start = startOfDay(s);
    }

    return items.filter((row) => {
      if (
        statusFilter &&
        statusFilter !== "all" &&
        String(row.status).toLowerCase() !== statusFilter
      ) {
        return false;
      }

      if (timeFilter === "all") return true;

      const dt =
        parseBookingDate(row.check_in_date) ||
        parseBookingDate(row.check_out_date);
      if (!dt || !start || !end) return false;
      return dt >= start && dt <= end;
    });
  }, [items, statusFilter, timeFilter]);

  return (
    <MainLayout>
      <Card
        title={
          <Space wrap size="middle">
            <span>Quản lí đặt chỗ</span>
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
              placeholder="Thời gian"
              style={{ width: 220 }}
              value={timeFilter}
              onChange={(v) => setTimeFilter(v)}
              options={[
                { value: "next3", label: "3 ngày tiếp theo" },
                { value: "prev7", label: "7 ngày trước" },
                { value: "prev1m", label: "1 tháng trước" },
                { value: "prev1y", label: "1 năm" },
                { value: "all", label: "Tất cả" },
              ]}
            />
          </Space>
        }
      >
        <Table
          rowKey="booking_id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          pagination={false}
          size="small"
          tableLayout="fixed"
        />
      </Card>

      <Drawer
        title={`Booking #${activeBooking?.booking_id || ""}`}
        open={Boolean(activeBooking)}
        onClose={() => setActiveBooking(null)}
        size="large"
      >
        {activeBooking && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions size="small" bordered column={1}>
              <Descriptions.Item label="Khách hàng">
                {activeBooking.user_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {activeBooking.contact_email || activeBooking.user_email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {activeBooking.contact_phone || activeBooking.user_phone || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm">
                {activeBooking.location_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Dịch vụ">
                {activeBooking.service_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Đặt gì">
                {(() => {
                  const groups = getGroupedDetailLines(
                    activeBooking,
                    foodItemsByBookingId[activeBooking.booking_id] || [],
                  );
                  if (groups.length === 0) return "-";
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {groups.map((group, index) => (
                        <span key={`${group.label}-${index}`}>
                          {group.label}: {group.value}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt">
                {formatDisplayDateTime(activeBooking.check_in_date || "") ||
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày nhận">
                {formatDisplayDateTime(activeBooking.check_out_date || "") ||
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Tiền đã thanh toán">
                {formatMoney(Number(activeBooking.final_amount || 0))}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú">
                {normalizeOwnerBookingNotes(activeBooking)}
              </Descriptions.Item>
            </Descriptions>
          </Space>
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
