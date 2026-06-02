// website/src/pages/Admin/Checkins.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Dropdown,
  Input,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  AimOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { statusToVi } from "../../utils/statusText";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { formatMoney } from "../../utils/formatMoney";

interface Checkin {
  checkin_id: number;
  user_id: number;
  location_id: number;
  booking_id: number | null;
  checkin_time: string | null;
  status: "pending" | "verified" | "failed" | string;
  verified_by: number | null;
  device_info: string | null;
  notes: string | null;

  user_name: string;
  user_email: string;
  user_phone: string | null;

  location_name: string;
  address: string | null;
  location_status?: "active" | "inactive" | "pending" | string;

  // Backend là nguồn dữ liệu duy nhất cho vị trí đăng ký và vị trí check-in thực tế
  registered_location: { latitude: number; longitude: number } | null;
  actual_checkin_location: { latitude: number; longitude: number } | null;

  // Backend quyết định trạng thái kiểm chứng
  verification_status: "pending" | "verified" | "failed" | string;
  can_view_location: boolean;

  verified_by_name: string | null;
  verified_by_email: string | null;

  // Khoảng cách (km) do backend tính để phục vụ admin xác thực vị trí
  distance_km: number | null;
}

type PosInvoiceItem = {
  service_id: number;
  service_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type PosInvoiceRow = {
  payment_id: number;
  payment_time: string;
  amount: number;
  payment_method: string;
  transaction_source?: string;
  booking_id?: number | null;
  booking_contact_name?: string | null;
  booking_contact_phone?: string | null;
  table_name: string | null;
  total_qty: number;
  items_count: number;
  hotel?: {
    stay_id: number | null;
    room_number: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    actual_minutes: number | null;
  } | null;
  hotel_rooms?: Array<{
    stay_id: number | null;
    room_number: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    checkin_time: string | null;
    checkout_time: string | null;
    total_amount: number | null;
  }> | null;
  performed_by: {
    role: "owner" | "employee" | "user" | null;
    user_id?: number | null;
    name: string | null;
    phone: string | null;
  };
  processed_by: { name: string | null };
  items: PosInvoiceItem[];
  prepaid_items?: PosInvoiceItem[];
  onsite_items?: PosInvoiceItem[];
  prepaid_amount?: number;
  onsite_amount?: number;
  prepaid_payment_method?: string | null;
  onsite_payment_method?: string | null;
  segment_type?: "prepaid" | "onsite" | null;
};

type TicketInvoiceItem = {
  service_id: number | null;
  service_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type TicketInvoiceRow = {
  source: "booking" | "pos";
  payment_id: number | null;
  booking_id: number | null;
  payment_time: string;
  payment_method?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  total_qty: number;
  total_amount: number;
  items: TicketInvoiceItem[];
};

type RevenueSplit = {
  amount: number;
  cash: number;
  transfer: number;
};

type RevenueSummary = {
  total: RevenueSplit;
  onsite: RevenueSplit;
  booking: RevenueSplit;
};

type LatLng = { lat: number; lng: number };

type MapPointKey = "registered" | "actual";

const statusColors: Record<string, string> = {
  pending: "orange",
  verified: "green",
  failed: "red",
};

// Center mặc định Việt Nam để tránh hiển thị kiểu "world map" ngay từ đầu
const VIETNAM_CENTER: LatLng = { lat: 16.047079, lng: 108.20623 };

// Giới hạn khung nhìn trong phạm vi Việt Nam (giảm việc kéo/zoom ra toàn cầu)
const VIETNAM_BOUNDS: L.LatLngBoundsExpression = [
  [7.0, 101.0],
  [23.5, 110.8],
];

const DEFAULT_VN_ZOOM = 6;
// Cho phép zoom-out vừa đủ để admin có ngữ cảnh (tránh bị kéo quá xa)
const MAP_MIN_ZOOM = 5;
const EXTRA_ZOOM_LEVELS = 10;
const SINGLE_MARKER_ZOOM = 20;

type BaseLayerKey =
  | "osm"
  | "positron"
  | "voyager"
  | "satellite"
  | "mapbox_satellite";

type BaseLayerConfig = {
  key: BaseLayerKey;
  label: string;
  url: string;
  maxZoom: number;
  maxNativeZoom: number;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
  subdomains?: string | string[];
};
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const MAPBOX_ENABLED = Boolean(MAPBOX_TOKEN);

const BASE_LAYERS: BaseLayerConfig[] = [
  {
    key: "osm",
    label: "Bản đồ tiêu chuẩn (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19 + EXTRA_ZOOM_LEVELS,
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    key: "positron",
    label: "Bản đồ sáng (Positron)",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxZoom: 19 + EXTRA_ZOOM_LEVELS,
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    key: "voyager",
    label: "Bản đồ đường phố (Voyager)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    maxZoom: 19 + EXTRA_ZOOM_LEVELS,
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    key: "satellite",
    label: "Vệ tinh (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18 + EXTRA_ZOOM_LEVELS,
    maxNativeZoom: 18,
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  ...(MAPBOX_ENABLED
    ? [
        {
          key: "mapbox_satellite",
          label: "Vệ tinh (Mapbox)",
          url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
          maxZoom: 19 + EXTRA_ZOOM_LEVELS,
          maxNativeZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          attribution: "&copy; Mapbox",
        } as BaseLayerConfig,
      ]
    : []),
];

const BASE_LAYER_MAP = Object.fromEntries(
  BASE_LAYERS.map((layer) => [layer.key, layer]),
) as Record<BaseLayerKey, BaseLayerConfig>;

const BASE_LAYER_ORDER = BASE_LAYERS.map((layer) => layer.key);

const SATELLITE_LABELS_LAYER: Omit<BaseLayerConfig, "label"> = {
  key: "satellite",
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  maxZoom: 18 + EXTRA_ZOOM_LEVELS,
  maxNativeZoom: 18,
  attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
};

const formatCoord = (value: number): string => value.toFixed(6);

const normalizeLatLng = (pos: LatLng | null): LatLng | null => {
  if (!pos) return null;
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const clampZoomToMap = (map: L.Map, desiredZoom: number): number => {
  const maxZoom = map.getMaxZoom();
  if (typeof maxZoom === "number" && Number.isFinite(maxZoom)) {
    return Math.min(desiredZoom, maxZoom);
  }
  return desiredZoom;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const renderPaymentMethodTag = (method: unknown) => {
  const raw = method == null ? "" : String(method);
  const m = raw.trim().toLowerCase();
  if (!m) return "-";

  const isCash =
    m === "cash" ||
    m.includes("cash") ||
    m.includes("tien mat") ||
    m.includes("tiền mặt");
  const isTransfer =
    m === "transfer" ||
    m.includes("transfer") ||
    m.includes("bank") ||
    m.includes("chuyen") ||
    m.includes("chuyển") ||
    m === "banktransfer";

  if (isCash) return <Tag color="gold">TIỀN MẶT</Tag>;
  if (isTransfer) return <Tag color="blue">CHUYỂN KHOẢN</Tag>;
  return <Tag>{raw}</Tag>;
};

const getExecLabel = (row: PosInvoiceRow): string => {
  const name =
    row?.processed_by?.name ||
    row?.performed_by?.name ||
    row?.performed_by?.phone ||
    "-";
  const role = String(row?.performed_by?.role || "").trim();
  const roleLabel =
    role === "owner"
      ? "Owner"
      : role === "employee"
        ? "Nhân viên"
        : role === "user"
          ? "User"
          : "";
  return roleLabel ? `${name} (${roleLabel})` : name;
};

const isMergedRestaurantInvoice = (row: PosInvoiceRow): boolean => {
  return (
    Number(row.prepaid_amount || 0) > 0 && Number(row.onsite_amount || 0) > 0
  );
};

const createLabeledMarkerIcon = (key: MapPointKey): L.DivIcon => {
  const bg = key === "registered" ? "#1677ff" : "#ff4d4f";
  const label = key === "registered" ? "R" : "A";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: ${bg};
        border: 2px solid #ffffff;
        box-shadow: 0 6px 16px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 700;
        font-size: 12px;
        line-height: 1;
      ">${label}</div>
    `.trim(),
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
};

const getNextBaseLayer = (current: BaseLayerKey): BaseLayerKey => {
  const idx = BASE_LAYER_ORDER.indexOf(current);
  if (idx === -1) return BASE_LAYER_ORDER[0];
  return BASE_LAYER_ORDER[(idx + 1) % BASE_LAYER_ORDER.length];
};

const MapViewportController = (props: {
  registeredPos: LatLng | null;
  actualPos: LatLng | null;
  recenterKey: number;
}) => {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;

    const applyView = () => {
      if (cancelled) return;

      const targetZoom = clampZoomToMap(map, SINGLE_MARKER_ZOOM);

      if (
        props.registeredPos &&
        Number.isFinite(props.registeredPos.lat) &&
        Number.isFinite(props.registeredPos.lng)
      ) {
        map.setView(
          [props.registeredPos.lat, props.registeredPos.lng],
          targetZoom,
          { animate: false },
        );
        return;
      }

      if (
        props.actualPos &&
        Number.isFinite(props.actualPos.lat) &&
        Number.isFinite(props.actualPos.lng)
      ) {
        map.setView([props.actualPos.lat, props.actualPos.lng], targetZoom, {
          animate: false,
        });
        return;
      }

      map.setView([VIETNAM_CENTER.lat, VIETNAM_CENTER.lng], DEFAULT_VN_ZOOM, {
        animate: false,
      });
    };

    const tryApply = (attempt = 0) => {
      if (cancelled) return;

      map.invalidateSize();
      const size = map.getSize();
      if (!size || size.x === 0 || size.y === 0) {
        if (attempt < 6) {
          setTimeout(() => tryApply(attempt + 1), 80);
        }
        return;
      }

      applyView();
    };

    setTimeout(() => tryApply(0), 0);

    return () => {
      cancelled = true;
    };
  }, [map, props.actualPos, props.registeredPos, props.recenterKey]);

  return null;
};

const MapReadyObserver = (props: { onReady: () => void }) => {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;

    const checkReady = (attempt = 0) => {
      if (cancelled) return;
      map.invalidateSize();
      const size = map.getSize();
      if (size && size.x > 0 && size.y > 0) {
        props.onReady();
        return;
      }
      if (attempt < 10) {
        setTimeout(() => checkReady(attempt + 1), 80);
      }
    };

    checkReady();

    return () => {
      cancelled = true;
    };
  }, [map, props]);

  return null;
};

const MapBoundsController = (props: { enabled: boolean }) => {
  const map = useMap();

  useEffect(() => {
    if (!props.enabled) return;
    map.setMaxBounds(VIETNAM_BOUNDS);
    map.options.maxBoundsViscosity = 1.0;
  }, [map, props.enabled]);

  return null;
};

const MapRecenterControl = (props: {
  registeredPos: LatLng | null;
  actualPos: LatLng | null;
  disabled?: boolean;
}) => {
  const map = useMap();

  const recenter = useCallback(() => {
    const hasRegistered = !!props.registeredPos;
    const hasActual = !!props.actualPos;

    const targetZoom = clampZoomToMap(map, SINGLE_MARKER_ZOOM);

    if (
      hasRegistered &&
      hasActual &&
      Number.isFinite(props.registeredPos!.lat) &&
      Number.isFinite(props.registeredPos!.lng) &&
      Number.isFinite(props.actualPos!.lat) &&
      Number.isFinite(props.actualPos!.lng)
    ) {
      const bounds = L.latLngBounds([
        [props.registeredPos!.lat, props.registeredPos!.lng],
        [props.actualPos!.lat, props.actualPos!.lng],
      ]);
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: targetZoom,
        animate: true,
      });
      return;
    }

    if (
      hasRegistered &&
      Number.isFinite(props.registeredPos!.lat) &&
      Number.isFinite(props.registeredPos!.lng)
    ) {
      map.flyTo(
        [props.registeredPos!.lat, props.registeredPos!.lng],
        targetZoom,
        {
          animate: true,
        },
      );
      return;
    }

    if (
      hasActual &&
      Number.isFinite(props.actualPos!.lat) &&
      Number.isFinite(props.actualPos!.lng)
    ) {
      map.flyTo([props.actualPos!.lat, props.actualPos!.lng], targetZoom, {
        animate: true,
      });
      return;
    }

    map.flyTo([VIETNAM_CENTER.lat, VIETNAM_CENTER.lng], DEFAULT_VN_ZOOM, {
      animate: true,
    });
  }, [map, props.actualPos, props.registeredPos]);

  return (
    <div className="absolute left-3 top-3 z-[600] flex items-center gap-2">
      <Tooltip title="Đưa bản đồ về vị trí marker (R/A) hiện có">
        <Button
          size="small"
          type="primary"
          icon={<AimOutlined />}
          onClick={recenter}
          disabled={props.disabled}
        >
          Về vị trí hiện tại
        </Button>
      </Tooltip>
    </div>
  );
};

const MapLayerController = (props: { baseLayer: BaseLayerKey }) => {
  const map = useMap();

  useEffect(() => {
    const layer = BASE_LAYER_MAP[props.baseLayer];
    map.setMaxZoom(layer.maxZoom);
    if (map.getZoom() > layer.maxZoom) {
      map.setZoom(layer.maxZoom);
    }
  }, [map, props.baseLayer]);

  return null;
};

const MapLayerSwitcher = (props: {
  baseLayer: BaseLayerKey;
  onChange: (next: BaseLayerKey) => void;
  showLabels: boolean;
  onToggleLabels: (next: boolean) => void;
}) => {
  return (
    <div className="absolute right-3 top-3 z-[650] rounded-2xl border border-slate-200 bg-white/95 p-2.5 text-xs shadow-lg backdrop-blur">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Chọn bản đồ
      </div>
      <div className="grid gap-1">
        {Object.values(BASE_LAYER_MAP).map((layer) => (
          <button
            key={layer.key}
            type="button"
            onClick={() => props.onChange(layer.key)}
            className={`rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition ${
              props.baseLayer === layer.key
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {props.baseLayer === "satellite" ? (
        <button
          type="button"
          onClick={() => props.onToggleLabels(!props.showLabels)}
          className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
            props.showLabels
              ? "border-slate-300 bg-slate-100 text-slate-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
          }`}
        >
          {props.showLabels ? "Tắt nhãn địa điểm" : "Bật nhãn địa điểm"}
        </button>
      ) : null}
    </div>
  );
};

const CheckinLeafletMap = (props: {
  locationName: string;
  address: string | null;
  registeredPos: LatLng | null;
  actualPos: LatLng | null;
  recenterKey: number;
  showRecenterButton?: boolean;
}) => {
  const registeredIcon = useMemo(
    () => createLabeledMarkerIcon("registered"),
    [],
  );
  const actualIcon = useMemo(() => createLabeledMarkerIcon("actual"), []);
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>("osm");
  const [showLabels, setShowLabels] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const activeLayer = BASE_LAYER_MAP[baseLayer];
  const tileErrorRef = useRef({
    count: 0,
    lastErrorAt: 0,
    lastSwitchAt: 0,
  });

  useEffect(() => {
    tileErrorRef.current.count = 0;
    tileErrorRef.current.lastErrorAt = 0;
  }, [baseLayer]);

  useEffect(() => {
    setMapReady(false);
  }, [props.recenterKey]);

  const handleTileError = useCallback(() => {
    const now = Date.now();
    const state = tileErrorRef.current;

    if (now - state.lastErrorAt > 4000) {
      state.count = 0;
    }

    state.count += 1;
    state.lastErrorAt = now;

    if (state.count < 6) return;
    if (now - state.lastSwitchAt < 4000) return;

    const nextLayer = getNextBaseLayer(baseLayer);
    state.lastSwitchAt = now;
    state.count = 0;

    setBaseLayer(nextLayer);
    if (nextLayer !== "satellite") {
      setShowLabels(false);
    }

    message.warning(
      "Nguồn bản đồ hiện tại không tải được, hệ thống đã chuyển sang lớp bản đồ khác.",
    );
  }, [baseLayer]);

  return (
    <MapContainer
      center={[VIETNAM_CENTER.lat, VIETNAM_CENTER.lng]}
      zoom={DEFAULT_VN_ZOOM}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={activeLayer.maxZoom}
      worldCopyJump={false}
      scrollWheelZoom
      zoomSnap={0.5}
      zoomDelta={0.5}
      style={{ height: "100%", width: "100%" }}
    >
      <MapReadyObserver onReady={() => setMapReady(true)} />
      <MapBoundsController enabled={mapReady} />

      {mapReady ? (
        <>
          <TileLayer
            key={activeLayer.key}
            url={activeLayer.url}
            maxZoom={activeLayer.maxZoom}
            maxNativeZoom={activeLayer.maxNativeZoom}
            tileSize={activeLayer.tileSize ?? 256}
            zoomOffset={activeLayer.zoomOffset ?? 0}
            subdomains={activeLayer.subdomains ?? "abc"}
            detectRetina={false}
            crossOrigin
            eventHandlers={{ tileerror: handleTileError }}
            attribution={activeLayer.attribution}
          />
          {baseLayer === "satellite" && showLabels ? (
            <TileLayer
              url={SATELLITE_LABELS_LAYER.url}
              maxZoom={SATELLITE_LABELS_LAYER.maxZoom}
              maxNativeZoom={SATELLITE_LABELS_LAYER.maxNativeZoom}
              tileSize={SATELLITE_LABELS_LAYER.tileSize ?? 256}
              zoomOffset={SATELLITE_LABELS_LAYER.zoomOffset ?? 0}
              subdomains={SATELLITE_LABELS_LAYER.subdomains ?? "abc"}
              detectRetina={false}
              crossOrigin
              eventHandlers={{ tileerror: handleTileError }}
              attribution={SATELLITE_LABELS_LAYER.attribution}
            />
          ) : null}
        </>
      ) : null}

      {props.showRecenterButton !== false ? (
        <MapRecenterControl
          registeredPos={props.registeredPos}
          actualPos={props.actualPos}
          disabled={!props.registeredPos && !props.actualPos}
        />
      ) : null}

      <MapLayerController baseLayer={baseLayer} />
      <MapLayerSwitcher
        baseLayer={baseLayer}
        onChange={setBaseLayer}
        showLabels={showLabels}
        onToggleLabels={setShowLabels}
      />

      <MapViewportController
        registeredPos={props.registeredPos}
        actualPos={props.actualPos}
        recenterKey={props.recenterKey}
      />

      {props.registeredPos ? (
        <Marker
          position={[props.registeredPos.lat, props.registeredPos.lng]}
          icon={registeredIcon}
        >
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{props.locationName}</div>
              <div className="text-xs text-gray-600">
                {props.address || "-"}
              </div>
              <div className="text-xs">
                <div>
                  <span className="font-medium">Vị trí đăng ký</span>
                </div>
                <div>Latitude: {formatCoord(props.registeredPos.lat)}</div>
                <div>Longitude: {formatCoord(props.registeredPos.lng)}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ) : null}

      {props.actualPos ? (
        <Marker
          position={[props.actualPos.lat, props.actualPos.lng]}
          icon={actualIcon}
        >
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{props.locationName}</div>
              <div className="text-xs text-gray-600">
                {props.address || "-"}
              </div>
              <div className="text-xs">
                <div>
                  <span className="font-medium">Vị trí check-in thực tế</span>
                </div>
                <div>Latitude: {formatCoord(props.actualPos.lat)}</div>
                <div>Longitude: {formatCoord(props.actualPos.lng)}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
};

const Checkins = () => {
  // Fix icon marker của Leaflet (Vite không tự resolve được asset)
  useEffect(() => {
    // Vite không tự resolve icon mặc định của Leaflet, cần set lại URL thủ công
    const proto = L.Icon.Default.prototype as unknown as Record<
      string,
      unknown
    >;
    delete proto._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const [mode] = useState<"checkin" | "history">("history");

  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [ownerOptions, setOwnerOptions] = useState<
    Array<{ value: number; label: string }>
  >([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [historyOwnerId, setHistoryOwnerId] = useState<number | null>(null);
  const [locationOptions, setLocationOptions] = useState<
    Array<{ value: number; label: string; location_type?: string | null }>
  >([]);
  const [historyLocationId, setHistoryLocationId] = useState<number | null>(
    null,
  );
  const [historyRange, setHistoryRange] = useState<
    "today" | "week" | "month" | "year" | "all"
  >("today");
  const [historyDate, setHistoryDate] = useState<string | undefined>(undefined);
  const [posInvoiceRows, setPosInvoiceRows] = useState<PosInvoiceRow[]>([]);
  const [ticketInvoiceRows, setTicketInvoiceRows] = useState<
    TicketInvoiceRow[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [ownerRevenueSummary, setOwnerRevenueSummary] =
    useState<RevenueSummary | null>(null);
  const [locationRevenueSummary, setLocationRevenueSummary] =
    useState<RevenueSummary | null>(null);

  const selectedHistoryLocationType = useMemo(() => {
    if (!historyLocationId) return null;
    return (
      locationOptions.find((o) => Number(o.value) === Number(historyLocationId))
        ?.location_type ?? null
    );
  }, [historyLocationId, locationOptions]);

  const isTouristHistory = useMemo(() => {
    const t = String(selectedHistoryLocationType || "").toLowerCase();
    return t.includes("tour") || t.includes("ticket") || t === "tourist";
  }, [selectedHistoryLocationType]);

  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCheckin, setDetailCheckin] = useState<Checkin | null>(null);

  const [verifyVisible, setVerifyVisible] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");

  const [failVisible, setFailVisible] = useState(false);
  const [failReason, setFailReason] = useState("");

  const [mapVisible, setMapVisible] = useState(false);
  const [mapMountKey, setMapMountKey] = useState(0);

  const registeredPos = useMemo<LatLng | null>(() => {
    if (!selectedCheckin?.registered_location) return null;
    return normalizeLatLng({
      lat: selectedCheckin.registered_location.latitude,
      lng: selectedCheckin.registered_location.longitude,
    });
  }, [selectedCheckin]);

  const actualPos = useMemo<LatLng | null>(() => {
    if (!selectedCheckin?.actual_checkin_location) return null;
    return normalizeLatLng({
      lat: selectedCheckin.actual_checkin_location.latitude,
      lng: selectedCheckin.actual_checkin_location.longitude,
    });
  }, [selectedCheckin]);

  const distanceKmFromBackend = useMemo(() => {
    return selectedCheckin?.distance_km ?? null;
  }, [selectedCheckin]);

  const openMap = (record: Checkin) => {
    setSelectedCheckin(record);
    setMapVisible(true);
  };

  const closeMap = () => {
    setMapVisible(false);
    // Chỉ clear selection khi không có modal nghiệp vụ khác đang mở
    if (!verifyVisible && !failVisible) setSelectedCheckin(null);
  };

  const fetchCheckins = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.current,
        limit: pagination.pageSize,
        booking_only: 1,
      };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;

      const response = await adminApi.getCheckins(params);
      if (response?.success) {
        setCheckins(response.data || []);
        setPagination((p) => ({
          ...p,
          total: response.pagination?.total ?? 0,
          current: response.pagination?.page ?? p.current,
          pageSize: response.pagination?.limit ?? p.pageSize,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách check-in"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "checkin") return;
    fetchCheckins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pagination.current, pagination.pageSize, searchText, statusFilter]);

  const fetchOwnerOptions = useCallback(async (search?: string) => {
    setOwnerLoading(true);
    try {
      const res = await adminApi.getOwners({
        page: 1,
        limit: 50,
        search: search || undefined,
      });
      const list = (res?.data || []) as Array<{
        user_id: number;
        full_name: string;
        email?: string | null;
        phone?: string | null;
      }>;
      setOwnerOptions(
        list.map((o) => ({
          value: Number(o.user_id),
          label:
            o.full_name +
            (o.email ? ` (${o.email})` : o.phone ? ` (${o.phone})` : ""),
        })),
      );
    } catch {
      setOwnerOptions([]);
    } finally {
      setOwnerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "history") return;
    const t = setTimeout(() => {
      void fetchOwnerOptions(ownerSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [mode, ownerSearch, fetchOwnerOptions]);

  const fetchLocationsForOwner = useCallback(async (ownerId: number) => {
    try {
      const res = await adminApi.getOwnerLocations(ownerId);
      const list = (res?.data || []) as Array<{
        location_id: number;
        location_name: string;
        location_type?: string | null;
      }>;
      const opts = list.map((l) => ({
        value: Number(l.location_id),
        label: l.location_name || `#${l.location_id}`,
        location_type:
          l.location_type == null ? null : String(l.location_type || ""),
      }));
      setLocationOptions(opts);
      setHistoryLocationId(opts[0]?.value ?? null);
    } catch {
      setLocationOptions([]);
      setHistoryLocationId(null);
    }
  }, []);

  useEffect(() => {
    if (mode !== "history") return;
    if (!historyOwnerId) {
      setLocationOptions([]);
      setHistoryLocationId(null);
      return;
    }
    void fetchLocationsForOwner(historyOwnerId);
  }, [mode, historyOwnerId, fetchLocationsForOwner]);

  const fetchHistory = useCallback(async () => {
    if (mode !== "history") return;
    if (!historyLocationId) {
      setPosInvoiceRows([]);
      setTicketInvoiceRows([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const summaryParams: Record<string, string | number> = {
        range: historyRange,
      };
      if (historyDate) summaryParams.date = historyDate;

      const ownerSummaryResponse = await adminApi.getOwnerRevenueSummary(
        Number(historyOwnerId),
        {
          ...summaryParams,
        },
      );
      if (ownerSummaryResponse?.success) {
        setOwnerRevenueSummary(
          (ownerSummaryResponse?.data?.owner_summary as RevenueSummary) || null,
        );

        const byLocation = Array.isArray(
          ownerSummaryResponse?.data?.location_summaries,
        )
          ? (ownerSummaryResponse.data.location_summaries as Array<
              RevenueSummary & { location_id: number }
            >)
          : [];
        const match = byLocation.find(
          (item) => Number(item.location_id) === Number(historyLocationId),
        );
        setLocationRevenueSummary(match || null);
      } else {
        setOwnerRevenueSummary(null);
        setLocationRevenueSummary(null);
      }

      if (isTouristHistory) {
        const res = await adminApi.getLocationTouristTicketInvoices(
          historyLocationId,
          {
            range: historyRange,
            date: historyDate,
          },
        );
        if (res?.success) {
          setTicketInvoiceRows(
            (res?.data?.invoices || []) as TicketInvoiceRow[],
          );
          setPosInvoiceRows([]);
        }
        return;
      }

      const res = await adminApi.getLocationPosPaymentsHistory(
        historyLocationId,
        {
          range: historyRange,
          date: historyDate,
        },
      );
      if (res?.success) {
        setPosInvoiceRows((res?.data?.history || []) as PosInvoiceRow[]);
        setTicketInvoiceRows([]);
      }
    } catch {
      setPosInvoiceRows([]);
      setTicketInvoiceRows([]);
      setOwnerRevenueSummary(null);
      setLocationRevenueSummary(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    mode,
    historyDate,
    historyLocationId,
    historyOwnerId,
    historyRange,
    isTouristHistory,
  ]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const renderRevenueBlock = (
    title: string,
    summary: RevenueSummary | null,
  ) => (
    <Card size="small" title={title} className="min-w-[280px]">
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="font-semibold text-gray-800">1. Tổng tiền</div>
          <div className="mt-1 text-base font-bold">
            {formatMoney(Number(summary?.total.amount || 0))}
          </div>
          <div className="mt-2 grid grid-cols-[90px_1fr] gap-y-1 text-xs text-gray-600">
            <div>Tiền mặt</div>
            <div className="text-right">
              {formatMoney(Number(summary?.total.cash || 0))}
            </div>
            <div>Chuyển khoản</div>
            <div className="text-right">
              {formatMoney(Number(summary?.total.transfer || 0))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="font-semibold text-blue-800">2. Tại địa điểm</div>
          <div className="mt-1 text-base font-bold text-blue-700">
            {formatMoney(Number(summary?.onsite.amount || 0))}
          </div>
          <div className="mt-2 grid grid-cols-[90px_1fr] gap-y-1 text-xs text-blue-700">
            <div>Tiền mặt</div>
            <div className="text-right">
              {formatMoney(Number(summary?.onsite.cash || 0))}
            </div>
            <div>Chuyển khoản</div>
            <div className="text-right">
              {formatMoney(Number(summary?.onsite.transfer || 0))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-semibold text-amber-800">3. Đặt trước</div>
          <div className="mt-1 text-base font-bold text-amber-700">
            {formatMoney(Number(summary?.booking.amount || 0))}
          </div>
          <div className="mt-2 grid grid-cols-[90px_1fr] gap-y-1 text-xs text-amber-700">
            <div>Tiền mặt</div>
            <div className="text-right">
              {formatMoney(Number(summary?.booking.cash || 0))}
            </div>
            <div>Chuyển khoản</div>
            <div className="text-right">
              {formatMoney(Number(summary?.booking.transfer || 0))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  const getBookedName = (row: PosInvoiceRow): string => {
    if (String(row.booking_contact_name || "").trim()) {
      return String(row.booking_contact_name);
    }
    const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
    return (
      hotelRooms.find((x) => String(x.guest_name || "").trim())?.guest_name ||
      row.hotel?.guest_name ||
      (row.performed_by?.role === "user" ? row.performed_by?.name : null) ||
      "-"
    );
  };

  const getBookedPhone = (row: PosInvoiceRow): string => {
    if (String(row.booking_contact_phone || "").trim()) {
      return String(row.booking_contact_phone);
    }
    const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
    return (
      hotelRooms.find((x) => String(x.guest_phone || "").trim())?.guest_phone ||
      row.hotel?.guest_phone ||
      (row.performed_by?.role === "user" ? row.performed_by?.phone : null) ||
      "-"
    );
  };

  const posColumns: ColumnsType<PosInvoiceRow> = useMemo(
    () => [
      {
        title: "Hóa đơn",
        dataIndex: "payment_id",
        key: "payment_id",
        width: 110,
        render: (v: number) => (
          <span className="font-semibold text-blue-700">#{v}</span>
        ),
      },
      {
        title: "Thời gian",
        dataIndex: "payment_time",
        key: "payment_time",
        width: 170,
        render: (v: unknown) => formatDateTimeVi(String(v || "")),
      },
      {
        title: "Dịch vụ",
        key: "place",
        width: 180,
        render: (_: unknown, row) =>
          row.table_name || row.hotel?.room_number || "-",
      },
      {
        title: "Người đặt trước",
        key: "booker",
        width: 170,
        render: (_: unknown, row) => getBookedName(row),
      },
      {
        title: "SĐT",
        key: "booker_phone",
        width: 140,
        render: (_: unknown, row) => getBookedPhone(row),
      },
      {
        title: "Tổng SL",
        dataIndex: "total_qty",
        key: "total_qty",
        width: 90,
        align: "right",
        render: (v: number) => <b>{Number(v || 0)}</b>,
      },
      {
        title: "Số tiền",
        dataIndex: "amount",
        key: "amount",
        width: 140,
        align: "right",
        render: (v: number) => <b>{formatMoney(Number(v || 0))}</b>,
      },
      {
        title: "Thanh toán",
        key: "payment_method",
        width: 140,
        render: (_: unknown, row) =>
          isMergedRestaurantInvoice(row)
            ? "-"
            : renderPaymentMethodTag(row.payment_method),
      },
      {
        title: "Người thực hiện",
        key: "exec",
        width: 200,
        render: (_: unknown, row) => getExecLabel(row),
      },
    ],
    [],
  );

  const ticketColumns: ColumnsType<TicketInvoiceRow> = useMemo(
    () => [
      {
        title: "Ngày giờ",
        dataIndex: "payment_time",
        key: "payment_time",
        width: 170,
        render: (v: unknown) => formatDateTimeVi(String(v || "")),
      },
      {
        title: "Nguồn",
        dataIndex: "source",
        key: "source",
        width: 110,
        render: (v: TicketInvoiceRow["source"]) => (
          <Tag color={v === "pos" ? "geekblue" : "green"}>
            {v === "pos" ? "TẠI QUẦY" : "ONLINE"}
          </Tag>
        ),
      },
      {
        title: "Mã",
        key: "code",
        width: 110,
        render: (_: unknown, row) => {
          const id = row.payment_id ?? row.booking_id;
          return <span className="font-semibold text-blue-700">#{id}</span>;
        },
      },
      {
        title: "Phương thức",
        dataIndex: "payment_method",
        key: "payment_method",
        width: 140,
        render: renderPaymentMethodTag,
      },
      {
        title: "Người bán",
        dataIndex: "seller_name",
        key: "seller_name",
        width: 180,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "Khách",
        dataIndex: "buyer_name",
        key: "buyer_name",
        width: 160,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "SĐT",
        dataIndex: "buyer_phone",
        key: "buyer_phone",
        width: 140,
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "Số lượng",
        dataIndex: "total_qty",
        key: "total_qty",
        width: 100,
        align: "right",
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Tổng tiền",
        dataIndex: "total_amount",
        key: "total_amount",
        width: 140,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
    ],
    [],
  );

  const ticketItemColumns: ColumnsType<TicketInvoiceItem> = useMemo(
    () => [
      {
        title: "Hạng vé",
        dataIndex: "service_name",
        key: "service_name",
        render: (v: unknown) => String(v || "-"),
      },
      {
        title: "SL",
        dataIndex: "quantity",
        key: "quantity",
        width: 80,
        align: "right",
        render: (v: unknown) => Number(v || 0),
      },
      {
        title: "Đơn giá",
        dataIndex: "unit_price",
        key: "unit_price",
        width: 120,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "Thành tiền",
        dataIndex: "line_total",
        key: "line_total",
        width: 140,
        align: "right",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
    ],
    [],
  );

  const expandedPosInvoiceRender = useCallback((row: PosInvoiceRow) => {
    const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
    const fallbackHotelRoom = row.hotel
      ? {
          stay_id: row.hotel.stay_id,
          room_number: row.hotel.room_number,
          guest_name: row.hotel.guest_name,
          guest_phone: row.hotel.guest_phone,
          checkin_time: row.hotel.checkin_time,
          checkout_time: row.hotel.checkout_time,
          total_amount: null as number | null,
        }
      : null;
    const roomsForRender =
      hotelRooms.length > 0
        ? hotelRooms
        : fallbackHotelRoom
          ? [fallbackHotelRoom]
          : [];

    const bookedName =
      roomsForRender.find((x) => String(x.guest_name || "").trim())
        ?.guest_name ||
      row.hotel?.guest_name ||
      row.performed_by?.name ||
      "-";
    const bookedPhone =
      roomsForRender.find((x) => String(x.guest_phone || "").trim())
        ?.guest_phone ||
      row.hotel?.guest_phone ||
      row.performed_by?.phone ||
      "-";
    const hideHeaderPayment = isMergedRestaurantInvoice(row);

    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-base font-semibold text-blue-800">
              Hóa đơn #{row.payment_id}
            </div>
            <div className="text-xs text-gray-500">
              {formatDateTimeVi(row.payment_time)}
              {row.table_name ? ` • ${row.table_name}` : ""}
            </div>
          </div>
          {!hideHeaderPayment ? (
            <div className="text-right">
              <div className="text-xs text-gray-500">Thanh toán</div>
              <div>{renderPaymentMethodTag(row.payment_method)}</div>
            </div>
          ) : null}
        </div>

        {roomsForRender.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">
                Thông tin người đặt
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="text-gray-500">Người đặt</div>
                <div className="text-right font-semibold">{bookedName}</div>
                <div className="text-gray-500">SĐT</div>
                <div className="text-right font-semibold">{bookedPhone}</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">
                Tổng thanh toán
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {roomsForRender.length} phòng
                </div>
                <div className="text-xl font-bold">
                  {formatMoney(row.amount)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">
              Chi tiết phòng
            </div>
            <div className="space-y-2">
              {roomsForRender.map((rm, idx) => (
                <div
                  key={`${rm.stay_id ?? "x"}-${rm.room_number ?? "-"}-${idx}`}
                  className="rounded-2xl border bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">
                      {rm.room_number || "-"}
                    </div>
                    <div className="font-bold">
                      {rm.total_amount != null
                        ? formatMoney(rm.total_amount)
                        : "-"}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="text-gray-500">Nhận phòng</div>
                    <div className="text-right font-medium">
                      {rm.checkin_time
                        ? formatDateTimeVi(rm.checkin_time)
                        : "-"}
                    </div>
                    <div className="text-gray-500">Trả phòng</div>
                    <div className="text-right font-medium">
                      {rm.checkout_time
                        ? formatDateTimeVi(rm.checkout_time)
                        : "-"}
                    </div>
                    <div className="text-gray-500">Thành tiền</div>
                    <div className="text-right font-semibold">
                      {rm.total_amount != null
                        ? formatMoney(rm.total_amount)
                        : "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (Array.isArray(row.prepaid_items) &&
            row.prepaid_items.length > 0) ||
          (Array.isArray(row.onsite_items) && row.onsite_items.length > 0) ? (
          <div className="mt-3 space-y-3">
            {Array.isArray(row.prepaid_items) &&
            row.prepaid_items.length > 0 ? (
              <div className="rounded-2xl border border-yellow-200 bg-amber-50/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-base font-semibold text-amber-700">
                    Món khách đã thanh toán trước khi check-in
                  </div>
                  <div>
                    {renderPaymentMethodTag(row.prepaid_payment_method)}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Món</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {row.prepaid_items.map((it) => (
                    <div
                      key={`prepaid-${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm"
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
                <div className="mt-2 text-right text-xl font-bold text-amber-700">
                  {formatMoney(Number(row.prepaid_amount || 0))}
                </div>
              </div>
            ) : null}

            {Array.isArray(row.onsite_items) && row.onsite_items.length > 0 ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-base font-semibold text-blue-700">
                    Món gọi thêm tại bàn
                  </div>
                  <div>{renderPaymentMethodTag(row.onsite_payment_method)}</div>
                </div>
                <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Món</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {row.onsite_items.map((it) => (
                    <div
                      key={`onsite-${it.service_id}-${it.service_name}`}
                      className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm"
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
                <div className="mt-2 text-right text-xl font-bold text-blue-700">
                  {formatMoney(Number(row.onsite_amount || 0))}
                </div>
              </div>
            ) : null}
          </div>
        ) : Array.isArray(row.items) && row.items.length > 0 ? (
          <div className="mt-3">
            <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
              <div>Món</div>
              <div className="text-right">SL</div>
              <div className="text-right">Giá</div>
              <div className="text-right">Thành tiền</div>
            </div>
            <div className="divide-y">
              {row.items.map((it) => (
                <div
                  key={`${it.service_id}-${it.service_name}`}
                  className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm"
                >
                  <div className="min-w-0 truncate">{it.service_name}</div>
                  <div className="text-right font-semibold">{it.quantity}</div>
                  <div className="text-right">{formatMoney(it.unit_price)}</div>
                  <div className="text-right font-semibold">
                    {formatMoney(it.line_total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? null : (
          <div className="mt-4 flex items-end justify-between gap-4 border-t pt-3">
            <div className="text-sm text-gray-600">
              Số món: <b>{row.items_count || row.items.length}</b> • Tổng SL:{" "}
              <b>{row.total_qty}</b>
            </div>
            <div className="text-lg font-bold">{formatMoney(row.amount)}</div>
          </div>
        )}
      </div>
    );
  }, []);

  const openVerify = (record: Checkin) => {
    setSelectedCheckin(record);
    setVerifyNotes("");
    setVerifyVisible(true);
  };

  const openFail = (record: Checkin) => {
    setSelectedCheckin(record);
    setFailReason("");
    setFailVisible(true);
  };

  const reportMismatchFromVerify = () => {
    setVerifyVisible(false);
    setFailVisible(true);
  };

  const submitVerify = async () => {
    if (!selectedCheckin) return;
    try {
      const response = await adminApi.verifyCheckin(
        selectedCheckin.checkin_id,
        verifyNotes,
      );
      if (response?.success) {
        message.success("Đã xác thực check-in");
        setVerifyVisible(false);
        fetchCheckins();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi xác thực check-in"));
    }
  };

  const submitFail = async () => {
    if (!selectedCheckin) return;
    try {
      const response = await adminApi.failCheckin(
        selectedCheckin.checkin_id,
        failReason,
      );
      if (response?.success) {
        message.success("Đã đánh dấu check-in thất bại");
        setFailVisible(false);
        fetchCheckins();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật check-in"));
    }
  };

  const openDetail = async (record: Checkin) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailCheckin(record);
    try {
      const response = await adminApi.getCheckinById(record.checkin_id);
      if (response?.success) {
        setDetailCheckin(response.data as Checkin);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải chi tiết check-in"));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleCheckinLock = async (record: Checkin) => {
    try {
      const res = await adminApi.toggleCheckinLock(record.checkin_id);
      if (res?.success) {
        message.success(res.message || "Đã cập nhật check-in");
        fetchCheckins();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khóa/mở check-in"));
    }
  };

  const handleUpdateLocationStatus = async (
    record: Checkin,
    nextStatus: "active" | "inactive",
  ) => {
    try {
      const res = await adminApi.updateCheckinLocationStatus(
        record.checkin_id,
        nextStatus,
      );
      if (res?.success) {
        message.success(res.message || "Đã cập nhật địa điểm");
        fetchCheckins();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật địa điểm"));
    }
  };

  const handleDeleteCheckin = async (record: Checkin) => {
    try {
      const res = await adminApi.deleteCheckin(record.checkin_id);
      if (res?.success) {
        message.success(res.message || "Đã xóa check-in");
        fetchCheckins();
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi xóa check-in"));
    }
  };

  const buildLockMenu = (record: Checkin): MenuProps => {
    const status = String(record.status || "").toLowerCase();
    const checkinLocked = status === "failed";
    const canToggleCheckin = status !== "verified";

    const locationStatus = String(record.location_status || "").toLowerCase();
    const locationLocked = locationStatus === "inactive";
    const canToggleLocation = locationStatus !== "";

    return {
      items: [
        {
          key: "checkin",
          label: checkinLocked ? "Mở khóa check-in" : "Khóa check-in",
          disabled: !canToggleCheckin,
        },
        {
          key: "location",
          label: locationLocked ? "Mở khóa địa điểm" : "Khóa địa điểm",
          disabled: !canToggleLocation,
        },
      ],
      onClick: ({ key }) => {
        if (key === "checkin") {
          if (!canToggleCheckin) return;
          Modal.confirm({
            title: checkinLocked
              ? "Mở khóa check-in này?"
              : "Khóa check-in này?",
            content: checkinLocked
              ? "Check-in sẽ quay về trạng thái pending."
              : "Check-in sẽ chuyển sang trạng thái failed.",
            onOk: () => handleToggleCheckinLock(record),
          });
        }

        if (key === "location") {
          if (!canToggleLocation) return;
          const nextStatus: "active" | "inactive" = locationLocked
            ? "active"
            : "inactive";
          Modal.confirm({
            title: locationLocked
              ? "Mở khóa địa điểm liên quan?"
              : "Khóa địa điểm liên quan?",
            content: locationLocked
              ? "Địa điểm sẽ chuyển sang trạng thái active."
              : "Địa điểm sẽ chuyển sang trạng thái inactive.",
            onOk: () => handleUpdateLocationStatus(record, nextStatus),
          });
        }
      },
    };
  };

  const columns: ColumnsType<Checkin> = [
    {
      title: "Người check-in",
      key: "user",
      width: 260,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.user_name || "-"}</div>
          <div className="text-xs text-gray-500 truncate">
            {record.user_email || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Địa điểm",
      key: "location",
      width: 280,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.location_name}</div>
          <div className="text-xs text-gray-500 truncate">
            {record.address || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Thời gian",
      dataIndex: "checkin_time",
      key: "checkin_time",
      width: 170,
      render: (t: string | null) => formatDateTimeVi(t),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (_, record) => {
        const status = record.verification_status || record.status;
        return (
          <Tag color={statusColors[status] || "default"}>
            {statusToVi(status)}
          </Tag>
        );
      },
    },
    {
      title: "Vị trí",
      key: "position",
      width: 120,
      align: "center",
      render: (_, record) => {
        if (!record.can_view_location) {
          return (
            <Tooltip title="Địa điểm chưa có tọa độ đăng ký">
              <Button size="small" type="link" disabled>
                Xem vị trí
              </Button>
            </Tooltip>
          );
        }

        return (
          <Button size="small" type="link" onClick={() => openMap(record)}>
            Xem vị trí
          </Button>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 220,
      align: "center",
      render: (_, record) => {
        const isPending = String(record.status || "") === "pending";

        return (
          <Space size={6}>
            <Tooltip title="Xem chi tiết">
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(record);
                }}
              />
            </Tooltip>

            <Dropdown menu={buildLockMenu(record)} trigger={["click"]}>
              <Tooltip title="Khóa/Mở">
                <Button size="small" type="text" icon={<LockOutlined />} />
              </Tooltip>
            </Dropdown>

            {isPending ? (
              <>
                <Tooltip title="Xác thực">
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openVerify(record);
                    }}
                  />
                </Tooltip>
                <Tooltip title="Báo cáo sai lệch / Thất bại">
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFail(record);
                    }}
                  />
                </Tooltip>
              </>
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}

            <Popconfirm
              title="Xóa check-in này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeleteCheckin(record)}
            >
              <Tooltip title="Xóa">
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Lịch sử</h2>
        <p className="text-gray-500">Quản lí lịch sử theo owner và địa điểm</p>
      </div>

      <Card>
        <div className="mb-4 text-sm text-gray-500">
          Theo owner → địa điểm để xem lịch sử và doanh thu.
        </div>

        {mode === "checkin" ? (
          <>
            <div className="mb-4 flex flex-wrap gap-4">
              <Input
                placeholder="Tìm kiếm theo user, email, địa điểm, địa chỉ..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPagination((p) => ({ ...p, current: 1 }));
                }}
                className="max-w-md"
                allowClear
              />
              <Select
                placeholder="Lọc theo trạng thái"
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPagination((p) => ({ ...p, current: 1 }));
                }}
                allowClear
                style={{ width: 200 }}
              >
                <Select.Option value="pending">
                  {statusToVi("pending")}
                </Select.Option>
                <Select.Option value="verified">
                  {statusToVi("verified")}
                </Select.Option>
                <Select.Option value="failed">
                  {statusToVi("failed")}
                </Select.Option>
              </Select>
            </div>

            <Table
              size="small"
              tableLayout="fixed"
              columns={columns}
              dataSource={checkins}
              loading={loading}
              rowKey="checkin_id"
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} / ${total}`,
                onChange: (page, pageSize) => {
                  setPagination((p) => ({
                    ...p,
                    current: page,
                    pageSize: pageSize || p.pageSize,
                  }));
                },
              }}
              scroll={{ x: "max-content", y: 640 }}
            />
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Select
                showSearch
                allowClear
                placeholder="Chọn chủ sở hữu"
                value={historyOwnerId ?? undefined}
                options={ownerOptions}
                loading={ownerLoading}
                onSearch={(v) => setOwnerSearch(v)}
                onChange={(v) => {
                  const nextId = typeof v === "number" ? v : Number(v);
                  setHistoryOwnerId(Number.isFinite(nextId) ? nextId : null);
                }}
                filterOption={false}
                style={{ minWidth: 320 }}
              />
              <Select
                allowClear
                placeholder="Chọn địa điểm"
                value={historyLocationId ?? undefined}
                options={locationOptions}
                onChange={(v) => {
                  const nextId = typeof v === "number" ? v : Number(v);
                  setHistoryLocationId(Number.isFinite(nextId) ? nextId : null);
                }}
                style={{ minWidth: 320 }}
                disabled={!historyOwnerId}
              />
              <Segmented
                value={historyRange}
                options={[
                  { label: "Hôm nay", value: "today" },
                  { label: "7 ngày", value: "week" },
                  { label: "1 tháng", value: "month" },
                  { label: "1 năm", value: "year" },
                  { label: "Tất cả", value: "all" },
                ]}
                onChange={(v) => {
                  setHistoryRange(v as typeof historyRange);
                  setHistoryDate(undefined);
                }}
              />
              <DatePicker
                placeholder="Chọn ngày cụ thể"
                onChange={(date) => {
                  setHistoryDate(date ? date.format("YYYY-MM-DD") : undefined);
                }}
                allowClear
              />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {renderRevenueBlock(
                "Doanh thu địa điểm đang chọn",
                locationRevenueSummary,
              )}
              {renderRevenueBlock(
                "Tổng doanh thu tất cả địa điểm của owner",
                ownerRevenueSummary,
              )}
            </div>

            {isTouristHistory ? (
              <Table<TicketInvoiceRow>
                size="small"
                tableLayout="fixed"
                columns={ticketColumns}
                dataSource={ticketInvoiceRows}
                loading={historyLoading}
                rowKey={(r, idx) => String(r.payment_id ?? r.booking_id ?? idx)}
                pagination={false}
                scroll={{ x: "max-content", y: 640 }}
                expandable={{
                  columnTitle: (
                    <span className="whitespace-nowrap">Chi tiết</span>
                  ),
                  expandIconColumnIndex: ticketColumns.length,
                  columnWidth: 90,
                  expandedRowRender: (row) => (
                    <div className="px-6 py-2">
                      <Table<TicketInvoiceItem>
                        rowKey={(it, idx) =>
                          String(it.service_id ?? `${it.service_name}-${idx}`)
                        }
                        dataSource={Array.isArray(row.items) ? row.items : []}
                        size="small"
                        pagination={false}
                        scroll={{ x: true }}
                        columns={ticketItemColumns}
                      />
                    </div>
                  ),
                  rowExpandable: (row) =>
                    Array.isArray(row.items) && row.items.length > 0,
                }}
                locale={{ emptyText: "Chưa có dữ liệu." }}
              />
            ) : (
              <Table<PosInvoiceRow>
                size="small"
                tableLayout="fixed"
                columns={posColumns}
                dataSource={posInvoiceRows}
                loading={historyLoading}
                rowKey={(r) => String(r.payment_id)}
                pagination={false}
                scroll={{ x: "max-content", y: 640 }}
                expandable={{
                  columnTitle: (
                    <span className="whitespace-nowrap">Chi tiết</span>
                  ),
                  expandIconColumnIndex: posColumns.length,
                  columnWidth: 90,
                  expandedRowRender: expandedPosInvoiceRender,
                }}
                locale={{ emptyText: "Chưa có dữ liệu." }}
              />
            )}
          </>
        )}
      </Card>

      <Modal
        title={
          detailCheckin
            ? `Chi tiết check-in #${detailCheckin.checkin_id}`
            : "Chi tiết check-in"
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>Đóng</Button>}
        width={760}
      >
        {detailLoading ? (
          <Typography.Text>Đang tải...</Typography.Text>
        ) : detailCheckin ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Người dùng">
              <div className="font-medium">{detailCheckin.user_name}</div>
              <div className="text-xs text-gray-500">
                {detailCheckin.user_email}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Địa điểm">
              <div className="font-medium">{detailCheckin.location_name}</div>
              <div className="text-xs text-gray-500">
                {detailCheckin.address || "-"}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian check-in">
              {formatDateTimeVi(detailCheckin.checkin_time)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái check-in">
              <Tag color={statusColors[detailCheckin.status] || "default"}>
                {statusToVi(detailCheckin.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái địa điểm">
              <Tag>{statusToVi(detailCheckin.location_status || "-")}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thiết bị">
              {detailCheckin.device_info || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">
              {detailCheckin.notes || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Vị trí đăng ký">
              {detailCheckin.registered_location
                ? `${formatCoord(detailCheckin.registered_location.latitude)}, ${formatCoord(
                    detailCheckin.registered_location.longitude,
                  )}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Vị trí check-in">
              {detailCheckin.actual_checkin_location
                ? `${formatCoord(detailCheckin.actual_checkin_location.latitude)}, ${formatCoord(
                    detailCheckin.actual_checkin_location.longitude,
                  )}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Khoảng cách">
              {detailCheckin.distance_km != null
                ? `${detailCheckin.distance_km} km`
                : "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">
            Không có dữ liệu check-in
          </Typography.Text>
        )}
      </Modal>

      <Modal
        title={
          selectedCheckin
            ? `Vị trí check-in • #${selectedCheckin.checkin_id}`
            : "Vị trí check-in"
        }
        open={mapVisible}
        onCancel={closeMap}
        afterOpenChange={(opened) => {
          if (opened) {
            setMapMountKey((k) => k + 1);
          }
        }}
        centered
        footer={
          <Space>
            <Button onClick={closeMap}>Đóng</Button>
          </Space>
        }
        width={760}
        destroyOnHidden
        styles={{
          mask: { backgroundColor: "rgba(0,0,0,0.65)" },
          body: { padding: 0 },
        }}
      >
        {selectedCheckin && mapVisible ? (
          <div className="p-3">
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="relative h-[380px] sm:h-[440px]">
                <CheckinLeafletMap
                  key={mapMountKey}
                  locationName={selectedCheckin.location_name}
                  address={selectedCheckin.address}
                  registeredPos={registeredPos}
                  actualPos={actualPos}
                  recenterKey={mapMountKey}
                />

                <div className="absolute bottom-3 left-3 z-[500] rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow backdrop-blur">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Chú thích
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1677ff] text-[10px] font-bold text-white">
                      R
                    </span>
                    <span className="text-slate-600">Vị trí đăng ký</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#ff4d4f] text-[10px] font-bold text-white">
                      A
                    </span>
                    <span className="text-slate-600">
                      Vị trí check-in thực tế
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t bg-white px-4 py-3 text-sm text-slate-700">
                <div className="font-semibold leading-snug text-slate-800">
                  {selectedCheckin.location_name}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {selectedCheckin.address || "-"}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
                  <div className="truncate">
                    <span className="text-slate-500">R:</span>{" "}
                    {registeredPos
                      ? `${formatCoord(registeredPos.lat)}, ${formatCoord(
                          registeredPos.lng,
                        )}`
                      : "-"}
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">A:</span>{" "}
                    {actualPos
                      ? `${formatCoord(actualPos.lat)}, ${formatCoord(
                          actualPos.lng,
                        )}`
                      : "Chưa có"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Khoảng cách R-A:</span>{" "}
                    {distanceKmFromBackend !== null
                      ? `${distanceKmFromBackend.toFixed(2)} km`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={`Xác thực check-in #${selectedCheckin?.checkin_id || ""}`}
        open={verifyVisible}
        onCancel={() => setVerifyVisible(false)}
        centered
        width="80vw"
        styles={{ mask: { backgroundColor: "rgba(0,0,0,0.65)" } }}
        footer={
          <Space>
            <Button onClick={() => setVerifyVisible(false)}>Đóng</Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={reportMismatchFromVerify}
            >
              Báo cáo sai lệch
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={submitVerify}
            >
              Xác nhận vị trí và đóng
            </Button>
          </Space>
        }
      >
        {selectedCheckin ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="relative h-[50vh] min-h-[360px]">
                <CheckinLeafletMap
                  locationName={selectedCheckin.location_name}
                  address={selectedCheckin.address}
                  registeredPos={registeredPos}
                  actualPos={actualPos}
                  recenterKey={selectedCheckin.checkin_id}
                />
              </div>
              <div className="border-t bg-gray-50 p-3 text-sm">
                <div>
                  <span className="font-medium">Địa điểm:</span>{" "}
                  {selectedCheckin.location_name}
                </div>
                <div>
                  <span className="font-medium">Địa chỉ:</span>{" "}
                  {selectedCheckin.address || "-"}
                </div>
                <div>
                  <span className="font-medium">R:</span>{" "}
                  {registeredPos
                    ? `${formatCoord(registeredPos.lat)}, ${formatCoord(
                        registeredPos.lng,
                      )}`
                    : "-"}
                </div>
                <div>
                  <span className="font-medium">A:</span>{" "}
                  {actualPos
                    ? `${formatCoord(actualPos.lat)}, ${formatCoord(
                        actualPos.lng,
                      )}`
                    : "Chưa có vị trí check-in thực tế"}
                </div>
                <div>
                  <span className="font-medium">Khoảng cách:</span>{" "}
                  {distanceKmFromBackend !== null
                    ? `${distanceKmFromBackend.toFixed(2)} km`
                    : "-"}
                </div>
              </div>
            </div>

            <Input.TextArea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="Ghi chú (tuỳ chọn)"
              rows={3}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={`Đánh dấu thất bại check-in #${
          selectedCheckin?.checkin_id || ""
        }`}
        open={failVisible}
        onCancel={() => setFailVisible(false)}
        onOk={submitFail}
        okText="Cập nhật"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          value={failReason}
          onChange={(e) => setFailReason(e.target.value)}
          placeholder="Lý do (tuỳ chọn)"
          rows={4}
        />
      </Modal>
    </MainLayout>
  );
};

export default Checkins;
