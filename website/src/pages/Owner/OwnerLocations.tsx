import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Card,
  Form,
  Image,
  Upload,
  Input,
  InputNumber,
  TimePicker,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs, { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { getPinIconByKind } from "../../utils/leafletPinIcons";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { isLatLngValid, parseLatLngMaybeSwap } from "../../utils/latLng";
import { statusToVi } from "../../utils/statusText";
import { locationTypeToVi } from "../../utils/locationTypeText";
import { asRecord, getErrorMessage } from "../../utils/safe";
import geoApi from "../../api/geoApi";

type LatLng = { lat: number; lng: number };

type LocationRow = {
  location_id: number;
  location_name?: string | null;
  location_type?: string | null;
  address?: string | null;
  province?: string | null;
  description?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone?: string | null;
  email?: string | null;
  opening_hours?: unknown;
  status: string;
  previous_status?: string | null;
  commission_rate?: number | string | null;
  images?: unknown;
};

const DEFAULT_CENTER: LatLng = { lat: 10.776889, lng: 106.700806 };

const MapResizeFix = ({ trigger }: { trigger: unknown }) => {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => window.clearTimeout(t);
  }, [map, trigger]);
  return null;
};

const MapFlyTo = ({
  center,
  zoom,
}: {
  center: LatLng | null;
  zoom?: number;
}) => {
  const map = useMap();
  useEffect(() => {
    if (!center) return;

    if (!isLatLngValid(center)) return;

    const z = typeof zoom === "number" ? zoom : map.getZoom();
    if (!Number.isFinite(z)) return;

    const run = () => {
      try {
        map.setView([center.lat, center.lng], z, { animate: true });
      } catch (error) {
        console.warn(
          "[Owner/OwnerLocations] map.setView failed",
          error,
          center,
          z,
        );
      }
    };

    map.whenReady(run);
  }, [map, center, zoom]);
  return null;
};

