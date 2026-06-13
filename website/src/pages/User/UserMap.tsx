import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as AntImage } from "antd";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet-polylinedecorator";
import { useLocation, useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import { useLocations } from "../../hooks/useLocations";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getPinIconByKind } from "../../utils/leafletPinIcons";
import userApi from "../../api/userApi";
import locationApi from "../../api/locationApi";
import geoApi from "../../api/geoApi";
import {
  isOwnerCreatedLocation,
  type LocationReview,
  type Location,
} from "../../types/location.types";
import {
  extractOpenClose,
  isWithinOpeningHours,
} from "../../utils/openingHours";
import { locationTypeToVi } from "../../utils/locationTypeText";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import {
  REVIEW_UPDATED_EVENT,
  dispatchReviewUpdated,
} from "../../utils/reviewSync";

// Lay user_id tu JWT token trong sessionStorage
const getCurrentUserId = (): number | null => {
  try {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId ?? payload.user_id ?? payload.sub ?? null;
  } catch {
    return null;
  }
};

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = { lat: number; lng: number };

type MapView = { center: LatLng; zoom: number };

type RouteMode = "motorbike" | "car";

type FocusCheckinState = {
  checkin_id: number;
  location_id: number;
  location_name: string;
  address?: string;
  status?: "pending" | "verified" | "failed";
  is_user_created?: number | boolean | null;
  location_owner_id?: number | string | null;
  lat: number | null;
  lng: number | null;
  first_image?: string | null;
};

type FocusRouteState = {
  location_id: number;
  lat: number;
  lng: number;
  location_name?: string;
  address?: string;
  first_image?: string | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type BaseLayerKey = "osm" | "positron" | "voyager" | "satellite";

type BaseLayerConfig = {
  key: BaseLayerKey;
  label: string;
  url: string;
  attribution: string;
  maxZoom?: number;
};

type SearchResult = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    state?: string;
    city?: string;
    county?: string;
    region?: string;
    country?: string;
  };
};

type PublicServiceRow = {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: "room" | "table" | "ticket" | "food" | "combo" | "other";
  price: number | string;
};

const clampInt = (value: number, min: number, max: number) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const normalizeReviewImages = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
};

const StarRatingPicker = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) => {
  const v = clampInt(value, 0, 5);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((i) => {
          const active = v === i;
          const filled = v >= i;
          return (
            <button
              key={i}
              type="button"
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                filled
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              onClick={() => onChange(active ? 0 : i)}
              aria-label={`${i} sao`}
              title={`${i} sao`}
            >
              {i} sao
            </button>
          );
        })}
      </div>
      <div className="text-xs text-slate-500">
        {v > 0 ? `${v} / 5` : "Chưa chọn"}
      </div>
    </div>
  );
};

const DEFAULT_CENTER: LatLng = { lat: 10.776889, lng: 106.700806 };
const VIETNAM_BOUNDS: [[number, number], [number, number]] = [
  [8.0, 102.0],
  [23.5, 110.5],
];

const normalizeNumber = (value: number | string | null | undefined) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const MapViewTracker = ({
  onChange,
}: {
  onChange: (view: MapView) => void;
}) => {
  const map = useMap();
  const rafRef = useRef(0);

  const emitView = useCallback(() => {
    if (rafRef.current) return;
    // Vi sao: cap nhat ref khi keo map de khong bi snap-back khi render.
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = 0;
      const center = map.getCenter();
      onChange({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      });
    });
  }, [map, onChange]);

  useMapEvents({
    move: emitView,
    zoom: emitView,
    moveend: emitView,
    zoomend: emitView,
  });

  useEffect(() => {
    emitView();
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [emitView]);

  return null;
};

const MapRecenter = ({
  target,
  trigger,
}: {
  target: LatLng | null;
  trigger: number;
}) => {
  const map = useMap();
  const lastTrigger = useRef(-1);
  useEffect(() => {
    if (!target) return;
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    map.setView([target.lat, target.lng], map.getZoom(), { animate: true });
  }, [map, target, trigger]);
  return null;
};

// Dong bo maxZoom mac dinh cho tat ca loai ban do
const MAX_ZOOM = 17;

const MapMaxZoomSync = () => {
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(MAX_ZOOM);
    if (map.getZoom() > MAX_ZOOM) {
      map.setZoom(MAX_ZOOM, { animate: false });
    }
  }, [map]);
  return null;
};

// Theo doi user keo map de chan fitBounds tu dong
const MapInteractionWatcher = ({
  interactingRef,
}: {
  interactingRef: React.MutableRefObject<boolean>;
}) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => { interactingRef.current = true; };
    map.on("dragstart", handler);
    return () => {
      map.off("dragstart", handler);
    };
  }, [map, interactingRef]);
  return null;
};

const MapResizeObserver = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let rafId = 0;

    const invalidate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => invalidate());
      observer.observe(container);
      invalidate();
      return () => {
        observer.disconnect();
        if (rafId) cancelAnimationFrame(rafId);
      };
    }

    window.addEventListener("resize", invalidate);
    invalidate();
    return () => {
      window.removeEventListener("resize", invalidate);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [map]);
  return null;
};

const MapRefBinder = ({ mapRef }: { mapRef: { current: L.Map | null } }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      // Vì sao: MapContainer có thể unmount khi mở/đóng full map.
      // Nếu không clear ref, các effect gọi fitBounds sẽ dùng map instance đã bị destroy
      // và gây crash: Cannot set properties of undefined (setting '_leaflet_pos').
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
};

const MapClickHandler = ({ onPick }: { onPick: (coords: LatLng) => void }) => {
  // Vì sao: tránh click nhầm tạo marker; chỉ tạo khi double-click.
  useMapEvents({
    dblclick: (event) => {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
};

// Mũi tên phương hướng quay theo thiết bị (DeviceOrientationEvent)
const CompassMarker = ({
  position,
  heading,
}: {
  position: LatLng;
  heading: number | null;
}) => {
  if (heading === null) return null;

  const icon = L.divIcon({
    className: "compass-marker",
    html: `<div style="
      width: 36px; height: 36px;
      transform: rotate(${heading}deg);
      transition: transform 0.3s ease;
      display: flex; align-items: center; justify-content: center;
    ">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#2563eb" stroke="#1d4ed8" stroke-width="1"/>
      </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={1000}
    />
  );
};

// Icon anh tron cho dia diem — co cache de tranh tao lai moi render
const circleIconCache = new Map<string, L.DivIcon>();
const getCircleImageIcon = (
  imageUrl: string | null | undefined,
  isSelected: boolean,
  size = 56,
) => {
  const cacheKey = `${imageUrl ?? ""}|${isSelected}|${size}`;
  const cached = circleIconCache.get(cacheKey);
  if (cached) return cached;

  const borderStyle = isSelected
    ? `3px solid white`
    : `2px solid white`;
  const shadow = isSelected
    ? `0 0 0 3px #14b8a6, 0 2px 10px rgba(0,0,0,0.35)`
    : `0 2px 6px rgba(0,0,0,0.2)`;

  let icon: L.DivIcon;
  if (imageUrl) {
    icon = L.divIcon({
      className: "",
      html: `<div style="
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        border: ${borderStyle};
        box-shadow: ${shadow};
        overflow: hidden;
        background: #e2e8f0;
      ">
        <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" onerror="this.parentElement.style.background='linear-gradient(135deg,#99f6e4,#a7f3d0)';this.style.display='none';" />
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  } else {
    // Fallback: gradient + SVG pin
    icon = L.divIcon({
      className: "",
      html: `<div style="
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        border: ${borderStyle};
        box-shadow: ${shadow};
        background: linear-gradient(135deg, #99f6e4, #a7f3d0);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2">
          <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }

  // Gioi han cache 200 icon de tranh memory leak
  if (circleIconCache.size > 200) circleIconCache.clear();
  circleIconCache.set(cacheKey, icon);
  return icon;
};

const getDestinationImageUrl = (
  dest: FocusRouteState | null,
  sel: Location | null,
): string | null => {
  if (!dest) return null;
  const rawUrl =
    dest.first_image ||
    (sel && Number(sel.location_id) === Number(dest.location_id)
      ? (sel.first_image ?? (Array.isArray(sel.images) ? sel.images[0] : null))
      : null);
  return resolveBackendUrl(rawUrl);
};

const getCheckinImageUrl = (
  checkin: FocusCheckinState | null,
  sel: Location | null,
): string | null => {
  if (!checkin) return null;
  const rawUrl =
    checkin.first_image ||
    (sel && Number(sel.location_id) === Number(checkin.location_id)
      ? (sel.first_image ?? (Array.isArray(sel.images) ? sel.images[0] : null))
      : null);
  return resolveBackendUrl(rawUrl);
};

// Mũi tên hướng đi trên polyline route — chỉ 1 mũi tên ở đầu (vị trí user)
const RouteArrowDecorator = ({
  routeLines,
}: {
  routeLines: LatLng[][] | null;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!routeLines || routeLines.length === 0) return;

    const decorators: L.PolylineDecorator[] = [];

    routeLines.forEach((line) => {
      if (line.length < 2) return;
      const latLngs = line.map((p) => L.latLng(p.lat, p.lng));
      const decorator = L.polylineDecorator(latLngs, {
        patterns: [
          {
            offset: 16,
            repeat: 0,
            symbol: L.Symbol.arrowHead({
              pixelSize: 18,
              polygon: true,
              pathOptions: {
                color: "#ffffff",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 2,
                opacity: 1,
              },
            }),
          },
        ],
      });
      decorator.addTo(map);
      decorators.push(decorator);
    });

    return () => {
      decorators.forEach((d) => map.removeLayer(d));
    };
  }, [map, routeLines]);

  return null;
};

// Tinh goc bearing tu diem A den diem B (do, 0=Bac, 90=Dong)
const calculateBearing = (from: LatLng, to: LatLng): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

// Mui ten bearing: vong tron 50m + mui ten huong den dich
const BearingArrow = ({
  position,
  destination,
  heading,
}: {
  position: LatLng;
  destination: LatLng;
  heading: number | null;
}) => {
  const bearing = useMemo(
    () => calculateBearing(position, destination),
    [position, destination],
  );

  // Tren mobile: bearing - heading (quay theo thiet bi)
  // Tren laptop: bearing co dinh (khong co gyroscope)
  const arrowRotation = heading != null ? bearing - heading : bearing;

  const arrowIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div style="
          width: 44px; height: 44px;
          background: #2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          display: flex; align-items: center; justify-content: center;
          transform: rotate(${arrowRotation}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 20L12 16L20 20L12 2Z" />
          </svg>
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [arrowRotation],
  );

  return (
    <>
      {/* Vong tron ban kinh 50m */}
      <Circle
        center={[position.lat, position.lng]}
        radius={50}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          weight: 2,
          dashArray: "6 4",
        }}
      />
      {/* Mui ten bearing */}
      <Marker
        position={[position.lat, position.lng]}
        icon={arrowIcon}
        zIndexOffset={1100}
      />
    </>
  );
};

const haversineMeters = (a: LatLng, b: LatLng): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters)) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds)) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const isWithinVietnam = (coords: LatLng): boolean => {
  const [[minLat, minLng], [maxLat, maxLng]] = VIETNAM_BOUNDS;
  return (
    coords.lat >= minLat &&
    coords.lat <= maxLat &&
    coords.lng >= minLng &&
    coords.lng <= maxLng
  );
};

const normalizeSearchText = (v: unknown): string => {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
};

const normalizeProvinceName = (v: unknown): string => {
  return normalizeSearchText(v)
    .replace(/^tinh\s+/, "")
    .replace(/^thanh\s+pho\s+/, "")
    .replace(/^tp\s+/, "")
    .trim();
};

const extractProvinceFromResult = (result: SearchResult): string => {
  return (
    result.address?.state ??
    result.address?.region ??
    result.address?.city ??
    result.address?.county ??
    ""
  );
};

const distanceBoostScore = (distanceM: number): number => {
  if (!Number.isFinite(distanceM) || distanceM < 0) return 0;
  if (distanceM <= 5_000) return 400;
  if (distanceM <= 20_000) return 250;
  if (distanceM <= 50_000) return 120;
  if (distanceM <= 100_000) return 50;
  return 0;
};

const pickProvinceHintFromQuery = (
  query: string,
  knownProvincesNorm: string[],
): string | null => {
  const q = normalizeProvinceName(query);
  if (!q) return null;
  let best: string | null = null;
  for (const p of knownProvincesNorm) {
    if (!p || p.length < 3) continue;
    if (q.includes(p) && (!best || p.length > best.length)) best = p;
  }
  return best;
};

const scoreSearchResult = (
  result: SearchResult,
  query: string,
  opts: {
    myPosition: LatLng | null;
    userProvinceNorm: string | null;
    provinceHintNorm: string | null;
    isSystem: boolean;
  },
): number => {
  const q = normalizeSearchText(query);
  const dn = normalizeSearchText(result.display_name);
  const idx = q ? dn.indexOf(q) : -1;
  const textScore = idx >= 0 ? Math.max(0, 120 - idx) : 0;

  const ownerBoost =
    opts.isSystem && (result.type === "owner" || result.type === "system")
      ? 1000
      : 0;
  const systemBoost = opts.isSystem ? 40 : 0;

  const lat = Number(result.lat);
  const lng = Number(result.lon);
  const distanceM =
    opts.myPosition && Number.isFinite(lat) && Number.isFinite(lng)
      ? haversineMeters(opts.myPosition, { lat, lng })
      : null;
  const distanceBoost = distanceM == null ? 0 : distanceBoostScore(distanceM);

  const provinceNorm = normalizeProvinceName(extractProvinceFromResult(result));
  const queryProvinceBoost =
    opts.provinceHintNorm &&
    provinceNorm &&
    provinceNorm === opts.provinceHintNorm
      ? 800
      : 0;
  const userProvinceBoost =
    !queryProvinceBoost &&
    opts.userProvinceNorm &&
    provinceNorm &&
    provinceNorm === opts.userProvinceNorm
      ? 500
      : 0;
  const outsideProvincePenalty =
    !queryProvinceBoost &&
    opts.userProvinceNorm &&
    provinceNorm &&
    provinceNorm !== opts.userProvinceNorm
      ? -80
      : 0;
  const nonHintPenalty =
    opts.provinceHintNorm &&
    provinceNorm &&
    provinceNorm !== opts.provinceHintNorm
      ? -120
      : 0;

  return (
    ownerBoost +
    systemBoost +
    textScore +
    distanceBoost +
    queryProvinceBoost +
    userProvinceBoost +
    outsideProvincePenalty +
    nonHintPenalty
  );
};

const bookingLabelByLocationType = (locationType: unknown): string => {
  const t = String(locationType ?? "")
    .trim()
    .toLowerCase();
  if (t === "restaurant" || t === "cafe") return "Đặt bàn";
  if (t === "hotel" || t === "resort") return "Đặt phòng";
  if (t === "tourist") return "Mua vé";
  return "Đặt trước";
};

