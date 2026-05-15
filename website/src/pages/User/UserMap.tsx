import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import { useLocations } from "../../hooks/useLocations";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import {
  getLocationPinIcon,
  getPinIconByKind,
} from "../../utils/leafletPinIcons";
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
};

type FocusRouteState = {
  location_id: number;
  lat: number;
  lng: number;
  location_name?: string;
  address?: string;
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
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onChange({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      });
    },
    zoomend: () => {
      const center = map.getCenter();
      onChange({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      });
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onChange({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], map.getZoom(), { animate: true });
  }, [map, target, trigger]);
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
  const [locating, setLocating] = useState(false);
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
  } | null>(null);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
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
  const [nearbyRadius, setNearbyRadius] = useState(1000);
  const [nearbyCategory, setNearbyCategory] = useState<
    "all" | "food" | "tourist" | "hotel" | "checkin"
  >("all");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewUploading, setReviewUploading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<LocationReview[]>([]);
  const [selectedReviewsLoading, setSelectedReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState(0);
  const [favoriteLocationIds, setFavoriteLocationIds] = useState<number[]>([]);

  const [focusCheckin, setFocusCheckin] = useState<FocusCheckinState | null>(
    null,
  );

  const searchIcon = getPinIconByKind("search");
  const pickedIcon = getPinIconByKind("picked");
  const myPositionIcon = getPinIconByKind("myPosition");

  const mainMapRef = useRef<L.Map | null>(null);
  const fullMapRef = useRef<L.Map | null>(null);

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

  const matchesNearbyCategory = useCallback(
    (location: Location) => {
      if (nearbyCategory === "all") return true;
      const type = location.location_type;
      if (nearbyCategory === "food")
        return type === "restaurant" || type === "cafe";
      if (nearbyCategory === "tourist") return type === "tourist";
      if (nearbyCategory === "hotel")
        return type === "hotel" || type === "resort";
      if (nearbyCategory === "checkin")
        return type === "cafe" || type === "other";
      return true;
    },
    [nearbyCategory],
  );

  const nearbyLocations = useMemo(() => {
    if (!myPosition) return [];
    return locationMarkers
      .map((entry) => {
        const distance = haversineMeters(myPosition, {
          lat: entry.lat,
          lng: entry.lng,
        });
        return { ...entry, distance };
      })
      .filter((entry) => entry.distance <= nearbyRadius)
      .filter((entry) => matchesNearbyCategory(entry.item))
      .sort((a, b) => a.distance - b.distance);
  }, [locationMarkers, matchesNearbyCategory, myPosition, nearbyRadius]);

  const [mapView, setMapView] = useState<MapView>(() => ({
    center: DEFAULT_CENTER,
    zoom: 13,
  }));

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

  useEffect(() => {
    if (!routeEnabled || !routeLines || routeLines.length === 0) return;
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
  }, [fullMapOpen, routeEnabled, routeLines]);

  const tileOptions = useMemo<BaseLayerConfig[]>(
    () => [
      {
        key: "osm",
        label: "Bản đồ tiêu chuẩn (OSM)",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
      {
        key: "positron",
        label: "Bản đồ sáng (Positron)",
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
      {
        key: "voyager",
        label: "Bản đồ đường phố (Voyager)",
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
      {
        key: "satellite",
        label: "Vệ tinh (Esri)",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 18,
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
    setMapView((prev) => {
      const EPS = 1e-7;
      const same =
        prev.zoom === view.zoom &&
        Math.abs(prev.center.lat - view.center.lat) <= EPS &&
        Math.abs(prev.center.lng - view.center.lng) <= EPS;
      return same ? prev : view;
    });
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

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: "error",
        message: "Trình duyệt không hỗ trợ định vị.",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMyPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLocating(false);
        setFeedback({
          type: "error",
          message: err?.message || "Không lấy được vị trí của bạn.",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  };

  const recenterTo = useCallback(
    (target: LatLng | null, zoomOverride?: number) => {
      if (!target) return;
      setMapView((prev) => ({
        ...prev,
        center: target,
        zoom: zoomOverride ?? prev.zoom,
      }));
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

  useEffect(() => {
    if (!routeEnabled || !myPosition || !routeTarget) {
      setRouteLines(null);
      setRouteInfo(null);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      const from = myPosition;
      const to = routeTarget;
      const fallbackDistance = haversineMeters(from, to);

      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Route error");
        const data = (await res.json()) as {
          routes?: Array<{
            distance: number;
            duration: number;
            geometry: { coordinates: Array<[number, number]> };
          }>;
        };
        const routes = data.routes ?? [];
        const route = routes[0];
        if (!route || !route.geometry?.coordinates?.length) {
          throw new Error("Route empty");
        }
        const lines = routes
          .slice(0, 3)
          .map((r) =>
            r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
          );
        setRouteLines(lines);
        setRouteInfo({
          distanceM: route.distance,
          durationS: route.duration,
          source: "osrm",
          alternatives: routes.length,
        });
      } catch {
        setRouteLines([[from, to]]);
        setRouteInfo({ distanceM: fallbackDistance, source: "haversine" });
      }
    };

    run();
    return () => controller.abort();
  }, [myPosition, routeEnabled, routeProfile, routeTarget]);

  const clearRoute = useCallback(() => {
    setRouteEnabled(false);
    setRouteTarget(null);
    setRouteLines(null);
    setRouteInfo(null);
    // Nếu đang ở chế độ chỉ dẫn đường từ Chi tiết địa điểm thì reset về map bình thường.
    setRouteOnlyMode(false);
    setRouteOnlyDestination(null);
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
      setFeedback(null);
      // UX: khi bấm "Đường đi" thì tự tắt panel chi tiết bên trái.
      setPanelOpen(false);
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
      setSelected(location);
      setPanelOpen(true);
      if (coords) {
        flyTo(coords);
      } else {
        const lat = normalizeNumber(location.latitude);
        const lng = normalizeNumber(location.longitude);
        if (lat == null || lng == null) return;
        const target = { lat, lng };
        flyTo(target);
      }
    },
    [flyTo],
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

    if (selectedCoords && !isWithinVietnam(selectedCoords)) {
      setFeedback({
        type: "error",
        message: "Chỉ hỗ trợ check-in trong phạm vi Việt Nam.",
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
          setSearchMarker(coords);
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
    const target = { lat: pendingFocusRoute.lat, lng: pendingFocusRoute.lng };
    // Có thể tìm được location để dùng cho popup/"Xem chi tiết" nếu cần.
    const found = locations.find(
      (x) => Number(x.location_id) === Number(pendingFocusRoute.location_id),
    );
    setSelected(found ?? null);
    setPanelOpen(false);
    flyTo(target);
    void ensureRouteToTarget(target);
    setPendingFocusRoute(null);
  }, [ensureRouteToTarget, flyTo, locations, pendingFocusRoute]);

  useEffect(() => {
    if (!focusCheckin || focusCheckin.lat == null || focusCheckin.lng == null)
      return;
    const target = { lat: focusCheckin.lat, lng: focusCheckin.lng } as LatLng;
    setRecenterTarget(target);
    setRecenterSignal((v) => v + 1);
  }, [focusCheckin]);

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
      setFeedback({ type: "error", message: "Rating không hợp lệ." });
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

  return (
    <UserLayout
      title="Bản đồ"
      subtitle="Bản đồ"
      activeKey="/user/map"
      showSearch
      onSearch={setKeyword}
      searchPlaceholder="Tìm địa điểm..."
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6">
        <section className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Bản đồ địa điểm
              </h2>
              <p className="text-sm text-gray-500">
                Chọn địa điểm trên bản đồ để check-in nhanh.
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-600 hover:bg-blue-100"
              onClick={handleLocate}
              disabled={locating}
            >
              {locating ? "Đang định vị..." : "Lấy vị trí của tôi"}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Tìm kiếm địa danh</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchSelected(null);
                }}
                placeholder="Nhập địa danh, quán, khu du lịch..."
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
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
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Đã chọn: {searchSelected.display_name}
              </div>
            ) : null}
          </div>

          <div className="mt-4 h-[420px] overflow-hidden rounded-2xl border border-gray-100">
            {!fullMapOpen ? (
              <MapContainer
                center={[mapView.center.lat, mapView.center.lng]}
                zoom={mapView.zoom}
                className="h-full w-full"
                maxBounds={VIETNAM_BOUNDS}
                maxBoundsViscosity={1}
                doubleClickZoom={false}
              >
                <TileLayer
                  attribution={activeTile.attribution}
                  url={activeTile.url}
                  maxZoom={activeTile.maxZoom}
                />
                <MapRefBinder mapRef={mainMapRef} />
                <MapViewTracker onChange={handleMapViewChange} />
                <MapRecenter target={recenterTarget} trigger={recenterSignal} />
                <MapResizeObserver />
                <MapClickHandler onPick={handleMapPick} />

                {myPosition ? (
                  <Marker
                    position={[myPosition.lat, myPosition.lng]}
                    icon={myPositionIcon}
                  >
                    <Popup>Vị trí của bạn</Popup>
                  </Marker>
                ) : null}

                {routeOnlyMode && routeOnlyDestination ? (
                  <Marker
                    position={[
                      routeOnlyDestination.lat,
                      routeOnlyDestination.lng,
                    ]}
                    icon={getLocationPinIcon({
                      isUserCreated: false,
                      isSelected: true,
                    })}
                  >
                    <Popup>
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
                    <Popup>
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
                    icon={getLocationPinIcon({
                      isUserCreated: Number(focusCheckin.is_user_created) === 1,
                      isSelected: true,
                    })}
                  >
                    <Popup>
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
                            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                              {focusCheckin.status}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                            {Number(focusCheckin.is_user_created) === 1
                              ? "Tự check-in"
                              : "Của owner"}
                          </span>
                        </div>
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
                    </Popup>
                  </Marker>
                ) : null}

                {routeLines
                  ? routeLines.map((line, index) => (
                      <Polyline
                        key={`route-${index}`}
                        positions={line.map((p) => [p.lat, p.lng])}
                        pathOptions={{
                          color:
                            index === 0
                              ? "#2563eb"
                              : index === 1
                                ? "#10b981"
                                : "#f97316",
                          weight: index === 0 ? 5 : 3,
                          opacity: index === 0 ? 0.9 : 0.7,
                          dashArray: index === 0 ? undefined : "6 8",
                        }}
                      />
                    ))
                  : null}

                {pickedPoint ? (
                  <Marker
                    position={[pickedPoint.lat, pickedPoint.lng]}
                    icon={pickedIcon}
                  >
                    <Popup>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Tọa độ</p>
                          <p className="text-sm text-gray-900">
                            {pickedPoint.lat.toFixed(6)},{" "}
                            {pickedPoint.lng.toFixed(6)}
                          </p>
                        </div>
                        {pickedSuggested ? (
                          <p className="text-xs text-emerald-600">
                            Gợi ý: {pickedSuggested.location_name}
                          </p>
                        ) : null}
                        <input
                          value={pickedName}
                          onChange={(event) =>
                            setPickedName(event.target.value)
                          }
                          placeholder="Tên địa điểm (tuỳ chọn)"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            onClick={() =>
                              void ensureRouteToTarget(pickedPoint)
                            }
                            disabled={locating}
                          >
                            {locating ? "Đang định vị..." : "Đường đi"}
                          </button>
                          {pickedSuggested ? (
                            <button
                              type="button"
                              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              onClick={() =>
                                navigate(
                                  `/user/location/${pickedSuggested.location_id}`,
                                )
                              }
                            >
                              Xem thông tin
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            onClick={clearPickedPoint}
                          >
                            Xoá
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                            onClick={() => handleFreeAction("checkin")}
                            disabled={freeAction === "checkin"}
                          >
                            {freeAction === "checkin"
                              ? "Đang check-in..."
                              : "Check-in tại đây"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            onClick={() => handleFreeAction("save")}
                            disabled={freeAction === "save"}
                          >
                            {freeAction === "save"
                              ? "Đang lưu..."
                              : "Lưu để đi sau"}
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}

                {!routeOnlyMode
                  ? locationMarkers.map((entry) => {
                      const isSelected =
                        selected?.location_id === entry.item.location_id;
                      const isUserCreated = isOwnerCreatedLocation(entry.item);
                      const icon = getLocationPinIcon({
                        isUserCreated,
                        isSelected,
                      });
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
                          }}
                        >
                          <Popup>
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
                                  className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white"
                                  onClick={() =>
                                    navigate(
                                      `/user/location/${entry.item.location_id}`,
                                    )
                                  }
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
              </MapContainer>
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-100" />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => setFullMapOpen(true)}
            >
              Mở lớn bản đồ
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => recenterTo(selectedCoords)}
              disabled={!selectedCoords}
            >
              Về điểm check-in
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
                    ? "bg-blue-600 text-white"
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
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                onClick={() => setRouteMode("car")}
              >
                Ô tô
              </button>
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
            <span className="text-xs text-gray-500">Loại bản đồ:</span>
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
            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              Tuyến đường: {formatDistance(routeInfo.distanceM)} · Thời gian ước
              tính: {formatDuration(routeInfo.durationS)}
              {routeInfo.alternatives ? (
                <span className="ml-2 text-gray-500">
                  ({routeInfo.alternatives} tuyến)
                </span>
              ) : null}
            </div>
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

        <aside className="space-y-4">
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900">
              Check-in nhanh
            </h3>
            {selected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-semibold">
                    {selected.location_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selected.location_name}
                    </p>
                    <p className="text-xs text-gray-500">{selected.address}</p>
                  </div>
                </div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ghi chú nhanh (tuỳ chọn)"
                  className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  rows={3}
                />
                <button
                  type="button"
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white hover:bg-blue-700"
                  onClick={handleCheckin}
                  disabled={checkingIn || !isSelectedOpenNow}
                >
                  {checkingIn ? "Đang gửi check-in..." : "Check-in ngay"}
                </button>

                {!isSelectedOpenNow ? (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    Đang đóng cửa
                    {selectedOpenClose
                      ? ` (${selectedOpenClose.open} - ${selectedOpenClose.close})`
                      : ""}
                    .
                  </div>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-100"
                  onClick={handleNavigateToSelected}
                  disabled={locating}
                >
                  {locating ? "Đang định vị..." : "Đường đi"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() =>
                    navigate(`/user/location/${selected.location_id}`)
                  }
                >
                  Xem chi tiết địa điểm
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                Chọn một địa điểm trên bản đồ để check-in.
              </div>
            )}
          </div>

          {!routeOnlyMode ? (
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900">
                Gợi ý địa điểm gần bạn
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Chọn bán kính và loại địa điểm để gợi ý.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {[500, 1000, 5000].map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${
                      nearbyRadius === radius
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                    onClick={() => setNearbyRadius(radius)}
                  >
                    {radius < 1000 ? `${radius}m` : `${radius / 1000}km`}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: "Tất cả" },
                    { key: "food", label: "Ăn uống 🍜" },
                    { key: "tourist", label: "Du lịch 🏞" },
                    { key: "hotel", label: "Khách sạn 🏨" },
                    { key: "checkin", label: "Check-in 📸" },
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

              {!myPosition ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 text-center">
                  Hãy bấm “Lấy vị trí của tôi” để xem địa điểm gần.
                </div>
              ) : null}

              <div className="mt-4 space-y-3 max-h-[260px] overflow-auto pr-1">
                {myPosition && nearbyLocations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 text-center">
                    Không có địa điểm phù hợp trong bán kính đã chọn.
                  </div>
                ) : null}
                {nearbyLocations.map((entry) => (
                  <button
                    key={entry.item.location_id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left text-xs ${
                      selected?.location_id === entry.item.location_id
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      handleSelectLocation(entry.item, {
                        lat: entry.lat,
                        lng: entry.lng,
                      });
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {entry.item.location_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistance(entry.distance)} · {entry.item.address}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-600">
                      Đi tới
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!routeOnlyMode ? (
            <div className="bg-white rounded-3xl shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900">
                Danh sách địa điểm
              </h3>
              {loading ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                  Đang tải địa điểm...
                </div>
              ) : null}
              {error ? (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 text-center">
                  {error}
                </div>
              ) : null}
              {!loading && locations.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
                  Chưa có địa điểm phù hợp.
                </div>
              ) : null}
              <div className="mt-4 space-y-3 max-h-[340px] overflow-auto pr-1">
                {locations.map((item) => {
                  const imageUrl = resolveBackendUrl(
                    item.first_image ??
                      (Array.isArray(item.images) ? item.images[0] : null),
                  );
                  return (
                    <button
                      key={item.location_id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        selected?.location_id === item.location_id
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-100 hover:bg-gray-50"
                      }`}
                      onClick={() => handleSelectLocation(item)}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.location_name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-100" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.location_name}
                        </p>
                        <p className="text-xs text-gray-500">{item.address}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="bg-white rounded-3xl shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900">
              Đánh giá nhanh trên map
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Gửi rating, nhận xét và ảnh mà không cần rời bản đồ.
            </p>

            {!selected ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 text-center">
                Chọn một địa điểm trên bản đồ để đánh giá.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5].map((star) => {
                    const active = reviewFilter === star;
                    return (
                      <button
                        key={`quick-map-review-filter-${star}`}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-blue-600 text-white"
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
                  <p className="text-xs text-gray-500">Địa điểm</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selected.location_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Rating</label>
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
                  className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  rows={3}
                />

                <div>
                  <label className="text-xs text-gray-500">Ảnh</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="mt-2 block w-full text-xs text-gray-600"
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
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white hover:bg-emerald-700"
                  onClick={handleSubmitReview}
                  disabled={reviewSubmitting || reviewRating <= 0}
                >
                  {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                </button>

                <div className="space-y-2 border-t border-gray-100 pt-3">
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
                  {filteredSelectedReviews.slice(0, 6).map((review) => (
                    <div
                      key={`quick-map-review-${review.review_id}`}
                      className="rounded-xl border border-gray-100 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-900">
                          {review.user_name || "Người dùng"}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-700">
                          {Number(review.rating || 0).toFixed(0)} sao
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-400">
                        {formatDateTimeVi(review.created_at)}
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        {review.comment?.trim() ||
                          "Người dùng không để lại bình luận."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <div>
                <p className="text-xs text-gray-500">Bản đồ check-in</p>
                <h3 className="text-base font-semibold text-gray-900">
                  Xem bản đồ toàn màn hình
                </h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-600 hover:bg-blue-100"
                  onClick={handleLocate}
                  disabled={locating}
                >
                  {locating ? "Đang định vị..." : "Lấy vị trí của tôi"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-600 hover:bg-emerald-100"
                  onClick={handleCheckin}
                  disabled={!selected || checkingIn || !isSelectedOpenNow}
                >
                  {checkingIn ? "Đang check-in..." : "Check-in nhanh"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  onClick={() => recenterTo(selectedCoords)}
                  disabled={!selectedCoords}
                >
                  Về điểm check-in
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
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-700"
                  onClick={() => setFullMapOpen(false)}
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-xs text-gray-500">Tìm kiếm địa danh</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchSelected(null);
                    }}
                    placeholder="Nhập địa danh, quán, khu du lịch..."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
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
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
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
                          <h4 className="mt-1 truncate text-lg font-semibold text-gray-900">
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
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                          onClick={() =>
                            void ensureRouteToTarget(selectedCoords)
                          }
                          disabled={locating || !selectedCoords}
                        >
                          {locating ? "Đang định vị..." : "Đường đi"}
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
                                ? "bg-blue-600 text-white hover:bg-blue-700"
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
                                    className="text-blue-600 hover:text-blue-700"
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
                              className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white hover:bg-blue-700"
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
                                        ? "bg-blue-600 text-white"
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
                              className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                              rows={3}
                            />
                            <div>
                              <label className="block rounded-2xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-600 hover:bg-gray-50">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(event) =>
                                    handleReviewUpload(event.target.files)
                                  }
                                  disabled={reviewUploading}
                                />
                                {reviewUploading
                                  ? "Đang upload ảnh..."
                                  : "Thêm ảnh cho bài đánh giá"}
                              </label>

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
                                const images = normalizeReviewImages(
                                  review.images,
                                ).map(
                                  (item) => resolveBackendUrl(item) || item,
                                );
                                return (
                                  <article
                                    key={`map-review-${review.review_id}`}
                                    className="rounded-xl border border-gray-100 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-semibold text-gray-900">
                                        {review.user_name || "Người dùng"}
                                      </div>
                                      <div className="text-[11px] font-semibold text-amber-700">
                                        {Number(review.rating || 0).toFixed(0)}{" "}
                                        sao
                                      </div>
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-400">
                                      {formatDateTimeVi(review.created_at)}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-600">
                                      {review.comment?.trim() ||
                                        "Người dùng không để lại bình luận."}
                                    </p>
                                    {images.length > 0 ? (
                                      <div className="mt-2 grid grid-cols-3 gap-2">
                                        {images.slice(0, 3).map((img, idx) => (
                                          <img
                                            key={`map-review-img-${review.review_id}-${idx}`}
                                            src={img}
                                            alt={`review-${idx + 1}`}
                                            className="h-16 w-full rounded-lg object-cover"
                                          />
                                        ))}
                                      </div>
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
                    center={[mapView.center.lat, mapView.center.lng]}
                    zoom={mapView.zoom}
                    className="h-full w-full"
                    maxBounds={VIETNAM_BOUNDS}
                    maxBoundsViscosity={1}
                    doubleClickZoom={false}
                  >
                    <TileLayer
                      attribution={activeTile.attribution}
                      url={activeTile.url}
                      maxZoom={activeTile.maxZoom}
                    />
                    <MapRefBinder mapRef={fullMapRef} />
                    <MapViewTracker onChange={handleMapViewChange} />
                    <MapRecenter
                      target={recenterTarget}
                      trigger={recenterSignal}
                    />
                    <MapResizeObserver />
                    <MapClickHandler onPick={handleMapPick} />

                    {myPosition ? (
                      <Marker
                        position={[myPosition.lat, myPosition.lng]}
                        icon={myPositionIcon}
                      >
                        <Popup>Vị trí của bạn</Popup>
                      </Marker>
                    ) : null}

                    {searchMarker ? (
                      <Marker
                        position={[searchMarker.lat, searchMarker.lng]}
                        icon={searchIcon}
                      >
                        <Popup>
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
                        icon={getLocationPinIcon({
                          isUserCreated:
                            Number(focusCheckin.is_user_created) === 1,
                          isSelected: true,
                        })}
                      >
                        <Popup>
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
                                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                                  {focusCheckin.status}
                                </span>
                              ) : null}
                              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                                {Number(focusCheckin.is_user_created) === 1
                                  ? "Tự check-in"
                                  : "Của owner"}
                              </span>
                            </div>
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
                        </Popup>
                      </Marker>
                    ) : null}

                    {routeLines
                      ? routeLines.map((line, index) => (
                          <Polyline
                            key={`route-full-${index}`}
                            positions={line.map((p) => [p.lat, p.lng])}
                            pathOptions={{
                              color:
                                index === 0
                                  ? "#2563eb"
                                  : index === 1
                                    ? "#10b981"
                                    : "#f97316",
                              weight: index === 0 ? 5 : 3,
                              opacity: index === 0 ? 0.9 : 0.7,
                              dashArray: index === 0 ? undefined : "6 8",
                            }}
                          />
                        ))
                      : null}

                    {pickedPoint ? (
                      <Marker
                        position={[pickedPoint.lat, pickedPoint.lng]}
                        icon={pickedIcon}
                      >
                        <Popup>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-500">Tọa độ</p>
                              <p className="text-sm text-gray-900">
                                {pickedPoint.lat.toFixed(6)},{" "}
                                {pickedPoint.lng.toFixed(6)}
                              </p>
                            </div>
                            {pickedSuggested ? (
                              <p className="text-xs text-emerald-600">
                                Gợi ý: {pickedSuggested.location_name}
                              </p>
                            ) : null}
                            <input
                              value={pickedName}
                              onChange={(event) =>
                                setPickedName(event.target.value)
                              }
                              placeholder="Tên địa điểm (tuỳ chọn)"
                              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() =>
                                  void ensureRouteToTarget(pickedPoint)
                                }
                                disabled={locating}
                              >
                                {locating ? "Đang định vị..." : "Đường đi"}
                              </button>
                              {pickedSuggested ? (
                                <button
                                  type="button"
                                  className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                  onClick={() =>
                                    navigate(
                                      `/user/location/${pickedSuggested.location_id}`,
                                    )
                                  }
                                >
                                  Xem thông tin
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                onClick={clearPickedPoint}
                              >
                                Xoá
                              </button>
                              <button
                                type="button"
                                className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                                onClick={() => handleFreeAction("checkin")}
                                disabled={
                                  freeAction === "checkin" || !isPickedOpenNow
                                }
                              >
                                {freeAction === "checkin"
                                  ? "Đang check-in..."
                                  : "Check-in tại đây"}
                              </button>
                              {!isPickedOpenNow ? (
                                <div className="text-[11px] text-amber-700">
                                  Đang đóng cửa
                                  {pickedOpenClose
                                    ? ` (${pickedOpenClose.open} - ${pickedOpenClose.close})`
                                    : ""}
                                  .
                                </div>
                              ) : null}
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                onClick={() => handleFreeAction("save")}
                                disabled={freeAction === "save"}
                              >
                                {freeAction === "save"
                                  ? "Đang lưu..."
                                  : "Lưu để đi sau"}
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
                        icon={getLocationPinIcon({
                          isUserCreated: false,
                          isSelected: true,
                        })}
                      >
                        <Popup>
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
                      ? locationMarkers.map((entry) => {
                          const isSelected =
                            selected?.location_id === entry.item.location_id;
                          const isUserCreated = isOwnerCreatedLocation(
                            entry.item,
                          );
                          const icon = getLocationPinIcon({
                            isUserCreated,
                            isSelected,
                          });
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
                              }}
                            >
                              <Popup>
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
                                      className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white"
                                      onClick={() =>
                                        navigate(
                                          `/user/location/${entry.item.location_id}`,
                                        )
                                      }
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
                          ? "bg-blue-600 text-white"
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
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setRouteMode("car")}
                    >
                      Ô tô
                    </button>
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
                  <span className="text-xs text-gray-500">Loại bản đồ:</span>
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
                <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                  Tuyến đường: {formatDistance(routeInfo.distanceM)} · Thời gian
                  ước tính: {formatDuration(routeInfo.durationS)}
                  {routeInfo.alternatives ? (
                    <span className="ml-2 text-gray-500">
                      ({routeInfo.alternatives} tuyến)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </UserLayout>
  );
};

export default UserMap;
