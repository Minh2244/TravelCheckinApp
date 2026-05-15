import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { CheckinItem } from "../../types/user.types";

type LatLng = { lat: number; lng: number };
type TimelinePoint = {
  checkin_id: number;
  location_name: string;
  checkin_time: string;
  status: "pending" | "verified" | "failed";
  coords: LatLng;
};

const normalizeNumber = (value: number | string | null | undefined) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const History = () => {
  const [items, setItems] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await userApi.getCheckins();
        setItems(response.data ?? []);
      } catch {
        setError("Không thể tải lịch sử check-in");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const timelinePoints = useMemo<TimelinePoint[]>(() => {
    const mapped = items.map((item) => {
      const lat = normalizeNumber(item.checkin_latitude);
      const lng = normalizeNumber(item.checkin_longitude);
      if (lat == null || lng == null) return null;
      return {
        checkin_id: item.checkin_id,
        location_name: item.location_name,
        checkin_time: item.checkin_time,
        status: item.status,
        coords: { lat, lng } as LatLng,
      };
    });
    const isTimelinePoint = (
      item: TimelinePoint | null,
    ): item is TimelinePoint => item != null;
    return mapped
      .filter(isTimelinePoint)
      .sort(
        (a, b) =>
          new Date(a.checkin_time).getTime() -
          new Date(b.checkin_time).getTime(),
      );
  }, [items]);

  const polyline = useMemo(() => {
    return timelinePoints.map((p) => [p.coords.lat, p.coords.lng]) as Array<
      [number, number]
    >;
  }, [timelinePoints]);

  const exportCsv = () => {
    const headers = [
      "checkin_id",
      "location_name",
      "checkin_time",
      "status",
      "latitude",
      "longitude",
    ];
    const rows = items.map((item) => [
      item.checkin_id,
      item.location_name,
      item.checkin_time,
      item.status,
      item.checkin_latitude ?? "",
      item.checkin_longitude ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <UserLayout title="Lịch sử" activeKey="/user/history">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Lịch sử check-in
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Xem lại các điểm đã check-in, tuyến đường đã đi và xuất báo cáo nhanh.
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Đang tải dữ liệu lịch sử...
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
            Chưa có dữ liệu lịch sử check-in từ hệ thống.
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600">
            Tổng lượt check-in: <strong>{items.length}</strong>
          </p>
          <button
            type="button"
            className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
            onClick={exportCsv}
            disabled={items.length === 0}
          >
            Xuất báo cáo CSV
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-gray-100 overflow-hidden">
          {timelinePoints.length > 0 ? (
            <MapContainer
              center={[
                timelinePoints[0].coords.lat,
                timelinePoints[0].coords.lng,
              ]}
              zoom={12}
              className="h-[360px] w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {polyline.length > 1 ? (
                <Polyline
                  positions={polyline}
                  pathOptions={{ color: "#2563eb", weight: 4 }}
                />
              ) : null}
              {timelinePoints.map((point, index) => (
                <Marker
                  key={point.checkin_id}
                  position={[point.coords.lat, point.coords.lng]}
                >
                  <Popup>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {point.location_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        #{index + 1} ·{" "}
                        {new Date(point.checkin_time).toLocaleString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="p-6 text-sm text-gray-500 text-center">
              Chưa có đủ dữ liệu tọa độ để hiển thị tuyến đường.
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.checkin_id}
              className="flex items-center justify-between rounded-2xl border border-gray-100 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {item.location_name}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(item.checkin_time).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </UserLayout>
  );
};

export default History;