const LocationPicker = ({ onPick }: { onPick: (pos: LatLng) => void }) => {
  useMapEvents({
    dblclick: (e) => {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const normalizeLocationImages = (v: unknown): string[] => {
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

const parseOpenCloseFromOpeningHours = (
  v: unknown,
): { open: string | null; close: string | null } => {
  if (!v) return { open: null, close: null };
  let obj: unknown = v;
  if (typeof v === "string") {
    try {
      obj = JSON.parse(v);
    } catch {
      return { open: null, close: null };
    }
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const rec = obj as Record<string, unknown>;
    const open = String(rec.open ?? "").trim();
    const close = String(rec.close ?? "").trim();
    return {
      open: open || null,
      close: close || null,
    };
  }
  return { open: null, close: null };
};

const toTimeValue = (v: string | null): Dayjs | null => {
  if (!v) return null;
  const d = dayjs(v, "HH:mm", true);
  return d.isValid() ? d : null;
};

const extractFilesFromUploadList = (value: unknown): File[] => {
  if (!Array.isArray(value)) return [];
  const files: File[] = [];
  value.forEach((item) => {
    const file = (item as UploadFile)?.originFileObj;
    if (file instanceof File) {
      files.push(file);
    }
  });
  return files;
};

const OwnerLocations = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LocationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [createImageFileList, setCreateImageFileList] = useState<UploadFile[]>(
    [],
  );
  const [createImagePreviewUrls, setCreateImagePreviewUrls] = useState<
    string[]
  >([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<string[]>(
    [],
  );

  const [defaultEmail, setDefaultEmail] = useState<string>("");
  const [defaultPhone, setDefaultPhone] = useState<string>("");

  const [picked, setPicked] = useState<LatLng | null>(null);
  const [pickedDraft, setPickedDraft] = useState<LatLng | null>(null);
  const [createStep, setCreateStep] = useState<"pick" | "form">("pick");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [viewMapOpen, setViewMapOpen] = useState(false);
  const [viewRow, setViewRow] = useState<LocationRow | null>(null);
  const [autoAddress, setAutoAddress] = useState<string>("");
  const [autoProvince, setAutoProvince] = useState<string>("");
  const reverseReqId = useRef(0);
  const mapSearchReqId = useRef(0);
  const mapSearchTimer = useRef<number | null>(null);

  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapSearchOptions, setMapSearchOptions] = useState<
    { value: string; label: string; lat: number; lng: number }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getLocations();
      setItems((res?.data || []) as LocationRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải địa điểm"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const nextUrls: string[] = [];
    createImageFileList.forEach((item) => {
      const file = item.originFileObj;
      if (file instanceof Blob) {
        nextUrls.push(URL.createObjectURL(file));
      }
    });

    setCreateImagePreviewUrls(nextUrls);
    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [createImageFileList]);

  useEffect(() => {
    // Prefill contact email from current owner account
    ownerApi
      .getMe()
      .then((res) => {
        const email = String(res?.data?.actor?.email || "").trim();
        if (email) setDefaultEmail(email);
        const phone = String(res?.data?.actor?.phone || "").trim();
        if (phone) setDefaultPhone(phone);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const statusTag = (s: string) => {
    const color = s === "active" ? "green" : s === "pending" ? "orange" : "red";
    return <Tag color={color}>{statusToVi(s)}</Tag>;
  };

  const onCreate = () => {
    if (!defaultPhone) {
      Modal.warning({
        title: "Cần cập nhật số điện thoại",
        content:
          "Bạn cần cập nhật SĐT trong Thông tin cá nhân trước khi tạo địa điểm.",
        okText: "Đến Thông tin cá nhân",
        onOk: () => navigate("/owner/profile"),
      });
      return;
    }
    setEditing(null);
    form.resetFields();
    if (defaultEmail) {
      form.setFieldsValue({ email: defaultEmail });
    }
    if (defaultPhone) {
      form.setFieldsValue({ phone: defaultPhone });
    }
    setPicked(null);
    setPickedDraft(null);
    setCreateStep("pick");
    setCreateImageFileList([]);
    setExistingGalleryImages([]);
    setOpen(true);
  };

  const onEdit = useCallback(
    (row: LocationRow) => {
      setEditing(row);
      const oc = parseOpenCloseFromOpeningHours(row.opening_hours);
      form.setFieldsValue({
        location_name: row.location_name,
        location_type: row.location_type,
        address: row.address,
        province: row.province,
        description: row.description,
        latitude: row.latitude,
        longitude: row.longitude,
        phone: row.phone,
        email: row.email,
        opening_open: toTimeValue(oc.open),
        opening_close: toTimeValue(oc.close),
      });
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      setPicked(
        Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
      );
      setPickedDraft(null);
      setCreateStep("form");
      setCreateImageFileList([]);
      setExistingGalleryImages(normalizeLocationImages(row.images));
      setOpen(true);
    },
    [form],
  );

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      message.error("Trình duyệt không hỗ trợ định vị");
      return;
    }

    if (!window.isSecureContext) {
      // Geolocation often requires HTTPS, but localhost is usually allowed.
      const host = window.location.hostname;
      if (host !== "localhost" && host !== "127.0.0.1") {
        message.error(
          "Không thể lấy vị trí: trang cần chạy HTTPS (hoặc localhost) để dùng định vị.",
        );
        return;
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!editing && createStep === "pick") {
          // Chỉ đưa bản đồ về vị trí hiện tại, KHÔNG tự chuyển bước
          setPickedDraft(p);
          form.setFieldsValue({ latitude: p.lat, longitude: p.lng });
          void reverseGeocode(p);
          return;
        }
        setPicked(p);
        form.setFieldsValue({ latitude: p.lat, longitude: p.lng });
        void reverseGeocode(p);
      },
      (err: GeolocationPositionError) => {
        const code = err.code;
        if (code === 1) {
          message.error(
            "Bạn đã từ chối quyền vị trí. Hãy bật Location permission cho trang và thử lại.",
          );
          return;
        }
        if (code === 2) {
          message.error(
            "Không thể xác định vị trí (tín hiệu GPS/mạng). Thử lại hoặc chọn trên bản đồ.",
          );
          return;
        }
        if (code === 3) {
          message.error(
            "Lấy vị trí bị timeout. Thử lại hoặc chọn trên bản đồ.",
          );
          return;
        }
        message.error("Không lấy được vị trí hiện tại");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const reverseGeocode = async (pos: LatLng) => {
    const id = ++reverseReqId.current;
    try {
      const data = await geoApi.reverse(pos.lat, pos.lng);
      if (id !== reverseReqId.current) return;
      const displayName = data.display_name || "";
      const address = data.address || {};
      const province =
        address.state ||
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        "";

      const currentAddress = String(form.getFieldValue("address") || "").trim();
      const currentProvince = String(
        form.getFieldValue("province") || "",
      ).trim();

      if (!currentAddress || currentAddress === autoAddress) {
        if (displayName) {
          form.setFieldsValue({ address: displayName });
          setAutoAddress(displayName);
        }
      }

      if (!currentProvince || currentProvince === autoProvince) {
        if (province) {
          form.setFieldsValue({ province });
          setAutoProvince(province);
        }
      }
    } catch {
      // ignore
    }
  };

  const confirmPickedDraft = () => {
    if (!pickedDraft) {
      message.info("Bạn chưa chọn vị trí.");
      return;
    }
    setPicked(pickedDraft);
    form.setFieldsValue({
      latitude: pickedDraft.lat,
      longitude: pickedDraft.lng,
    });
    void reverseGeocode(pickedDraft);
    setCreateStep("form");
    setMapModalOpen(false);
  };

  const searchPlaces = (q: string) => {
    const query = String(q || "").trim();
    if (!query) {
      if (mapSearchTimer.current) {
        window.clearTimeout(mapSearchTimer.current);
        mapSearchTimer.current = null;
      }
      setMapSearchOptions([]);
      setMapSearchLoading(false);
      return;
    }

    if (mapSearchTimer.current) {
      window.clearTimeout(mapSearchTimer.current);
      mapSearchTimer.current = null;
    }

    const reqId = ++mapSearchReqId.current;
    setMapSearchLoading(true);
    mapSearchTimer.current = window.setTimeout(async () => {
      try {
        const json = await geoApi.search(query, 6);
        if (reqId !== mapSearchReqId.current) return;
        const opts = (Array.isArray(json) ? json : [])
          .map((r) => {
            const rec = asRecord(r);
            const lat = Number(rec.lat);
            const lng = Number(rec.lon);
            const label = String(rec.display_name || "").trim();
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label)
              return null;
            return {
              value: `${lat},${lng}`,
              label,
              lat,
              lng,
            };
          })
          .filter(Boolean) as {
          value: string;
          label: string;
          lat: number;
          lng: number;
        }[];
        setMapSearchOptions(opts);
      } catch {
        if (reqId !== mapSearchReqId.current) return;
        setMapSearchOptions([]);
      } finally {
        if (reqId !== mapSearchReqId.current) return;
        setMapSearchLoading(false);
      }
    }, 350);
  };

  const applySearchedPosition = (pos: LatLng, displayName?: string) => {
    if (!editing && createStep === "pick") {
      setPickedDraft(pos);
      form.setFieldsValue({ latitude: pos.lat, longitude: pos.lng });
      if (displayName) {
        const trimmed = displayName.trim();
        if (trimmed && (!autoAddress || autoAddress === trimmed)) {
          form.setFieldsValue({ address: trimmed });
          setAutoAddress(trimmed);
        }
      }
      void reverseGeocode(pos);
      return;
    }

    setPicked(pos);
    form.setFieldsValue({ latitude: pos.lat, longitude: pos.lng });
    if (displayName) {
      const trimmed = displayName.trim();
      if (trimmed && (!autoAddress || autoAddress === trimmed)) {
        form.setFieldsValue({ address: trimmed });
        setAutoAddress(trimmed);
      }
    }
    void reverseGeocode(pos);
  };

  const onSave = async () => {
    try {
      const values = (await form.validateFields()) as Record<
        string,
        unknown
      > & {
        image?: UploadFile[];
        opening_open?: Dayjs | null;
        opening_close?: Dayjs | null;
      };

      const openStr = dayjs.isDayjs(values.opening_open)
        ? values.opening_open.format("HH:mm")
        : null;
      const closeStr = dayjs.isDayjs(values.opening_close)
        ? values.opening_close.format("HH:mm")
        : null;

      if ((openStr && !closeStr) || (!openStr && closeStr)) {
        message.error("Vui lòng chọn đủ giờ mở cửa và giờ đóng cửa");
        return;
      }

      const opening_hours =
        openStr && closeStr ? { open: openStr, close: closeStr } : null;

      setSaving(true);
      if (editing) {
        const payload: Record<string, unknown> = { ...values };
        delete payload.image;
        delete payload.images;
        delete payload.opening_open;
        delete payload.opening_close;
        payload.opening_hours = opening_hours;

        const selectedFiles = extractFilesFromUploadList(values.images);

        if (selectedFiles.length > 0) {
          const fd = new FormData();
          selectedFiles.forEach((file) => fd.append("images", file));
          fd.append("existing_images", JSON.stringify(existingGalleryImages));
          Object.entries(payload).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (k === "opening_hours") {
              fd.append(k, JSON.stringify(v));
              return;
            }
            fd.append(k, String(v));
          });
          await ownerApi.updateLocation(editing.location_id, fd);
        } else {
          payload.images = existingGalleryImages;
          await ownerApi.updateLocation(editing.location_id, payload);
        }
        message.success("Đã cập nhật địa điểm");
      } else {
        const fileObjects = extractFilesFromUploadList(values.images);
        if (fileObjects.length === 0) {
          message.error("Vui lòng upload ít nhất 1 ảnh địa điểm");
          return;
        }

        const fd = new FormData();
        fileObjects.forEach((file) => fd.append("images", file));
        Object.entries(values as Record<string, unknown>).forEach(([k, v]) => {
          if (k === "images") return;
          if (k === "opening_open" || k === "opening_close") return;
          if (v === undefined || v === null) return;
          fd.append(k, String(v));
        });

        if (opening_hours) {
          fd.append("opening_hours", JSON.stringify(opening_hours));
        }

        await ownerApi.createLocation(fd);
        message.success("Đã tạo địa điểm (chờ duyệt)");
      }
      setOpen(false);
      setCreateImageFileList([]);
      setExistingGalleryImages([]);
      await load();
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi lưu địa điểm"));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = useCallback(
    async (row: LocationRow) => {
      try {
        const next = row.status === "active" ? "inactive" : "active";
        await ownerApi.updateLocationStatus(row.location_id, next);
        message.success("Đã cập nhật trạng thái");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi cập nhật trạng thái"));
      }
    },
    [load],
  );

  const openViewMap = useCallback((row: LocationRow) => {
    setViewRow(row);
    setViewMapOpen(true);
  }, []);

  const viewPos = viewRow
    ? parseLatLngMaybeSwap(viewRow.latitude, viewRow.longitude)
    : null;

  const columns: ColumnsType<LocationRow> = useMemo(
    () => [
      { title: "#", dataIndex: "location_id", width: 80 },
      {
        title: "Ảnh",
        key: "image",
        width: 90,
        render: (_: unknown, row: LocationRow) => {
          const first = normalizeLocationImages(row.images)?.[0];
          if (!first) return <span className="text-gray-400">-</span>;
          const src = resolveBackendUrl(first) || first;
          return (
            <Image
              src={src}
              width={56}
              height={40}
              style={{ objectFit: "cover", borderRadius: 8 }}
              preview={{ mask: "Xem" }}
            />
          );
        },
      },
      { title: "Tên", dataIndex: "location_name" },
      {
        title: "Loại",
        dataIndex: "location_type",
        width: 140,
        render: (v: unknown) => locationTypeToVi(v),
      },
      {
        title: "Giờ mở/đóng",
        key: "opening_hours",
        width: 140,
        render: (_: unknown, row: LocationRow) => {
          const oc = parseOpenCloseFromOpeningHours(row.opening_hours);
          if (!oc.open || !oc.close)
            return <span className="text-gray-400">-</span>;
          return (
            <span className="text-gray-700">
              {oc.open} - {oc.close}
            </span>
          );
        },
      },
      { title: "Tỉnh", dataIndex: "province", width: 120 },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 120,
        render: (s: string) => statusTag(s),
      },
      {
        title: "Hoa hồng",
        dataIndex: "commission_rate",
        width: 110,
        align: "right",
        render: (v: unknown) => {
          const n = Number(v);
          return `${Number.isFinite(n) ? n : 2.5}%`;
        },
      },
      {
        title: "Hành động",
        key: "actions",
        width: 320,
        render: (_: unknown, row: LocationRow) => (
          <Space>
            <Button size="small" onClick={() => openViewMap(row)}>
              Vị trí
            </Button>
            <Button size="small" onClick={() => onEdit(row)}>
              Sửa
            </Button>
            <Button
              size="small"
              onClick={() => navigate(`/owner/location-ops/${row.location_id}`)}
              disabled={row.status !== "active"}
            >
              Cấu hình sơ đồ
            </Button>
            {row.status === "inactive" && row.previous_status === "active" ? (
              <Tooltip title="Địa điểm bị admin tạm ẩn nên owner không thể bật lại.">
                <Button size="small" onClick={() => toggleStatus(row)} disabled>
                  Bị admin tạm ẩn
                </Button>
              </Tooltip>
            ) : (
              <Button
                size="small"
                onClick={() => toggleStatus(row)}
                disabled={row.status === "pending"}
              >
                {row.status === "active" ? "Tắt" : "Bật"}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [navigate, onEdit, openViewMap, toggleStatus],
  );

  return (
    <MainLayout>
      <Card
        title="Địa điểm"
        extra={
          <Button type="primary" onClick={onCreate}>
            Tạo địa điểm
          </Button>
        }
      >
        <Table<LocationRow>
          rowKey="location_id"
          loading={loading}
          dataSource={items}
          columns={columns}
        />
      </Card>

      <Modal
        title={editing ? "Cập nhật địa điểm" : "Tạo địa điểm"}
        open={open}
        onCancel={() => {
          setOpen(false);
          setCreateImageFileList([]);
          setExistingGalleryImages([]);
        }}
        onOk={onSave}
        confirmLoading={saving}
        okText="Lưu"
        width={720}
        okButtonProps={{ disabled: !editing && createStep !== "form" }}
      >
        <Form form={form} layout="vertical">
          {!editing && createStep === "pick" ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    Bước 1: Chọn vị trí trên bản đồ
                  </div>
                  <div className="text-xs text-gray-500">
                    Double-click (bấm 2 lần) lên bản đồ để chọn vị trí.
                  </div>
                </div>
                <Space wrap>
                  <AutoComplete
                    options={mapSearchOptions.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    onSearch={(text) => {
                      void searchPlaces(text);
                    }}
                    onSelect={(value) => {
                      const found = mapSearchOptions.find(
                        (o) => o.value === value,
                      );
                      if (!found) return;
                      applySearchedPosition(
                        { lat: found.lat, lng: found.lng },
                        found.label,
                      );
                    }}
                    style={{ width: 340 }}
                  >
                    <Input
                      placeholder="Tìm nhanh địa điểm..."
                      allowClear
                      suffix={
                        mapSearchLoading ? (
                          <span className="text-xs text-gray-400">...</span>
                        ) : null
                      }
                    />
                  </AutoComplete>
                  <Button size="small" onClick={useMyPosition}>
                    Lấy vị trí hiện tại
                  </Button>
                  <Button size="small" onClick={() => setMapModalOpen(true)}>
                    Phóng to
                  </Button>
                </Space>
              </div>

              <div className="mt-2 overflow-hidden rounded-lg border">
                <MapContainer
                  center={[
                    (pickedDraft ?? picked)?.lat ?? DEFAULT_CENTER.lat,
                    (pickedDraft ?? picked)?.lng ?? DEFAULT_CENTER.lng,
                  ]}
                  zoom={(pickedDraft ?? picked) ? 16 : 12}
                  doubleClickZoom={false}
                  style={{ height: 360, width: "100%" }}
                >
                  <MapResizeFix trigger={`${open}-pick`} />
                  <MapFlyTo
                    center={pickedDraft ?? null}
                    zoom={pickedDraft ? 16 : undefined}
                  />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    onPick={(p) => {
                      setPickedDraft(p);
                      form.setFieldsValue({
                        latitude: p.lat,
                        longitude: p.lng,
                      });
                      void reverseGeocode(p);
                    }}
                  />
                  {pickedDraft || picked ? (
                    <Marker
                      position={[
                        (pickedDraft || picked)!.lat,
                        (pickedDraft || picked)!.lng,
                      ]}
                      icon={getPinIconByKind("picked")}
                    />
                  ) : null}
                </MapContainer>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                {pickedDraft ? (
                  <div className="text-sm text-gray-700">
                    Đã chọn: <strong>{pickedDraft.lat.toFixed(6)}</strong>,{" "}
                    <strong>{pickedDraft.lng.toFixed(6)}</strong>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Chưa chọn vị trí.</div>
                )}
                <Button
                  type="primary"
                  disabled={!pickedDraft}
                  onClick={confirmPickedDraft}
                >
                  Xác nhận vị trí
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Vị trí trên bản đồ</div>
                <Space>
                  {!editing ? (
                    <Button
                      size="small"
                      onClick={() => {
                        setPickedDraft(picked);
                        setCreateStep("pick");
                      }}
                    >
                      Chọn lại vị trí
                    </Button>
                  ) : (
                    <Button size="small" onClick={useMyPosition}>
                      Lấy vị trí hiện tại
                    </Button>
                  )}
                  <Button size="small" onClick={() => setMapModalOpen(true)}>
                    Phóng to
                  </Button>
                </Space>
              </div>

              <div className="mt-2 overflow-hidden rounded-lg border">
                <MapContainer
                  center={[
                    picked?.lat ??
                      (Number.isFinite(Number(form.getFieldValue("latitude")))
                        ? Number(form.getFieldValue("latitude"))
                        : DEFAULT_CENTER.lat),
                    picked?.lng ??
                      (Number.isFinite(Number(form.getFieldValue("longitude")))
                        ? Number(form.getFieldValue("longitude"))
                        : DEFAULT_CENTER.lng),
                  ]}
                  zoom={picked ? 16 : 12}
                  doubleClickZoom={false}
                  style={{ height: 260, width: "100%" }}
                >
                  <MapResizeFix
                    trigger={`${open}-${createStep}-${editing?.location_id ?? "new"}`}
                  />
                  <MapFlyTo center={picked} zoom={picked ? 16 : undefined} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    onPick={(p) => {
                      setPicked(p);
                      form.setFieldsValue({
                        latitude: p.lat,
                        longitude: p.lng,
                      });
                      void reverseGeocode(p);
                    }}
                  />
                  {picked ? (
                    <Marker
                      position={[picked.lat, picked.lng]}
                      icon={getPinIconByKind("picked")}
                    />
                  ) : null}
                </MapContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <Form.Item
                  name="latitude"
                  label="Vĩ độ"
                  rules={[{ required: true, message: "Thiếu vĩ độ" }]}
                >
                  <InputNumber style={{ width: "100%" }} step={0.000001} />
                </Form.Item>
                <Form.Item
                  name="longitude"
                  label="Kinh độ"
                  rules={[{ required: true, message: "Thiếu kinh độ" }]}
                >
                  <InputNumber style={{ width: "100%" }} step={0.000001} />
                </Form.Item>
              </div>

              <Form.Item
                name="location_name"
                label="Tên"
                rules={[{ required: true, message: "Nhập tên" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="location_type"
                label="Loại"
                rules={[{ required: true, message: "Chọn loại" }]}
              >
                <Select
                  options={[
                    { value: "hotel", label: "Khách sạn" },
                    { value: "restaurant", label: "Ăn uống" },
                    { value: "tourist", label: "Du lịch" },
                    { value: "other", label: "Khác" },
                  ]}
                />
              </Form.Item>

              <div className="grid grid-cols-2 gap-3">
                <Form.Item name="opening_open" label="Giờ mở cửa">
                  <TimePicker
                    format="HH:mm"
                    style={{ width: "100%" }}
                    placeholder="--:--"
                  />
                </Form.Item>
                <Form.Item name="opening_close" label="Giờ đóng cửa">
                  <TimePicker
                    format="HH:mm"
                    style={{ width: "100%" }}
                    placeholder="--:--"
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="address"
                label="Địa chỉ"
                rules={[{ required: true, message: "Nhập địa chỉ" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="province" label="Tỉnh/TP">
                <Input />
              </Form.Item>

              <Form.Item name="description" label="Mô tả">
                <Input.TextArea rows={3} />
              </Form.Item>

              <Form.Item
                name="images"
                label={
                  editing
                    ? "Ảnh giới thiệu / gallery"
                    : "Ảnh giới thiệu / gallery (bắt buộc)"
                }
                valuePropName="fileList"
                getValueFromEvent={(e) => (e?.fileList ? e.fileList : [])}
                rules={
                  editing
                    ? undefined
                    : [
                        {
                          required: true,
                          message: "Vui lòng upload ít nhất 1 ảnh địa điểm",
                        },
                      ]
                }
              >
                <div className="grid grid-cols-1 gap-3">
                  {editing && existingGalleryImages.length > 0 ? (
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Gallery hiện tại
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {existingGalleryImages.map((src, index) => {
                          const resolved = resolveBackendUrl(src) || src;
                          return (
                            <div
                              key={`${src}-${index}`}
                              className="overflow-hidden rounded-lg border bg-white"
                            >
                              <Image
                                src={resolved}
                                alt={`Existing ${index + 1}`}
                                width="100%"
                                height={160}
                                style={{ objectFit: "cover" }}
                                preview={{ mask: "Phóng to" }}
                              />
                              <div className="flex items-center justify-between px-2 py-2 text-xs text-gray-500">
                                <span>
                                  {index === 0
                                    ? "Ảnh đại diện"
                                    : `Ảnh ${index + 1}`}
                                </span>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() =>
                                    setExistingGalleryImages((prev) =>
                                      prev.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3">
                    <Upload.Dragger
                      accept="image/*"
                      multiple
                      maxCount={12}
                      beforeUpload={() => false}
                      showUploadList={false}
                      fileList={createImageFileList}
                      onChange={(info) => {
                        setCreateImageFileList(info.fileList);
                        form.setFieldsValue({ images: info.fileList });
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">
                        Kéo thả nhiều ảnh vào đây hoặc bấm để chọn gallery
                      </p>
                      <p className="ant-upload-hint">
                        Hỗ trợ JPG/PNG/WebP. Ảnh đầu tiên sẽ là ảnh đại diện.
                      </p>
                    </Upload.Dragger>

                    <div className="rounded-lg border bg-gray-50 p-3">
                      {createImagePreviewUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {createImagePreviewUrls.map((src, index) => (
                            <div
                              key={`${src}-${index}`}
                              className="overflow-hidden rounded-lg border bg-white"
                            >
                              <Image
                                src={src}
                                alt={`Preview ${index + 1}`}
                                width="100%"
                                height={160}
                                style={{ objectFit: "cover" }}
                                preview={{ mask: "Phóng to" }}
                              />
                              <div className="flex items-center justify-between px-2 py-2 text-xs text-gray-500">
                                <span>
                                  {index === 0
                                    ? "Ảnh đại diện"
                                    : `Ảnh ${index + 1}`}
                                </span>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => {
                                    const next = createImageFileList.filter(
                                      (_, i) => i !== index,
                                    );
                                    setCreateImageFileList(next);
                                    form.setFieldsValue({ images: next });
                                  }}
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[160px] flex items-center justify-center text-sm text-gray-500">
                          Chưa chọn ảnh gallery
                        </div>
                      )}
                      <div className="px-3 py-2 text-xs text-gray-500">
                        {editing
                          ? "Ảnh mới sẽ được thêm vào gallery sau khi lưu cập nhật."
                          : "Gallery này sẽ hiển thị trong phần giới thiệu của địa điểm."}
                      </div>
                    </div>
                  </div>
                </div>
              </Form.Item>

              <Form.Item name="phone" label="Số điện thoại">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="Bản đồ (phóng to)"
        open={mapModalOpen}
        onCancel={() => setMapModalOpen(false)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <Space wrap>
            <AutoComplete
              options={mapSearchOptions.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              onSearch={(text) => {
                void searchPlaces(text);
              }}
              onSelect={(value) => {
                const found = mapSearchOptions.find((o) => o.value === value);
                if (!found) return;
                applySearchedPosition(
                  { lat: found.lat, lng: found.lng },
                  found.label,
                );
              }}
              style={{ width: 420 }}
            >
              <Input
                placeholder="Tìm nhanh địa điểm..."
                allowClear
                suffix={
                  mapSearchLoading ? (
                    <span className="text-xs text-gray-400">...</span>
                  ) : null
                }
              />
            </AutoComplete>

            <Button size="small" onClick={useMyPosition}>
              Lấy vị trí hiện tại
            </Button>
            {!editing && createStep === "pick" ? (
              <Button
                size="small"
                type="primary"
                disabled={!pickedDraft}
                onClick={confirmPickedDraft}
              >
                Xác nhận vị trí
              </Button>
            ) : null}
          </Space>
          <Button size="small" onClick={() => setMapModalOpen(false)}>
            Đóng
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <MapContainer
            center={[
              (!editing && createStep === "pick"
                ? (pickedDraft ?? picked)
                : picked
              )?.lat ?? DEFAULT_CENTER.lat,
              (!editing && createStep === "pick"
                ? (pickedDraft ?? picked)
                : picked
              )?.lng ?? DEFAULT_CENTER.lng,
            ]}
            zoom={
              (
                !editing && createStep === "pick"
                  ? (pickedDraft ?? picked)
                  : picked
              )
                ? 16
                : 12
            }
            doubleClickZoom={false}
            style={{ height: "70vh", width: "100%" }}
          >
            <MapResizeFix trigger={`zoom-${mapModalOpen}`} />
            {!editing && createStep === "pick" ? (
              <MapFlyTo
                center={pickedDraft ?? null}
                zoom={pickedDraft ? 16 : undefined}
              />
            ) : (
              <MapFlyTo center={picked} zoom={picked ? 16 : undefined} />
            )}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <LocationPicker
              onPick={(p) => {
                if (!editing && createStep === "pick") {
                  setPickedDraft(p);
                  form.setFieldsValue({ latitude: p.lat, longitude: p.lng });
                  void reverseGeocode(p);
                  return;
                }
                setPicked(p);
                form.setFieldsValue({ latitude: p.lat, longitude: p.lng });
                void reverseGeocode(p);
              }}
            />

            {!editing && createStep === "pick" && pickedDraft ? (
              <Marker
                position={[pickedDraft.lat, pickedDraft.lng]}
                icon={getPinIconByKind("picked")}
              />
            ) : null}
            {(editing || createStep === "form") && picked ? (
              <Marker
                position={[picked.lat, picked.lng]}
                icon={getPinIconByKind("picked")}
              />
            ) : null}
          </MapContainer>
        </div>

        {!editing && createStep === "pick" ? (
          <div className="mt-2 text-sm text-gray-700">
            {pickedDraft ? (
              <>
                Đã chọn: <strong>{pickedDraft.lat.toFixed(6)}</strong>,{" "}
                <strong>{pickedDraft.lng.toFixed(6)}</strong>
              </>
            ) : (
              <span className="text-gray-500">Chưa chọn vị trí.</span>
            )}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-700">
            {picked ? (
              <>
                Đang chọn: <strong>{picked.lat.toFixed(6)}</strong>,{" "}
                <strong>{picked.lng.toFixed(6)}</strong>
              </>
            ) : (
              <span className="text-gray-500">Chưa có vị trí.</span>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={
          viewRow ? `Vị trí: ${String(viewRow.location_name || "")}` : "Vị trí"
        }
        open={viewMapOpen}
        onCancel={() => {
          setViewMapOpen(false);
          setViewRow(null);
        }}
        footer={null}
        width={760}
      >
        {viewRow ? (
          <>
            <div className="mb-2 text-sm text-gray-700">
              {String(viewRow.address || "")}{" "}
              {viewRow.province ? `, ${String(viewRow.province)}` : ""}
            </div>
            <div className="mb-3 text-xs text-gray-500">
              Tọa độ: {viewPos ? `${viewPos.lat}, ${viewPos.lng}` : "Chưa có"}
            </div>

            {viewPos ? (
              <div className="overflow-hidden rounded-lg border">
                <MapContainer
                  center={[viewPos.lat, viewPos.lng]}
                  zoom={16}
                  style={{ height: 420, width: "100%" }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapResizeFix trigger={`${viewMapOpen}-view`} />
                  <MapFlyTo center={viewPos} zoom={16} />
                  <Marker
                    position={[viewPos.lat, viewPos.lng]}
                    icon={getPinIconByKind("ownerSelected")}
                  />
                </MapContainer>
              </div>
            ) : (
              <div className="rounded-lg border bg-gray-50 h-[220px] flex items-center justify-center text-sm text-gray-500">
                Địa điểm này chưa có tọa độ hợp lệ.
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </MainLayout>
  );
};

export default OwnerLocations;
