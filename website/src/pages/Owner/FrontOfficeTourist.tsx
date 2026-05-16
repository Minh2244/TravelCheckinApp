import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Segmented,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import ownerApi from "../../api/ownerApi";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import PosCard from "../../modules/frontOffice/components/PosCard";
import PosStatCard from "../../modules/frontOffice/components/PosStatCard";
import useTouristTicketSync from "../../modules/frontOffice/hooks/useTouristTicketSync";

type ServiceStat = {
  service_id: number;
  service_name: string;
  price: number | string;
  total_today: number;
  sold_today: number;
  used_today: number;
  remaining_today: number;
};

type HistoryRow = {
  action: "sold" | "used";
  source: "booking" | "pos";
  ticket_code: string;
  service_name: string;
  at: string;
  used_by?: number | string | null;
};

type TodaySummary = {
  date: string;
  services: ServiceStat[];
  history: HistoryRow[];
};

type CartItem = {
  service_id: number;
  service_name: string;
  price: number;
  remaining_today: number;
  quantity: number;
};

type PayMethod = "cash" | "transfer";

type TicketLineItem = {
  service_id: number;
  service_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type TicketInvoice = {
  payment_id: number | null;
  location_name: string | null;
  owner_name: string | null;
  payment_time: string;
  items: TicketLineItem[];
  total_qty: number;
  total_amount: number;
};

type TransferInit = {
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
    items: TicketLineItem[];
    total_qty: number;
    total_amount: number;
  };
};

function formatDateTime(value: unknown) {
  return formatDateTimeVi(value);
}