const pickPrimaryServiceForLocation = (
  services: PublicServiceRow[],
  locationType: unknown,
): PublicServiceRow | null => {
  if (!services.length) return null;
  const t = String(locationType ?? "")
    .trim()
    .toLowerCase();

  const want: PublicServiceRow["service_type"][] =
    t === "restaurant" || t === "cafe"
      ? ["table", "food", "combo", "other"]
      : t === "hotel" || t === "resort"
        ? ["room", "combo", "other"]
        : t === "tourist"
          ? ["ticket", "combo", "other"]
          : ["other", "combo", "food", "table", "room", "ticket"];

  for (const k of want) {
    const found = services.find((s) => s.service_type === k);
    if (found) return found;
  }
  return services[0] ?? null;
};

const buildSystemSearchResults = (
  query: string,
  locations: Location[],
  opts?: {
    myPosition?: LatLng | null;
    userProvinceNorm?: string | null;
    provinceHintNorm?: string | null;
  },
): SearchResult[] => {
  const q = normalizeSearchText(query);
  if (!q) return [];

  const scored: Array<{ score: number; result: SearchResult }> = [];

  for (const loc of locations) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!isWithinVietnam({ lat, lng })) continue;

    const name = String(loc.location_name ?? "").trim();
    const address = String(loc.address ?? "").trim();
    const province = String(loc.province ?? "").trim();
    const hay = normalizeSearchText(`${name} ${address} ${province}`);
    if (!hay) continue;

    const idx = hay.indexOf(q);
    if (idx < 0) continue;

    const ownerBoost = isOwnerCreatedLocation(loc) ? 1000 : 0;
    const nameNorm = normalizeSearchText(name);
    const startsWithBoost = nameNorm.startsWith(q) ? 200 : 0;
    const nameIncludesBoost = nameNorm.includes(q) ? 80 : 0;
    const positionScore = Math.max(0, 120 - idx);

    const provinceNorm = normalizeProvinceName(province);
    const hint = opts?.provinceHintNorm ?? null;
    const userProv = opts?.userProvinceNorm ?? null;
    const myPos = opts?.myPosition ?? null;
    const distanceM = myPos ? haversineMeters(myPos, { lat, lng }) : null;
    const distanceBoost = distanceM == null ? 0 : distanceBoostScore(distanceM);

    const queryProvinceBoost =
      hint && provinceNorm && provinceNorm === hint ? 800 : 0;
    const userProvinceBoost =
      !queryProvinceBoost &&
      userProv &&
      provinceNorm &&
      provinceNorm === userProv
        ? 500
        : 0;
    const outsideProvincePenalty =
      !queryProvinceBoost &&
      userProv &&
      provinceNorm &&
      provinceNorm !== userProv
        ? -80
        : 0;
    const nonHintPenalty =
      hint && provinceNorm && provinceNorm !== hint ? -120 : 0;

    const score =
      ownerBoost +
      startsWithBoost +
      nameIncludesBoost +
      positionScore +
      distanceBoost +
      queryProvinceBoost +
      userProvinceBoost +
      outsideProvincePenalty +
      nonHintPenalty +
      40;

    const displayName =
      [name, address, province].filter(Boolean).join(", ") || name || address;

    scored.push({
      score,
      result: {
        place_id: `sys:${loc.location_id}`,
        display_name: displayName,
        lat: String(lat),
        lon: String(lng),
        class: "system",
        type: isOwnerCreatedLocation(loc) ? "owner" : "location",
        address: {
          state: province || undefined,
          country: "Vietnam",
        },
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6).map((x) => x.result);
};

const FREE_CHECKIN_RADIUS_M = 80;

const UserMap = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();


  const { locations, loading, error, setKeyword, refetch } = useLocations();
  const [selected, setSelected] = useState<Location | null>(null);
  const [pickedPoint, setPickedPoint] = useState<LatLng | null>(null);
  const [pickedName, setPickedName] = useState("");
  const [pickedSuggested, setPickedSuggested] = useState<Location | null>(null);
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const lastGpsPosRef = useRef<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [freeAction, setFreeAction] = useState<"checkin" | "save" | null>(null);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mapStyle, setMapStyle] = useState<BaseLayerKey>("osm");
  const [routeMode, setRouteMode] = useState<RouteMode>("motorbike");
  const [routeEnabled, setRouteEnabled] = useState(false);
  const [routeTarget, setRouteTarget] = useState<LatLng | null>(null);
  const [routeLines, setRouteLines] = useState<LatLng[][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceM: number;
    durationS?: number;
    source: "osrm" | "haversine";
    alternatives?: number;
    hasNoRoute?: boolean;
    error?: string;
  } | null>(null);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelOpenRef = useRef(false);
  // Dong bo ref voi state de handleSelectLocation dung ref, khong re-create callback
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);
  const [routeOnlyMode, setRouteOnlyMode] = useState(false);
  const [routeOnlyDestination, setRouteOnlyDestination] =
    useState<FocusRouteState | null>(null);
  const [pendingFocusRoute, setPendingFocusRoute] =
    useState<FocusRouteState | null>(null);
  const [recenterTarget, setRecenterTarget] = useState<LatLng | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSelected, setSearchSelected] = useState<SearchResult | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMarker, setSearchMarker] = useState<LatLng | null>(null);
  const [userProvince, setUserProvince] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"info" | "review" | "about">("info");
  const [savingSelected, setSavingSelected] = useState(false);
  const [selectedServices, setSelectedServices] = useState<PublicServiceRow[]>(
    [],
  );
  const [selectedServicesLoading, setSelectedServicesLoading] = useState(false);
  const [selectedServicesError, setSelectedServicesError] = useState<
    string | null
  >(null);
  const [nearbyCategory, setNearbyCategory] = useState<
    "all" | "food" | "tourist" | "hotel" | "mine"
  >("all");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<LocationReview[]>([]);
  const [selectedReviewsLoading, setSelectedReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState(0);
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const [favoriteLocationIds, setFavoriteLocationIds] = useState<number[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"locations" | "detail" | "reviews">("locations");

  const [focusCheckin, setFocusCheckin] = useState<FocusCheckinState | null>(
    null,
  );

  const searchIcon = getPinIconByKind("search");
  const pickedIcon = getPinIconByKind("picked");
  const myPositionIcon = getPinIconByKind("myPosition");

  const mainMapRef = useRef<L.Map | null>(null);
  const fullMapRef = useRef<L.Map | null>(null);
  const userInteractingRef = useRef(false);

  const knownProvincesNorm = useMemo(() => {
    const set = new Set<string>();
    for (const loc of locations) {
      const p = normalizeProvinceName(loc.province);
      if (p) set.add(p);
    }
    return Array.from(set);
  }, [locations]);

  const userProvinceNorm = useMemo(() => {
    const p = normalizeProvinceName(userProvince);
    return p || null;
  }, [userProvince]);

  useEffect(() => {
    if (!myPosition) {
      setUserProvince(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data = await geoApi.reverse(
          myPosition.lat,
          myPosition.lng,
          controller.signal,
        );
        setUserProvince((data?.address as any)?.state ?? null);
      } catch (error) {
        const name = String((error as Error | { name?: unknown })?.name || "");
        if (name === "AbortError" || name === "CanceledError") return;
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [myPosition]);

  const isSamePoint = useCallback((a: LatLng | null, b: LatLng | null) => {
    if (!a || !b) return false;
    const EPS = 1e-6;
    return Math.abs(a.lat - b.lat) <= EPS && Math.abs(a.lng - b.lng) <= EPS;
  }, []);

  const locationMarkers = useMemo(() => {
    return locations
      .map((item) => {
        const lat = normalizeNumber(item.latitude);
        const lng = normalizeNumber(item.longitude);
        if (lat == null || lng == null) return null;
        return { item, lat, lng };
      })
      .filter(
        (item): item is { item: Location; lat: number; lng: number } =>
          item != null,
      );
  }, [locations]);

  const selectedCoords = useMemo<LatLng | null>(() => {
    if (!selected) return null;
    const lat = normalizeNumber(selected.latitude);
    const lng = normalizeNumber(selected.longitude);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [selected]);

  const selectedIsFavorite = useMemo(() => {
    const locationId = Number(selected?.location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) return false;
    return favoriteLocationIds.includes(locationId);
  }, [favoriteLocationIds, selected?.location_id]);

  const loadFavoriteLocationIds = useCallback(async () => {
    try {
      const response = await userApi.getFavorites();
      const ids = (response?.data || [])
        .map((item) => Number(item.location_id))
        .filter((id) => Number.isFinite(id) && id > 0);
      setFavoriteLocationIds(Array.from(new Set(ids)));
    } catch {
      setFavoriteLocationIds([]);
    }
  }, []);

  useEffect(() => {
    void loadFavoriteLocationIds();
  }, [loadFavoriteLocationIds]);

  // Tu dong lay vi tri khi vao trang + watchPosition + device orientation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }

    let watchId = 0;
    let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;

    const startWatch = (initialPos: LatLng) => {
      setMyPosition(initialPos);
      lastGpsPosRef.current = initialPos;
      flyTo(initialPos);
      setLocationDenied(false);
    };

    const startWatchPosition = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          // Chi cap nhat khi di chuyen > 5m de tranh re-render nhieu
          const prev = lastGpsPosRef.current;
          if (!prev || haversineMeters(prev, newPos) > 5) {
            setMyPosition(newPos);
            lastGpsPosRef.current = newPos;
          }
          setGpsAccuracy(pos.coords.accuracy);
          setLocationDenied(false);
        },
        () => {
          // Loi tam thinh (mat tin hieu) → khong set locationDenied
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    };

    const requestOrientation = () => {
      orientationHandler = (event: DeviceOrientationEvent) => {
        if (event.alpha != null) {
          setDeviceHeading(event.alpha);
        }
      };
      window.addEventListener("deviceorientation", orientationHandler, true);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const initialPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsAccuracy(pos.coords.accuracy);
        startWatch(initialPos);
      },
      () => {
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );

    // Luon bat watchPosition de GPS co the phuc hoi sau khi duoc cap quyen
    startWatchPosition();
    requestOrientation();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (orientationHandler) {
        window.removeEventListener("deviceorientation", orientationHandler, true);
      }
    };
  }, []);

  const matchesNearbyCategory = useCallback(
    (location: Location) => {
      if (nearbyCategory === "all") return true;
      const type = location.location_type;
      if (nearbyCategory === "food")
        return type === "restaurant" || type === "cafe";
      if (nearbyCategory === "tourist") return type === "tourist";
      if (nearbyCategory === "hotel")
        return type === "hotel" || type === "resort";
      if (nearbyCategory === "mine") return favoriteLocationIds.includes(Number(location.location_id));
      return true;
    },
    [nearbyCategory, favoriteLocationIds],
  );

  // Danh sach da gop: loc theo loai, sap xep theo ten
  const filteredLocations = useMemo(() => {
    return locationMarkers
      .filter((entry) => matchesNearbyCategory(entry.item))
      .map((entry) => {
        const distance = myPosition
          ? haversineMeters(myPosition, { lat: entry.lat, lng: entry.lng })
          : null;
        return { ...entry, distance };
      })
      .sort((a, b) => {
        const nameA = a.item.location_name || "";
        const nameB = b.item.location_name || "";
        return nameA.localeCompare(nameB, "vi");
      });
  }, [locationMarkers, matchesNearbyCategory, myPosition]);

  const mapViewRef = useRef<MapView>({
    center: DEFAULT_CENTER,
    zoom: 13,
  });

  const findNearbyLocation = useCallback(
    (coords: LatLng): Location | null => {
      let nearestLocation: Location | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      locationMarkers.forEach((entry) => {
        const dist = haversineMeters(coords, {
          lat: entry.lat,
          lng: entry.lng,
        });
        if (dist <= FREE_CHECKIN_RADIUS_M) {
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestLocation = entry.item;
          }
        }
      });
      return nearestLocation;
    },
    [locationMarkers],
  );

  const routeProfile = useMemo(() => {
    // OSRM public profile: use driving for both car & motorbike.
    return "driving";
  }, [routeMode]);

  // Chi fitBounds 1 lan khi route moi duoc tao (routeEnabled + routeTarget thay doi)
  // Khong phu thuoc routeLines de tranh bi keo lai khi GPS cap nhat
  const routeFitDoneRef = useRef(false);
  useEffect(() => {
    if (!routeEnabled || !routeTarget) {
      routeFitDoneRef.current = false;
      return;
    }
    routeFitDoneRef.current = false; // reset khi co route moi
  }, [routeEnabled, routeTarget]);

  useEffect(() => {
    if (!routeEnabled || !routeLines || routeLines.length === 0) return;
    if (routeFitDoneRef.current) return; // da fitBounds roi, khong lam nua
    if (userInteractingRef.current) {
      userInteractingRef.current = false;
      routeFitDoneRef.current = true; // user keo tay -> skip lan nay va luon
      return;
    }
    const map = (fullMapOpen ? fullMapRef.current : mainMapRef.current) ?? null;
    if (!map) return;
    const primary = routeLines[0] ?? [];
    if (!primary.length) return;

    const bounds = L.latLngBounds(primary.map((p) => [p.lat, p.lng]));
    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      padding: [40, 40],
      animate: true,
    });
    routeFitDoneRef.current = true;
  }, [fullMapOpen, routeEnabled, routeLines, routeTarget]);

  const tileOptions = useMemo<BaseLayerConfig[]>(
    () => [
      {
        key: "osm",
        label: "Bản đồ tiêu chuẩn",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: MAX_ZOOM,
      },
      {
        key: "positron",
        label: "Bản đồ sáng",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: MAX_ZOOM,
      },
      {
        key: "voyager",
        label: "Bản đồ đường phố",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: MAX_ZOOM,
      },
      {
        key: "satellite",
        label: "Vệ tinh",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: MAX_ZOOM,
      },
    ],
    [],
  );

  const activeTile = useMemo(() => {
    return tileOptions.find((item) => item.key === mapStyle) ?? tileOptions[0];
  }, [mapStyle, tileOptions]);

  const filteredSelectedReviews = useMemo(() => {
    if (!reviewFilter) return selectedReviews;
    return selectedReviews.filter(
      (item) => Number(item.rating) === reviewFilter,
    );
  }, [reviewFilter, selectedReviews]);

  const handleMapViewChange = useCallback((view: MapView) => {
    const prev = mapViewRef.current;
    const EPS = 1e-7;
    const same =
      prev.zoom === view.zoom &&
      Math.abs(prev.center.lat - view.center.lat) <= EPS &&
      Math.abs(prev.center.lng - view.center.lng) <= EPS;
    if (same) return;
    mapViewRef.current = view;
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    if (searchSelected && query === searchSelected.display_name.trim()) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const provinceHintNorm = pickProvinceHintFromQuery(
          query,
          knownProvincesNorm,
        );

        // 1) Prefer system locations, also rank by near + same-province.
        const systemResults = buildSystemSearchResults(query, locations, {
          myPosition,
          userProvinceNorm,
          provinceHintNorm,
        });
        setSearchResults(systemResults);

        // If we already have enough system results, skip Nominatim.
        if (systemResults.length >= 6) return;

        // 2) Fallback: Nominatim, restricted to Vietnam for higher precision.
        const data = (await geoApi.search(
          query,
          10,
          controller.signal,
        )) as unknown as SearchResult[];
        const nominatim = (Array.isArray(data) ? data : [])
          .map((r) => {
            const placeId = String((r as any)?.place_id ?? "").trim();
            return {
              ...r,
              place_id:
                placeId || `nom:${String(r.lat ?? "")},${String(r.lon ?? "")}`,
            } as SearchResult;
          })
          .filter((r) => {
            const lat = Number(r.lat);
            const lng = Number(r.lon);
            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              isWithinVietnam({ lat, lng })
            );
          });

        const combined: SearchResult[] = [];
        const seen = new Set<string>();
        for (const r of [...systemResults, ...nominatim]) {
          if (seen.has(r.place_id)) continue;
          seen.add(r.place_id);
          combined.push(r);
        }

        const ranked = combined
          .map((r) => {
            const isSystem =
              r.place_id.startsWith("sys:") || r.class === "system";
            const score = scoreSearchResult(r, query, {
              myPosition,
              userProvinceNorm,
              provinceHintNorm,
              isSystem,
            });
            return { score, result: r };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((x) => x.result);

        setSearchResults(ranked);
      } catch (error) {
        const name = String((error as Error | { name?: unknown })?.name || "");
        if (name !== "AbortError" && name !== "CanceledError") {
          setSearchError("Không thể tìm kiếm địa danh.");
        }
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    knownProvincesNorm,
    locations,
    myPosition,
    searchQuery,
    searchSelected,
    userProvinceNorm,
  ]);

  useEffect(() => {
    if (!fullMapOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullMapOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullMapOpen]);

  useEffect(() => {
    if (!fullMapOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullMapOpen]);

  useEffect(() => {
    if (!fullMapOpen) return;

    const invalidate = () => {
      fullMapRef.current?.invalidateSize();
    };

    const raf = requestAnimationFrame(invalidate);
    const t1 = window.setTimeout(invalidate, 60);
    const t2 = window.setTimeout(invalidate, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fullMapOpen]);

  const recenterTo = useCallback(
    (target: LatLng | null, zoomOverride?: number) => {
      if (!target) return;
      const nextZoom = zoomOverride ?? mapViewRef.current.zoom;
      mapViewRef.current = {
        center: target,
        zoom: nextZoom,
      };
      setRecenterTarget(target);
      setRecenterSignal((prev) => prev + 1);
    },
    [],
  );

  const flyTo = useCallback(
    (target: LatLng) => {
      recenterTo(target, 16);
    },
    [recenterTo],
  );

  // Luu vi tri bat dau route bang ref de khong re-fetch khi GPS cap nhat
  const routeFromRef = useRef<LatLng | null>(null);
  const lastTargetRef = useRef<LatLng | null>(null);
  const lastProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routeEnabled || !myPosition || !routeTarget) {
      setRouteLines(null);
      setRouteInfo(null);
      routeFromRef.current = null;
      lastTargetRef.current = null;
      lastProfileRef.current = null;
      return;
    }

    const targetChanged = !isSamePoint(lastTargetRef.current, routeTarget);
    const profileChanged = lastProfileRef.current !== routeProfile;
    if (targetChanged || profileChanged) {
      routeFromRef.current = null;
      lastTargetRef.current = routeTarget;
      lastProfileRef.current = routeProfile;
    }

    // Chi luu vi tri bat dau lan dau khi route moi
    if (!routeFromRef.current) {
      routeFromRef.current = myPosition;
    } else if (!targetChanged && !profileChanged) {
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      const from = routeFromRef.current!;
      const to = routeTarget;
      const fallbackDistance = haversineMeters(from, to);

      let lastError: Error | null = null;
      let success = false;
      let data: any = null;

      const urls = [
        `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`,
        `https://routing.openstreetmap.de/routed-${routeProfile === "driving" ? "car" : routeProfile}/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
      ];

      for (const url of urls) {
        if (controller.signal.aborted) break;
        for (let attempt = 1; attempt <= 3; attempt++) {
          if (controller.signal.aborted) break;
          try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.status === 400 || res.status === 422) {
              const errBody = await res.json().catch(() => ({}));
              if (errBody.code === "NoRoute") {
                throw new Error("NoRoute");
              }
              throw new Error(`HTTP error ${res.status}`);
            }
            if (res.status === 429) {
              throw new Error("Rate limit exceeded");
            }
            if (!res.ok) {
              throw new Error(`HTTP error ${res.status}`);
            }
            const json = await res.json();
            if (json.code && json.code !== "Ok") {
              if (json.code === "NoRoute") {
                throw new Error("NoRoute");
              }
              throw new Error(`OSRM error: ${json.code}`);
            }
            data = json;
            success = true;
            break;
          } catch (err: any) {
            lastError = err;
            if (err.name === "AbortError") {
              break;
            }
            if (err.message === "NoRoute") {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          }
        }
        if (success || (lastError && lastError.message === "NoRoute")) {
          break;
        }
      }

      if (success && data) {
        const routes = data.routes ?? [];
        const route = routes[0];
        if (!route || !route.geometry?.coordinates?.length) {
          setRouteLines([[from, to]]);
          setRouteInfo({
            distanceM: fallbackDistance,
            source: "haversine",
            hasNoRoute: true,
          });
        } else {
          const lines = routes
            .slice(0, 3)
            .map((r: any) =>
              r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
            );
          setRouteLines(lines);
          setRouteInfo({
            distanceM: route.distance,
            durationS: route.duration,
            source: "osrm",
            alternatives: routes.length,
          });
        }
      } else {
        setRouteLines([[from, to]]);
        setRouteInfo({
          distanceM: fallbackDistance,
          source: "haversine",
          hasNoRoute: lastError?.message === "NoRoute",
          error: lastError?.message || "Connection failed",
        });
      }
    };

    run();
    return () => controller.abort();
  }, [routeEnabled, routeProfile, routeTarget, myPosition, isSamePoint]);

  // Lưu route vào sessionStorage để persist khi reload
  useEffect(() => {
    if (routeEnabled && routeTarget) {
      sessionStorage.setItem(
        "userMapRoute",
        JSON.stringify({
          target: routeTarget,
          mode: routeMode,
          enabled: true,
        }),
      );
    }
  }, [routeEnabled, routeTarget, routeMode]);

  // Khôi phục route từ sessionStorage khi mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("userMapRoute");
      if (saved) {
        const data = JSON.parse(saved) as {
          target: LatLng;
          mode: RouteMode;
          enabled: boolean;
        };
        if (data.enabled && data.target) {
          setRouteTarget(data.target);
          setRouteMode(data.mode);
          setRouteEnabled(true);
        }
      }
    } catch {
      sessionStorage.removeItem("userMapRoute");
    }
  }, []);

  const clearRoute = useCallback(() => {
    // Danh dau user dang tuong tac de chan recenter khi layout thay doi
    userInteractingRef.current = true;
    setRecenterTarget(null);
    setRouteEnabled(false);
    setRouteTarget(null);
    setRouteLines(null);
    setRouteInfo(null);
    setRouteOnlyMode(false);
    setRouteOnlyDestination(null);
    sessionStorage.removeItem("userMapRoute");
  }, []);

  const getCurrentPosition = useCallback((): Promise<LatLng | null> => {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
      );
    });
  }, []);

  const handleRecenterToMyPosition = useCallback(async () => {
    setFeedback(null);
    if (myPosition) {
      recenterTo(myPosition, 16);
      return;
    }

    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    if (!pos) {
      setFeedback({
        type: "error",
        message: "Không lấy được vị trí của bạn.",
      });
      return;
    }
    setMyPosition(pos);
    recenterTo(pos, 16);
  }, [getCurrentPosition, myPosition, recenterTo]);

  const handleNavigateToSelected = async () => {
    if (!selectedCoords) {
      setFeedback({ type: "error", message: "Hãy chọn địa điểm trước." });
      return;
    }
    await ensureRouteToTarget(selectedCoords);
  };

  const ensureRouteToTarget = useCallback(
    async (target: LatLng | null) => {
      if (!target) return;
      userInteractingRef.current = false; // Cho phep fitBounds khi user yeu cau route moi
      routeFitDoneRef.current = false; // reset de fitBounds chay lai
      setFeedback(null);
      // Giu panel mo de user van thay chi tiet dia diem
      setRouteLines(null);
      setRouteInfo(null);
      setRouteTarget((prev) =>
        isSamePoint(prev, target) ? { ...target } : target,
      );
      setRouteEnabled(true);
      if (myPosition) {
        recenterTo(target, 14);
        return;
      }
      setLocating(true);
      const pos = await getCurrentPosition();
      setLocating(false);
      if (!pos) {
        setFeedback({
          type: "error",
          message: "Không lấy được vị trí của bạn.",
        });
        return;
      }
      setMyPosition(pos);
      recenterTo(target, 14);
    },
    [getCurrentPosition, isSamePoint, myPosition, recenterTo],
  );

  const handleSelectLocation = useCallback(
    (location: Location, coords?: LatLng) => {
      // Neu da chon → bo chon (toggle)
      if (selected?.location_id === location.location_id) {
        setPanelOpen((prev) => !prev);
        return;
      }
      setSelected(location);
      setPanelOpen(true);
      setSidebarTab("detail");
      // Luon flyTo
      if (coords) {
        flyTo(coords);
      } else {
        const lat = normalizeNumber(location.latitude);
        const lng = normalizeNumber(location.longitude);
        if (lat == null || lng == null) return;
        flyTo({ lat, lng });
      }
    },
    [flyTo, selected?.location_id],
  );

  const selectedOpenClose = useMemo(() => {
    return extractOpenClose(selected?.opening_hours ?? null, new Date());
  }, [selected?.opening_hours]);

  const isSelectedOpenNow = useMemo(() => {
    return isWithinOpeningHours(selected?.opening_hours ?? null, new Date());
  }, [selected?.opening_hours]);

  const pickedOpenClose = useMemo(() => {
    return extractOpenClose(pickedSuggested?.opening_hours ?? null, new Date());
  }, [pickedSuggested?.opening_hours]);

  const isPickedOpenNow = useMemo(() => {
    return isWithinOpeningHours(
      pickedSuggested?.opening_hours ?? null,
      new Date(),
    );
  }, [pickedSuggested?.opening_hours]);

  useEffect(() => {
    if (!selected?.location_id) {
      setPanelOpen(false);
      setPanelTab("info");
      return;
    }
    // Không ép mở panel nữa để có thể đóng panel khi bắt đầu dẫn đường.
    setPanelTab("info");
  }, [selected?.location_id]);

  useEffect(() => {
    const locationId = selected?.location_id;
    if (!locationId) {
      setSelectedServices([]);
      setSelectedServicesError(null);
      setSelectedServicesLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedServicesLoading(true);
    setSelectedServicesError(null);
    locationApi
      .getLocationServices(locationId)
      .then((resp) => {
        if (cancelled) return;
        const raw = Array.isArray(resp.data) ? resp.data : [];
        const mapped: PublicServiceRow[] = raw
          .map((r) => r as any)
          .filter((r) => r && typeof r === "object")
          .map((r) => ({
            service_id: Number(r.service_id),
            location_id: Number(r.location_id),
            service_name: String(r.service_name || ""),
            service_type: String(r.service_type || "other") as any,
            price: r.price,
          }))
          .filter((r) => Number.isFinite(r.service_id) && r.service_name);
        setSelectedServices(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedServices([]);
        setSelectedServicesError("Không thể tải danh sách dịch vụ.");
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedServicesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.location_id]);

  const primarySelectedService = useMemo(() => {
    return pickPrimaryServiceForLocation(
      selectedServices,
      selected?.location_type,
    );
  }, [selected?.location_type, selectedServices]);

  const loadSelectedReviews = useCallback(async () => {
    const locationId = Number(selected?.location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      setSelectedReviews([]);
      setSelectedReviewsLoading(false);
      return;
    }
    setSelectedReviewsLoading(true);
    try {
      const [reviewsResp, locationResp] = await Promise.all([
        locationApi.getLocationReviews(locationId),
        locationApi.getLocationById(locationId, "web"),
      ]);

      setSelectedReviews(reviewsResp.success ? reviewsResp.data || [] : []);
      if (locationResp.success && locationResp.data) {
        setSelected((prev) => {
          if (!prev || Number(prev.location_id) !== locationId) return prev;
          return {
            ...prev,
            rating: locationResp.data.rating,
            total_reviews: locationResp.data.total_reviews,
          };
        });
      }
    } catch {
      setSelectedReviews([]);
    } finally {
      setSelectedReviewsLoading(false);
    }
  }, [selected?.location_id]);

  useEffect(() => {
    if (!selected?.location_id) {
      setSelectedReviews([]);
      return;
    }
    void loadSelectedReviews();
  }, [loadSelectedReviews, selected?.location_id]);

  useEffect(() => {
    const locationId = Number(selected?.location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ locationId?: number }>;
      if (Number(custom.detail?.locationId) !== locationId) return;
      void loadSelectedReviews();
    };
    window.addEventListener(REVIEW_UPDATED_EVENT, handler as EventListener);
    const id = window.setInterval(() => {
      void loadSelectedReviews();
    }, 5000);
    return () => {
      window.removeEventListener(
        REVIEW_UPDATED_EVENT,
        handler as EventListener,
      );
      window.clearInterval(id);
    };
  }, [loadSelectedReviews, selected?.location_id]);

  const handleCheckin = async () => {
    setFeedback(null);
    if (!selected) {
      setFeedback({ type: "error", message: "Vui lòng chọn địa điểm." });
      return;
    }

    if (!myPosition) {
      setFeedback({
        type: "error",
        message: "Chưa lấy được vị trí. Vui lòng cấp quyền định vị.",
      });
      return;
    }

    setCheckingIn(true);
    try {
      await userApi.createCheckin({
        location_id: selected.location_id,
        checkin_latitude: myPosition?.lat ?? null,
        checkin_longitude: myPosition?.lng ?? null,
        notes: notes.trim() ? notes.trim() : null,
      });
      setNotes("");
      setFeedback({
        type: "success",
        message: "Đã check-in thành công.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "Không thể tạo check-in."),
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSaveSelectedLocation = async () => {
    setFeedback(null);
    if (!selected) {
      setFeedback({ type: "error", message: "Vui lòng chọn địa điểm." });
      return;
    }
    setSavingSelected(true);
    try {
      if (selectedIsFavorite) {
        await userApi.removeFavorite(selected.location_id);
        setFavoriteLocationIds((prev) =>
          prev.filter((id) => id !== Number(selected.location_id)),
        );
        setFeedback({ type: "success", message: "Đã bỏ lưu địa điểm." });
      } else {
        await userApi.saveFavorite(selected.location_id, {
          note: "",
          tags: "",
        });
        setFavoriteLocationIds((prev) => {
          const id = Number(selected.location_id);
          return prev.includes(id) ? prev : [...prev, id];
        });
        setFeedback({ type: "success", message: "Đã lưu địa điểm để đi sau." });
      }
      refetch();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "Không thể cập nhật trạng thái lưu địa điểm.",
        ),
      });
    } finally {
      setSavingSelected(false);
    }
  };

  const handleShareSelectedLocation = async () => {
    setFeedback(null);
    if (!selected) {
      setFeedback({ type: "error", message: "Vui lòng chọn địa điểm." });
      return;
    }
    const url = `${window.location.origin}/user/location/${selected.location_id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: selected.location_name,
          url,
        });
        setFeedback({ type: "success", message: "Đã chia sẻ liên kết." });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setFeedback({ type: "success", message: "Đã copy liên kết." });
      } else {
        setFeedback({ type: "success", message: url });
      }
    } catch {
      setFeedback({ type: "error", message: "Không thể chia sẻ lúc này." });
    }
  };

  const handleBookSelectedLocation = () => {
    setFeedback(null);
    if (!selected) {
      setFeedback({ type: "error", message: "Vui lòng chọn địa điểm." });
      return;
    }
    if (!primarySelectedService) {
      setFeedback({
        type: "error",
        message: "Chưa có dịch vụ để đặt trước tại địa điểm này.",
      });
      navigate(`/user/location/${selected.location_id}`);
      return;
    }
    navigate(
      `/user/booking/${primarySelectedService.service_id}?locationId=${selected.location_id}`,
    );
  };

  const handleSearchSelect = (result: SearchResult) => {
    if (result.place_id.startsWith("sys:")) {
      const id = Number(result.place_id.slice("sys:".length));
      if (Number.isFinite(id)) {
        const loc = locations.find((x) => Number(x.location_id) === id);
        if (loc) {
          const lat = normalizeNumber(loc.latitude);
          const lng = normalizeNumber(loc.longitude);
          const coords =
            lat == null || lng == null ? null : ({ lat, lng } as LatLng);
          handleSelectLocation(loc, coords ?? undefined);
          setSearchMarker(null);
          setSearchSelected(result);
          setSearchResults([]);
          setSearchQuery(result.display_name);
          return;
        }
      }
    }

    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const target = { lat, lng };
    setSearchMarker(target);
    setSearchSelected(result);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    flyTo(target);
  };

  const handleMapPick = useCallback(
    (coords: LatLng) => {
      setPickedPoint(coords);
      const suggested = findNearbyLocation(coords);
      setPickedSuggested(suggested);
      setPickedName(suggested?.location_name ?? "");
      setFeedback(null);
    },
    [findNearbyLocation],
  );

  const handleFreeAction = async (action: "checkin" | "save") => {
    if (!pickedPoint) return;
    if (!isWithinVietnam(pickedPoint)) {
      setFeedback({
        type: "error",
        message: "Chỉ hỗ trợ check-in trong phạm vi Việt Nam.",
      });
      return;
    }
    setFeedback(null);
    setFreeAction(action);
    try {
      await userApi.createCheckin({
        action,
        location_id: pickedSuggested?.location_id,
        checkin_latitude: pickedPoint.lat,
        checkin_longitude: pickedPoint.lng,
        location_name: pickedName.trim() ? pickedName.trim() : null,
        notes: action === "checkin" && notes.trim() ? notes.trim() : null,
      });
      setFeedback({
        type: "success",
        message:
          action === "checkin"
            ? "Đã check-in thành công."
            : "Đã lưu địa điểm để đi sau.",
      });
      if (action === "checkin") setNotes("");
      refetch();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          action === "checkin"
            ? "Không thể tạo check-in."
            : "Không thể lưu địa điểm.",
        ),
      });
    } finally {
      setFreeAction(null);
    }
  };

  const clearPickedPoint = useCallback(() => {
    if (isSamePoint(routeTarget, pickedPoint)) {
      clearRoute();
    }
    setPickedPoint(null);
    setPickedSuggested(null);
    setPickedName("");
    setFeedback(null);
  }, [clearRoute, isSamePoint, pickedPoint, routeTarget]);

  useEffect(() => {
    const state = routerLocation.state as unknown as {
      focusCheckin?: FocusCheckinState;
      focusRoute?: FocusRouteState;
    } | null;
    if (!state?.focusCheckin && !state?.focusRoute) return;

    if (state.focusCheckin) {
      const incoming = state.focusCheckin;
      setFocusCheckin((prev) => {
        if (!prev) return incoming;
        const same =
          prev.checkin_id === incoming.checkin_id &&
          prev.location_id === incoming.location_id &&
          prev.lat === incoming.lat &&
          prev.lng === incoming.lng &&
          prev.is_user_created === incoming.is_user_created;
        return same ? prev : incoming;
      });
    }

    if (state.focusRoute) {
      setPendingFocusRoute(state.focusRoute);
      setRouteOnlyMode(true);
      setRouteOnlyDestination(state.focusRoute);
    }

    // Clear router state to prevent re-applying on every render
    navigate(routerLocation.pathname, { replace: true, state: null });
  }, [navigate, routerLocation.pathname, routerLocation.state]);

  useEffect(() => {
    if (!pendingFocusRoute) return;
    if (locations.length === 0 && loading) return; // Wait for locations to load

    const target = { lat: pendingFocusRoute.lat, lng: pendingFocusRoute.lng };
    const found = locations.find(
      (x) => Number(x.location_id) === Number(pendingFocusRoute.location_id),
    );

    if (selected?.location_id !== Number(pendingFocusRoute.location_id)) {
      if (found) {
        setSelected(found);
        setPanelOpen(true);
        setSidebarTab("detail");
        setPanelTab("info");
      } else {
        locationApi.getLocationById(Number(pendingFocusRoute.location_id))
          .then((res) => {
            if (res.success && res.data) {
              setSelected(res.data);
              setPanelOpen(true);
              setSidebarTab("detail");
              setPanelTab("info");
            }
          })
          .catch(() => {});
      }
    }

    flyTo(target);
    void ensureRouteToTarget(target);
    setPendingFocusRoute(null);
  }, [ensureRouteToTarget, flyTo, locations, loading, pendingFocusRoute, selected]);

  const focusCheckinDoneRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusCheckin || focusCheckin.lat == null || focusCheckin.lng == null)
      return;
    if (userInteractingRef.current) return;

    if (focusCheckinDoneRef.current === focusCheckin.checkin_id) {
      return;
    }

    const target = { lat: focusCheckin.lat, lng: focusCheckin.lng } as LatLng;
    setRecenterTarget(target);
    setRecenterSignal((v) => v + 1);

    if (focusCheckin.location_id) {
      const found = locations.find(
        (x) => Number(x.location_id) === Number(focusCheckin.location_id),
      );
      if (found) {
        setSelected(found);
        setPanelOpen(true);
        setSidebarTab("detail");
        setPanelTab("info");
        focusCheckinDoneRef.current = focusCheckin.checkin_id;
      } else {
        locationApi.getLocationById(Number(focusCheckin.location_id))
          .then((res) => {
            if (res.success && res.data) {
              setSelected(res.data);
              setPanelOpen(true);
              setSidebarTab("detail");
              setPanelTab("info");
              focusCheckinDoneRef.current = focusCheckin.checkin_id;
            }
          })
          .catch(() => {});
      }
    } else {
      focusCheckinDoneRef.current = focusCheckin.checkin_id;
    }
  }, [focusCheckin, locations]);

  const handleReviewUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setReviewUploading(true);
    setFeedback(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const resp = await userApi.uploadReviewImage(file);
        if (resp.success && resp.data?.image_url) {
          uploaded.push(resp.data.image_url);
        }
      }
      if (uploaded.length > 0) {
        setReviewImages((prev) => [...prev, ...uploaded]);
      }
    } catch {
      setFeedback({ type: "error", message: "Không thể upload ảnh review." });
    } finally {
      setReviewUploading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selected) {
      setFeedback({ type: "error", message: "Vui lòng chọn địa điểm." });
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      setFeedback({ type: "error", message: "Đánh giá không hợp lệ." });
      return;
    }

    setReviewSubmitting(true);
    setFeedback(null);
    try {
      const resp = await userApi.createReview({
        location_id: selected.location_id,
        rating: reviewRating,
        comment: reviewComment.trim() ? reviewComment.trim() : null,
        images: reviewImages.length > 0 ? reviewImages : null,
      });
      setReviewComment("");
      setReviewImages([]);
      setFeedback({ type: "success", message: "Đã gửi đánh giá." });
      refetch();
      await loadSelectedReviews();
      dispatchReviewUpdated({
        locationId: selected.location_id,
        rating: resp?.data?.rating,
        totalReviews: resp?.data?.total_reviews,
      });
    } catch {
      setFeedback({ type: "error", message: "Không thể gửi đánh giá." });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm("Bạn có chắc muốn xóa đánh giá này?")) return;
    try {
      await userApi.deleteReview(reviewId);
      setFeedback({ type: "success", message: "Đã xóa đánh giá." });
      await loadSelectedReviews();
      if (selected) {
        refetch();
        dispatchReviewUpdated({ locationId: selected.location_id });
      }
    } catch {
      setFeedback({ type: "error", message: "Không thể xóa đánh giá." });
    }
  };

  // Reply state
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [replyUploading, setReplyUploading] = useState(false);

  const handleReplyImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setReplyUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const res = await userApi.uploadReviewImage(file);
        if (res.data?.image_url) uploaded.push(res.data.image_url);
      }
      setReplyImages((prev) => [...prev, ...uploaded]);
    } catch {
      setFeedback({ type: "error", message: "Tải ảnh phản hồi thất bại." });
    } finally {
      setReplyUploading(false);
    }
  };

  const handleReplySubmit = async (reviewId: number) => {
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      await userApi.replyToReview(reviewId, replyText.trim(), replyImages.length > 0 ? replyImages : undefined);
      setReplyText("");
      setReplyImages([]);
      setReplyingTo(null);
      await loadSelectedReviews();
    } catch {
      setFeedback({ type: "error", message: "Không thể gửi phản hồi." });
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <UserLayout
      title="Bản đồ"
      activeKey="/user/map"
      showSearch
      onSearch={setKeyword}
      searchPlaceholder="Tìm địa điểm..."
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
        <section className="bg-white/90 backdrop-blur-md rounded-3xl border border-gray-200/60 shadow-lg p-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchSelected(null);
                }}
                placeholder="Nhập địa danh, quán, khu du lịch..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
              />
              <button
                type="button"
                className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-100"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchMarker(null);
                  setSearchSelected(null);
                }}
              >
                Xoá
              </button>
            </div>
            {searchLoading ? (
              <p className="mt-2 text-xs text-gray-500">Đang tìm kiếm...</p>
            ) : null}
            {searchError ? (
              <p className="mt-2 text-xs text-red-500">{searchError}</p>
            ) : null}
            {!searchLoading && !searchError && searchQuery.trim() && searchResults.length === 0 && !searchSelected ? (
              <p className="mt-2 text-xs text-gray-400">Không tìm thấy kết quả.</p>
            ) : null}
            {searchResults.length > 0 ? (
              <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => handleSearchSelect(result)}
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            ) : null}
            {searchSelected && searchResults.length === 0 ? (
              <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                Đã chọn: {searchSelected.display_name}
              </div>
            ) : null}
          </div>

          <div className="mt-4 h-[520px] overflow-hidden rounded-2xl border border-gray-100">
            {!fullMapOpen ? (
              <MapContainer
                center={[
                  mapViewRef.current.center.lat,
                  mapViewRef.current.center.lng,
                ]}
                zoom={mapViewRef.current.zoom}
                className="h-full w-full"
                maxBounds={VIETNAM_BOUNDS}
                maxBoundsViscosity={1}
                doubleClickZoom={false}
              >
                <TileLayer
                  attribution={activeTile.attribution}
                  url={activeTile.url}
                  maxZoom={MAX_ZOOM}
                />
                <MapMaxZoomSync />
                <MapRefBinder mapRef={mainMapRef} />
                <MapViewTracker onChange={handleMapViewChange} />
                <MapRecenter target={recenterTarget} trigger={recenterSignal} />
                <MapInteractionWatcher interactingRef={userInteractingRef} />
                <MapResizeObserver />
                <MapClickHandler onPick={handleMapPick} />

                {myPosition && !routeOnlyMode && !routeEnabled ? (
                  <Marker
                    position={[myPosition.lat, myPosition.lng]}
                    icon={myPositionIcon}
                  >
                    <Popup autoPan={false}>Vị trí của bạn</Popup>
                  </Marker>
                ) : null}

                {myPosition ? (
                  <CompassMarker
                    position={myPosition}
                    heading={deviceHeading}
                  />
                ) : null}

                <RouteArrowDecorator routeLines={routeLines} />

                {routeOnlyMode && routeOnlyDestination ? (
                  <Marker
                    position={[
                      routeOnlyDestination.lat,
                      routeOnlyDestination.lng,
                    ]}
                    icon={getCircleImageIcon(
                      getDestinationImageUrl(routeOnlyDestination, selected),
                      true,
                    )}
                  >
                    <Popup autoPan={false}>
                      <div className="space-y-2">
                        <p className="font-semibold text-gray-900">
                          {routeOnlyDestination.location_name ?? "Địa điểm"}
                        </p>
                        {routeOnlyDestination.address ? (
                          <p className="text-xs text-gray-500">
                            {routeOnlyDestination.address}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            onClick={() =>
                              void ensureRouteToTarget({
                                lat: routeOnlyDestination.lat,
                                lng: routeOnlyDestination.lng,
                              })
                            }
                            disabled={locating}
                          >
                            {locating ? "Đang định vị..." : "Đường đi"}
                          </button>

                          {routeEnabled && routeTarget ? (
                            <button
                              type="button"
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                              onClick={clearRoute}
                            >
                              Xoá
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}

                {searchMarker ? (
                  <Marker
                    position={[searchMarker.lat, searchMarker.lng]}
                    icon={searchIcon}
                  >
                    <Popup autoPan={false}>
                      <div className="space-y-2">
                        <p className="font-semibold text-gray-900">
                          {searchSelected?.display_name ?? "Địa điểm tìm kiếm"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            onClick={() =>
                              void ensureRouteToTarget(searchMarker)
                            }
                            disabled={locating}
                          >
                            {locating ? "Đang định vị..." : "Đường đi"}
                          </button>

                          <button
                            type="button"
                            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            onClick={() => {
                              setSearchMarker(null);
                              setSearchSelected(null);
                            }}
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}

                {focusCheckin &&
                focusCheckin.lat != null &&
                focusCheckin.lng != null ? (
                  <Marker
                    position={[focusCheckin.lat, focusCheckin.lng]}
                    icon={getCircleImageIcon(
                      getCheckinImageUrl(focusCheckin, selected),
                      true,
                    )}
                  >
                    <Popup autoPan={false}>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">
                            {focusCheckin.checkin_id === -1
                              ? "Địa điểm của bạn"
                              : "Điểm đã check-in"}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {focusCheckin.location_name}
                          </p>
                          {focusCheckin.address ? (
                            <p className="text-xs text-gray-500 mt-1">
                              {focusCheckin.address}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {focusCheckin.status ? (
                            <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-600">
                              {focusCheckin.status}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            {Number(focusCheckin.is_user_created) === 1
                              ? "Tự check-in"
                              : "Của owner"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            onClick={() =>
                              void ensureRouteToTarget({
                                lat: focusCheckin.lat as number,
                                lng: focusCheckin.lng as number,
                              })
                            }
                            disabled={locating}
                          >
                            {locating ? "Đang định vị..." : "Đường đi"}
                          </button>

                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}

                {routeLines
                  ? routeLines.map((line, index) => (
                      <React.Fragment key={`route-${index}`}>
                        {/* Vien trang de route noi bat */}
                        {index === 0 && (
                          <Polyline
                            positions={line.map((p) => [p.lat, p.lng])}
                            pathOptions={{
                              color: "#ffffff",
                              weight: 9,
                              opacity: 0.8,
                            }}
                          />
                        )}
                        {/* Duong route chinh */}
                        <Polyline
                          positions={line.map((p) => [p.lat, p.lng])}
                          pathOptions={{
                            color:
                              index === 0
                                ? "#2563eb"
                                : index === 1
                                  ? "#10b981"
                                  : "#f97316",
                            weight: index === 0 ? 5 : 3,
                            opacity: index === 0 ? 0.95 : 0.7,
                            dashArray: index === 0 ? undefined : "6 8",
                            lineCap: "round",
                            lineJoin: "round",
                          }}
                        />
                      </React.Fragment>
                    ))
                  : null}

                {/* Mui ten bearing khi co route */}
                {routeEnabled && routeTarget && myPosition ? (
                  <BearingArrow
                    position={myPosition}
                    destination={routeTarget}
                    heading={deviceHeading}
                  />
                ) : null}

                {pickedPoint ? (
                  <Marker
                    position={[pickedPoint.lat, pickedPoint.lng]}
                    icon={pickedIcon}
                  >
                    <Popup autoPan={false}>
                      <div className="w-[210px] p-0.5 font-sans text-slate-800 text-left">
                        {/* Header */}
                        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1 mb-1.5">
                          <span className="text-xs select-none">📍</span>
                          <div>
                            <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">Tọa độ đã ghim</p>
                            <p className="text-[11px] font-bold text-slate-700">
                              {pickedPoint.lat.toFixed(6)}, {pickedPoint.lng.toFixed(6)}
                            </p>
                          </div>
                        </div>

                        {/* Suggested Location nearby */}
                        {pickedSuggested ? (
                          <div className="mb-2 rounded-lg bg-teal-50/70 border border-teal-100 p-1.5">
                            <p className="text-[8px] font-extrabold text-teal-700 uppercase tracking-wide">Địa điểm gần đây</p>
                            <p className="text-[10px] font-bold text-teal-900 truncate mt-0.5">
                              {pickedSuggested.location_name}
                            </p>
                            <button
                              type="button"
                              className="text-[9px] text-teal-600 hover:text-teal-800 font-bold underline mt-0.5 block transition"
                              onClick={() =>
                                navigate(
                                  `/user/location/${pickedSuggested.location_id}`,
                                )
                              }
                            >
                              Xem chi tiết →
                            </button>
                          </div>
                        ) : null}

                        {/* Optional Name Input */}
                        <div className="mb-2">
                          <label className="text-[8px] font-extrabold text-slate-400 uppercase block mb-0.5">Tên địa danh (tự đặt)</label>
                          <input
                            value={pickedName}
                            onChange={(event) => setPickedName(event.target.value)}
                            placeholder="Ví dụ: Điểm cắm trại, Quán ăn..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 transition focus:border-teal-500 focus:bg-white focus:outline-none"
                          />
                        </div>

                        {/* Action buttons list */}
                        <div className="space-y-1">


                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                            onClick={() => handleFreeAction("checkin")}
                            disabled={freeAction === "checkin" || !isPickedOpenNow}
                          >
                            <span>✅</span> {freeAction === "checkin" ? "Đang check-in..." : "Check-in tại đây"}
                          </button>

                          {!isPickedOpenNow ? (
                            <div className="text-[9px] text-amber-700 bg-amber-50 rounded-md py-0.5 px-1.5 text-center font-bold">
                              ⚠️ Đang đóng cửa
                              {pickedOpenClose
                                ? ` (${pickedOpenClose.open} - ${pickedOpenClose.close})`
                                : ""}
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-1 py-1.5 text-[10px] font-bold text-slate-700 transition"
                              onClick={() => void ensureRouteToTarget(pickedPoint)}
                              disabled={locating}
                            >
                              <span>🚗</span> Đường đi
                            </button>

                            <button
                              type="button"
                              className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-1 py-1.5 text-[10px] font-bold text-slate-700 transition disabled:opacity-50"
                              onClick={() => handleFreeAction("save")}
                              disabled={freeAction === "save"}
                            >
                              <span>⭐</span> {freeAction === "save" ? "Đang lưu..." : "Lưu lại"}
                            </button>
                          </div>

                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 py-1.5 text-[10px] font-bold text-rose-600 transition"
                            onClick={clearPickedPoint}
                          >
                            Xoá ghim
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}

                {!routeOnlyMode
                  ? filteredLocations.map((entry) => {
                      const isSelected =
                        selected?.location_id === entry.item.location_id;
                      const icon = getCircleImageIcon(
                            resolveBackendUrl(
                              entry.item.first_image ??
                                (Array.isArray(entry.item.images) ? entry.item.images[0] : null),
                            ),
                            isSelected,
                          );
                      const isRoutingToThis =
                        routeEnabled &&
                        routeTarget &&
                        isSamePoint(routeTarget, {
                          lat: entry.lat,
                          lng: entry.lng,
                        });

                      return (
                        <Marker
                          key={`loc-${entry.item.location_id}`}
                          position={[entry.lat, entry.lng]}
                          icon={icon}
                          eventHandlers={{
                            click: () =>
                              handleSelectLocation(entry.item, {
                                lat: entry.lat,
                                lng: entry.lng,
                              }),
                            dblclick: () => {
                              setSelected(null);
                              setPanelOpen(false);
                            },
                          }}
                        >
                          <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
                            <div className="space-y-2">
                              <p className="font-semibold text-gray-900">
                                {entry.item.location_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {entry.item.address}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded-full bg-teal-600 px-3 py-1 text-xs text-white"
                                  onClick={() => {
                                    setSelected(entry.item);
                                    setPanelOpen(true);
                                  }}
                                >
                                  Xem chi tiết
                                </button>

                                <button
                                  type="button"
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                  onClick={() =>
                                    void ensureRouteToTarget({
                                      lat: entry.lat,
                                      lng: entry.lng,
                                    })
                                  }
                                  disabled={locating}
                                >
                                  {locating ? "Đang định vị..." : "Đường đi"}
                                </button>
                                {isRoutingToThis ? (
                                  <button
                                    type="button"
                                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                    onClick={clearRoute}
                                  >
                                    Xoá
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })
                  : null}

                {!routeOnlyMode && selected && !filteredLocations.some(entry => entry.item.location_id === selected.location_id) ? (
                  (() => {
                    const lat = normalizeNumber(selected.latitude);
                    const lng = normalizeNumber(selected.longitude);
                    if (lat == null || lng == null) return null;
                    const isSelected = true;
                    const icon = getCircleImageIcon(
                      resolveBackendUrl(
                        selected.first_image ??
                          (Array.isArray(selected.images) ? selected.images[0] : null),
                      ),
                      isSelected,
                    );
                    const isRoutingToThis =
                      routeEnabled &&
                      routeTarget &&
                      isSamePoint(routeTarget, { lat, lng });

                    return (
                      <Marker
                        key={`loc-selected-extra`}
                        position={[lat, lng]}
                        icon={icon}
                        eventHandlers={{
                          click: () =>
                            handleSelectLocation(selected, { lat, lng }),
                          dblclick: () => {
                            setSelected(null);
                            setPanelOpen(false);
                          },
                        }}
                      >
                        <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
                          <div className="space-y-2">
                            <p className="font-semibold text-gray-900">
                              {selected.location_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {selected.address}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-full bg-teal-600 px-3 py-1 text-xs text-white"
                                onClick={() => {
                                  setPanelOpen(true);
                                }}
                              >
                                Xem chi tiết
                              </button>

                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() =>
                                  void ensureRouteToTarget({ lat, lng })
                                }
                                disabled={locating}
                              >
                                {locating ? "Đang định vị..." : "Đường đi"}
                              </button>
                              {isRoutingToThis ? (
                                <button
                                  type="button"
                                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                  onClick={clearRoute}
                                >
                                  Xoá
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })()
                ) : null}
              </MapContainer>
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100" />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => {
                setFullMapOpen(true);
                if (selected) setPanelOpen(true);
              }}
            >
              Mở lớn bản đồ
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
              onClick={handleRecenterToMyPosition}
              disabled={locating}
            >
              Về vị trí tôi
            </button>
          </div>

          {routeTarget ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Lộ trình:</span>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  routeMode === "motorbike"
                    ? "bg-teal-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setRouteMode("motorbike")}
              >
                Xe máy
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  routeMode === "car"
                    ? "bg-teal-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setRouteMode("car")}
              >
                Ô tô
              </button>
              <span className="text-[10px] text-gray-400" title="OSRM chỉ hỗ trợ profile driving">(ước tính)</span>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  routeEnabled
                    ? "bg-emerald-500 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setRouteEnabled((prev) => !prev)}
              >
                {routeEnabled ? "Ẩn lộ trình" : "Hiện lộ trình"}
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                onClick={clearRoute}
              >
                Xoá lộ trình
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tileOptions.map((tile) => (
              <button
                key={tile.key}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  mapStyle === tile.key
                    ? "bg-slate-900 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setMapStyle(tile.key)}
              >
                {tile.label}
              </button>
            ))}
          </div>

          {routeInfo ? (
            routeInfo.source === "haversine" ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                  <span className="text-sm">⚠️</span>
                  <span>
                    {routeInfo.hasNoRoute
                      ? "Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"
                      : "Lỗi kết nối máy chủ đường đi (Đang hiển thị đường chim bay)"}
                  </span>
                </div>
                <div>
                  Khoảng cách chim bay: {formatDistance(routeInfo.distanceM)} · Thời gian di chuyển: không khả dụng
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                Tuyến đường: {formatDistance(routeInfo.distanceM)} · Thời gian ước
                tính: {formatDuration(routeInfo.durationS)}
                {routeInfo.alternatives ? (
                  <span className="ml-2 text-gray-500">
                    ({routeInfo.alternatives} tuyến)
                  </span>
                ) : null}
              </div>
            )
          ) : null}

          {feedback ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col bg-white/90 backdrop-blur-md rounded-3xl border border-gray-200/60 shadow-lg overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            {(
              [
                { key: "locations" as const, label: "Địa điểm" },
                { key: "detail" as const, label: "Chi tiết" },
                { key: "reviews" as const, label: "Đánh giá" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`flex-1 py-3 text-xs font-semibold transition ${
                  sidebarTab === tab.key
                    ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setSidebarTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-5">
            {/* Banner GPS */}
            {locationDenied ? (
              <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0">
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-700">Cần bật định vị</p>
                  <p className="text-[10px] text-amber-600">Chỉ đường và check-in cần GPS.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-amber-600 transition"
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setMyPosition(newPos);
                        flyTo(newPos);
                        setLocationDenied(false);
                      },
                      () => {},
                      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
                    );
                  }}
                >
                  Thử lại
                </button>
              </div>
            ) : null}

            {/* Canh bao GPS khong chinh xac */}
            {!locationDenied && myPosition && gpsAccuracy != null && gpsAccuracy > 500 ? (
              <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-700">GPS không chính xác</p>
                  <p className="text-[10px] text-blue-600">Sai số ~{Math.round(gpsAccuracy)}m. Dùng tìm kiếm để chọn vị trí chính xác.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-blue-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-600 transition"
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setMyPosition(newPos);
                        setGpsAccuracy(pos.coords.accuracy);
                        flyTo(newPos);
                        setLocationDenied(false);
                      },
                      () => {},
                      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
                    );
                  }}
                >
                  Thử lại
                </button>
              </div>
            ) : null}

            {/* Tab: Địa điểm */}
            {sidebarTab === "locations" && !routeOnlyMode ? (
              <div className="space-y-4">
                {/* Tìm kiếm */}
                <div className="flex gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchSelected(null);
                    }}
                    placeholder="Tìm kiếm địa điểm..."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setSearchMarker(null);
                      setSearchSelected(null);
                    }}
                  >
                    Xoá
                  </button>
                </div>

                {/* Filter loại địa điểm */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "all", label: "Tất cả" },
                      { key: "food", label: "Ăn uống" },
                      { key: "tourist", label: "Du lịch" },
                      { key: "hotel", label: "Khách sạn" },
                      { key: "mine", label: "Đã lưu" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        nearbyCategory === item.key
                          ? "bg-emerald-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setNearbyCategory(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Danh sách địa điểm (gộp Gần bạn + Tất cả) */}
                {locationDenied ? (
                  <p className="text-xs text-gray-400">
                    Không thể lấy vị trí. Vui lòng cấp quyền định vị trong trình duyệt.
                  </p>
                ) : !myPosition ? (
                  <p className="text-xs text-gray-400">Đang lấy vị trí...</p>
                ) : null}

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Địa điểm {myPosition ? `(${filteredLocations.length})` : ""}
                  </p>
                  {loading ? (
                    <p className="text-xs text-gray-400">Đang tải...</p>
                  ) : error ? (
                    <p className="text-xs text-red-500">{error}</p>
                  ) : filteredLocations.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      Không có địa điểm phù hợp.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-auto pr-1">
                      {filteredLocations.map((entry) => {
                        const item = entry.item;
                        const imageUrl = resolveBackendUrl(
                          item.first_image ??
                            (Array.isArray(item.images) ? item.images[0] : null),
                        );
                        const isSelected = selected?.location_id === item.location_id;
                        const typeLabel = locationTypeToVi(item.location_type);
                        const ratingVal = Number(item.rating || 0);
                        return (
                          <button
                            key={item.location_id}
                            type="button"
                            className={`user-sub-card card-lift flex items-stretch overflow-hidden text-left transition rounded-xl ${
                              isSelected
                                ? "border-teal-300 bg-teal-50/60 ring-1 ring-teal-300"
                                : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                            onClick={() =>
                              handleSelectLocation(item, { lat: entry.lat, lng: entry.lng })
                            }
                          >
                            {/* Anh ben trai */}
                            <div className="relative w-28 shrink-0 overflow-hidden rounded-l-xl min-h-[72px]">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.location_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-teal-100 via-emerald-50 to-cyan-100 flex items-center justify-center">
                                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-300">
                                    <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                                    <circle cx="12" cy="10" r="2.5" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Noi dung ben phai */}
                            <div className="flex flex-1 flex-col justify-center px-3 py-2 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="inline-block rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 shrink-0">
                                  {typeLabel}
                                </span>
                                {item.is_eco_friendly ? (
                                  <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                                    Eco
                                  </span>
                                ) : null}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 line-clamp-1">
                                {item.location_name}
                              </h4>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-xs text-amber-500">★</span>
                                <span className="text-xs font-semibold text-gray-700">{ratingVal.toFixed(1)}</span>
                                <span className="text-xs text-gray-400">({item.total_reviews ?? 0})</span>
                                {entry.distance != null ? (
                                  <span className="text-xs text-gray-400 ml-auto shrink-0">
                                    {formatDistance(entry.distance)}
                                  </span>
                                ) : null}
                              </div>
                              {item.address ? (
                                <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-1">
                                  {item.address}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Tab: Check-in */}
            {sidebarTab === "detail" ? (
              <div className="space-y-4">
                {selected ? (
                  <>
                    {/* Anh lon */}
                    {(() => {
                      const img = resolveBackendUrl(
                        selected.first_image ??
                          (Array.isArray(selected.images) ? selected.images[0] : null),
                      );
                      return img ? (
                        <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden">
                          <img
                            src={img}
                            alt={selected.location_name}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute top-2 left-2 rounded-md bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
                            {locationTypeToVi(selected.location_type)}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full aspect-[16/10] rounded-xl bg-gradient-to-br from-teal-100 via-emerald-50 to-cyan-100 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-300">
                            <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                        </div>
                      );
                    })()}

                    {/* Ten + loai dia diem */}
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">
                        {selected.location_name}
                      </h3>
                      <span className="mt-1 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                        {locationTypeToVi(selected.location_type)}
                      </span>
                    </div>

                    {/* Rating + gio mo cua */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-amber-500">★</span>
                        <span className="text-sm font-semibold text-gray-800">
                          {Number(selected.rating || 0).toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({selected.total_reviews ?? 0} đánh giá)
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isSelectedOpenNow
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelectedOpenNow ? "bg-emerald-500" : "bg-red-500"}`} />
                        {isSelectedOpenNow ? "Đang mở" : "Đang đóng"}
                        {selectedOpenClose ? ` ${selectedOpenClose.open}-${selectedOpenClose.close}` : ""}
                      </span>
                    </div>

                    {/* Thong ke: gio mo cua + reviews */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-xl border px-3 py-2.5 text-center ${
                        isSelectedOpenNow
                          ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100"
                          : "bg-gradient-to-br from-red-50 to-rose-50 border-red-100"
                      }`}>
                        <p className={`text-lg font-bold ${isSelectedOpenNow ? "text-emerald-700" : "text-red-700"}`}>
                          {selectedOpenClose ? `${selectedOpenClose.open}` : "--:--"}
                        </p>
                        <p className={`text-[10px] font-medium ${isSelectedOpenNow ? "text-emerald-600" : "text-red-600"}`}>
                          {isSelectedOpenNow ? "Đang mở cửa" : "Đang đóng cửa"}
                        </p>
                        {selectedOpenClose ? (
                          <p className={`text-[9px] mt-0.5 ${isSelectedOpenNow ? "text-emerald-500" : "text-red-500"}`}>
                            Đóng lúc {selectedOpenClose.close}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 px-3 py-2.5 text-center">
                        <p className="text-lg font-bold text-amber-700">{selected.total_reviews ?? 0}</p>
                        <p className="text-[10px] text-amber-600 font-medium">Đánh giá</p>
                      </div>
                    </div>

                    {/* Dia chi */}
                    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Địa chỉ</p>
                      <p className="text-xs text-gray-700 flex items-start gap-1.5">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0 mt-0.5">
                          <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {selected.address}
                      </p>
                      {selected.province ? (
                        <p className="mt-1.5 text-[10px] text-gray-500 flex items-center gap-1.5 ml-[22px]">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                            <rect x="2" y="7" width="20" height="14" rx="2" />
                            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                          </svg>
                          {selected.province}
                        </p>
                      ) : null}
                    </div>

                    {/* Mo ta */}
                    {selected.description ? (
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Mô tả</p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {selected.description}
                        </p>
                      </div>
                    ) : null}

                    {/* Lien he: phone, email, website */}
                    {(selected.phone || selected.email || selected.website) ? (
                      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Liên hệ</p>
                        {selected.phone ? (
                          <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-teal-600">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                            {selected.phone}
                          </a>
                        ) : null}
                        {selected.email ? (
                          <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-teal-600">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="M22 7l-10 6L2 7" />
                            </svg>
                            {selected.email}
                          </a>
                        ) : null}
                        {selected.website ? (
                          <a href={selected.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-700 hover:text-teal-600">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                            </svg>
                            {selected.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        className={`w-full rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                          !myPosition
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                        }`}
                        onClick={handleNavigateToSelected}
                        disabled={locating || !myPosition}
                      >
                        {!myPosition
                          ? "Cần định vị để chỉ đường"
                          : locating
                            ? "Đang định vị..."
                            : "Chỉ đường"}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        onClick={() =>
                          navigate(`/user/location/${selected.location_id}`)
                        }
                      >
                        Xem chi tiết đầy đủ
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
                    Chọn một địa điểm trên bản đồ để xem thông tin.
                  </div>
                )}
              </div>
            ) : null}

            {/* Tab: Đánh giá */}
            {sidebarTab === "reviews" ? (
              <div className="space-y-4">
                {!selected ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-gray-500 text-center">
                    Chọn một địa điểm trên bản đồ để đánh giá.
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">Địa điểm</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selected.location_name}
                      </p>
                    </div>

                    {/* Bộ lọc sao */}
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5].map((star) => {
                        const active = reviewFilter === star;
                        return (
                          <button
                            key={`review-filter-${star}`}
                            type="button"
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              active
                                ? "bg-teal-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => setReviewFilter(star)}
                          >
                            {star === 0 ? "Tất cả" : `${star} sao`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Form đánh giá */}
                    <div className="border-t border-gray-100 pt-3">
                      <label className="text-xs text-gray-500">Đánh giá</label>
                      <div className="mt-2">
                        <StarRatingPicker
                          value={reviewRating}
                          onChange={setReviewRating}
                        />
                        {reviewRating <= 0 ? (
                          <p className="mt-2 text-xs text-amber-700">
                            Hãy chọn từ 1 đến 5 sao để gửi.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Nhận xét (tuỳ chọn)"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-none"
                      rows={3}
                    />
                    <div>
                      <label
                        htmlFor="review-file-input"
                        className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 hover:border-teal-300 hover:bg-teal-50/50 cursor-pointer transition"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        {reviewUploading ? "Đang tải ảnh..." : "Chọn ảnh (tối đa 5MB/ảnh)"}
                      </label>
                      <input
                        id="review-file-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => handleReviewUpload(event.target.files)}
                        disabled={reviewUploading}
                      />
                      {reviewImages.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {reviewImages.map((img) => (
                            <div
                              key={img}
                              className="relative h-14 w-14 overflow-hidden rounded-xl border border-gray-100"
                            >
                              <img
                                src={resolveBackendUrl(img) ?? undefined}
                                alt="review"
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                className="absolute right-1 top-1 rounded-full bg-white/90 px-1 text-[10px] text-red-600"
                                onClick={() =>
                                  setReviewImages((prev) =>
                                    prev.filter((item) => item !== img),
                                  )
                                }
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm text-white hover:bg-emerald-700"
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting || reviewRating <= 0}
                    >
                      {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                    </button>

                    {/* Danh sách đánh giá */}
                    <div className="space-y-2 border-t border-gray-100 pt-3">
                      {selectedReviewsLoading ? (
                        <p className="text-xs text-gray-500">Đang tải đánh giá...</p>
                      ) : null}
                      {!selectedReviewsLoading &&
                      filteredSelectedReviews.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          Chưa có đánh giá phù hợp bộ lọc.
                        </p>
                      ) : null}
                      {filteredSelectedReviews.slice(0, 6).map((review) => {
                        const reviewImgs = normalizeReviewImages(review.images);
                        const isOwnReview = currentUserId != null && review.user_id === currentUserId;
                        const stars = Math.round(Number(review.rating || 0));
                        const avatarUrl = resolveBackendUrl(review.user_avatar);
                        const initial = (review.user_name || "N").charAt(0).toUpperCase();
                        return (
                          <div
                            key={`review-${review.review_id}`}
                            className="rounded-xl border border-gray-100 p-3"
                          >
                            {/* Header: avatar + ten + sao + ngay */}
                            <div className="flex items-start gap-2">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center text-[11px] font-bold text-teal-700 shrink-0">
                                  {initial}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold text-gray-900 truncate">
                                    {review.user_name || "Người dùng"}
                                  </span>
                                  {isOwnReview ? (
                                    <button
                                      type="button"
                                      className="text-[10px] text-red-500 hover:text-red-700 hover:underline shrink-0"
                                      onClick={() => handleDeleteReview(review.review_id)}
                                    >
                                      Xóa
                                    </button>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-amber-500">
                                    {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {formatDateTimeVi(review.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Noi dung */}
                            <p className="mt-2 text-xs text-gray-600">
                              {review.comment?.trim() || "Không có bình luận."}
                            </p>

                            {/* Anh review */}
                            {reviewImgs.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <AntImage.PreviewGroup>
                                  {reviewImgs.slice(0, 3).map((img) => (
                                    <AntImage
                                      key={img}
                                      src={resolveBackendUrl(img) ?? undefined}
                                      alt="review"
                                      width={64}
                                      height={64}
                                      className="rounded-lg object-cover"
                                      style={{ borderRadius: 8 }}
                                    />
                                  ))}
                                </AntImage.PreviewGroup>
                              </div>
                            ) : null}

                            {/* Reply cua owner */}
                            {review.reply_content ? (
                              <div className="mt-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                                <p className="text-[10px] font-semibold text-teal-700">
                                  Phản hồi của chủ quán
                                </p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  {review.reply_content}
                                </p>
                                {(() => {
                                  const replyImgs = normalizeReviewImages(review.reply_images);
                                  return replyImgs.length > 0 ? (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      <AntImage.PreviewGroup>
                                        {replyImgs.slice(0, 3).map((img) => (
                                          <AntImage
                                            key={img}
                                            src={resolveBackendUrl(img) ?? undefined}
                                            alt=""
                                            width={48}
                                            height={48}
                                            className="rounded-md object-cover"
                                            style={{ borderRadius: 6 }}
                                          />
                                        ))}
                                      </AntImage.PreviewGroup>
                                    </div>
                                  ) : null;
                                })()}
                                {review.reply_created_at ? (
                                  <p className="text-[9px] text-gray-400 mt-1">
                                    {formatDateTimeVi(review.reply_created_at)}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {/* Reply cua user */}
                            {review.user_reply_content ? (
                              <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                                <p className="text-[10px] font-semibold text-gray-600">
                                  Phản hồi của bạn
                                </p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  {review.user_reply_content}
                                </p>
                                {(() => {
                                  const userReplyImgs = normalizeReviewImages(review.user_reply_images);
                                  return userReplyImgs.length > 0 ? (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      <AntImage.PreviewGroup>
                                        {userReplyImgs.slice(0, 3).map((img) => (
                                          <AntImage
                                            key={img}
                                            src={resolveBackendUrl(img) ?? undefined}
                                            alt=""
                                            width={48}
                                            height={48}
                                            className="rounded-md object-cover"
                                            style={{ borderRadius: 6 }}
                                          />
                                        ))}
                                      </AntImage.PreviewGroup>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            ) : null}

                            {/* Nut tra loi (hien khi co reply cua owner va chua reply) */}
                            {review.reply_content && !review.user_reply_content && currentUserId ? (
                              replyingTo === review.review_id ? (
                                <div className="mt-2 space-y-1.5">
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Nhập phản hồi..."
                                      className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleReplySubmit(review.review_id);
                                        if (e.key === "Escape") { setReplyingTo(null); setReplyText(""); setReplyImages([]); }
                                      }}
                                    />
                                    <label
                                      htmlFor={`reply-img-${review.review_id}`}
                                      className="flex items-center justify-center rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-50 cursor-pointer"
                                    >
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path d="M21 15l-5-5L5 21" />
                                      </svg>
                                    </label>
                                    <input
                                      id={`reply-img-${review.review_id}`}
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleReplyImageUpload(e.target.files)}
                                      disabled={replyUploading}
                                    />
                                    <button
                                      type="button"
                                      className="rounded-lg bg-teal-600 px-2 py-1 text-[10px] text-white hover:bg-teal-700 disabled:opacity-50"
                                      onClick={() => handleReplySubmit(review.review_id)}
                                      disabled={replySubmitting || !replyText.trim()}
                                    >
                                      Gửi
                                    </button>
                                  </div>
                                  {replyImages.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {replyImages.map((img) => (
                                        <div key={img} className="relative h-12 w-12 overflow-hidden rounded-lg border border-gray-100">
                                          <img src={resolveBackendUrl(img) ?? undefined} alt="" className="h-full w-full object-cover" />
                                          <button
                                            type="button"
                                            className="absolute right-0.5 top-0.5 rounded-full bg-white/90 px-1 text-[8px] text-red-600"
                                            onClick={() => setReplyImages((prev) => prev.filter((i) => i !== img))}
                                          >
                                            x
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {replyUploading ? (
                                    <p className="text-[10px] text-gray-400">Đang tải ảnh...</p>
                                  ) : null}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="mt-1.5 text-[10px] text-teal-600 hover:text-teal-800 hover:underline"
                                  onClick={() => setReplyingTo(review.review_id)}
                                >
                                  Phản hồi
                                </button>
                              )
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {fullMapOpen ? (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFullMapOpen(false);
          }}
        >
          <div
            className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-100 px-5 py-3">
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-xs ${
                  !myPosition
                    ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                    : "border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
                onClick={handleCheckin}
                disabled={!selected || checkingIn || !isSelectedOpenNow || !myPosition}
              >
                {!myPosition
                  ? "Cần bật định vị"
                  : checkingIn
                    ? "Đang check-in..."
                    : "Check-in nhanh"}
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
                onClick={handleRecenterToMyPosition}
                disabled={locating}
              >
                Về vị trí tôi
              </button>
              <button
                type="button"
                className="rounded-full bg-teal-600 px-4 py-2 text-xs text-white hover:bg-teal-700"
                onClick={() => setFullMapOpen(false)}
              >
                Đóng
              </button>
            </div>
            {locationDenied ? (
              <div className="mx-5 mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 shrink-0">
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-700">Cần bật định vị</p>
                  <p className="text-[10px] text-amber-600">Chỉ đường và check-in cần GPS.</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-amber-600 transition"
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setMyPosition(newPos);
                        flyTo(newPos);
                        setLocationDenied(false);
                      },
                      () => {},
                      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
                    );
                  }}
                >
                  Thử lại
                </button>
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-gray-100 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchSelected(null);
                    }}
                    placeholder="Nhập địa danh, quán, khu du lịch..."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-100"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setSearchMarker(null);
                      setSearchSelected(null);
                    }}
                  >
                    Xoá
                  </button>
                </div>
                {searchLoading ? (
                  <p className="mt-2 text-xs text-gray-500">Đang tìm kiếm...</p>
                ) : null}
                {searchError ? (
                  <p className="mt-2 text-xs text-red-500">{searchError}</p>
                ) : null}
                {!searchLoading && !searchError && searchQuery.trim() && searchResults.length === 0 && !searchSelected ? (
                  <p className="mt-2 text-xs text-gray-400">Không tìm thấy kết quả.</p>
                ) : null}
                {searchResults.length > 0 ? (
                  <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">
                    {searchResults.map((result) => (
                      <button
                        key={result.place_id}
                        type="button"
                        className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                        onClick={() => handleSearchSelect(result)}
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {searchSelected && searchResults.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                    Đã chọn: {searchSelected.display_name}
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 flex">
                {panelOpen && selected ? (
                  <aside className="w-full max-w-sm border-r border-gray-100 bg-white p-5 overflow-auto">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Địa điểm</p>
                          <h4 className="mt-1 truncate text-lg font-semibold text-gray-900 font-heading">
                            {selected.location_name}
                          </h4>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100"
                          onClick={() => setPanelOpen(false)}
                          title="Đóng thông tin"
                        >
                          ✕
                        </button>
                      </div>

                      {(() => {
                        const imageUrl = resolveBackendUrl(
                          selected.first_image ??
                            (Array.isArray(selected.images)
                              ? selected.images[0]
                              : null),
                        );
                        return imageUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-gray-100">
                            <img
                              src={imageUrl}
                              alt={selected.location_name}
                              className="h-40 w-full object-cover"
                            />
                          </div>
                        ) : null;
                      })()}

                      <div>
                        <p className="mt-1 text-sm text-gray-500">
                          {selected.address}
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">
                            {Number.isFinite(Number(selected.rating))
                              ? Number(selected.rating).toFixed(1)
                              : "0.0"}
                          </span>{" "}
                          <span className="text-amber-500">★</span>
                          <span className="text-gray-500">
                            {" "}
                            ({selected.total_reviews ?? 0} đánh giá)
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            !myPosition
                              ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                          onClick={() =>
                            void ensureRouteToTarget(selectedCoords)
                          }
                          disabled={locating || !selectedCoords || !myPosition}
                        >
                          {!myPosition
                            ? "Cần bật định vị"
                            : locating
                              ? "Đang định vị..."
                              : "Đường đi"}
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs hover:bg-gray-50 ${
                            selectedIsFavorite
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-gray-200 text-gray-600"
                          }`}
                          onClick={() => void handleSaveSelectedLocation()}
                          disabled={savingSelected}
                        >
                          {savingSelected
                            ? "Đang xử lý..."
                            : selectedIsFavorite
                              ? "Bỏ lưu"
                              : "Lưu"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          onClick={() => void handleShareSelectedLocation()}
                        >
                          Chia sẻ
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { key: "info", label: "Tổng quan" },
                            { key: "review", label: "Bài đánh giá" },
                            { key: "about", label: "Giới thiệu" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            className={`rounded-full px-3 py-1 text-xs ${
                              panelTab === tab.key
                                ? "bg-teal-600 text-white hover:bg-teal-700"
                                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                            onClick={() => setPanelTab(tab.key)}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {panelTab === "info" ? (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-gray-100 p-4">
                            <h5 className="text-sm font-semibold text-gray-900">
                              Thông tin
                            </h5>
                            <div className="mt-3 space-y-2 text-sm text-gray-600">
                              <p>
                                <span className="font-medium text-gray-900">
                                  Loại dịch vụ:
                                </span>{" "}
                                {locationTypeToVi(selected.location_type)}
                              </p>
                              <p>
                                <span className="font-medium text-gray-900">
                                  Giờ mở cửa:
                                </span>{" "}
                                {selectedOpenClose
                                  ? `${selectedOpenClose.open} - ${selectedOpenClose.close}`
                                  : "Chưa cập nhật"}
                                {!isSelectedOpenNow ? " (đang đóng cửa)" : ""}
                              </p>
                              <p>
                                <span className="font-medium text-gray-900">
                                  Website:
                                </span>{" "}
                                {selected.website ? (
                                  <a
                                    href={selected.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-teal-600 hover:text-teal-700"
                                  >
                                    {selected.website}
                                  </a>
                                ) : (
                                  "Chưa cập nhật"
                                )}
                              </p>
                              <p>
                                <span className="font-medium text-gray-900">
                                  Số điện thoại:
                                </span>{" "}
                                {selected.phone ?? "Chưa cập nhật"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-gray-100 p-4">
                            <h5 className="text-sm font-semibold text-gray-900">
                              Đặt trước
                            </h5>
                            {selectedServicesLoading ? (
                              <p className="mt-2 text-xs text-gray-500">
                                Đang tải dịch vụ...
                              </p>
                            ) : null}
                            {selectedServicesError ? (
                              <p className="mt-2 text-xs text-red-500">
                                {selectedServicesError}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              className="mt-3 w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm text-white hover:bg-teal-700"
                              onClick={handleBookSelectedLocation}
                              disabled={selectedServicesLoading}
                            >
                              {bookingLabelByLocationType(
                                selected.location_type,
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {panelTab === "review" ? (
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="text-sm font-semibold text-gray-900">
                              Viết bài đánh giá
                            </h5>
                            <span className="text-[11px] text-gray-400">
                              1 đến 5 sao
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {[0, 1, 2, 3, 4, 5].map((star) => {
                                const active = reviewFilter === star;
                                return (
                                  <button
                                    key={`map-review-filter-${star}`}
                                    type="button"
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                      active
                                        ? "bg-teal-600 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                    onClick={() => setReviewFilter(star)}
                                  >
                                    {star === 0 ? "Tất cả" : `${star} sao`}
                                  </button>
                                );
                              })}
                            </div>
                            <div>
                              <div className="mt-2">
                                <StarRatingPicker
                                  value={reviewRating}
                                  onChange={setReviewRating}
                                />
                                {reviewRating <= 0 ? (
                                  <p className="mt-2 text-xs text-amber-700">
                                    Hãy chọn từ 1 đến 5 sao để gửi.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <textarea
                              value={reviewComment}
                              onChange={(event) =>
                                setReviewComment(event.target.value)
                              }
                              placeholder="Nhận xét (tuỳ chọn)"
                              className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-none"
                              rows={3}
                            />
                            <div>
                              <label
                                htmlFor="review-file-input-full"
                                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-5 text-center text-xs text-gray-500 hover:border-teal-300 hover:bg-teal-50/50 cursor-pointer transition"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <path d="M21 15l-5-5L5 21" />
                                </svg>
                                {reviewUploading
                                  ? "Đang upload ảnh..."
                                  : "Thêm ảnh cho bài đánh giá"}
                              </label>
                              <input
                                id="review-file-input-full"
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) =>
                                  handleReviewUpload(event.target.files)
                                }
                                disabled={reviewUploading}
                              />

                              {reviewImages.length > 0 ? (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {reviewImages.map((img) => (
                                    <div
                                      key={img}
                                      className="relative overflow-hidden rounded-xl border border-gray-100"
                                    >
                                      <img
                                        src={
                                          resolveBackendUrl(img) ?? undefined
                                        }
                                        alt="review"
                                        className="h-20 w-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-1 text-[11px] text-white"
                                        onClick={() =>
                                          setReviewImages((prev) =>
                                            prev.filter((item) => item !== img),
                                          )
                                        }
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white hover:bg-emerald-700"
                              onClick={handleSubmitReview}
                              disabled={reviewSubmitting || reviewRating <= 0}
                            >
                              {reviewSubmitting
                                ? "Đang gửi..."
                                : "Gửi đánh giá"}
                            </button>

                            <div className="space-y-2 pt-2">
                              {selectedReviewsLoading ? (
                                <p className="text-xs text-gray-500">
                                  Đang tải bài đánh giá...
                                </p>
                              ) : null}
                              {!selectedReviewsLoading &&
                              filteredSelectedReviews.length === 0 ? (
                                <p className="text-xs text-gray-500">
                                  Chưa có đánh giá phù hợp bộ lọc.
                                </p>
                              ) : null}
                              {filteredSelectedReviews.map((review) => {
                                const reviewImgs = normalizeReviewImages(review.images);
                                const isOwnReviewFull = currentUserId != null && review.user_id === currentUserId;
                                const stars = Math.round(Number(review.rating || 0));
                                const avatarUrl = resolveBackendUrl(review.user_avatar);
                                const initial = (review.user_name || "N").charAt(0).toUpperCase();
                                return (
                                  <article
                                    key={`map-review-${review.review_id}`}
                                    className="rounded-xl border border-gray-100 p-3"
                                  >
                                    {/* Header: avatar + ten + sao */}
                                    <div className="flex items-start gap-2">
                                      {avatarUrl ? (
                                        <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                                      ) : (
                                        <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center text-[11px] font-bold text-teal-700 shrink-0">
                                          {initial}
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-xs font-semibold text-gray-900 truncate">
                                            {review.user_name || "Người dùng"}
                                          </span>
                                          {isOwnReviewFull ? (
                                            <button
                                              type="button"
                                              className="text-[10px] text-red-500 hover:text-red-700 hover:underline shrink-0"
                                              onClick={() => handleDeleteReview(review.review_id)}
                                            >
                                              Xóa
                                            </button>
                                          ) : null}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[11px] text-amber-500">
                                            {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                                          </span>
                                          <span className="text-[10px] text-gray-400">
                                            {formatDateTimeVi(review.created_at)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Noi dung */}
                                    <p className="mt-2 text-xs text-gray-600">
                                      {review.comment?.trim() || "Không có bình luận."}
                                    </p>

                                    {/* Anh review */}
                                    {reviewImgs.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <AntImage.PreviewGroup>
                                          {reviewImgs.slice(0, 3).map((img) => (
                                            <AntImage
                                              key={img}
                                              src={resolveBackendUrl(img) ?? undefined}
                                              alt="review"
                                              width={64}
                                              height={64}
                                              className="rounded-lg object-cover"
                                              style={{ borderRadius: 8 }}
                                            />
                                          ))}
                                        </AntImage.PreviewGroup>
                                      </div>
                                    ) : null}

                                    {/* Reply cua owner */}
                                    {review.reply_content ? (
                                      <div className="mt-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                                        <p className="text-[10px] font-semibold text-teal-700">
                                          Phản hồi của chủ quán
                                        </p>
                                        <p className="text-[11px] text-gray-600 mt-0.5">
                                          {review.reply_content}
                                        </p>
                                        {(() => {
                                          const replyImgs = normalizeReviewImages(review.reply_images);
                                          return replyImgs.length > 0 ? (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              <AntImage.PreviewGroup>
                                                {replyImgs.slice(0, 3).map((img) => (
                                                  <AntImage
                                                    key={img}
                                                    src={resolveBackendUrl(img) ?? undefined}
                                                    alt=""
                                                    width={48}
                                                    height={48}
                                                    className="rounded-md object-cover"
                                                    style={{ borderRadius: 6 }}
                                                  />
                                                ))}
                                              </AntImage.PreviewGroup>
                                            </div>
                                          ) : null;
                                        })()}
                                        {review.reply_created_at ? (
                                          <p className="text-[9px] text-gray-400 mt-1">
                                            {formatDateTimeVi(review.reply_created_at)}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {/* Reply cua user */}
                                    {review.user_reply_content ? (
                                      <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                                        <p className="text-[10px] font-semibold text-gray-600">
                                          Phản hồi của bạn
                                        </p>
                                        <p className="text-[11px] text-gray-600 mt-0.5">
                                          {review.user_reply_content}
                                        </p>
                                        {(() => {
                                          const userReplyImgs = normalizeReviewImages(review.user_reply_images);
                                          return userReplyImgs.length > 0 ? (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                              <AntImage.PreviewGroup>
                                                {userReplyImgs.slice(0, 3).map((img) => (
                                                  <AntImage
                                                    key={img}
                                                    src={resolveBackendUrl(img) ?? undefined}
                                                    alt=""
                                                    width={48}
                                                    height={48}
                                                    className="rounded-md object-cover"
                                                    style={{ borderRadius: 6 }}
                                                  />
                                                ))}
                                              </AntImage.PreviewGroup>
                                            </div>
                                          ) : null;
                                        })()}
                                      </div>
                                    ) : null}

                                    {/* Nut tra loi */}
                                    {review.reply_content && !review.user_reply_content && currentUserId ? (
                                      replyingTo === review.review_id ? (
                                        <div className="mt-2 space-y-1.5">
                                          <div className="flex gap-1.5">
                                            <input
                                              type="text"
                                              value={replyText}
                                              onChange={(e) => setReplyText(e.target.value)}
                                              placeholder="Nhập phản hồi..."
                                              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") handleReplySubmit(review.review_id);
                                                if (e.key === "Escape") { setReplyingTo(null); setReplyText(""); setReplyImages([]); }
                                              }}
                                            />
                                            <label
                                              htmlFor={`reply-img-full-${review.review_id}`}
                                              className="flex items-center justify-center rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-50 cursor-pointer"
                                            >
                                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <path d="M21 15l-5-5L5 21" />
                                              </svg>
                                            </label>
                                            <input
                                              id={`reply-img-full-${review.review_id}`}
                                              type="file"
                                              accept="image/*"
                                              multiple
                                              className="hidden"
                                              onChange={(e) => handleReplyImageUpload(e.target.files)}
                                              disabled={replyUploading}
                                            />
                                            <button
                                              type="button"
                                              className="rounded-lg bg-teal-600 px-2 py-1 text-[10px] text-white hover:bg-teal-700 disabled:opacity-50"
                                              onClick={() => handleReplySubmit(review.review_id)}
                                              disabled={replySubmitting || !replyText.trim()}
                                            >
                                              Gửi
                                            </button>
                                          </div>
                                          {replyImages.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {replyImages.map((img) => (
                                                <div key={img} className="relative h-12 w-12 overflow-hidden rounded-lg border border-gray-100">
                                                  <img src={resolveBackendUrl(img) ?? undefined} alt="" className="h-full w-full object-cover" />
                                                  <button
                                                    type="button"
                                                    className="absolute right-0.5 top-0.5 rounded-full bg-white/90 px-1 text-[8px] text-red-600"
                                                    onClick={() => setReplyImages((prev) => prev.filter((i) => i !== img))}
                                                  >
                                                    x
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          ) : null}
                                          {replyUploading ? (
                                            <p className="text-[10px] text-gray-400">Đang tải ảnh...</p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="mt-1.5 text-[10px] text-teal-600 hover:text-teal-800 hover:underline"
                                          onClick={() => setReplyingTo(review.review_id)}
                                        >
                                          Phản hồi
                                        </button>
                                      )
                                    ) : null}
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {panelTab === "about" ? (
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <h5 className="text-sm font-semibold text-gray-900">
                            Giới thiệu
                          </h5>
                          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">
                            {selected.description?.trim()
                              ? selected.description
                              : "Owner chưa cập nhật nội dung giới thiệu."}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </aside>
                ) : null}

                <div className="min-w-0 flex-1">
                  <MapContainer
                    center={[
                      mapViewRef.current.center.lat,
                      mapViewRef.current.center.lng,
                    ]}
                    zoom={mapViewRef.current.zoom}
                    className="h-full w-full"
                    maxBounds={VIETNAM_BOUNDS}
                    maxBoundsViscosity={1}
                    doubleClickZoom={false}
                  >
                    <TileLayer
                      attribution={activeTile.attribution}
                      url={activeTile.url}
                      maxZoom={MAX_ZOOM}
                    />
                    <MapMaxZoomSync />
                    <MapRefBinder mapRef={fullMapRef} />
                    <MapViewTracker onChange={handleMapViewChange} />
                    <MapRecenter
                      target={recenterTarget}
                      trigger={recenterSignal}
                    />
                    <MapInteractionWatcher interactingRef={userInteractingRef} />
                    <MapResizeObserver />
                    <MapClickHandler onPick={handleMapPick} />

                    {myPosition ? (
                      <Marker
                        position={[myPosition.lat, myPosition.lng]}
                        icon={myPositionIcon}
                      >
                        <Popup autoPan={false}>Vị trí của bạn</Popup>
                      </Marker>
                    ) : null}

                    {myPosition ? (
                      <CompassMarker
                        position={myPosition}
                        heading={deviceHeading}
                      />
                    ) : null}

                    <RouteArrowDecorator routeLines={routeLines} />

                    {searchMarker ? (
                      <Marker
                        position={[searchMarker.lat, searchMarker.lng]}
                        icon={searchIcon}
                      >
                        <Popup autoPan={false}>
                          <div className="space-y-2">
                            <p className="font-semibold text-gray-900">
                              {searchSelected?.display_name ??
                                "Địa điểm tìm kiếm"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() =>
                                  void ensureRouteToTarget(searchMarker)
                                }
                                disabled={locating}
                              >
                                {locating ? "Đang định vị..." : "Đường đi"}
                              </button>

                              <button
                                type="button"
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                onClick={() => {
                                  setSearchMarker(null);
                                  setSearchSelected(null);
                                }}
                              >
                                Xoá
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null}

                    {focusCheckin &&
                    focusCheckin.lat != null &&
                    focusCheckin.lng != null ? (
                      <Marker
                        position={[focusCheckin.lat, focusCheckin.lng]}
                        icon={getCircleImageIcon(
                          getCheckinImageUrl(focusCheckin, selected),
                          true,
                        )}
                      >
                        <Popup autoPan={false}>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-500">
                                Điểm đã check-in
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {focusCheckin.location_name}
                              </p>
                              {focusCheckin.address ? (
                                <p className="text-xs text-gray-500 mt-1">
                                  {focusCheckin.address}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {focusCheckin.status ? (
                                <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-600">
                                  {focusCheckin.status}
                                </span>
                              ) : null}
                              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                                {Number(focusCheckin.is_user_created) === 1
                                  ? "Tự check-in"
                                  : "Của owner"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() =>
                                  void ensureRouteToTarget({
                                    lat: focusCheckin.lat as number,
                                    lng: focusCheckin.lng as number,
                                  })
                                }
                                disabled={locating}
                              >
                                {locating ? "Đang định vị..." : "Đường đi"}
                              </button>

                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null}

                    {routeLines
                      ? routeLines.map((line, index) => (
                          <React.Fragment key={`route-full-${index}`}>
                            {index === 0 && (
                              <Polyline
                                positions={line.map((p) => [p.lat, p.lng])}
                                pathOptions={{
                                  color: "#ffffff",
                                  weight: 9,
                                  opacity: 0.8,
                                }}
                              />
                            )}
                            <Polyline
                              positions={line.map((p) => [p.lat, p.lng])}
                              pathOptions={{
                                color:
                                  index === 0
                                    ? "#2563eb"
                                    : index === 1
                                      ? "#10b981"
                                      : "#f97316",
                                weight: index === 0 ? 5 : 3,
                                opacity: index === 0 ? 0.95 : 0.7,
                                dashArray: index === 0 ? undefined : "6 8",
                                lineCap: "round",
                                lineJoin: "round",
                              }}
                            />
                          </React.Fragment>
                        ))
                      : null}

                    {/* Mui ten bearing khi co route */}
                    {routeEnabled && routeTarget && myPosition ? (
                      <BearingArrow
                        position={myPosition}
                        destination={routeTarget}
                        heading={deviceHeading}
                      />
                    ) : null}

                    {pickedPoint ? (
                      <Marker
                        position={[pickedPoint.lat, pickedPoint.lng]}
                        icon={pickedIcon}
                      >
                        <Popup autoPan={false}>
                          <div className="w-[210px] p-0.5 font-sans text-slate-800 text-left">
                            {/* Header */}
                            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1 mb-1.5">
                              <span className="text-xs select-none">📍</span>
                              <div>
                                <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">Tọa độ đã ghim</p>
                                <p className="text-[11px] font-bold text-slate-700">
                                  {pickedPoint.lat.toFixed(6)}, {pickedPoint.lng.toFixed(6)}
                                </p>
                              </div>
                            </div>

                            {/* Suggested Location nearby */}
                            {pickedSuggested ? (
                              <div className="mb-2 rounded-lg bg-teal-50/70 border border-teal-100 p-1.5">
                                <p className="text-[8px] font-extrabold text-teal-700 uppercase tracking-wide">Địa điểm gần đây</p>
                                <p className="text-[10px] font-bold text-teal-900 truncate mt-0.5">
                                  {pickedSuggested.location_name}
                                </p>
                                <button
                                  type="button"
                                  className="text-[9px] text-teal-600 hover:text-teal-800 font-bold underline mt-0.5 block transition"
                                  onClick={() =>
                                    navigate(
                                      `/user/location/${pickedSuggested.location_id}`,
                                    )
                                  }
                                >
                                  Xem chi tiết →
                                </button>
                              </div>
                            ) : null}

                            {/* Optional Name Input */}
                            <div className="mb-2">
                              <label className="text-[8px] font-extrabold text-slate-400 uppercase block mb-0.5">Tên địa danh (tự đặt)</label>
                              <input
                                value={pickedName}
                                onChange={(event) => setPickedName(event.target.value)}
                                placeholder="Ví dụ: Điểm cắm trại, Quán ăn..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 transition focus:border-teal-500 focus:bg-white focus:outline-none"
                              />
                            </div>

                            {/* Action buttons list */}
                            <div className="space-y-1">


                              <button
                                type="button"
                                className="w-full flex items-center justify-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                                onClick={() => handleFreeAction("checkin")}
                                disabled={
                                  freeAction === "checkin" || !isPickedOpenNow
                                }
                              >
                                <span>✅</span> {freeAction === "checkin" ? "Đang check-in..." : "Check-in tại đây"}
                              </button>

                              {!isPickedOpenNow ? (
                                <div className="text-[9px] text-amber-700 bg-amber-50 rounded-md py-0.5 px-1.5 text-center font-bold">
                                  ⚠️ Đang đóng cửa
                                  {pickedOpenClose
                                    ? ` (${pickedOpenClose.open} - ${pickedOpenClose.close})`
                                    : ""}
                                </div>
                              ) : null}

                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-1 py-1.5 text-[10px] font-bold text-slate-700 transition"
                                  onClick={() => void ensureRouteToTarget(pickedPoint)}
                                  disabled={locating}
                                >
                                  <span>🚗</span> Đường đi
                                </button>

                                <button
                                  type="button"
                                  className="flex items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-1 py-1.5 text-[10px] font-bold text-slate-700 transition disabled:opacity-50"
                                  onClick={() => handleFreeAction("save")}
                                  disabled={freeAction === "save"}
                                >
                                  <span>⭐</span> {freeAction === "save" ? "Đang lưu..." : "Lưu lại"}
                                </button>
                              </div>

                              <button
                                type="button"
                                className="w-full flex items-center justify-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 py-1.5 text-[10px] font-bold text-rose-600 transition"
                                onClick={clearPickedPoint}
                              >
                                Xoá ghim
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null}

                    {routeOnlyMode && routeOnlyDestination ? (
                      <Marker
                        position={[
                          routeOnlyDestination.lat,
                          routeOnlyDestination.lng,
                        ]}
                        icon={getCircleImageIcon(
                          getDestinationImageUrl(routeOnlyDestination, selected),
                          true,
                        )}
                      >
                        <Popup autoPan={false}>
                          <div className="space-y-2">
                            <p className="font-semibold text-gray-900">
                              {routeOnlyDestination.location_name ?? "Địa điểm"}
                            </p>
                            {routeOnlyDestination.address ? (
                              <p className="text-xs text-gray-500">
                                {routeOnlyDestination.address}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() =>
                                  void ensureRouteToTarget({
                                    lat: routeOnlyDestination.lat,
                                    lng: routeOnlyDestination.lng,
                                  })
                                }
                                disabled={locating}
                              >
                                {locating ? "Đang định vị..." : "Đường đi"}
                              </button>

                              {routeEnabled && routeTarget ? (
                                <button
                                  type="button"
                                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                  onClick={clearRoute}
                                >
                                  Xoá
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null}

                    {!routeOnlyMode
                      ? filteredLocations.map((entry) => {
                          const isSelected =
                            selected?.location_id === entry.item.location_id;
                          const icon = getCircleImageIcon(
                                resolveBackendUrl(
                                  entry.item.first_image ??
                                    (Array.isArray(entry.item.images) ? entry.item.images[0] : null),
                                ),
                                isSelected,
                              );
                          const isRoutingToThis =
                            routeEnabled &&
                            routeTarget &&
                            isSamePoint(routeTarget, {
                              lat: entry.lat,
                              lng: entry.lng,
                            });

                          return (
                            <Marker
                              key={`loc-full-${entry.item.location_id}`}
                              position={[entry.lat, entry.lng]}
                              icon={icon}
                              eventHandlers={{
                                click: () =>
                                  handleSelectLocation(entry.item, {
                                    lat: entry.lat,
                                    lng: entry.lng,
                                  }),
                                dblclick: () => {
                                  setSelected(null);
                                  setPanelOpen(false);
                                },
                              }}
                            >
                              <Popup autoPan={false}>
                                <div className="space-y-2">
                                  <p className="font-semibold text-gray-900">
                                    {entry.item.location_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {entry.item.address}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className="rounded-full bg-teal-600 px-3 py-1 text-xs text-white"
                                      onClick={() => {
                                        setSelected(entry.item);
                                        setPanelOpen(true);
                                      }}
                                    >
                                      Xem chi tiết
                                    </button>

                                    <button
                                      type="button"
                                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                      onClick={() =>
                                        void ensureRouteToTarget({
                                          lat: entry.lat,
                                          lng: entry.lng,
                                        })
                                      }
                                      disabled={locating}
                                    >
                                      {locating
                                        ? "Đang định vị..."
                                        : "Đường đi"}
                                    </button>
                                    {isRoutingToThis ? (
                                      <button
                                        type="button"
                                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                        onClick={clearRoute}
                                      >
                                        Xoá
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })
                      : null}

                    {!routeOnlyMode && selected && !filteredLocations.some(entry => entry.item.location_id === selected.location_id) ? (
                      (() => {
                        const lat = normalizeNumber(selected.latitude);
                        const lng = normalizeNumber(selected.longitude);
                        if (lat == null || lng == null) return null;
                        const isSelected = true;
                        const icon = getCircleImageIcon(
                          resolveBackendUrl(
                            selected.first_image ??
                              (Array.isArray(selected.images) ? selected.images[0] : null),
                          ),
                          isSelected,
                        );
                        const isRoutingToThis =
                          routeEnabled &&
                          routeTarget &&
                          isSamePoint(routeTarget, { lat, lng });

                        return (
                          <Marker
                            key={`loc-selected-extra-full`}
                            position={[lat, lng]}
                            icon={icon}
                            eventHandlers={{
                              click: () =>
                                handleSelectLocation(selected, { lat, lng }),
                              dblclick: () => {
                                setSelected(null);
                                setPanelOpen(false);
                              },
                            }}
                          >
                            <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
                              <div className="space-y-2">
                                <p className="font-semibold text-gray-900">
                                  {selected.location_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {selected.address}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="rounded-full bg-teal-600 px-3 py-1 text-xs text-white"
                                    onClick={() => {
                                      setPanelOpen(true);
                                    }}
                                  >
                                    Xem chi tiết
                                  </button>

                                  <button
                                    type="button"
                                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                    onClick={() =>
                                      void ensureRouteToTarget({ lat, lng })
                                    }
                                    disabled={locating}
                                  >
                                    {locating ? "Đang định vị..." : "Đường đi"}
                                  </button>
                                  {isRoutingToThis ? (
                                    <button
                                      type="button"
                                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600"
                                      onClick={clearRoute}
                                    >
                                      Xoá
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })()
                    ) : null}
                  </MapContainer>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {routeTarget ? (
                  <>
                    <span className="text-xs text-gray-500">Lộ trình:</span>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        routeMode === "motorbike"
                          ? "bg-teal-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setRouteMode("motorbike")}
                    >
                      Xe máy
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        routeMode === "car"
                          ? "bg-teal-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setRouteMode("car")}
                    >
                      Ô tô
                    </button>
                    <span className="text-[10px] text-gray-400" title="OSRM chỉ hỗ trợ profile driving">(ước tính)</span>
                    <button
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        routeEnabled
                          ? "bg-emerald-500 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setRouteEnabled((prev) => !prev)}
                    >
                      {routeEnabled ? "Ẩn lộ trình" : "Hiện lộ trình"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      onClick={clearRoute}
                    >
                      Xoá lộ trình
                    </button>
                  </>
                ) : null}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {tileOptions.map((tile) => (
                    <button
                      key={tile.key}
                      type="button"
                      className={`rounded-full px-3 py-1 text-xs ${
                        mapStyle === tile.key
                          ? "bg-slate-900 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setMapStyle(tile.key)}
                    >
                      {tile.label}
                    </button>
                  ))}
                </div>
              </div>

              {routeInfo ? (
                routeInfo.source === "haversine" ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                      <span className="text-sm">⚠️</span>
                      <span>
                        {routeInfo.hasNoRoute
                          ? "Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"
                          : "Lỗi kết nối máy chủ đường đi (Đang hiển thị đường chim bay)"}
                      </span>
                    </div>
                    <div>
                      Khoảng cách chim bay: {formatDistance(routeInfo.distanceM)} · Thời gian di chuyển: không khả dụng
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                    Tuyến đường: {formatDistance(routeInfo.distanceM)} · Thời gian
                    ước tính: {formatDuration(routeInfo.durationS)}
                    {routeInfo.alternatives ? (
                      <span className="ml-2 text-gray-500">
                        ({routeInfo.alternatives} tuyến)
                      </span>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </UserLayout>
  );
};

export default UserMap;
