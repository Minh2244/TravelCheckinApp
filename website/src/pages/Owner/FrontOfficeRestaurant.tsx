import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Tag,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type AreaRow = { area_id: number; area_name: string };

type TableRow = {
  table_id: number;
  area_id: number | null;
  table_name: string;
  shape: "square" | "round";
  pos_x?: number | null;
  pos_y?: number | null;
  status: "free" | "occupied" | "reserved";
  order_id?: number | null;
  final_amount?: number | string | null;
  reservation_booking_id?: number | null;
  reservation_contact_name?: string | null;
  reservation_contact_phone?: string | null;
  reservation_check_in_date?: string | null;
  reservation_notes?: string | null;
};

type MenuItem = {
  service_id: number;
  service_name: string;
  price: number | string;
  pos_group?: string | null;
  images?: unknown;
};

type OrderDetail = {
  order: {
    order_id: number;
    final_amount?: number | string | null;
    order_source?: "online_booking" | "onsite_pos";
  };
  items: Array<{
    order_item_id: number;
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price?: number | string | null;
    line_total?: number | string | null;
  }>;
  prepaid?: {
    booking_id: number;
    payment_id: number | null;
    payment_method: string | null;
    notes: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    total_qty: number;
    total_amount: number;
    items: Array<{
      service_id: number;
      service_name: string;
      quantity: number;
      unit_price?: number | string | null;
      line_total?: number | string | null;
    }>;
  } | null;
};

type PosInvoice = {
  payment_id: number;
  location_name: string | null;
  owner_name: string | null;
  payment_time: string;
  table_name: string | null;
  items: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  total_qty: number;
  total_amount: number;
  prepaid_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  prepaid_amount?: number;
  onsite_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  onsite_amount?: number;
};

type TransferInitData = {
  payment_id: number;
  qr: {
    qr_code_url: string;
    bank_name: string;
    bank_account: string;
    account_holder: string;
    amount: number;
    note: string;
  };
  context: {
    location_name: string | null;
    owner_name: string | null;
    payment_time: string;
    table_name: string | null;
    items: PosInvoice["items"];
    total_qty: number;
    total_amount: number;
  };
};

const formatDateTime = (iso: string) => {
  return formatDateTimeVi(iso);
};

const normalizeReservationNote = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "PREPAY_UNCONFIRMED")
    .join(" • ");
};

const parseInvoiceItems = (value: unknown): PosInvoice["items"] => {
  return Array.isArray(value)
    ? value.map((x: any) => ({
        service_id: Number(x.service_id),
        service_name: String(x.service_name || ""),
        quantity: Number(x.quantity || 0),
        unit_price: Number(x.unit_price || 0),
        line_total: Number(x.line_total || 0),
      }))
    : [];
};

const parseInvoicePayload = (payload: unknown): PosInvoice => {
  const parsed = asRecord(payload) as any;
  return {
    payment_id: Number(parsed.payment_id),
    location_name:
      parsed.location_name == null ? null : String(parsed.location_name),
    owner_name: parsed.owner_name == null ? null : String(parsed.owner_name),
    payment_time: String(parsed.payment_time),
    table_name: parsed.table_name == null ? null : String(parsed.table_name),
    items: parseInvoiceItems(parsed.items),
    total_qty: Number(parsed.total_qty || 0),
    total_amount: Number(parsed.total_amount || 0),
    prepaid_items: parseInvoiceItems(parsed.prepaid_items),
    prepaid_amount: Number(parsed.prepaid_amount || 0),
    onsite_items: parseInvoiceItems(parsed.onsite_items),
    onsite_amount: Number(parsed.onsite_amount || 0),
  };
};

const tableMeta = (s: string) => {
  if (s === "free") return { label: "TRỐNG", color: "default", bg: "#ffffff" };
  if (s === "occupied")
    return { label: "CÓ KHÁCH", color: "blue", bg: "#eff6ff" };
  if (s === "reserved")
    return { label: "ĐÃ ĐẶT", color: "orange", bg: "#fffbeb" };
  return { label: String(s).toUpperCase(), color: "default", bg: "#ffffff" };
};

const normalizeImages = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }
  return [];
};

const normalizeSearchText = (v: unknown) =>
  String(v || "")
    .normalize("NFD")
    // Remove Vietnamese diacritics
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const formatTableName = (name: unknown) => {
  const n = String(name || "").trim();
  if (!n) return "-";
  const lower = n.toLowerCase();
  if (lower.startsWith("bàn") || lower.startsWith("ban")) return n;
  return `Bàn ${n}`;
};

const isMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
};

