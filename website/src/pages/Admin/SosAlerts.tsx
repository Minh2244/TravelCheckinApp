import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  Button,
  Card,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { statusToVi } from "../../utils/statusText";
import { formatDateVi } from "../../utils/formatDateVi";

type SosStatus = "pending" | "processing" | "resolved";

interface SosAlertRow {
  alert_id: number;
  user_id: number | null;
  user_name: string | null;
  user_phone: string | null;
  location_text: string | null;
  message: string | null;
  status: SosStatus;
  resolved_at: string | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

type LatLng = { lat: number; lng: number };

const VIETNAM_CENTER: LatLng = { lat: 16.047079, lng: 108.20623 };
const VIETNAM_BOUNDS: L.LatLngBoundsExpression = [
  [7.0, 101.0],
  [23.5, 110.8],
];

const statusColor: Record<SosStatus, string> = {
  pending: "orange",
  processing: "blue",
  resolved: "green",
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
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

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const MapAttach = ({ mapRef }: { mapRef: MutableRefObject<L.Map | null> }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, mapRef]);
  return null;
};

const SosAlerts = () => {
  // Fix icon marker của Leaflet (Vite không tự resolve được asset)
  useEffect(() => {
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

  const [rows, setRows] = useState<SosAlertRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<SosStatus | undefined>(
    undefined,
  );

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [selected, setSelected] = useState<SosAlertRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const [locating, setLocating] = useState(false);
  const [myPos, setMyPos] = useState<LatLng | null>(null);
  const [routeLine, setRouteLine] = useState<LatLng[] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceM: number;
    durationS?: number;
    source: "osrm" | "haversine";
  } | null>(null);

  const selectedPos = useMemo<LatLng | null>(() => {
    if (selected?.latitude == null || selected?.longitude == null) return null;
    return { lat: selected.latitude, lng: selected.longitude };
  }, [selected]);

  const requestMyLocation = () => {
    if (!navigator.geolocation) {
      message.error("Trình duyệt không hỗ trợ định vị");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMyPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLocating(false);
        message.error(err?.message || "Không lấy được vị trí của bạn");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10_000,
      },
    );
  };

  // Reset trạng thái khi đóng modal
  useEffect(() => {
    if (!detailOpen) {
      mapRef.current = null;
      setMyPos(null);
      setRouteLine(null);
      setRouteInfo(null);
    }
  }, [detailOpen]);

  // Fit bounds khi có đủ điểm
  useEffect(() => {
    if (!detailOpen) return;
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      if (myPos && selectedPos) {
        const bounds = L.latLngBounds(
          [myPos.lat, myPos.lng],
          [selectedPos.lat, selectedPos.lng],
        );
        map.fitBounds(bounds.pad(0.25));
      } else if (selectedPos) {
        map.setView([selectedPos.lat, selectedPos.lng], 16);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [detailOpen, myPos, selectedPos]);

  // Routing + distance
  useEffect(() => {
    if (!detailOpen || !myPos || !selectedPos) return;

    const controller = new AbortController();

    const run = async () => {
      const from = myPos;
      const to = selectedPos;
      const fallbackDistance = haversineMeters(from, to);
      setRouteInfo({ distanceM: fallbackDistance, source: "haversine" });
      setRouteLine([from, to]);

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from.lng},${from.lat};${to.lng},${to.lat}` +
          `?overview=full&geometries=geojson`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        type OsrmRoute = {
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: Array<[number, number]> };
        };
        type OsrmRouteResponse = { routes?: OsrmRoute[] };

        const json = (await res.json()) as OsrmRouteResponse;
        const route = json.routes?.[0];
        const coords: Array<[number, number]> | undefined =
          route?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return;

        const line: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));
        setRouteLine(line);
        setRouteInfo({
          distanceM: Number(route?.distance) || fallbackDistance,
          durationS: Number(route?.duration) || undefined,
          source: "osrm",
        });
      } catch {
        // ignore (fallback already set)
      }
    };

    run();
    return () => controller.abort();
  }, [detailOpen, myPos, selectedPos]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (statusFilter) params.status = statusFilter;

      const response = await adminApi.getSosAlerts(params);
      if (response?.success) {
        setRows(response.data || []);
        setPagination((p) => ({
          ...p,
          total: response.pagination?.total ?? 0,
          current: response.pagination?.page ?? p.current,
          pageSize: response.pagination?.limit ?? p.pageSize,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách SOS"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, statusFilter]);

  const openDetails = (row: SosAlertRow) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setSelected(null);
  };

  const updateStatus = async (row: SosAlertRow, status: SosStatus) => {
    try {
      const response = await adminApi.updateSosAlertStatus(
        row.alert_id,
        status,
      );
      if (response?.success) {
        message.success("Đã cập nhật trạng thái SOS");
        fetchAlerts();
        if (selected?.alert_id === row.alert_id) {
          setSelected({ ...row, status });
        }
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật trạng thái SOS"));
    }
  };

  const columns: ColumnsType<SosAlertRow> = [
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (t: string) => formatDateVi(t),
    },
    {
      title: "Người gửi",
      key: "user",
      width: 220,
      render: (_, r) => (
        <div>
          <div className="font-medium text-gray-800">{r.user_name || "-"}</div>
          <div className="text-xs text-gray-500">{r.user_phone || "-"}</div>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (s: SosStatus) => (
        <Tag color={statusColor[s] || "default"}>{statusToVi(s)}</Tag>
      ),
    },
    {
      title: "Vị trí",
      key: "location",
      ellipsis: true,
      render: (_, r) => r.location_text || "-",
    },
    {
      title: "Nội dung",
      key: "message",
      ellipsis: true,
      render: (_, r) => r.message || "-",
    },
    {
      title: "",
      key: "action",
      width: 220,
      fixed: "right",
      render: (_, r) => (
        <Space size={6}>
          <Button size="small" type="link" onClick={() => openDetails(r)}>
            Xem
          </Button>

          <Button
            size="small"
            onClick={() => updateStatus(r, "processing")}
            disabled={r.status === "resolved" || r.status === "processing"}
          >
            Đang xử lý
          </Button>

          <Button
            size="small"
            type="primary"
            onClick={() => updateStatus(r, "resolved")}
            disabled={r.status === "resolved"}
          >
            Đã xử lý
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Theo dõi SOS</h2>
        <p className="text-gray-500">
          Danh sách tín hiệu khẩn cấp từ người dùng
        </p>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Space>
            <span className="text-sm text-gray-600">Trạng thái</span>
            <Select
              placeholder="Tất cả"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              allowClear
              style={{ width: 220 }}
            >
              <Select.Option value="pending">
                {statusToVi("pending")}
              </Select.Option>
              <Select.Option value="processing">
                {statusToVi("processing")}
              </Select.Option>
              <Select.Option value="resolved">
                {statusToVi("resolved")}
              </Select.Option>
            </Select>
          </Space>

          <Button onClick={fetchAlerts}>Tải lại</Button>
        </div>

        <Table
          size="small"
          tableLayout="fixed"
          rowKey="alert_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`,
            onChange: (page, pageSize) => {
              setPagination((p) => ({
                ...p,
                current: page,
                pageSize: pageSize || p.pageSize,
              }));
            },
          }}
          scroll={{ x: 1100, y: 640 }}
        />
      </Card>

      <Modal
        title={
          selected ? `Chi tiết SOS • #${selected.alert_id}` : "Chi tiết SOS"
        }
        open={detailOpen}
        onCancel={closeDetails}
        centered
        footer={
          <Space>
            <Button onClick={closeDetails}>Đóng</Button>
          </Space>
        }
        width={760}
        destroyOnHidden
        styles={{ body: { padding: 0 } }}
      >
        {selected ? (
          <div className="p-3">
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="relative h-[320px] sm:h-[360px]">
                <MapContainer
                  center={
                    selectedPos
                      ? [selectedPos.lat, selectedPos.lng]
                      : [VIETNAM_CENTER.lat, VIETNAM_CENTER.lng]
                  }
                  zoom={selectedPos ? 16 : 6}
                  minZoom={6}
                  maxZoom={19}
                  maxBounds={VIETNAM_BOUNDS}
                  maxBoundsViscosity={1.0}
                  worldCopyJump={false}
                  scrollWheelZoom
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapAttach mapRef={mapRef} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />

                  {routeLine && routeLine.length >= 2 ? (
                    <Polyline
                      positions={routeLine.map((p) => [p.lat, p.lng])}
                      pathOptions={{ color: "#2563eb", weight: 5 }}
                    />
                  ) : null}

                  {selectedPos ? (
                    <Marker position={[selectedPos.lat, selectedPos.lng]} />
                  ) : null}

                  {myPos ? <Marker position={[myPos.lat, myPos.lng]} /> : null}
                </MapContainer>
              </div>

              <div className="border-t bg-slate-900 px-4 py-3 text-sm text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {selected.user_name || "Người dùng"}
                  </div>
                  <Tag color={statusColor[selected.status] || "default"}>
                    {statusToVi(selected.status)}
                  </Tag>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="small"
                    onClick={requestMyLocation}
                    loading={locating}
                  >
                    Lấy vị trí của tôi
                  </Button>
                  {myPos && selectedPos ? (
                    <div className="text-xs text-white/80">
                      Khoảng cách:{" "}
                      {formatDistance(
                        routeInfo?.distanceM ??
                          haversineMeters(myPos, selectedPos),
                      )}
                      {routeInfo?.durationS != null
                        ? ` • Thời gian: ${formatDuration(routeInfo.durationS)}`
                        : ""}
                      {routeInfo?.source === "osrm" ? " • (OSRM)" : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-white/70">
                      Chọn “Lấy vị trí của tôi” để xem đường đi
                    </div>
                  )}
                </div>

                <div className="mt-1 text-xs text-white/70">
                  {selected.user_phone || "-"}
                </div>

                <div className="mt-2 space-y-1">
                  <div>
                    <span className="text-white/70">Vị trí mô tả:</span>{" "}
                    {selected.location_text || "-"}
                  </div>
                  <div>
                    <span className="text-white/70">Tọa độ:</span>{" "}
                    {selectedPos
                      ? `${selectedPos.lat.toFixed(
                          6,
                        )}, ${selectedPos.lng.toFixed(6)}`
                      : "-"}
                  </div>
                  <div>
                    <span className="text-white/70">Nội dung:</span>{" "}
                    <Typography.Text className="text-white">
                      {selected.message || "-"}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </MainLayout>
  );
};

export default SosAlerts;