export default function FrontOfficeTourist(props: {
  locationId: number;
  role: "owner" | "employee";
}) {
  const { locationId } = props;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [summary, setSummary] = useState<TodaySummary | null>(null);

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanInfo, setLastScanInfo] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const [scanReader] = useState(() => new BrowserMultiFormatReader());
  const scanControlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [sellServiceId, setSellServiceId] = useState<number | null>(null);
  const [sellQty, setSellQty] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [payBusy, setPayBusy] = useState(false);
  const [transferInit, setTransferInit] = useState<TransferInit | null>(null);
  const [invoice, setInvoice] = useState<TicketInvoice | null>(null);
  const [issuedCount, setIssuedCount] = useState<number>(0);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getTouristTicketToday({
        location_id: locationId,
      });
      setSummary((res?.data as TodaySummary) || null);
    } catch (err: unknown) {
      setSummary(null);
      message.error(getErrorMessage(err, "Lỗi tải dữ liệu vé"));
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const { sseState } = useTouristTicketSync({
    locationId,
    onSync: () => void loadToday(),
  });

  useEffect(() => {
    if (sellServiceId != null) return;
    const first = summary?.services?.[0];
    if (first?.service_id != null) setSellServiceId(Number(first.service_id));
  }, [sellServiceId, summary]);

  const scan = async (raw?: string) => {
    const c = String(raw ?? code).trim();
    if (!c) return;
    setScanning(true);
    try {
      const res = await ownerApi.scanTouristTicket({
        location_id: locationId,
        ticket_code: c,
      });
      const serviceName = String(
        asRecord(asRecord(res).data).service_name || "",
      );
      setLastScanInfo(serviceName ? `HỢP LỆ: ${serviceName}` : "HỢP LỆ");
      message.success(serviceName ? `HỢP LỆ: ${serviceName}` : "HỢP LỆ");
      setCode("");
      await loadToday();
    } catch (err: unknown) {
      setLastScanInfo(null);
      message.error(getErrorMessage(err, "KHÔNG HỢP LỆ"));
    } finally {
      setScanning(false);
    }
  };

  const stopCamera = useCallback(() => {
    try {
      scanControlsRef.current?.stop();
    } catch {
      // ignore
    }
    scanControlsRef.current = null;
    // Explicitly stop media stream tracks to release camera hardware
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // Keep scan function in a ref to avoid stale closure in startCamera callback
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  // Guard to prevent concurrent startCamera calls
  const startingRef = useRef(false);

  const startCamera = useCallback(async () => {
    if (startingRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    startingRef.current = true;
    setScanError(null);
    setCameraReady(false);
    stopCamera();

    try {
      const controls = await scanReader.decodeFromVideoDevice(
        undefined,
        video,
        (result, err) => {
          if (result) {
            const text = result.getText();
            stopCamera();
            setScanModalOpen(false);
            void scanRef.current(text);
          } else if (err) {
            // ignore decode misses
          }
        },
      );
      scanControlsRef.current = controls;
      setCameraReady(true);
    } catch (error) {
      console.error(error);
      setScanError(
        "Không mở được camera. Hãy cấp quyền camera hoặc dùng nhập mã thủ công.",
      );
    } finally {
      startingRef.current = false;
    }
  }, [scanReader, stopCamera]);

  // Start camera when modal opens, wait for video element via rAF polling
  useEffect(() => {
    if (!scanModalOpen) {
      stopCamera();
      return;
    }
    let rafId: number;
    const tryStart = () => {
      if (videoRef.current) {
        void startCamera();
      } else {
        rafId = requestAnimationFrame(tryStart);
      }
    };
    rafId = requestAnimationFrame(tryStart);
    return () => {
      cancelAnimationFrame(rafId);
      stopCamera();
    };
  }, [scanModalOpen, startCamera, stopCamera]);

  const serviceColumns: ColumnsType<ServiceStat> = useMemo(
    () => [
      { title: "Loại vé", dataIndex: "service_name" },
      {
        title: "Tổng vé/ngày",
        dataIndex: "total_today",
        width: 120,
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Đã bán hôm nay",
        dataIndex: "sold_today",
        width: 130,
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Còn lại",
        dataIndex: "remaining_today",
        width: 100,
        render: (v: unknown) => (
          <Tag color={Number(v || 0) > 0 ? "green" : "red"}>
            {Number(v || 0)}
          </Tag>
        ),
      },
      {
        title: "Đã soát hôm nay",
        dataIndex: "used_today",
        width: 130,
        render: (v: unknown) => Number(v || 0),
      },
    ],
    [],
  );

  const totalStats = useMemo(() => {
    const items = summary?.services || [];
    const total = items.reduce((sum, x) => sum + Number(x.total_today || 0), 0);
    const sold = items.reduce((sum, x) => sum + Number(x.sold_today || 0), 0);
    const used = items.reduce((sum, x) => sum + Number(x.used_today || 0), 0);
    const remaining = items.reduce(
      (sum, x) => sum + Number(x.remaining_today || 0),
      0,
    );
    return { total, sold, used, remaining };
  }, [summary]);

  const serviceOptions = useMemo(() => {
    return (summary?.services || []).map((s) => ({
      value: Number(s.service_id),
      label: `${s.service_name} (còn ${Number(s.remaining_today || 0)})`,
    }));
  }, [summary]);

  const selectedService = useMemo(() => {
    const sid = sellServiceId;
    if (sid == null) return null;
    return (summary?.services || []).find((s) => Number(s.service_id) === sid);
  }, [sellServiceId, summary]);

  const addToCart = useCallback(() => {
    if (!selectedService) {
      message.warning("Vui lòng chọn loại vé");
      return;
    }
    const qty = Math.max(1, Math.min(200, Number(sellQty ?? 1)));
    if (!Number.isFinite(qty) || qty < 1) {
      message.warning("Số lượng không hợp lệ");
      return;
    }
    const remaining = Number(selectedService.remaining_today ?? NaN);
    if (Number.isFinite(remaining) && qty > remaining) {
      message.warning(`Không đủ vé. Còn lại ${remaining}`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex(
        (x) => Number(x.service_id) === Number(selectedService.service_id),
      );
      if (idx >= 0) {
        const next = [...prev];
        const cur = next[idx];
        const nextQty = Math.max(1, Math.min(200, cur.quantity + qty));
        next[idx] = { ...cur, quantity: nextQty };
        return next;
      }
      return [
        ...prev,
        {
          service_id: Number(selectedService.service_id),
          service_name: String(selectedService.service_name || ""),
          price: Number(selectedService.price || 0),
          remaining_today: Number(selectedService.remaining_today || 0),
          quantity: qty,
        },
      ];
    });
  }, [sellQty, selectedService]);

  const cartTotals = useMemo(() => {
    const totalQty = cart.reduce((sum, x) => sum + Number(x.quantity || 0), 0);
    const totalAmount = cart.reduce(
      (sum, x) => sum + Number(x.quantity || 0) * Number(x.price || 0),
      0,
    );
    return { totalQty, totalAmount };
  }, [cart]);

  const syncBadge = useMemo(() => {
    if (sseState === "connected") {
      return {
        text: "Realtime",
        className: "fo-pill border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }
    if (sseState === "disconnected") {
      return {
        text: "Auto 30s",
        className: "fo-pill border-amber-200 bg-amber-50 text-amber-700",
      };
    }
    return {
      text: "Dang ket noi",
      className: "fo-pill border-slate-200 bg-slate-50 text-slate-600",
    };
  }, [sseState]);

  const buildPayItems = useCallback(() => {
    return cart.map((c) => ({
      service_id: Number(c.service_id),
      quantity: Number(c.quantity),
    }));
  }, [cart]);

  const resetPayState = useCallback(() => {
    setPayBusy(false);
    setTransferInit(null);
    setInvoice(null);
    setIssuedCount(0);
  }, []);

  const checkoutOffline = useCallback(async () => {
    if (cart.length === 0) {
      message.warning("Giỏ vé đang trống");
      return;
    }

    // Re-validate with latest summary
    const remainingByService = new Map<number, number>();
    for (const s of summary?.services || []) {
      remainingByService.set(
        Number(s.service_id),
        Number(s.remaining_today || 0),
      );
    }
    for (const it of cart) {
      const rem = remainingByService.get(Number(it.service_id));
      if (rem != null && Number(it.quantity || 0) > rem) {
        message.warning(
          `Không đủ vé: ${it.service_name}. Còn lại ${rem}, bạn chọn ${it.quantity}`,
        );
        return;
      }
    }

    resetPayState();
    setPayMethod("cash");
    setPayModalOpen(true);
  }, [cart, resetPayState, summary]);

  const runCashPay = useCallback(async () => {
    if (cart.length === 0) return;
    setPayBusy(true);
    try {
      const res = await ownerApi.payTouristPosTicketsBatch({
        location_id: locationId,
        payment_method: "cash",
        items: buildPayItems(),
      });
      const data = asRecord(asRecord(res).data);
      const inv = asRecord(data.invoice);
      const ticketsRaw = data.tickets;
      const codesRaw = data.ticket_codes;
      const count = Array.isArray(ticketsRaw)
        ? ticketsRaw.length
        : Array.isArray(codesRaw)
          ? codesRaw.length
          : 0;

      setIssuedCount(count);
      setInvoice({
        payment_id:
          inv.payment_id == null ? null : Number(inv.payment_id || null),
        location_name:
          inv.location_name == null ? null : String(inv.location_name),
        owner_name: inv.owner_name == null ? null : String(inv.owner_name),
        payment_time: String(inv.payment_time || ""),
        items: Array.isArray(inv.items)
          ? (inv.items as any[]).map((x: any) => ({
              service_id: Number(x.service_id),
              service_name: String(x.service_name || ""),
              quantity: Number(x.quantity || 0),
              unit_price: Number(x.unit_price || 0),
              line_total: Number(x.line_total || 0),
            }))
          : [],
        total_qty: Number(inv.total_qty || 0),
        total_amount: Number(inv.total_amount || 0),
      });

      setCart([]);
      setSellQty(1);
      message.success("Thanh toán tiền mặt thành công");
      await loadToday();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi thanh toán offline"));
    } finally {
      setPayBusy(false);
    }
  }, [buildPayItems, cart.length, loadToday, locationId]);

  const runTransferInit = useCallback(async () => {
    if (cart.length === 0) return;
    setPayBusy(true);
    try {
      const res = await ownerApi.payTouristPosTicketsBatch({
        location_id: locationId,
        payment_method: "transfer",
        step: "init",
        items: buildPayItems(),
      });
      const data = asRecord(asRecord(res).data);
      const ctx = asRecord(data.context);
      const qr = asRecord(data.qr);
      setTransferInit({
        payment_id: Number(data.payment_id),
        qr: {
          qr_code_url: String(qr.qr_code_url || ""),
          bank_name: String(qr.bank_name || ""),
          bank_account: String(qr.bank_account || ""),
          account_holder: String(qr.account_holder || ""),
          amount: Number(qr.amount || 0),
          note: String(qr.note || ""),
        },
        context: {
          location_name:
            ctx.location_name == null ? null : String(ctx.location_name),
          owner_name: ctx.owner_name == null ? null : String(ctx.owner_name),
          payment_time: String(ctx.payment_time || ""),
          items: Array.isArray(ctx.items)
            ? (ctx.items as any[]).map((x: any) => ({
                service_id: Number(x.service_id),
                service_name: String(x.service_name || ""),
                quantity: Number(x.quantity || 0),
                unit_price: Number(x.unit_price || 0),
                line_total: Number(x.line_total || 0),
              }))
            : [],
          total_qty: Number(ctx.total_qty || 0),
          total_amount: Number(ctx.total_amount || 0),
        },
      });
      message.success("Đã tạo mã QR chuyển khoản");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể tạo mã QR"));
    } finally {
      setPayBusy(false);
    }
  }, [buildPayItems, cart.length, locationId]);

  const runTransferComplete = useCallback(async () => {
    const pid = Number(transferInit?.payment_id);
    if (!Number.isFinite(pid) || cart.length === 0) return;
    setPayBusy(true);
    try {
      const res = await ownerApi.payTouristPosTicketsBatch({
        location_id: locationId,
        payment_method: "transfer",
        step: "complete",
        payment_id: pid,
        items: buildPayItems(),
      });
      const data = asRecord(asRecord(res).data);
      const inv = asRecord(data.invoice);
      const ticketsRaw = data.tickets;
      const codesRaw = data.ticket_codes;
      const count = Array.isArray(ticketsRaw)
        ? ticketsRaw.length
        : Array.isArray(codesRaw)
          ? codesRaw.length
          : 0;

      setIssuedCount(count);
      setInvoice({
        payment_id:
          inv.payment_id == null ? null : Number(inv.payment_id || null),
        location_name:
          inv.location_name == null ? null : String(inv.location_name),
        owner_name: inv.owner_name == null ? null : String(inv.owner_name),
        payment_time: String(inv.payment_time || ""),
        items: Array.isArray(inv.items)
          ? (inv.items as any[]).map((x: any) => ({
              service_id: Number(x.service_id),
              service_name: String(x.service_name || ""),
              quantity: Number(x.quantity || 0),
              unit_price: Number(x.unit_price || 0),
              line_total: Number(x.line_total || 0),
            }))
          : [],
        total_qty: Number(inv.total_qty || 0),
        total_amount: Number(inv.total_amount || 0),
      });

      setCart([]);
      setSellQty(1);
      message.success("Đã xác nhận chuyển khoản");
      await loadToday();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Không thể xác nhận"));
    } finally {
      setPayBusy(false);
    }
  }, [
    buildPayItems,
    cart.length,
    loadToday,
    locationId,
    transferInit?.payment_id,
  ]);

  const cartColumns: ColumnsType<CartItem> = useMemo(
    () => [
      { title: "Loại vé", dataIndex: "service_name" },
      {
        title: "Đơn giá",
        dataIndex: "price",
        width: 110,
        render: (v: unknown) => Number(v || 0).toLocaleString("vi-VN"),
      },
      {
        title: "SL",
        dataIndex: "quantity",
        width: 110,
        render: (_: unknown, r: CartItem) => (
          <InputNumber
            min={1}
            max={200}
            value={Number(r.quantity || 1)}
            onChange={(v) => {
              const qty = Math.max(1, Math.min(200, Number(v ?? 1)));
              setCart((prev) =>
                prev.map((x) =>
                  x.service_id === r.service_id ? { ...x, quantity: qty } : x,
                ),
              );
            }}
            style={{ width: 90 }}
          />
        ),
      },
      {
        title: "Thành tiền",
        dataIndex: "line_total",
        width: 130,
        render: (_: unknown, r: CartItem) =>
          (Number(r.quantity || 0) * Number(r.price || 0)).toLocaleString(
            "vi-VN",
          ),
      },
      {
        title: "",
        dataIndex: "actions",
        width: 90,
        render: (_: unknown, r: CartItem) => (
          <Button
            danger
            onClick={() =>
              setCart((prev) =>
                prev.filter((x) => x.service_id !== r.service_id),
              )
            }
          >
            Xóa
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <PosCard
              title={
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">Soát vé</span>
                  <span className={syncBadge.className}>{syncBadge.text}</span>
                </div>
              }
              extra={
                <span className="text-xs text-slate-500">
                  {summary?.date ? `Ngày ${summary.date}` : "Hôm nay"}
                </span>
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Nhập ticket_code / QR payload"
                  style={{ maxWidth: 420 }}
                  size="large"
                  onPressEnter={() => void scan()}
                />
                <Button
                  type="primary"
                  size="large"
                  className="h-12 rounded-full px-6"
                  onClick={() => setScanModalOpen(true)}
                >
                  Quét QR
                </Button>
                <Button
                  size="large"
                  className="h-12 rounded-full px-6"
                  onClick={() => void scan()}
                  disabled={scanning || !code.trim()}
                >
                  Kiểm tra mã
                </Button>
              </div>
              {lastScanInfo ? (
                <div className="mt-3 text-sm font-semibold text-emerald-700">
                  {lastScanInfo}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  Quét QR bằng camera hoặc nhập mã thủ công để soát vé.
                </div>
              )}
          </PosCard>

          <PosCard
            title={`Tồn vé hôm nay${summary?.date ? ` (${summary.date})` : ""}`}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PosStatCard
                label="Tổng vé/ngày"
                value={totalStats.total}
                tone="slate"
              />
              <PosStatCard
                label="Đã bán"
                value={totalStats.sold}
                tone="sky"
              />
              <PosStatCard
                label="Còn lại"
                value={totalStats.remaining}
                tone="emerald"
              />
              <PosStatCard
                label="Đã soát"
                value={totalStats.used}
                tone="amber"
              />
            </div>

            <div className="mt-4">
              <Table
                size="small"
                rowKey={(r) => String(r.service_id)}
                dataSource={summary?.services || []}
                pagination={{ pageSize: 10 }}
                columns={serviceColumns}
                loading={loading}
              />
            </div>
          </PosCard>
        </div>

        <div className="space-y-4">
          <PosCard
            title="Bán vé offline (tại quầy)"
            extra={
              <div className="text-xs text-slate-500">
                Tổng SL: <b>{cartTotals.totalQty}</b> | Tổng tiền:{" "}
                <b>{cartTotals.totalAmount.toLocaleString("vi-VN")}</b>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <Select
                size="large"
                style={{ width: 320, maxWidth: "100%" }}
                options={serviceOptions}
                value={sellServiceId ?? undefined}
                onChange={(v: number) => setSellServiceId(v)}
                placeholder="Chọn loại vé"
              />
              <InputNumber
                min={1}
                max={200}
                value={sellQty}
                onChange={(v) => setSellQty(Number(v ?? 1))}
                style={{ width: 120 }}
                size="large"
              />
              <Button
                size="large"
                className="h-12 rounded-full px-6"
                onClick={addToCart}
                disabled={!sellServiceId}
              >
                Thêm
              </Button>
              <Button
                type="primary"
                size="large"
                className="h-12 rounded-full px-6"
                onClick={() => void checkoutOffline()}
                disabled={cart.length === 0}
              >
                Thanh toán
              </Button>
              <Button
                size="large"
                className="h-12 rounded-full px-6"
                onClick={() => setCart([])}
                disabled={cart.length === 0}
              >
                Xóa giỏ
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {selectedService
                ? `Còn lại hôm nay: ${Number(selectedService.remaining_today || 0)}`
                : "Chọn loại vé để xem tồn"}
            </div>

            <div className="mt-3">
              <Table
                size="small"
                rowKey={(r) => String(r.service_id)}
                dataSource={cart}
                pagination={false}
                columns={cartColumns}
                locale={{ emptyText: "Chưa có vé trong giỏ" }}
              />
            </div>
          </PosCard>

          <PosCard
            title="Lịch sử vé hôm nay"
            extra={
              <Button
                size="small"
                className="rounded-full"
                onClick={() => {
                  const base =
                    props.role === "employee"
                      ? "/employee/front-office/tourist/tickets-history"
                      : "/owner/front-office/tourist/tickets-history";
                  navigate(
                    `${base}?location_id=${encodeURIComponent(String(locationId))}`,
                  );
                }}
              >
                Xem trang lịch sử
              </Button>
            }
          >
            <div className="text-sm text-slate-600">
              Lịch sử vé chi tiết đã chuyển sang trang riêng (có biểu đồ).
            </div>
          </PosCard>
        </div>
      </div>

      <Modal
        open={payModalOpen}
        onCancel={() => {
          if (payBusy) return;
          setPayModalOpen(false);
          resetPayState();
        }}
        footer={null}
        title={null}
        centered={false}
        style={{ top: invoice || transferInit ? 32 : 56 }}
        width={invoice || transferInit ? 640 : 620}
        styles={{ container: { borderRadius: 24, overflow: "hidden" } }}
        destroyOnHidden
      >
        {invoice ? (
          <div className="mx-auto max-w-[520px]">
            <div className="rounded-3xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold">
                    Thanh toán vé offline
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">ID</div>
                  <div className="text-xl font-bold text-gray-800">
                    #{invoice.payment_id ?? "-"}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-base font-semibold text-blue-800">
                  {invoice.location_name || "-"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Owner: {invoice.owner_name || "-"} •{" "}
                  {formatDateTime(invoice.payment_time)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div className="text-gray-500">Số vé</div>
                  <div className="text-right font-semibold">
                    {Number(issuedCount || 0).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-[1fr_70px_90px_110px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Vé</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {invoice.items.map((it) => (
                    <div
                      key={`${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_70px_90px_110px] py-3 text-sm"
                    >
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">
                        {Number(it.quantity || 0).toLocaleString("vi-VN")}
                      </div>
                      <div className="text-right">
                        {Number(it.unit_price || 0).toLocaleString("vi-VN")} đ
                      </div>
                      <div className="text-right font-semibold">
                        {Number(it.line_total || 0).toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t pt-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Tổng số lượng: <b>{invoice.total_qty}</b>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Number(invoice.total_amount || 0).toLocaleString("vi-VN")}{" "}
                    đ
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="primary"
                  className="h-10 rounded-full px-6"
                  onClick={() => {
                    setPayModalOpen(false);
                    resetPayState();
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
              <div className="text-2xl font-semibold">
                Thanh toán vé offline
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="rounded-2xl border bg-white p-4 flex items-center justify-center">
                  {transferInit.qr.qr_code_url ? (
                    <img
                      src={transferInit.qr.qr_code_url}
                      alt="VietQR"
                      className="h-[220px] w-[220px] object-contain"
                    />
                  ) : (
                    <div className="text-sm text-gray-600">Không có QR</div>
                  )}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-sm font-semibold text-gray-800">
                    Quét để thanh toán đúng số tiền
                  </div>
                  <div className="text-xs text-gray-500">
                    Sử dụng app ngân hàng hoặc Ví điện tử
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-blue-800">
                  {transferInit.qr.bank_name || "-"}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div className="text-gray-500">STK</div>
                  <div className="text-right font-semibold">
                    {transferInit.qr.bank_account || "-"}
                  </div>
                  <div className="text-gray-500">Chủ TK</div>
                  <div className="text-right font-semibold">
                    {transferInit.qr.account_holder || "-"}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="text-base font-semibold text-blue-800">
                  {transferInit.context.location_name || "-"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Owner: {transferInit.context.owner_name || "-"} •{" "}
                  {formatDateTime(transferInit.context.payment_time)}
                </div>
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-[1fr_70px_90px_110px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Vé</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {transferInit.context.items.map((it) => (
                    <div
                      key={`${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_70px_90px_110px] py-3 text-sm"
                    >
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">
                        {Number(it.quantity || 0).toLocaleString("vi-VN")}
                      </div>
                      <div className="text-right">
                        {Number(it.unit_price || 0).toLocaleString("vi-VN")} đ
                      </div>
                      <div className="text-right font-semibold">
                        {Number(it.line_total || 0).toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    Tổng số lượng: <b>{transferInit.context.total_qty}</b>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Number(
                      transferInit.context.total_amount || 0,
                    ).toLocaleString("vi-VN")}{" "}
                    đ
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  className="h-11 rounded-full"
                  onClick={() => {
                    if (payBusy) return;
                    setTransferInit(null);
                  }}
                >
                  Quay lại
                </Button>
                <Button
                  type="primary"
                  className="h-11 rounded-full"
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
              <div className="text-2xl font-semibold">
                Thanh toán vé offline
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-gray-600">Tổng SL:</span>{" "}
                    <b>
                      {Number(cartTotals.totalQty || 0).toLocaleString("vi-VN")}
                    </b>
                  </div>
                  <div>
                    <span className="text-gray-600">Tổng tiền:</span>{" "}
                    <b>
                      {Number(cartTotals.totalAmount || 0).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      đ
                    </b>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-600">Phương thức:</div>
                  <Segmented
                    value={payMethod}
                    onChange={(v) => setPayMethod(v as PayMethod)}
                    options={[
                      { label: "Tiền mặt", value: "cash" },
                      { label: "Chuyển khoản", value: "transfer" },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="grid grid-cols-[1fr_70px_90px_110px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Vé</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {cart.map((it) => (
                    <div
                      key={`${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_70px_90px_110px] py-3 text-sm"
                    >
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">
                        {Number(it.quantity || 0).toLocaleString("vi-VN")}
                      </div>
                      <div className="text-right">
                        {Number(it.price || 0).toLocaleString("vi-VN")} đ
                      </div>
                      <div className="text-right font-semibold">
                        {(
                          Number(it.price || 0) * Number(it.quantity || 0)
                        ).toLocaleString("vi-VN")}{" "}
                        đ
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button
                  className="h-11 rounded-full"
                  onClick={() => {
                    if (payBusy) return;
                    setPayModalOpen(false);
                    resetPayState();
                  }}
                >
                  Hủy
                </Button>
                {payMethod === "cash" ? (
                  <Button
                    type="primary"
                    className="h-11 rounded-full"
                    loading={payBusy}
                    onClick={() => void runCashPay()}
                  >
                    Thanh toán tiền mặt
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    className="h-11 rounded-full"
                    loading={payBusy}
                    onClick={() => void runTransferInit()}
                  >
                    Tạo mã QR chuyển khoản
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Quét vé"
        open={scanModalOpen}
        onCancel={() => setScanModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <div className="text-sm text-gray-600 mb-2">
          Đưa QR vào khung hình để hệ thống tự quét.
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-black">
          <video
            ref={videoRef}
            className="h-[340px] w-full object-cover"
            muted
            playsInline
          />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {scanError
            ? scanError
            : cameraReady
              ? "Đang quét..."
              : "Đang khởi tạo camera..."}
        </div>
        <Space style={{ marginTop: 12 }} wrap>
          <Button onClick={() => void startCamera()} disabled={scanning}>
            Quét lại
          </Button>
          <Button
            type="primary"
            onClick={() => {
              stopCamera();
              setScanModalOpen(false);
            }}
          >
            Đóng
          </Button>
        </Space>
      </Modal>
    </>
  );
}