export default function FrontOfficeRestaurant(props: {
  locationId: number;
  role: "owner" | "employee";
}) {
  const { locationId } = props;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [area, setArea] = useState<string>("all");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTable, setActiveTable] = useState<TableRow | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [menuQuery, setMenuQuery] = useState<string>("");
  const [itemBusyId, setItemBusyId] = useState<number | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [payConfirmed, setPayConfirmed] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [transferInit, setTransferInit] = useState<TransferInitData | null>(
    null,
  );
  const [invoice, setInvoice] = useState<PosInvoice | null>(null);

  const [orderSourceById, setOrderSourceById] = useState<
    Record<number, "online_booking" | "onsite_pos">
  >({});

  const currentOrderIdRef = useRef<number | null>(null);
  useEffect(() => {
    currentOrderIdRef.current = orderDetail?.order?.order_id ?? null;
  }, [orderDetail]);

  const areaOptions = useMemo((): Array<{ label: string; value: string }> => {
    const all = [{ label: "Tất cả", value: "all" }];
    const a = areas.map((x) => ({
      label: x.area_name,
      value: String(x.area_id),
    }));
    return [...all, ...a];
  }, [areas]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of menu) {
      const g = String(m.pos_group || "").trim();
      if (g) set.add(g);
    }
    return ["all", ...Array.from(set)];
  }, [menu]);

  const menuByCategory = useMemo(() => {
    const q = normalizeSearchText(menuQuery);
    const byCat =
      category === "all"
        ? menu
        : menu.filter((m) => String(m.pos_group || "").trim() === category);
    if (!q) return byCat;
    return byCat.filter((m) => {
      const name = normalizeSearchText(m.service_name);
      return name.includes(q);
    });
  }, [menu, category, menuQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes, mRes] = await Promise.all([
        ownerApi.getPosAreas({ location_id: locationId }),
        ownerApi.getPosTables({ location_id: locationId, area_id: area }),
        ownerApi.getPosMenu({ location_id: locationId }),
      ]);
      setAreas(
        (aRes?.data || [])
          .map((item: unknown): AreaRow => {
            const r = asRecord(item);
            return {
              area_id: Number(r.area_id),
              area_name: String(r.area_name || ""),
            };
          })
          .filter(
            (x: AreaRow) => Number.isFinite(x.area_id) && Boolean(x.area_name),
          ),
      );

      setTables(
        (tRes?.data || [])
          .map((item: unknown): TableRow => {
            const r = asRecord(item);
            return {
              table_id: Number(r.table_id),
              area_id: r.area_id == null ? null : Number(r.area_id),
              table_name: String(r.table_name || ""),
              shape: String(r.shape) === "round" ? "round" : "square",
              pos_x: r.pos_x == null ? null : Number(r.pos_x),
              pos_y: r.pos_y == null ? null : Number(r.pos_y),
              status:
                String(r.status) === "occupied"
                  ? "occupied"
                  : String(r.status) === "reserved"
                    ? "reserved"
                    : "free",
              order_id: r.order_id == null ? null : Number(r.order_id),
              final_amount:
                (r.final_amount as TableRow["final_amount"]) ?? null,
              reservation_booking_id:
                r.reservation_booking_id == null
                  ? null
                  : Number(r.reservation_booking_id),
              reservation_contact_name:
                r.reservation_contact_name == null
                  ? null
                  : String(r.reservation_contact_name),
              reservation_contact_phone:
                r.reservation_contact_phone == null
                  ? null
                  : String(r.reservation_contact_phone),
              reservation_check_in_date:
                r.reservation_check_in_date == null
                  ? null
                  : String(r.reservation_check_in_date),
              reservation_notes:
                r.reservation_notes == null
                  ? null
                  : String(r.reservation_notes),
            };
          })
          .filter(
            (t: TableRow) =>
              Number.isFinite(t.table_id) &&
              Boolean(t.table_name) &&
              Boolean(t.status),
          ),
      );

      setMenu(
        (mRes?.data || [])
          .map((item: unknown): MenuItem => {
            const r = asRecord(item);
            return {
              service_id: Number(r.service_id),
              service_name: String(r.service_name || ""),
              price: (r.price as MenuItem["price"]) ?? 0,
              pos_group: r.pos_group == null ? null : String(r.pos_group),
              images: r.images,
            };
          })
          .filter(
            (m: MenuItem) =>
              Number.isFinite(m.service_id) && Boolean(m.service_name),
          ),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải dữ liệu POS"));
    } finally {
      setLoading(false);
    }
  }, [area, locationId]);

  const loadOrder = useCallback(async (orderId: number) => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setOrderDetail(null);
      return;
    }
    try {
      const res = await ownerApi.getPosOrderDetail(orderId);
      const data = asRecord(asRecord(res).data);
      const order = asRecord(data.order);
      const itemsRaw = data.items as unknown;
      const items = Array.isArray(itemsRaw)
        ? itemsRaw
            .map((it: unknown) => {
              const r = asRecord(it);
              return {
                order_item_id: Number(r.order_item_id),
                service_id: Number(r.service_id),
                service_name: String(r.service_name || ""),
                quantity: Number(r.quantity || 0),
                unit_price:
                  (r.unit_price as number | string | null | undefined) ?? null,
                line_total:
                  (r.line_total as number | string | null | undefined) ?? null,
              };
            })
            .filter(
              (it) =>
                Number.isFinite(it.order_item_id) &&
                Number.isFinite(it.service_id) &&
                Boolean(it.service_name) &&
                Number.isFinite(it.quantity),
            )
        : [];
      const detail: OrderDetail = {
        order: {
          order_id: Number(order.order_id),
          final_amount:
            (order.final_amount as OrderDetail["order"]["final_amount"]) ??
            null,
          order_source:
            order.order_source === "online_booking" ||
            order.order_source === "onsite_pos"
              ? (order.order_source as OrderDetail["order"]["order_source"])
              : undefined,
        },
        items,
        prepaid: (() => {
          const prepaidRaw = data.prepaid;
          if (!prepaidRaw || typeof prepaidRaw !== "object") return null;
          const prepaid = asRecord(prepaidRaw);
          const prepaidItemsRaw = prepaid.items;
          return {
            booking_id: Number(prepaid.booking_id),
            payment_id:
              prepaid.payment_id == null ? null : Number(prepaid.payment_id),
            payment_method:
              prepaid.payment_method == null
                ? null
                : String(prepaid.payment_method),
            notes: prepaid.notes == null ? null : String(prepaid.notes),
            contact_name:
              prepaid.contact_name == null
                ? null
                : String(prepaid.contact_name),
            contact_phone:
              prepaid.contact_phone == null
                ? null
                : String(prepaid.contact_phone),
            total_qty: Number(prepaid.total_qty || 0),
            total_amount: Number(prepaid.total_amount || 0),
            items: Array.isArray(prepaidItemsRaw)
              ? prepaidItemsRaw
                  .map((it: unknown) => {
                    const row = asRecord(it);
                    return {
                      service_id: Number(row.service_id),
                      service_name: String(row.service_name || ""),
                      quantity: Number(row.quantity || 0),
                      unit_price:
                        (row.unit_price as
                          | number
                          | string
                          | null
                          | undefined) ?? null,
                      line_total:
                        (row.line_total as
                          | number
                          | string
                          | null
                          | undefined) ?? null,
                    };
                  })
                  .filter(
                    (it) =>
                      Number.isFinite(it.service_id) &&
                      Boolean(it.service_name) &&
                      Number.isFinite(it.quantity),
                  )
              : [],
          };
        })(),
      };
      if (!Number.isFinite(detail.order.order_id)) {
        setOrderDetail(null);
        return;
      }

      if (detail.order.order_source) {
        setOrderSourceById((prev) => ({
          ...prev,
          [detail.order.order_id]: detail.order.order_source!,
        }));
      }
      setOrderDetail(detail);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải chi tiết order"));
      setOrderDetail(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeTable) return;

    const latest = tables.find(
      (table) => Number(table.table_id) === Number(activeTable.table_id),
    );

    if (!latest) {
      setActiveTable(null);
      setOrderDetail(null);
      return;
    }

    if (
      latest.status !== activeTable.status ||
      Number(latest.order_id || 0) !== Number(activeTable.order_id || 0) ||
      Number(latest.reservation_booking_id || 0) !==
        Number(activeTable.reservation_booking_id || 0) ||
      Number(latest.final_amount || 0) !== Number(activeTable.final_amount || 0)
    ) {
      setActiveTable(latest);
    }

    if (
      latest.status === "free" &&
      (!Number.isFinite(Number(latest.order_id)) ||
        Number(latest.order_id) <= 0)
    ) {
      setOrderDetail(null);
      return;
    }

    const latestOrderId = Number(latest.order_id || 0);
    const currentOrderId = Number(orderDetail?.order?.order_id || 0);
    if (
      Number.isFinite(latestOrderId) &&
      latestOrderId > 0 &&
      latestOrderId !== currentOrderId
    ) {
      void loadOrder(latestOrderId);
    }
  }, [activeTable, loadOrder, orderDetail?.order?.order_id, tables]);

  // Fallback auto-refresh: nếu SSE bị chặn/không ổn định thì vẫn tự đồng bộ
  useEffect(() => {
    const tick = () => {
      void load();
      const cur = currentOrderIdRef.current;
      if (cur && Number.isFinite(cur)) void loadOrder(cur);
    };

    const id = window.setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 5000);

    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, loadOrder]);

  // Realtime: auto-sync POS giữa nhiều màn hình vận hành
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) return;

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type?: string;
          location_id?: number;
        };
        if (data?.type !== "pos_updated") return;
        if (Number(data.location_id) !== Number(locationId)) return;

        void load();
        const cur = currentOrderIdRef.current;
        if (cur && Number.isFinite(cur)) void loadOrder(cur);
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
    };
  }, [load, loadOrder, locationId]);

  const openTable = async (t: TableRow) => {
    setActiveTable(t);

    if (t.status === "reserved") {
      const reservationMeta = [
        String(t.reservation_contact_name || "").trim(),
        String(t.reservation_contact_phone || "").trim(),
        t.reservation_check_in_date
          ? formatDateTime(t.reservation_check_in_date)
          : "",
        normalizeReservationNote(t.reservation_notes),
      ]
        .filter(Boolean)
        .join(" • ");
      Modal.confirm({
        title: `Bàn ${t.table_name} đang ĐÃ ĐẶT`,
        content: reservationMeta || undefined,
        okText: "Khách tới (mở bàn)",
        cancelText: "Hủy",
        onOk: async () => {
          const o = await ownerApi.arrivePosTable(t.table_id);
          const orderId = Number(o?.data?.order_id);
          if (Number.isFinite(orderId) && orderId > 0) {
            setOrderSourceById((prev) => ({
              ...prev,
              [orderId]: "online_booking",
            }));
            await loadOrder(orderId);
            if (isMobile()) setDrawerOpen(true);
            await load();
          }
        },
      });
      return;
    }

    if (t.status === "free") {
      const o = await ownerApi.openPosTable(t.table_id);
      const orderId = Number(o?.data?.order_id);
      if (Number.isFinite(orderId) && orderId > 0) {
        setOrderSourceById((prev) => ({
          ...prev,
          [orderId]: "onsite_pos",
        }));
        await loadOrder(orderId);
        if (isMobile()) setDrawerOpen(true);
        await load();
      }
      return;
    }

    // occupied
    const existing = Number(t.order_id);
    if (Number.isFinite(existing) && existing > 0) {
      await loadOrder(existing);
      if (isMobile()) setDrawerOpen(true);
      return;
    }

    const o = await ownerApi.openPosTable(t.table_id);
    const orderId = Number(o?.data?.order_id);
    if (Number.isFinite(orderId) && orderId > 0) {
      setOrderSourceById((prev) => ({
        ...prev,
        [orderId]:
          t.reservation_booking_id && t.reservation_booking_id > 0
            ? "online_booking"
            : "onsite_pos",
      }));
      await loadOrder(orderId);
      if (isMobile()) setDrawerOpen(true);
      await load();
    }
  };

  const addItem = async (m: MenuItem) => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    await ownerApi.addPosOrderItem(orderId, {
      service_id: m.service_id,
      quantity: 1,
    });
    await loadOrder(orderId);
    await load();
  };

  const setItemQuantity = async (orderItemId: number, quantity: number) => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    if (!Number.isFinite(orderItemId)) return;
    const qty = Math.max(1, Math.floor(Number(quantity || 1)));
    setItemBusyId(orderItemId);
    try {
      await ownerApi.updatePosOrderItem(orderId, orderItemId, {
        quantity: qty,
      });
      await loadOrder(orderId);
      await load();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể cập nhật số lượng"));
    } finally {
      setItemBusyId(null);
    }
  };

  const deleteItem = async (orderItemId: number) => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    if (!Number.isFinite(orderItemId)) return;
    setItemBusyId(orderItemId);
    try {
      await ownerApi.deletePosOrderItem(orderId, orderItemId);
      await loadOrder(orderId);
      await load();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xóa món"));
    } finally {
      setItemBusyId(null);
    }
  };

  const resetPayState = () => {
    setPayOpen(false);
    setPayMethod("cash");
    setPayConfirmed(false);
    setTransferInit(null);
    setInvoice(null);
    setPayBusy(false);
  };

  const resolveLinkedBookingId = () => {
    const prepaidBookingId = Number(orderDetail?.prepaid?.booking_id || 0);
    if (Number.isFinite(prepaidBookingId) && prepaidBookingId > 0) {
      return prepaidBookingId;
    }
    const reservedBookingId = Number(activeTable?.reservation_booking_id || 0);
    return Number.isFinite(reservedBookingId) && reservedBookingId > 0
      ? reservedBookingId
      : undefined;
  };

  const runZeroPrepaidSettlement = async () => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    const txSource = orderSourceById[orderId] ?? "onsite_pos";
    const bookingId = resolveLinkedBookingId();
    setPayBusy(true);
    try {
      const res = await ownerApi.payPosOrder(orderId, {
        payment_method: "transfer",
        step: "complete",
        transaction_source: txSource,
        booking_id: bookingId,
      });
      setInvoice(parseInvoicePayload(asRecord(asRecord(res).data).invoice));
      message.success("Đã lưu hóa đơn 0đ cho bàn đặt trước");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể lưu hóa đơn 0đ"));
    } finally {
      setPayBusy(false);
    }
  };

  const openPayModal = () => {
    if (!orderDetail || !activeTable) return;
    if (
      (orderDetail.prepaid?.items?.length || 0) > 0 &&
      orderDetail.items.length === 0
    ) {
      Modal.confirm({
        title: "Lưu hóa đơn cho bàn đã thanh toán trước",
        content:
          "Khách không gọi thêm món tại quầy. Hệ thống sẽ tạo hóa đơn 0đ và ghi nhận theo hình thức chuyển khoản.",
        okText: "Lưu hóa đơn 0đ",
        cancelText: "Hủy",
        onOk: async () => {
          await runZeroPrepaidSettlement();
        },
      });
      return;
    }
    setPayOpen(true);
    setPayMethod("cash");
    setPayConfirmed(false);
    setTransferInit(null);
    setInvoice(null);
  };

  const runCashPay = async () => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    const txSource = orderSourceById[orderId] ?? "onsite_pos";
    const bookingId = resolveLinkedBookingId();
    setPayBusy(true);
    try {
      const res = await ownerApi.payPosOrder(orderId, {
        payment_method: "cash",
        transaction_source: txSource,
        booking_id: bookingId,
      });
      setInvoice(parseInvoicePayload(asRecord(asRecord(res).data).invoice));
      message.success("Thanh toán tiền mặt thành công");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể thanh toán"));
    } finally {
      setPayBusy(false);
    }
  };

  const runTransferInit = async () => {
    const orderId = Number(orderDetail?.order?.order_id);
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    const txSource = orderSourceById[orderId] ?? "onsite_pos";
    const bookingId = resolveLinkedBookingId();
    setPayBusy(true);
    try {
      const res = await ownerApi.payPosOrder(orderId, {
        payment_method: "transfer",
        step: "init",
        transaction_source: txSource,
        booking_id: bookingId,
      });
      const data = asRecord(asRecord(res).data);
      const ctx = asRecord((data as any).context);
      const itemsRaw = (ctx as any).items as unknown;
      setTransferInit({
        payment_id: Number((data as any).payment_id),
        qr: {
          qr_code_url: String(asRecord((data as any).qr).qr_code_url || ""),
          bank_name: String(asRecord((data as any).qr).bank_name || ""),
          bank_account: String(asRecord((data as any).qr).bank_account || ""),
          account_holder: String(
            asRecord((data as any).qr).account_holder || "",
          ),
          amount: Number(asRecord((data as any).qr).amount || 0),
          note: String(asRecord((data as any).qr).note || ""),
        },
        context: {
          location_name:
            (ctx as any).location_name == null
              ? null
              : String((ctx as any).location_name),
          owner_name:
            (ctx as any).owner_name == null
              ? null
              : String((ctx as any).owner_name),
          payment_time: String((ctx as any).payment_time || ""),
          table_name:
            (ctx as any).table_name == null
              ? null
              : String((ctx as any).table_name),
          items: Array.isArray(itemsRaw)
            ? (itemsRaw as any[]).map((x: any) => ({
                service_id: Number(x.service_id),
                service_name: String(x.service_name || ""),
                quantity: Number(x.quantity || 0),
                unit_price: Number(x.unit_price || 0),
                line_total: Number(x.line_total || 0),
              }))
            : [],
          total_qty: Number((ctx as any).total_qty || 0),
          total_amount: Number((ctx as any).total_amount || 0),
        },
      });
      message.success("Đã tạo mã QR chuyển khoản");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể tạo mã QR"));
    } finally {
      setPayBusy(false);
    }
  };

  const runTransferComplete = async () => {
    const orderId = Number(orderDetail?.order?.order_id);
    const paymentId = Number(transferInit?.payment_id);
    if (
      !Number.isFinite(orderId) ||
      orderId <= 0 ||
      !Number.isFinite(paymentId)
    )
      return;
    const txSource = orderSourceById[orderId] ?? "onsite_pos";
    const bookingId = resolveLinkedBookingId();
    setPayBusy(true);
    try {
      const res = await ownerApi.payPosOrder(orderId, {
        payment_method: "transfer",
        step: "complete",
        payment_id: paymentId,
        transaction_source: txSource,
        booking_id: bookingId,
      });
      setInvoice(parseInvoicePayload(asRecord(asRecord(res).data).invoice));
      message.success("Đã xác nhận chuyển khoản");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xác nhận"));
    } finally {
      setPayBusy(false);
    }
  };

  const bookHeader = useMemo(() => {
    const t = activeTable;
    if (!t) {
      return {
        title: "Chưa chọn bàn",
        subtitle: "Chọn bàn bên trái để gọi món",
        tag: null as React.ReactNode,
      };
    }
    const meta = tableMeta(t.status);
    const tag = <Tag color={meta.color}>{meta.label}</Tag>;
    return {
      title: formatTableName(t.table_name),
      subtitle:
        t.status === "occupied"
          ? `Tạm tính: ${formatMoney(Number(t.final_amount || 0))}`
          : t.status === "reserved"
            ? "Bàn đã đặt"
            : "Bàn trống",
      tag,
    };
  }, [activeTable]);

  const orderView = useMemo(() => {
    const items = orderDetail?.items || [];
    const totalQty = items.reduce(
      (sum, it) => sum + Number(it.quantity || 0),
      0,
    );
    const itemsByServiceId = new Map<
      number,
      {
        totalQty: number;
        rows: Array<{ order_item_id: number; quantity: number }>;
      }
    >();
    for (const it of items) {
      if (!Number.isFinite(it.service_id)) continue;
      const serviceId = Number(it.service_id);
      const entry = itemsByServiceId.get(serviceId) ?? {
        totalQty: 0,
        rows: [] as Array<{ order_item_id: number; quantity: number }>,
      };
      const q = Number(it.quantity || 0);
      entry.totalQty += q;
      entry.rows.push({ order_item_id: it.order_item_id, quantity: q });
      itemsByServiceId.set(serviceId, entry);
    }

    const cartTotal = items.reduce(
      (sum, it) => sum + Number(it.line_total || 0),
      0,
    );
    return { items, totalQty, itemsByServiceId, cartTotal };
  }, [orderDetail]);

  const renderMenuPanel = (opts?: { inDrawer?: boolean }) => {
    const inDrawer = Boolean(opts?.inDrawer);
    const disabled = !orderDetail || !activeTable;
    const { totalQty, itemsByServiceId, cartTotal } = orderView;

    return (
      <div className={inDrawer ? "" : "sticky top-4"}>
        <div className="rounded-2xl border border-blue-100 bg-white shadow-md overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 via-white to-indigo-50 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">
                  {bookHeader.title}
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {!activeTable
                    ? bookHeader.subtitle
                    : totalQty === 0
                      ? "Bàn trống"
                      : activeTable.status === "occupied"
                        ? `Tạm tính: ${formatMoney(cartTotal)}`
                        : bookHeader.subtitle}
                </div>
              </div>
              <div className="flex items-end flex-col gap-1">
                {bookHeader.tag}
                <div className="text-[11px] text-gray-500 whitespace-nowrap">
                  {menuByCategory.length} món • Giỏ: {totalQty} sp
                </div>
              </div>
            </div>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-gray-500">
                {disabled
                  ? "Chọn/mở bàn để gọi món"
                  : "Bấm nút 'Thêm vào giỏ' để thêm"}
              </div>
            </div>

            <div className="mt-3">
              <Input
                value={menuQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setMenuQuery(e.target.value)
                }
                placeholder="Tìm món... (vd: cafe, trà sữa)"
                allowClear
                size="large"
                className="!rounded-2xl"
              />
            </div>

            <Divider className="!my-4" />

            {/* Categories: xl sidebar, smaller as chips */}
            <div className={inDrawer ? "" : "xl:hidden"}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-semibold">Danh mục</div>
              </div>
              <div className="flex flex-wrap gap-2 pb-2">
                {categories.map((c) => (
                  <Button
                    key={c}
                    size="middle"
                    type={c === category ? "primary" : "default"}
                    onClick={() => setCategory(c)}
                    className={
                      "!rounded-full whitespace-nowrap " +
                      (c === category
                        ? ""
                        : "!border-gray-200 hover:!border-blue-200")
                    }
                  >
                    {c === "all" ? "Tất cả sản phẩm" : c}
                  </Button>
                ))}
              </div>
              <Divider className="!my-4" />
            </div>

            <div
              className={
                inDrawer
                  ? "grid grid-cols-1 gap-3"
                  : "grid grid-cols-1 xl:grid-cols-[190px_1fr] gap-3 items-start"
              }
            >
              {/* Sidebar categories on xl */}
              <div className={inDrawer ? "hidden" : "hidden xl:block"}>
                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-white to-blue-50">
                    <div className="text-sm font-semibold">Danh mục</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Chọn để lọc
                    </div>
                  </div>
                  <div
                    className="p-2"
                    style={{ maxHeight: "66vh", overflowY: "auto" }}
                  >
                    <div className="space-y-2">
                      {categories.map((c) => (
                        <Button
                          key={c}
                          block
                          size="middle"
                          type={c === category ? "primary" : "default"}
                          onClick={() => setCategory(c)}
                          className={
                            "!rounded-xl !text-left !h-10 " +
                            (c === category
                              ? ""
                              : "!border-gray-200 hover:!border-blue-200")
                          }
                        >
                          {c === "all" ? "Tất cả sản phẩm" : c}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div>
                <div
                  className={
                    "grid gap-4 pr-2 w-full min-w-0 overflow-y-auto overflow-x-hidden " +
                    (inDrawer
                      ? "grid-cols-2"
                      : "grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4")
                  }
                  style={{ maxHeight: inDrawer ? "54vh" : "66vh" }}
                >
                  {menuByCategory.map((m) => {
                    const img = normalizeImages(m.images)?.[0] ?? "";
                    const src = resolveBackendUrl(img) || img;
                    const serviceEntry = itemsByServiceId.get(
                      Number(m.service_id),
                    );
                    const selectedQty = serviceEntry?.totalQty ?? 0;
                    const rows = serviceEntry?.rows ?? [];
                    const busy = rows.some(
                      (r) => itemBusyId === r.order_item_id,
                    );

                    return (
                      <div
                        key={m.service_id}
                        className={
                          "group min-w-0 rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-lg transition " +
                          (disabled ? "opacity-60" : "hover:border-blue-300")
                        }
                      >
                        <div className="relative">
                          {src ? (
                            <img
                              alt={m.service_name}
                              src={src}
                              className="h-44 w-full object-cover"
                            />
                          ) : (
                            <div className="h-44 w-full bg-gradient-to-br from-blue-50 to-indigo-50" />
                          )}

                          {selectedQty > 0 ? (
                            <div
                              className="absolute top-2 left-2"
                              onClick={(ev) => ev.stopPropagation()}
                              onPointerDown={(ev) => ev.stopPropagation()}
                            >
                              <div className="flex items-center gap-1 rounded-full bg-white/95 backdrop-blur border border-blue-100 shadow px-2 py-1">
                                <button
                                  type="button"
                                  disabled={disabled || busy}
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    if (rows.length === 0) return;

                                    for (let i = rows.length - 1; i >= 0; i--) {
                                      const r = rows[i];
                                      if (r.quantity > 1) {
                                        void setItemQuantity(
                                          r.order_item_id,
                                          r.quantity - 1,
                                        );
                                        return;
                                      }
                                    }

                                    void deleteItem(
                                      rows[rows.length - 1].order_item_id,
                                    );
                                  }}
                                  className={
                                    "h-7 w-7 rounded-full border text-sm font-bold leading-none " +
                                    (disabled || busy
                                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                      : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200")
                                  }
                                >
                                  -
                                </button>

                                <div className="min-w-[26px] text-center text-sm font-bold text-blue-700">
                                  {selectedQty}
                                </div>

                                <button
                                  type="button"
                                  disabled={disabled || busy}
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    void addItem(m);
                                  }}
                                  onPointerDown={(ev) => ev.stopPropagation()}
                                  className={
                                    "h-7 w-7 rounded-full border text-sm font-bold leading-none " +
                                    (disabled || busy
                                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                      : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200")
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="p-4">
                          <div className="text-center font-semibold truncate text-base">
                            {m.service_name}
                          </div>
                          <div className="text-center text-sm font-bold mt-1 text-rose-600">
                            {formatMoney(Number(m.price || 0))}
                          </div>
                          <div className="mt-3">
                            <Button
                              type="primary"
                              block
                              size="middle"
                              disabled={disabled}
                              className="!rounded-xl"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (disabled) return;
                                void addItem(m);
                              }}
                            >
                              Thêm vào giỏ
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {menuByCategory.length === 0 ? (
                    <div className="text-sm text-gray-500">Không có món.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCartPanel = (opts?: { inDrawer?: boolean }) => {
    const inDrawer = Boolean(opts?.inDrawer);
    const { items, totalQty, cartTotal } = orderView;
    const prepaidItems = orderDetail?.prepaid?.items || [];
    const prepaidTotal = Number(orderDetail?.prepaid?.total_amount || 0);
    const hasPrepaidItems = prepaidItems.length > 0;
    const hasItems = Boolean(orderDetail) && items.length > 0;

    const cartListMaxHeight =
      hasItems && items.length > 4 ? (inDrawer ? "40vh" : "420px") : undefined;

    return (
      <div className={inDrawer ? "" : "sticky top-4"}>
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-white to-blue-50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Giỏ hàng</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {totalQty} sản phẩm
                </div>
              </div>
              <Button
                type="primary"
                danger
                size="middle"
                onClick={openPayModal}
                disabled={
                  !orderDetail ||
                  (items.length === 0 && (prepaidItems.length || 0) === 0)
                }
                className="!rounded-full"
              >
                Thanh toán
              </Button>
            </div>
          </div>

          <div className={hasItems ? "p-3" : "p-4"}>
            {!orderDetail || (!hasPrepaidItems && items.length === 0) ? (
              <div className="py-6">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    !orderDetail ? "Chọn/mở bàn để gọi món" : "Chưa có món"
                  }
                />
              </div>
            ) : null}

            {hasPrepaidItems ? (
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-amber-800">
                      Món khách đã thanh toán trước
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      {orderDetail?.prepaid?.total_qty || 0} món • Đã thanh toán{" "}
                      {formatMoney(prepaidTotal)}
                    </div>
                  </div>
                  <Tag color="gold">0đ tại quầy</Tag>
                </div>

                {normalizeReservationNote(orderDetail?.prepaid?.notes) ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-xs text-amber-900">
                    Ghi chú đặt trước:{" "}
                    {normalizeReservationNote(orderDetail?.prepaid?.notes)}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {prepaidItems.map((it) => (
                    <div
                      key={`prepaid-${it.service_id}-${it.service_name}`}
                      className="rounded-2xl border border-amber-100 bg-white/90 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate text-amber-950">
                            {it.service_name}
                          </div>
                          <div className="text-xs text-amber-700 mt-0.5">
                            Giá tại quầy:{" "}
                            {formatMoney(Number(it.unit_price || 0))}
                          </div>
                        </div>
                        <div className="text-sm font-semibold whitespace-nowrap text-emerald-700">
                          0đ
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-amber-800">
                        <span>Số lượng: {it.quantity}</span>
                        <span>
                          Đã trả trước:{" "}
                          {formatMoney(Number(it.line_total || 0))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              className={hasItems ? "space-y-2" : "hidden"}
              style={{
                maxHeight: cartListMaxHeight,
                overflowY: cartListMaxHeight ? "auto" : "visible",
              }}
            >
              {items.map((it) => {
                const busy = itemBusyId === it.order_item_id;
                return (
                  <div
                    key={it.order_item_id}
                    className="rounded-2xl border bg-gray-50/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {it.service_name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatMoney(Number(it.unit_price || 0))} / ly
                        </div>
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">
                        {formatMoney(Number(it.line_total || 0))}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="small"
                          disabled={!orderDetail || busy}
                          onClick={() =>
                            setItemQuantity(it.order_item_id, it.quantity - 1)
                          }
                        >
                          -
                        </Button>
                        <div className="min-w-[34px] text-center text-sm font-semibold">
                          {it.quantity}
                        </div>
                        <Button
                          size="small"
                          disabled={!orderDetail || busy}
                          onClick={() =>
                            setItemQuantity(it.order_item_id, it.quantity + 1)
                          }
                        >
                          +
                        </Button>
                      </div>

                      <Popconfirm
                        title="Xóa món này khỏi giỏ?"
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => deleteItem(it.order_item_id)}
                        disabled={!orderDetail || busy}
                      >
                        <Button
                          size="small"
                          danger
                          disabled={!orderDetail || busy}
                        >
                          Xóa
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-3 border-t bg-white">
            {hasPrepaidItems ? (
              <div className="mb-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Khung thanh toán này chỉ tính các món gọi thêm tại bàn. Món đặt
                trước đã được ghi nhận riêng.
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {hasPrepaidItems ? "Tổng món gọi thêm" : "Tổng"}
              </div>
              <div className="text-lg font-bold text-blue-700">
                {formatMoney(cartTotal)}
              </div>
            </div>

            <div className="mt-1 flex items-center justify-end">
              <Button
                type="link"
                size="small"
                onClick={() => {
                  const base =
                    props.role === "employee"
                      ? "/employee/front-office/payments-history"
                      : "/owner/front-office/payments-history";
                  navigate(
                    `${base}?location_id=${encodeURIComponent(String(locationId))}`,
                  );
                }}
              >
                Lịch sử thanh toán
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInvoiceItemSection = (
    title: string,
    items: PosInvoice["items"],
    amount: number,
    accent: "amber" | "blue",
    opts?: { zeroAtCounter?: boolean },
  ) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    const tone =
      accent === "amber"
        ? {
            wrap: "border-amber-100 bg-amber-50/60",
            text: "text-amber-900",
            sub: "text-amber-700",
            row: "border-amber-100 bg-white/90",
          }
        : {
            wrap: "border-blue-100 bg-blue-50/50",
            text: "text-blue-900",
            sub: "text-blue-700",
            row: "border-blue-100 bg-white/90",
          };

    return (
      <div className={`rounded-2xl border p-3 ${tone.wrap}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-sm font-semibold ${tone.text}`}>{title}</div>
            <div className={`text-xs mt-0.5 ${tone.sub}`}>
              {items.length} món •{" "}
              {items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}{" "}
              sản phẩm
            </div>
          </div>
          <div className={`text-sm font-semibold ${tone.text}`}>
            {opts?.zeroAtCounter ? "0đ tại quầy" : formatMoney(amount)}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div
              key={`${title}-${it.service_id}-${it.service_name}`}
              className={`grid grid-cols-[1fr_60px_110px_120px] rounded-2xl border px-3 py-2 text-sm ${tone.row}`}
            >
              <div className="min-w-0 truncate">{it.service_name}</div>
              <div className="text-right font-semibold">{it.quantity}</div>
              <div className="text-right">{formatMoney(it.unit_price)}</div>
              <div className="text-right font-semibold">
                {opts?.zeroAtCounter ? "0đ" : formatMoney(it.line_total)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Modal
        open={payOpen}
        onCancel={() => {
          if (payBusy) return;
          resetPayState();
        }}
        footer={null}
        centered={false}
        style={{ top: invoice || transferInit ? 32 : 56 }}
        width={invoice || transferInit ? 640 : 620}
        title={null}
        styles={{ container: { borderRadius: 24, overflow: "hidden" } }}
        destroyOnHidden
      >
        {invoice ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="text-2xl font-semibold">Hóa đơn</div>
                <div className="rounded-full border bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-700">
                  #{invoice.payment_id}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-base font-semibold text-blue-800">
                  {invoice.location_name || "-"}
                </div>
                <div className="text-xs text-gray-500">
                  Owner: {invoice.owner_name || "-"} •{" "}
                  {formatDateTime(invoice.payment_time)}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border bg-slate-50 px-4 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Bàn</span>
                  <span className="font-semibold">
                    {invoice.table_name || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                {(invoice.prepaid_items?.length || 0) > 0 ||
                (invoice.onsite_items?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {renderInvoiceItemSection(
                      "Món khách đã thanh toán trước",
                      invoice.prepaid_items || [],
                      Number(invoice.prepaid_amount || 0),
                      "amber",
                      { zeroAtCounter: true },
                    )}
                    {renderInvoiceItemSection(
                      "Món gọi thêm tại bàn",
                      invoice.onsite_items || [],
                      Number(invoice.onsite_amount || 0),
                      "blue",
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                      <div>Món</div>
                      <div className="text-right">SL</div>
                      <div className="text-right">Giá</div>
                      <div className="text-right">Thành tiền</div>
                    </div>

                    <div className="divide-y">
                      {invoice.items.map((it) => (
                        <div
                          key={`${it.service_id}-${it.service_name}`}
                          className="grid grid-cols-[1fr_60px_110px_120px] py-3 text-sm"
                        >
                          <div className="min-w-0 truncate">
                            {it.service_name}
                          </div>
                          <div className="text-right font-semibold">
                            {it.quantity}
                          </div>
                          <div className="text-right">
                            {formatMoney(it.unit_price)}
                          </div>
                          <div className="text-right font-semibold">
                            {formatMoney(it.line_total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 border-t pt-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Số món:{" "}
                    <b>
                      {Math.max(
                        invoice.items.length,
                        (invoice.prepaid_items || []).length +
                          (invoice.onsite_items || []).length,
                      )}
                    </b>{" "}
                    • Tổng SL: <b>{invoice.total_qty}</b>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {formatMoney(invoice.total_amount)}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  className="h-10 rounded-full border-blue-600 px-6 text-blue-700"
                  onClick={async () => {
                    resetPayState();
                    setDrawerOpen(false);
                    setOrderDetail(null);
                    setActiveTable(null);
                    await load();
                  }}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        ) : transferInit ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="text-2xl font-semibold">Chuyển khoản</div>

              <div className="mt-4 rounded-3xl border bg-slate-50 p-4">
                <div className="flex items-center justify-center">
                  {transferInit.qr.qr_code_url ? (
                    <img
                      src={transferInit.qr.qr_code_url}
                      alt="VietQR"
                      className="w-[220px] h-[220px] object-contain rounded-2xl bg-white"
                    />
                  ) : (
                    <div className="h-[220px] w-[220px] rounded-2xl border bg-white flex items-center justify-center text-sm text-gray-500">
                      [Mã QR]
                    </div>
                  )}
                </div>
                <div className="mt-3 text-center text-sm text-gray-700">
                  Quét để thanh toán đúng số tiền
                </div>
                <div className="text-center text-xs text-gray-500">
                  Sử dụng app ngân hàng hoặc Ví điện tử
                </div>
              </div>

              <div className="mt-4 rounded-3xl border p-4 text-sm">
                <div className="font-semibold text-blue-800">
                  {transferInit.qr.bank_name}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">STK:</span>
                    <span className="font-semibold">
                      {transferInit.qr.bank_account}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Chủ TK:</span>
                    <span className="font-semibold">
                      {transferInit.qr.account_holder}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-base font-semibold text-blue-800">
                  {transferInit.context.location_name || "-"}
                </div>
                <div className="text-xs text-gray-500">
                  Owner: {transferInit.context.owner_name || "-"} •{" "}
                  {formatDateTime(transferInit.context.payment_time)}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border bg-slate-50 px-4 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Bàn</span>
                  <span className="font-semibold">
                    {transferInit.context.table_name || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Món</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>

                <div className="divide-y">
                  {transferInit.context.items.map((it) => (
                    <div
                      key={`${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_60px_110px_120px] py-3 text-sm"
                    >
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">
                        {it.quantity}
                      </div>
                      <div className="text-right">
                        {formatMoney(it.unit_price)}
                      </div>
                      <div className="text-right font-semibold">
                        {formatMoney(it.line_total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t pt-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Số món: <b>{transferInit.context.items.length}</b> • Tổng
                    SL: <b>{transferInit.context.total_qty}</b>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {formatMoney(transferInit.context.total_amount)}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Button
                  className="h-11 w-full rounded-full"
                  onClick={() => {
                    if (payBusy) return;
                    setTransferInit(null);
                    setPayConfirmed(false);
                  }}
                >
                  Quay lại
                </Button>
                <Button
                  type="primary"
                  className="h-11 w-full rounded-full"
                  loading={payBusy}
                  onClick={() => void runTransferComplete()}
                >
                  Xác nhận đã chuyển khoản
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="text-2xl font-semibold">Thanh toán</div>
              <div className="mt-1 text-xs text-gray-500 border-l-2 border-blue-600 pl-2">
                Chọn phương thức thanh toán
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button
                  size="large"
                  onClick={() => {
                    setPayMethod("cash");
                    setPayConfirmed(false);
                  }}
                  type={payMethod === "cash" ? "primary" : "default"}
                  className="h-12 rounded-2xl font-semibold"
                >
                  Tiền mặt
                </Button>
                <Button
                  size="large"
                  onClick={() => {
                    setPayMethod("transfer");
                    setPayConfirmed(false);
                  }}
                  type={payMethod === "transfer" ? "primary" : "default"}
                  className="h-12 rounded-2xl font-semibold"
                >
                  Chuyển khoản
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                {payMethod === "cash" ? (
                  <div>
                    Tiền mặt: bấm <b>Xác nhận</b> rồi bấm <b>Thanh toán</b>
                    <div className="text-sm text-gray-600"></div>
                  </div>
                ) : (
                  <div>
                    Chuyển khoản: bấm <b>Xác nhận</b> rồi bấm <b>Thanh toán</b>{" "}
                    để hiện mã QR.
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  className="h-11 flex-1 rounded-full"
                  onClick={() => {
                    if (payBusy) return;
                    resetPayState();
                  }}
                >
                  Hủy
                </Button>
                <Button
                  className="h-11 flex-1 rounded-full"
                  onClick={() => setPayConfirmed(true)}
                  disabled={payConfirmed}
                >
                  Xác nhận
                </Button>
                <Button
                  type="primary"
                  className="h-11 flex-1 rounded-full"
                  loading={payBusy}
                  disabled={!payConfirmed}
                  onClick={() => {
                    if (!payConfirmed) return;
                    if (payMethod === "cash") {
                      void runCashPay();
                      return;
                    }
                    void runTransferInit();
                  }}
                >
                  Thanh toán
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Card
        title="Sơ đồ bàn (POS)"
        extra={
          <Space wrap>
            <Segmented
              options={areaOptions}
              value={area}
              onChange={(v) => setArea(String(v))}
            />
            <Button onClick={load} loading={loading}>
              Tải lại
            </Button>
            <Button
              className="md:hidden"
              type="primary"
              onClick={() => setDrawerOpen(true)}
              disabled={!activeTable}
            >
              Menu / Order
            </Button>
          </Space>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-[520px_1fr] xl:grid-cols-[520px_1fr_360px] gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-gray-500">
                Chọn bàn để mở order và gọi món.
              </div>
              {activeTable ? (
                <div className="text-xs text-gray-500">
                  Đang chọn: <b>{formatTableName(activeTable.table_name)}</b>
                </div>
              ) : null}
            </div>

            <div className="max-h-[380px] lg:max-h-[520px] overflow-y-auto overflow-x-hidden pr-1 space-y-2">
              {[...tables]
                .sort((a, b) =>
                  String(a.table_name || "").localeCompare(
                    String(b.table_name || ""),
                    "vi",
                    { numeric: true, sensitivity: "base" },
                  ),
                )
                .map((t) => {
                  const meta = tableMeta(t.status);
                  const selected =
                    Number(activeTable?.table_id) === Number(t.table_id);
                  const tone =
                    t.status === "free"
                      ? "border-gray-200 bg-white"
                      : t.status === "occupied"
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-amber-200 bg-amber-50/70";

                  const leftBar =
                    t.status === "free"
                      ? "border-l-gray-300"
                      : t.status === "occupied"
                        ? "border-l-blue-400"
                        : "border-l-amber-400";

                  return (
                    <div
                      key={t.table_id}
                      className={
                        "rounded-2xl border border-l-4 p-3 shadow-sm hover:shadow-md transition cursor-pointer " +
                        tone +
                        " " +
                        leftBar +
                        (selected
                          ? " ring-4 ring-blue-100 border-blue-400"
                          : "")
                      }
                      onClick={() => openTable(t)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {formatTableName(t.table_name)}
                          </div>
                          {t.status === "occupied" ? (
                            <div className="text-xs text-gray-700 mt-1 space-y-1">
                              <div className="font-semibold">
                                Tạm tính:{" "}
                                {formatMoney(Number(t.final_amount || 0))}
                              </div>
                              {normalizeReservationNote(t.reservation_notes) ? (
                                <div className="text-[11px] text-amber-700 line-clamp-2">
                                  Ghi chú:{" "}
                                  {normalizeReservationNote(
                                    t.reservation_notes,
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : t.status === "reserved" ? (
                            <div className="text-xs text-gray-700 mt-1 space-y-1">
                              <div>Bàn đã đặt</div>
                              {t.reservation_contact_name ||
                              t.reservation_contact_phone ||
                              t.reservation_check_in_date ? (
                                <div className="text-[11px] text-amber-700 space-y-0.5">
                                  <div>
                                    {[
                                      String(
                                        t.reservation_contact_name || "",
                                      ).trim(),
                                      String(
                                        t.reservation_contact_phone || "",
                                      ).trim(),
                                      t.reservation_check_in_date
                                        ? formatDateTime(
                                            t.reservation_check_in_date,
                                          )
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" - ")}
                                  </div>
                                  {normalizeReservationNote(
                                    t.reservation_notes,
                                  ) ? (
                                    <div>
                                      Ghi chú:{" "}
                                      {normalizeReservationNote(
                                        t.reservation_notes,
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">
                              Bàn trống
                            </div>
                          )}
                        </div>

                        <div className="flex items-end flex-col gap-2">
                          <Tag color={meta.color} className="!m-0">
                            {meta.label}
                          </Tag>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {tables.length === 0 ? (
              <div className="text-sm text-gray-500 mt-4">
                Chưa có bàn. Owner tạo bàn ở Back-office.
              </div>
            ) : null}
          </div>

          {/* Menu panel (md+) */}
          <div className="hidden md:block min-w-0">{renderMenuPanel()}</div>

          {/* Cart: xl right column */}
          <div className="hidden xl:block min-w-0">{renderCartPanel()}</div>

          {/* Cart: md..lg below spanning two columns */}
          <div className="hidden md:block xl:hidden md:col-span-2 min-w-0">
            {renderCartPanel()}
          </div>
        </div>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        title={
          activeTable
            ? `Menu / Order • ${activeTable.table_name}`
            : "Menu / Order"
        }
      >
        <div className="space-y-4">
          {renderMenuPanel({ inDrawer: true })}
          {renderCartPanel({ inDrawer: true })}
        </div>
      </Drawer>
    </Space>
  );
}
