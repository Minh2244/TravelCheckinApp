import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useLocations } from "../hooks/useLocations";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";
import { getPinIconByKind } from "../utils/leafletPinIcons";
import geoApi from "../api/geoApi";
import type { Location } from "../types/location.types";

// ============================================================
// Sub-components
// ============================================================

const MapRecenter = ({ target, trigger }: { target: { lat: number; lng: number } | null; trigger: number }) => {
  const map = useMap();
  const lastTrigger = useRef(-1);
  useEffect(() => {
    if (!target || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    map.setView([target.lat, target.lng], 16, { animate: true });
  }, [map, target, trigger]);
  return null;
};

const MapResizeObserver = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
};

// Single click handler (UserMap uses dblclick, but for itinerary we use single click to pick)
const MapClickHandler = ({ onPick }: { onPick: (coords: { lat: number; lng: number }) => void }) => {
  useMapEvents({
    click: (e) => {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// ============================================================
// Circle image icon (same as UserMap)
// ============================================================

const circleIconCache = new Map<string, L.DivIcon>();

const getCircleImageIcon = (imageUrl: string | null | undefined, isSelected: boolean, size = 48) => {
  const cacheKey = `${imageUrl ?? ""}|${isSelected}|${size}`;
  const cached = circleIconCache.get(cacheKey);
  if (cached) return cached;

  const borderStyle = isSelected ? "3px solid white" : "2px solid white";
  const shadow = isSelected
    ? "0 0 0 3px #14b8a6, 0 2px 10px rgba(0,0,0,0.35)"
    : "0 2px 6px rgba(0,0,0,0.2)";

  let icon: L.DivIcon;
  if (imageUrl) {
    icon = L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:${borderStyle};box-shadow:${shadow};overflow:hidden;background:#e2e8f0;">
        <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;"
             onerror="this.parentElement.style.background='linear-gradient(135deg,#99f6e4,#a7f3d0)';this.style.display='none';" />
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  } else {
    icon = L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:${borderStyle};box-shadow:${shadow};background:linear-gradient(135deg,#99f6e4,#a7f3d0);display:flex;align-items:center;justify-content:center;">
        <svg width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round"><path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z"/><circle cx="12" cy="10" r="2.5"/></svg>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }

  if (circleIconCache.size > 200) circleIconCache.clear();
  circleIconCache.set(cacheKey, icon);
  return icon;
};

// ============================================================
// Types
// ============================================================

interface PickedLocationData {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

interface LocationPickerMapProps {
  onSelectLocation: (location: Location) => void;
  onPickLocation?: (data: PickedLocationData) => void;
  className?: string;
}

// ============================================================
// Main Component
// ============================================================

const LocationPickerMap = ({ onSelectLocation, onPickLocation, className = "" }: LocationPickerMapProps) => {
  const { locations, loading: locationsLoading } = useLocations();

  // GPS
  const [myPosition, setMyPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [recenterTarget, setRecenterTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const lastGpsPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Search result marker (Nominatim) - persists until dismissed
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Picked point (click on map) - persists until dismissed
  const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Selected location (for highlighting)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const myPositionIcon = useMemo(() => getPinIconByKind("myPosition"), []);
  const pickedIcon = useMemo(() => getPinIconByKind("picked"), []);
  const searchIcon = useMemo(() => getPinIconByKind("search"), []);

  // ---- GPS ----
  useEffect(() => {
    let watchId: number | null = null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPosition(p);
        lastGpsPosRef.current = p;
        setRecenterTarget(p);
        setRecenterSignal((s) => s + 1);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const prev = lastGpsPosRef.current;
        if (!prev || Math.abs(prev.lat - newPos.lat) > 0.00005 || Math.abs(prev.lng - newPos.lng) > 0.00005) {
          setMyPosition(newPos);
          lastGpsPosRef.current = newPos;
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // ---- Search (debounce 500ms) ----
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = searchQuery.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
        const systemResults = locations
          .filter((loc) => {
            const name = (loc.location_name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
            const addr = (loc.address || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
            return name.includes(q) || addr.includes(q);
          })
          .slice(0, 5)
          .map((loc) => ({
            place_id: `sys:${loc.location_id}`,
            display_name: `${loc.location_name}${loc.address ? ", " + loc.address : ""}`,
            lat: String(loc.latitude),
            lon: String(loc.longitude),
            isSystem: true,
            _location: loc,
          }));

        let nomResults: any[] = [];
        if (systemResults.length < 5) {
          const data = await geoApi.search(searchQuery, 8);
          nomResults = data
            .filter((r) => r.lat && r.lon)
            .map((r) => ({
              place_id: `nom:${r.place_id}`,
              display_name: r.display_name || "",
              lat: r.lat,
              lon: r.lon,
              isSystem: false,
            }));
        }

        setSearchResults([...systemResults, ...nomResults].slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, locations]);

  // ---- Handle search select ----
  const handleSearchSelect = useCallback(
    (result: any) => {
      // System result → select location directly, clear search marker
      if (result.isSystem && result._location) {
        const loc = result._location;
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          setRecenterTarget({ lat, lng });
          setRecenterSignal((s) => s + 1);
        }
        setSelectedLocationId(loc.location_id);
        setSearchMarker(null); // clear search marker for system results
        setSearchQuery("");
        setSearchResults([]);
        return;
      }

      // Nominatim result → place search marker that PERSISTS
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        setRecenterTarget({ lat, lng });
        setRecenterSignal((s) => s + 1);
        setSearchMarker({ lat, lng, name: result.display_name || "" });
      }
      setSearchQuery(result.display_name || "");
      setSearchResults([]);
    },
    [],
  );

  // ---- Handle map click → only place picked pin (don't call onPickLocation yet) ----
  const handleMapClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      setPickedPoint(coords);
      setSearchMarker(null); // clear search marker when clicking map
    },
    [],
  );

  // ---- Confirm picked location → reverse geocode + call onPickLocation ----
  const handleConfirmPicked = useCallback(
    async (coords: { lat: number; lng: number }) => {
      if (!onPickLocation) return;
      try {
        const result = await geoApi.reverse(coords.lat, coords.lng);
        const name = result.display_name || "";
        const addr = result.address
          ? [result.address.road, result.address.suburb, result.address.city || result.address.town || result.address.village, result.address.state].filter(Boolean).join(", ")
          : "";
        onPickLocation({ lat: coords.lat, lng: coords.lng, name: name || undefined, address: addr || undefined });
      } catch {
        onPickLocation({ lat: coords.lat, lng: coords.lng });
      }
    },
    [onPickLocation],
  );

  // ---- Handle location marker click → select and open popup ----
  const handleLocationClick = useCallback(
    (loc: Location) => {
      setSelectedLocationId(loc.location_id);
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setRecenterTarget({ lat, lng });
        setRecenterSignal((s) => s + 1);
      }
    },
    [],
  );

  // ---- Handle "Thêm vào lịch trình" from popup ----
  const handleAddFromPopup = useCallback(
    (loc: Location) => {
      onSelectLocation(loc);
      setSelectedLocationId(null);
    },
    [onSelectLocation],
  );

  // ---- Recenter to my position ----
  const handleRecenter = useCallback(() => {
    if (myPosition) {
      setRecenterTarget(myPosition);
      setRecenterSignal((s) => s + 1);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyPosition(p);
          setRecenterTarget(p);
          setRecenterSignal((s) => s + 1);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [myPosition]);

  const typeLabel = (t: string) => {
    if (t === "restaurant" || t === "cafe") return "Ăn uống";
    if (t === "hotel" || t === "resort" || t === "homestay") return "Lưu trú";
    if (t === "tourist") return "Du lịch";
    return "Khác";
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search bar */}
      <div className="absolute top-3 left-3 z-[1000]" style={{ width: "calc(100% - 54px)" }}>
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm địa điểm..."
            className="w-full rounded-xl border border-white/50 bg-white/95 backdrop-blur-sm px-4 py-2.5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 shadow-lg outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.place_id}
                  onClick={() => handleSearchSelect(r)}
                  className="w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-indigo-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {r.isSystem && <span className="shrink-0 h-2 w-2 rounded-full bg-indigo-500" />}
                    <span className="text-sm text-slate-700 truncate">{r.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nút vị trí tôi */}
      <div className="absolute top-3 right-3 z-[1000]">
        <button
          onClick={handleRecenter}
          className="rounded-xl bg-white/95 backdrop-blur-sm border border-white/50 p-2.5 shadow-lg hover:bg-white transition-colors"
          title="Vị trí của tôi"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

      {/* Map */}
      <MapContainer
        center={[16.0471, 108.2068]}
        zoom={6}
        zoomControl={false}
        doubleClickZoom={false}
        style={{ height: "100%", width: "100%" }}
        className="rounded-xl"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapResizeObserver />
        <MapRecenter target={recenterTarget} trigger={recenterSignal} />
        <MapClickHandler onPick={handleMapClick} />

        {/* My position */}
        {myPosition && (
          <Marker position={[myPosition.lat, myPosition.lng]} icon={myPositionIcon}>
            <Popup autoPan={false}><div className="text-sm font-semibold">📍 Vị trí của bạn</div></Popup>
          </Marker>
        )}

        {/* Search result marker (Nominatim) - PERSISTS until dismissed */}
        {searchMarker && (
          <Marker position={[searchMarker.lat, searchMarker.lng]} icon={searchIcon}>
            <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
              <div className="min-w-[180px]">
                <div className="font-bold text-sm mb-1">🔍 {searchMarker.name}</div>
                <div className="text-xs text-gray-500 mb-2">
                  {searchMarker.lat.toFixed(5)}, {searchMarker.lng.toFixed(5)}
                </div>
                <button
                  onClick={() => {
                    if (onPickLocation) {
                      onPickLocation({
                        lat: searchMarker.lat,
                        lng: searchMarker.lng,
                        name: searchMarker.name,
                      });
                    }
                    // Convert search marker to picked point (keep pin on map)
                    setPickedPoint({ lat: searchMarker.lat, lng: searchMarker.lng });
                    setSearchMarker(null);
                  }}
                  className="w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  📍 Chọn vị trí này
                </button>
                <button
                  onClick={() => setSearchMarker(null)}
                  className="w-full mt-1 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ✕ Bỏ ghim
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Picked point (click on map) - PERSISTS until dismissed */}
        {pickedPoint && (
          <Marker position={[pickedPoint.lat, pickedPoint.lng]} icon={pickedIcon}>
            <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
              <div className="min-w-[160px]">
                <div className="text-xs text-gray-500 mb-2">
                  📌 {pickedPoint.lat.toFixed(5)}, {pickedPoint.lng.toFixed(5)}
                </div>
                <button
                  onClick={() => void handleConfirmPicked(pickedPoint)}
                  className="w-full px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                >
                  📍 Chọn vị trí này
                </button>
                <button
                  onClick={() => setPickedPoint(null)}
                  className="w-full mt-1 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ✕ Bỏ ghim
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* System locations with circular images */}
        {locations
          .filter((loc) => loc.latitude && loc.longitude)
          .map((loc) => {
            const imageUrl = resolveBackendUrl(loc.first_image ?? (Array.isArray(loc.images) ? loc.images[0] : null));
            const isSelected = selectedLocationId === loc.location_id;
            const icon = getCircleImageIcon(imageUrl, isSelected, 48);
            return (
              <Marker
                key={`loc-${loc.location_id}`}
                position={[Number(loc.latitude), Number(loc.longitude)]}
                icon={icon}
                eventHandlers={{
                  click: () => handleLocationClick(loc),
                }}
              >
                <Popup autoPan={false} closeOnEscapeKey closeOnClick={false}>
                  <div className="min-w-[180px]">
                    <div className="font-bold text-sm mb-1">{loc.location_name}</div>
                    <div className="text-xs text-gray-500 mb-1">{loc.address}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">{typeLabel(loc.location_type)}</span>
                      {Number(loc.rating) > 0 && <span>⭐ {Number(loc.rating).toFixed(1)}</span>}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddFromPopup(loc);
                      }}
                      className="w-full px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      + Thêm vào lịch trình
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Loading overlay */}
      {locationsLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl z-[1000]">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-slate-600 shadow-sm border border-slate-200">
        🗺️ Nhấn vào bản đồ để ghim · Nhấn marker để xem thông tin
      </div>
    </div>
  );
};

export default LocationPickerMap;
