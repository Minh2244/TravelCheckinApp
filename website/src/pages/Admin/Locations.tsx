import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getPinIconByKind } from "../../utils/leafletPinIcons";
import { isLatLngValid, parseLatLngMaybeSwap } from "../../utils/latLng";

type LatLng = { lat: number; lng: number };

const MapResizeFix = ({ trigger }: { trigger: string }) => {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);
    return () => window.clearTimeout(t);
  }, [map, trigger]);
  return null;
};

const MapFlyTo = ({ center, zoom }: { center: LatLng; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (!isLatLngValid(center)) return;
    // Leaflet can throw if called before the map is fully ready
    // (and React StrictMode may mount effects twice in dev).
    const run = () => {
      try {
        map.flyTo([center.lat, center.lng], zoom, { duration: 0.6 });
      } catch (err) {
        // Don't surface a misleading toast; just avoid crashing the page.
        console.warn("Leaflet flyTo failed", err);
      }
    };

    map.whenReady(run);
  }, [map, center, zoom]);
  return null;
};

type LocationStatus = "pending" | "active" | "inactive";

interface AdminLocationRow {
  location_id: number;
  owner_id: number;
  owner_name: string | null;
  owner_email: string | null;
  commission_rate?: number | string | null;
  location_name: string;
  location_type: string;
  first_image?: string | null;
  address: string;
  province: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  opening_hours?: unknown;
  status: LocationStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface DuplicatePair {
  source: AdminLocationRow;
  target: AdminLocationRow;
  distance_m: number;
  similarity: number;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const statusTag = (row: AdminLocationRow) => {
  if (row.status === "pending") return <Tag color="gold">Chờ duyệt</Tag>;
  if (row.status === "active") return <Tag color="green">Đã duyệt</Tag>;
  if (row.status === "inactive") {
    const isRejected = Boolean(String(row.rejection_reason || "").trim());
    return isRejected ? (
      <Tag color="red">Từ chối</Tag>
    ) : (
      <Tag color="default">Tạm ẩn</Tag>
    );
  }
  return <Tag>{row.status}</Tag>;
};

const formatOpeningHours = (v: unknown): string | null => {
  if (!v) return null;
  let obj: unknown = v;
  if (typeof v === "string") {
    try {
      obj = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const open = String(rec.open ?? "").trim();
  const close = String(rec.close ?? "").trim();
  if (!open || !close) return null;
  return `${open} - ${close}`;
};

const Locations = () => {
  const LIST_LIMIT = 200;
  const LIST_SCROLL_Y = 520;

  const [rows, setRows] = useState<AdminLocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<LocationStatus>("pending");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingLocationId, setRejectingLocationId] = useState<number | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupRows, setDupRows] = useState<DuplicatePair[]>([]);

  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionEditing, setCommissionEditing] =
    useState<AdminLocationRow | null>(null);
  const [commissionNewRate, setCommissionNewRate] = useState<number | null>(
    null,
  );
  const [commissionSaving, setCommissionSaving] = useState(false);

  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<{
    name: string;
    lat: number;
    lng: number;
    address?: string | null;
  } | null>(null);

  const mapCenter = useMemo(() => {
    if (!mapTarget) return null;
    return parseLatLngMaybeSwap(mapTarget.lat, mapTarget.lng);
  }, [mapTarget]);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: 1,
        limit: LIST_LIMIT,
        status: statusFilter,
      };
      if (searchText.trim()) params.search = searchText.trim();

      const resp = await adminApi.getLocations(params);
      if (resp?.success) {
        setRows(resp.data || []);
        setPagination((p) => ({
          ...p,
          total: resp.pagination?.total || 0,
        }));
      } else {
        message.error(resp?.message || "Không thể tải danh sách địa điểm");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi tải danh sách địa điểm"));
    } finally {
      setLoading(false);
    }
  }, [LIST_LIMIT, searchText, statusFilter]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  const onApprove = async (locationId: number) => {
    try {
      const resp = await adminApi.approveLocation(locationId);
      if (resp?.success) {
        message.success("Duyệt địa điểm thành công");
        await fetchLocations();
      } else {
        message.error(resp?.message || "Duyệt địa điểm thất bại");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi duyệt địa điểm"));
    }
  };

  const onHide = async (locationId: number) => {
    try {
      const resp = await adminApi.hideLocation(locationId);
      if (resp?.success) {
        message.success("Đã tạm ẩn địa điểm");
        await fetchLocations();
      } else {
        message.error(resp?.message || "Tạm ẩn thất bại");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi tạm ẩn địa điểm"));
    }
  };

  const onShowAgain = async (locationId: number) => {
    // Reuse approve endpoint as "mở lại"
    await onApprove(locationId);
  };

  const openReject = (locationId: number) => {
    setRejectingLocationId(locationId);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const onRejectConfirm = async () => {
    if (!rejectingLocationId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      const resp = await adminApi.rejectLocation(rejectingLocationId, reason);
      if (resp?.success) {
        message.success("Từ chối địa điểm thành công");
        setRejectModalOpen(false);
        setRejectingLocationId(null);
        setRejectReason("");
        await fetchLocations();
      } else {
        message.error(resp?.message || "Từ chối địa điểm thất bại");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi từ chối địa điểm"));
    }
  };

  const onDelete = async (locationId: number) => {
    try {
      const resp = await adminApi.deleteLocation(locationId);
      if (resp?.success) {
        message.success("Xóa địa điểm thành công");
        await fetchLocations();
      } else {
        message.error(resp?.message || "Xóa địa điểm thất bại");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi xóa địa điểm"));
    }
  };

  const openMap = useCallback((r: AdminLocationRow) => {
    const parsed = parseLatLngMaybeSwap(r.latitude, r.longitude);
    if (!parsed) {
      message.warning("Địa điểm chưa có tọa độ hợp lệ để xem vị trí");
      return;
    }

    setMapTarget({
      name: r.location_name,
      lat: parsed.lat,
      lng: parsed.lng,
      address: r.address || null,
    });
    setMapModalOpen(true);
  }, []);

  const fetchDuplicates = useCallback(async () => {
    setDupLoading(true);
    try {
      const resp = await adminApi.getLocationDuplicates();
      if (resp?.success) {
        setDupRows(resp.data || []);
      } else {
        message.error(resp?.message || "Không thể lấy danh sách trùng");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi lấy danh sách trùng"));
    } finally {
      setDupLoading(false);
    }
  }, []);

  const handleMerge = useCallback(
    async (sourceId: number, targetId: number) => {
      try {
        const resp = await adminApi.mergeLocations({
          source_id: sourceId,
          target_id: targetId,
        });
        if (resp?.success) {
          message.success("Đã gộp địa điểm");
          void fetchDuplicates();
          void fetchLocations();
        } else {
          message.error(resp?.message || "Gộp thất bại");
        }
      } catch (err: unknown) {
        message.error(getApiErrorMessage(err, "Lỗi gộp địa điểm"));
      }
    },
    [fetchDuplicates, fetchLocations],
  );

  const openCommissionModal = useCallback((r: AdminLocationRow) => {
    const current = Number(r.commission_rate);
    setCommissionEditing(r);
    setCommissionNewRate(Number.isFinite(current) ? current : 2.5);
    setCommissionModalOpen(true);
  }, []);

  const saveCommissionRate = async () => {
    if (!commissionEditing) return;
    const rate = Number(commissionNewRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      message.warning("Tỷ lệ hoa hồng không hợp lệ");
      return;
    }

    try {
      setCommissionSaving(true);
      const resp = await adminApi.updateLocationCommissionRate(
        commissionEditing.location_id,
        rate,
      );
      if (resp?.success) {
        message.success(resp?.message || "Đã cập nhật hoa hồng địa điểm");
        setCommissionModalOpen(false);
        setCommissionEditing(null);
        await fetchLocations();
      } else {
        message.error(resp?.message || "Cập nhật hoa hồng thất bại");
      }
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Lỗi cập nhật hoa hồng"));
    } finally {
      setCommissionSaving(false);
    }
  };

  const columns: ColumnsType<AdminLocationRow> = [
    {
      title: "Ảnh",
      key: "first_image",
      width: 90,
      render: (_: unknown, r) => {
        const src = resolveBackendUrl(r.first_image);
        if (!src) return <span className="text-gray-400">-</span>;

        return (
          <Image
            src={src}
            alt={r.location_name}
            width={64}
            height={48}
            style={{ objectFit: "cover", borderRadius: 6 }}
          />
        );
      },
    },
    {
      title: "Địa điểm",
      dataIndex: "location_name",
      key: "location_name",
      render: (v: string, r) => (
        <div className="whitespace-normal break-words">
          <div className="font-semibold text-gray-800">{v}</div>
          <div className="text-xs text-gray-500">{r.location_type}</div>
        </div>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      render: (_: unknown, r) => (
        <div className="whitespace-normal break-words">
          <div className="text-gray-800">{r.owner_name || "(Không rõ)"}</div>
          <div className="text-xs text-gray-500">{r.owner_email || ""}</div>
        </div>
      ),
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
      render: (v: string, r) => (
        <div className="whitespace-normal break-words">
          <div className="text-gray-800">{v}</div>
          <div className="text-xs text-gray-500">{r.province || ""}</div>
        </div>
      ),
    },
    {
      title: "Giờ mở/đóng",
      key: "opening_hours",
      width: 130,
      render: (_: unknown, r) => {
        const text = formatOpeningHours(r.opening_hours);
        return text ? (
          <span className="text-gray-700">{text}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (_: LocationStatus, r) => statusTag(r),
    },
    {
      title: "Hoa hồng",
      key: "commission_rate",
      width: 110,
      render: (_: unknown, r) => {
        const rate = Number(r.commission_rate);
        return (
          <Tag color="blue">{Number.isFinite(rate) ? `${rate}%` : "2.5%"}</Tag>
        );
      },
    },
    {
      title: "Ghi chú",
      dataIndex: "rejection_reason",
      key: "rejection_reason",
      render: (v: string | null, r) => {
        if (r.status !== "inactive")
          return <span className="text-gray-400">-</span>;
        const note = String(v || "").trim();
        if (note)
          return (
            <span className="whitespace-normal break-words text-gray-700">
              {note}
            </span>
          );
        return <span className="text-gray-500">(Tạm ẩn)</span>;
      },
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_: unknown, r) => (
        <Space size={6} wrap={false} className="whitespace-nowrap">
          <Button
            size="small"
            icon={<EnvironmentOutlined />}
            onClick={() => openMap(r)}
          >
            Vị trí
          </Button>

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openCommissionModal(r)}
          >
            Hoa hồng
          </Button>

          {r.status === "pending" ? (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => onApprove(r.location_id)}
              >
                Duyệt
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => openReject(r.location_id)}
              >
                Từ chối
              </Button>
            </>
          ) : null}

          {r.status === "active" ? (
            <Popconfirm
              title="Tạm ẩn địa điểm"
              description="Địa điểm sẽ bị tạm ẩn khỏi hệ thống cho đến khi bạn mở lại."
              okText="Tạm ẩn"
              cancelText="Hủy"
              onConfirm={() => onHide(r.location_id)}
            >
              <Button size="small" icon={<EyeInvisibleOutlined />}>
                Tạm ẩn
              </Button>
            </Popconfirm>
          ) : null}

          {r.status === "inactive" ? (
            <Popconfirm
              title="Mở lại địa điểm"
              okText="Mở lại"
              cancelText="Hủy"
              onConfirm={() => onShowAgain(r.location_id)}
            >
              <Button size="small" type="primary" icon={<EyeOutlined />}>
                Mở lại
              </Button>
            </Popconfirm>
          ) : null}

          <Popconfirm
            title="Xóa địa điểm"
            description="Bạn có chắc chắn muốn xóa địa điểm này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => onDelete(r.location_id)}
          >
            <Button size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const duplicateColumns: ColumnsType<DuplicatePair> = useMemo(
    () => [
      {
        title: "Nguồn",
        key: "source",
        render: (_: unknown, r) => (
          <div>
            <div className="font-semibold text-gray-800">
              {r.source.location_name}
            </div>
            <div className="text-xs text-gray-500">
              #{r.source.location_id} · {r.source.address}
            </div>
          </div>
        ),
      },
      {
        title: "Đích",
        key: "target",
        render: (_: unknown, r) => (
          <div>
            <div className="font-semibold text-gray-800">
              {r.target.location_name}
            </div>
            <div className="text-xs text-gray-500">
              #{r.target.location_id} · {r.target.address}
            </div>
          </div>
        ),
      },
      {
        title: "Khoảng cách",
        dataIndex: "distance_m",
        key: "distance_m",
        render: (v: number) => `${v} m`,
      },
      {
        title: "Độ giống",
        dataIndex: "similarity",
        key: "similarity",
      },
      {
        title: "Hành động",
        key: "actions",
        render: (_: unknown, r) => (
          <Popconfirm
            title="Gộp địa điểm"
            description="Bạn có chắc chắn muốn gộp?"
            okText="Gộp"
            cancelText="Hủy"
            onConfirm={() =>
              handleMerge(r.source.location_id, r.target.location_id)
            }
          >
            <Button type="primary">Gộp</Button>
          </Popconfirm>
        ),
      },
    ],
    [handleMerge],
  );

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Duyệt Địa điểm</h2>
        <p className="text-gray-500">
          Duyệt / từ chối các địa điểm do Owner gửi lên
        </p>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Tìm theo tên, địa chỉ, tỉnh, owner..."
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
            value={statusFilter}
            onChange={(v: LocationStatus) => {
              setStatusFilter(v);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
            style={{ width: 200 }}
            options={[
              { value: "pending", label: "Chờ duyệt" },
              { value: "active", label: "Đã duyệt" },
              { value: "inactive", label: "Từ chối" },
            ]}
          />

          <Button icon={<ReloadOutlined />} onClick={() => fetchLocations()}>
            Làm mới
          </Button>

          <Button
            icon={<SearchOutlined />}
            onClick={() => {
              setDupModalOpen(true);
              fetchDuplicates();
            }}
          >
            Tìm địa điểm trùng
          </Button>

          <div className="flex-1" />

          <Typography.Text type="secondary">
            Tổng: {pagination.total}
          </Typography.Text>
        </div>

        <Table
          tableLayout="auto"
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="location_id"
          pagination={false}
          scroll={{ y: LIST_SCROLL_Y }}
        />
      </Card>

      <Modal
        title="Từ chối địa điểm"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={onRejectConfirm}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Typography.Paragraph type="secondary" className="mb-2">
          Nhập lý do để Owner biết và chỉnh sửa.
        </Typography.Paragraph>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Ví dụ: Thiếu hình ảnh, địa chỉ không rõ ràng..."
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
      </Modal>

      <Modal
        title="Gộp địa điểm trùng"
        open={dupModalOpen}
        onCancel={() => setDupModalOpen(false)}
        footer={null}
        width={900}
      >
        <Table
          columns={duplicateColumns}
          dataSource={dupRows}
          loading={dupLoading}
          rowKey={(r) => `${r.source.location_id}-${r.target.location_id}`}
          pagination={{ pageSize: 8 }}
        />
      </Modal>

      <Modal
        title={
          commissionEditing
            ? `Hoa hồng: ${commissionEditing.location_name}`
            : "Cập nhật hoa hồng"
        }
        open={commissionModalOpen}
        onCancel={() => {
          setCommissionModalOpen(false);
          setCommissionEditing(null);
        }}
        onOk={() => void saveCommissionRate()}
        okText="Lưu"
        confirmLoading={commissionSaving}
        cancelText="Hủy"
      >
        <Typography.Paragraph type="secondary" className="mb-2">
          Thiết lập % hoa hồng áp dụng cho địa điểm này (từ các payment mới).
        </Typography.Paragraph>
        <InputNumber
          min={0.01}
          max={100}
          value={commissionNewRate ?? undefined}
          onChange={(v) => setCommissionNewRate(v == null ? null : Number(v))}
          addonAfter="%"
          style={{ width: 220 }}
        />
      </Modal>

      <Modal
        title={mapTarget ? `Vị trí: ${mapTarget.name}` : "Vị trí"}
        open={mapModalOpen}
        onCancel={() => {
          setMapModalOpen(false);
          setMapTarget(null);
        }}
        footer={null}
        width={820}
      >
        {mapTarget ? (
          <div>
            {mapTarget.address ? (
              <div className="text-sm text-gray-700 mb-2">
                {mapTarget.address}
              </div>
            ) : null}
            <div className="text-sm text-gray-700 mb-3">
              Tọa độ: {mapTarget.lat}, {mapTarget.lng}
            </div>

            {mapCenter ? (
              <div className="overflow-hidden rounded-lg border">
                <MapContainer
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={16}
                  style={{ height: 420, width: "100%" }}
                  doubleClickZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapResizeFix
                    trigger={`${mapModalOpen}-${mapCenter.lat}-${mapCenter.lng}`}
                  />
                  <MapFlyTo center={mapCenter} zoom={16} />
                  <Marker
                    position={[mapCenter.lat, mapCenter.lng]}
                    icon={getPinIconByKind("ownerSelected")}
                  />
                </MapContainer>
              </div>
            ) : (
              <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                Địa điểm này chưa có tọa độ hợp lệ để hiển thị bản đồ.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </MainLayout>
  );
};

export default Locations;
