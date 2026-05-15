import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";

type LocationRow = {
  location_id: number;
  location_name: string;
  status: string;
  location_type: string;
};

type CategoryRow = {
  category_id: number;
  category_name: string;
  category_type: string;
  sort_order?: number | null;
};

type ServiceRow = {
  service_id: number;
  category_id?: number | null;
  category_name?: string | null;
  service_name: string;
  service_type: string;
  description?: string | null;
  price?: number | null;
  quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  admin_status?: string | null;
  images?: unknown;
  order_id?: number | null;
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

const OwnerServices = () => {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(
    null,
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);

  const watchImageUrl = Form.useWatch("image_url", form) as string | undefined;

  const selectedLocation = useMemo(() => {
    if (!locationId) return null;
    return locations.find((l) => Number(l.location_id) === Number(locationId));
  }, [locations, locationId]);

  const hasActiveLocation = useMemo(() => {
    return locations.some((l) => String(l.status) === "active");
  }, [locations]);

  const isSelectedLocationActive =
    String(selectedLocation?.status || "") === "active";

  const locationType = String(selectedLocation?.location_type || "");

  const isFoodLocation =
    locationType === "restaurant" || locationType === "cafe";
  const isHotelLocation = locationType === "hotel" || locationType === "resort";
  const isTouristLocation = locationType === "tourist";

  const requiredCategoryType = useMemo(() => {
    if (locationType === "restaurant" || locationType === "cafe") return "menu";
    if (locationType === "hotel" || locationType === "resort") return "room";
    return "other";
  }, [locationType]);

  const getNextCategorySortOrder = useCallback(() => {
    const maxSort = categories.reduce((max, c) => {
      const v = Number(c.sort_order);
      return Number.isFinite(v) ? Math.max(max, v) : max;
    }, 0);
    return Math.max(0, maxSort) + 1;
  }, [categories]);

  const categoryTitle =
    requiredCategoryType === "menu"
      ? "Danh mục Thực đơn"
      : requiredCategoryType === "room"
        ? "Danh mục Phòng"
        : "Danh mục";

  const serviceTypeOptions = useMemo(() => {
    if (locationType === "restaurant" || locationType === "cafe") {
      return [
        { value: "food", label: "Món ăn / Nước" },
        { value: "combo", label: "Combo" },
        { value: "other", label: "Khác" },
      ];
    }
    if (locationType === "hotel" || locationType === "resort") {
      return [
        { value: "room", label: "Phòng" },
        { value: "other", label: "Khác" },
      ];
    }
    if (locationType === "tourist") {
      return [{ value: "ticket", label: "Vé" }];
    }
    return [
      { value: "room", label: "Phòng" },
      { value: "table", label: "Bàn" },
      { value: "ticket", label: "Vé" },
      { value: "food", label: "Món ăn / Nước" },
      { value: "combo", label: "Combo" },
      { value: "other", label: "Khác" },
    ];
  }, [locationType]);

  const serviceTypeLabel = useCallback(
    (raw: unknown) => {
      const v = String(raw || "").trim();
      if (!v) return "-";
      if (locationType === "restaurant" || locationType === "cafe") {
        if (v === "food") return "Món ăn / Nước";
        if (v === "combo") return "Combo";
        if (v === "other") return "Khác";
        return v;
      }
      if (locationType === "hotel" || locationType === "resort") {
        if (v === "room") return "Phòng";
        if (v === "other") return "Khác";
        return v;
      }
      if (locationType === "tourist") {
        if (v === "ticket") return "Vé";
        return v;
      }

      if (v === "room") return "Phòng";
      if (v === "table") return "Bàn";
      if (v === "ticket") return "Vé";
      if (v === "food") return "Món ăn / Nước";
      if (v === "combo") return "Combo";
      if (v === "other") return "Khác";
      return v;
    },
    [locationType],
  );

  const loadLocations = useCallback(async () => {
    try {
      const res = await ownerApi.getLocations({});
      const raw = (res?.data || []) as unknown[];
      const locs: LocationRow[] = raw
        .map((item) => {
          const r = asRecord(item);
          return {
            location_id: Number(r.location_id),
            location_name: String(r.location_name || ""),
            status: String(r.status || ""),
            location_type: String(r.location_type || ""),
          };
        })
        .filter((l) => Number.isFinite(l.location_id));

      setLocations(locs);

      const current = locationId
        ? locs.find((l) => Number(l.location_id) === Number(locationId))
        : null;
      if (current && String(current.status) === "active") return;

      const firstActive = locs.find((l) => String(l.status) === "active");
      setLocationId(
        firstActive?.location_id ? Number(firstActive.location_id) : null,
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh sách địa điểm"));
    }
  }, [locationId]);

  const loadServices = useCallback(async (locId: number) => {
    setLoading(true);
    try {
      const res = await ownerApi.getServicesByLocation(locId);
      const raw = (res?.data || []) as unknown[];
      setServices(
        raw
          .map((item) => {
            const r = asRecord(item);
            return {
              service_id: Number(r.service_id),
              category_id: r.category_id == null ? null : Number(r.category_id),
              category_name:
                r.category_name == null ? null : String(r.category_name),
              service_name: String(r.service_name || ""),
              service_type: String(r.service_type || ""),
              description: r.description == null ? null : String(r.description),
              price: r.price == null ? null : Number(r.price),
              quantity: r.quantity == null ? null : Number(r.quantity),
              unit: r.unit == null ? null : String(r.unit),
              status: r.status == null ? null : String(r.status),
              admin_status:
                r.admin_status == null ? null : String(r.admin_status),
              images: r.images,
              order_id: r.order_id == null ? null : Number(r.order_id),
            } satisfies ServiceRow;
          })
          .filter((s) => Number.isFinite(s.service_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải dịch vụ"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(
    async (locId: number) => {
      setLoadingCategories(true);
      try {
        const res = await ownerApi.getServiceCategories(locId, {
          type: requiredCategoryType,
        });
        const raw = (res?.data || []) as unknown[];
        setCategories(
          raw
            .map((item) => {
              const r = asRecord(item);
              return {
                category_id: Number(r.category_id),
                category_name: String(r.category_name || ""),
                category_type: String(r.category_type || ""),
                sort_order: r.sort_order == null ? null : Number(r.sort_order),
              } satisfies CategoryRow;
            })
            .filter((c) => Number.isFinite(c.category_id)),
        );
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải danh mục"));
      } finally {
        setLoadingCategories(false);
      }
    },
    [requiredCategoryType],
  );

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (locationId) void loadServices(locationId);
  }, [loadServices, locationId]);

  useEffect(() => {
    if (!locationId) return;
    void loadCategories(locationId);
  }, [loadCategories, locationId]);

  const onCreate = () => {
    if (!locationId || !selectedLocation) {
      message.warning(
        "Bạn cần có địa điểm đã được duyệt trước khi tạo dịch vụ",
      );
      return;
    }
    if (!isSelectedLocationActive) {
      message.warning("Địa điểm đang chờ duyệt hoặc chưa kích hoạt");
      return;
    }
    if (categories.length === 0) {
      message.warning("Bạn cần tạo danh mục trước khi tạo dịch vụ");
      return;
    }
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ quantity: 1, status: "available" });
    setImageFileList([]);
    setOpen(true);
  };

  const onEdit = useCallback(
    (row: ServiceRow) => {
      setEditing(row);
      const img = normalizeImages(row.images)?.[0] ?? "";
      const normalizedUnit = (() => {
        if (!isHotelLocation) return row.unit;
        if (String(row.service_type || "") !== "room") return row.unit;
        const u = String(row.unit || "").trim();
        if (!u) return "Tiếng";
        const lc = u.toLowerCase();
        if (lc === "phòng" || lc === "phong") return "Tiếng";
        return row.unit;
      })();
      form.setFieldsValue({
        category_id:
          typeof row.category_id === "number"
            ? row.category_id
            : row.category_id
              ? Number(row.category_id)
              : undefined,
        service_name: row.service_name,
        service_type: row.service_type,
        description: row.description,
        price: row.price,
        quantity: isHotelLocation ? 1 : row.quantity,
        unit: normalizedUnit,
        status: row.status,
        image_url: img || undefined,
      });
      setImageFileList(
        img
          ? [
              {
                uid: "service-image",
                name: "service-image",
                status: "done",
                url: img,
              },
            ]
          : [],
      );
      setOpen(true);
    },
    [form, isHotelLocation],
  );

  const onSave = async () => {
    if (!locationId) return;
    try {
      const values = (await form.validateFields()) as Record<string, unknown>;
      setSaving(true);

      const imageUrl = String(values.image_url || "").trim();
      const payload: Record<string, unknown> = {
        ...values,
        images: imageUrl ? [imageUrl] : null,
      };
      delete (payload as Record<string, unknown>).image_url;

      // Normalize by location type
      if (isFoodLocation) {
        payload.quantity = 1;
        const st = String(payload.status || "");
        if (st !== "available" && st !== "unavailable") {
          payload.status = "available";
        }
      }

      if (isTouristLocation) {
        const st = String(payload.status || "");
        if (st !== "available" && st !== "unavailable") {
          payload.status = "available";
        }
      }

      if (isHotelLocation) {
        payload.quantity = 1;
        if (String(payload.service_type || "") === "room") {
          payload.unit = "Tiếng";
        }
      }

      if (editing) {
        await ownerApi.updateService(editing.service_id, payload);
        message.success("Đã cập nhật dịch vụ");
      } else {
        await ownerApi.createService(locationId, payload);
        message.success("Đã tạo dịch vụ");
      }
      setOpen(false);
      await loadServices(locationId);
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi lưu dịch vụ"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = useCallback(
    async (row: ServiceRow) => {
      try {
        const res = await ownerApi.deleteService(row.service_id);
        message.success(res?.message || "Đã xóa dịch vụ");
        if (locationId) await loadServices(locationId);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa dịch vụ"));
      }
    },
    [loadServices, locationId],
  );

  const openCreateCategory = () => {
    if (!locationId || !selectedLocation) {
      message.warning(
        "Bạn cần có địa điểm đã được duyệt trước khi tạo danh mục",
      );
      return;
    }
    if (!isSelectedLocationActive) {
      message.warning("Địa điểm đang chờ duyệt hoặc chưa kích hoạt");
      return;
    }
    setEditingCategory(null);
    categoryForm.resetFields();
    categoryForm.setFieldsValue({
      category_type: requiredCategoryType,
      sort_order: getNextCategorySortOrder(),
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (row: CategoryRow) => {
    setEditingCategory(row);
    categoryForm.setFieldsValue({
      category_name: row.category_name,
      category_type: row.category_type,
      sort_order: row.sort_order ?? 0,
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    if (!locationId) return;
    try {
      const v = (await categoryForm.validateFields()) as Record<
        string,
        unknown
      >;
      setSaving(true);
      const sortOrder = Math.max(0, Number(v.sort_order ?? 0));
      if (editingCategory) {
        await ownerApi.updateServiceCategory(editingCategory.category_id, {
          category_name: String(v.category_name).trim(),
          sort_order: sortOrder,
        });
        message.success("Đã cập nhật danh mục");
      } else {
        const raw = v.category_type;
        const ctString = typeof raw === "string" ? raw : String(raw || "");
        const categoryType =
          ctString === "menu" || ctString === "room" || ctString === "other"
            ? (ctString as "menu" | "room" | "other")
            : requiredCategoryType;
        await ownerApi.createServiceCategory(locationId, {
          category_type: categoryType,
          category_name: String(v.category_name).trim(),
          sort_order: sortOrder,
        });
        message.success("Đã tạo danh mục");
      }
      setCategoryModalOpen(false);
      await loadCategories(locationId);
      await loadServices(locationId);
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi lưu danh mục"));
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (row: CategoryRow) => {
    try {
      setSaving(true);
      const res = await ownerApi.deleteServiceCategory(row.category_id);
      message.success(res?.message || "Đã xóa danh mục");
      if (locationId) {
        await loadCategories(locationId);
        await loadServices(locationId);
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi xóa danh mục"));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<ServiceRow> = useMemo(() => {
    const cols: ColumnsType<ServiceRow> = [
      { title: "#", dataIndex: "service_id", width: 80 },
      {
        title: "Ảnh",
        key: "images",
        width: 80,
        render: (_: unknown, row: ServiceRow) => {
          const img = normalizeImages(row.images)?.[0] ?? "";
          const src = resolveBackendUrl(img) || img;
          return src ? (
            <img
              src={src}
              alt="service"
              className="w-10 h-10 object-cover rounded-md border bg-white"
            />
          ) : (
            <div className="w-10 h-10 rounded-md border bg-gray-50" />
          );
        },
      },
      { title: "Tên", dataIndex: "service_name" },
      { title: "Danh mục", dataIndex: "category_name", width: 200 },
      {
        title: "Loại",
        dataIndex: "service_type",
        width: 160,
        render: (v: unknown) => serviceTypeLabel(v),
      },
      {
        title: isHotelLocation ? "Tiền phòng/tiếng" : "Giá",
        dataIndex: "price",
        width: 160,
        render: (v: unknown, row: ServiceRow) => {
          const base = formatMoney(Number(v || 0));
          if (isHotelLocation && String(row.service_type || "") === "room") {
            return `${base} / tiếng`;
          }
          return base;
        },
      },
      {
        title: "Đơn vị",
        dataIndex: "unit",
        width: 140,
        render: (v: unknown, row: ServiceRow) => {
          if (isHotelLocation && String(row.service_type || "") === "room") {
            return "Tiếng";
          }
          return String(v || "").trim() ? String(v).trim() : "-";
        },
      },
    ];

    if (!isFoodLocation) {
      cols.push({
        title: "SL",
        dataIndex: "quantity",
        width: 80,
        render: (v: unknown) => {
          if (isHotelLocation) return 1;
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : 1;
        },
      });
    }

    cols.push(
      {
        title: "Trạng thái",
        width: 180,
        render: (_: unknown, row: ServiceRow) => {
          const adminStatus = String(row.admin_status || "approved");
          const approvalTag =
            adminStatus === "pending" ? (
              <Tag color="gold">Chờ duyệt</Tag>
            ) : adminStatus === "rejected" ? (
              <Tag color="red">Từ chối</Tag>
            ) : (
              <Tag color="green">Đã duyệt</Tag>
            );

          const status = String(row.status || "");
          const isFood =
            locationType === "restaurant" || locationType === "cafe";
          const isTourist = locationType === "tourist";

          const statusTag = isFood ? (
            status === "available" ? (
              <Tag color="green">Còn</Tag>
            ) : (
              <Tag color="red">Hết</Tag>
            )
          ) : isTourist ? (
            status === "available" ? (
              <Tag color="green">Còn vé</Tag>
            ) : (
              <Tag color="red">Hết vé</Tag>
            )
          ) : status === "available" ? (
            <Tag color="green">Có sẵn</Tag>
          ) : status === "reserved" ? (
            <Tag color="blue">Đã giữ chỗ</Tag>
          ) : status === "booked" ? (
            <Tag color="orange">Đã đặt</Tag>
          ) : (
            <Tag color="default">Không khả dụng</Tag>
          );

          return (
            <Space size={4} wrap>
              {approvalTag}
              {statusTag}
            </Space>
          );
        },
      },
      {
        title: "Hành động",
        width: 220,
        render: (_: unknown, row: ServiceRow) => (
          <Space>
            {isFoodLocation || isTouristLocation ? (
              <Button
                size="small"
                onClick={async () => {
                  try {
                    const cur = String(row.status || "");
                    if (cur === "reserved" || cur === "booked") {
                      message.warning(
                        "Dịch vụ đang được giữ chỗ/đặt nên không thể đổi trạng thái",
                      );
                      return;
                    }
                    const next =
                      cur === "available" ? "unavailable" : "available";
                    await ownerApi.updateService(row.service_id, {
                      status: next,
                    });
                    message.success("Đã cập nhật trạng thái dịch vụ");
                    if (locationId) await loadServices(locationId);
                  } catch (err: unknown) {
                    message.error(
                      getErrorMessage(err, "Lỗi cập nhật trạng thái dịch vụ"),
                    );
                  }
                }}
              >
                {String(row.status || "") === "available"
                  ? isTouristLocation
                    ? "Hết vé"
                    : "Hết hàng"
                  : isTouristLocation
                    ? "Còn vé"
                    : "Còn hàng"}
              </Button>
            ) : null}
            <Button size="small" onClick={() => onEdit(row)}>
              Sửa
            </Button>
            <Button size="small" danger onClick={() => onDelete(row)}>
              Xóa
            </Button>
          </Space>
        ),
      },
    );

    return cols;
  }, [
    isFoodLocation,
    isHotelLocation,
    isTouristLocation,
    loadServices,
    locationId,
    locationType,
    onDelete,
    onEdit,
    serviceTypeLabel,
  ]);

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card
          title="Dịch vụ"
          extra={
            <Space>
              <Select
                style={{ minWidth: 260 }}
                value={locationId ?? undefined}
                onChange={(v) => setLocationId(Number(v))}
                placeholder="Chọn địa điểm đã duyệt"
                options={locations.map((l) => {
                  const st = String(l.status || "");
                  return {
                    value: l.location_id,
                    disabled: st !== "active",
                    label: (
                      <Space>
                        <span>{`${l.location_name} (#${l.location_id})`}</span>
                        {st === "active" ? (
                          <Tag color="green">Đã duyệt</Tag>
                        ) : st === "pending" ? (
                          <Tag color="gold">Chờ duyệt</Tag>
                        ) : (
                          <Tag color="default">Ngừng hoạt động</Tag>
                        )}
                      </Space>
                    ),
                  };
                })}
              />
              <Button
                onClick={openCreateCategory}
                disabled={!locationId || !isSelectedLocationActive}
              >
                Tạo danh mục
              </Button>
              <Button
                type="primary"
                onClick={onCreate}
                disabled={
                  !locationId ||
                  !isSelectedLocationActive ||
                  categories.length === 0
                }
              >
                Tạo dịch vụ
              </Button>
            </Space>
          }
        >
          {!hasActiveLocation ? (
            <Alert
              type="warning"
              showIcon
              message="Chưa có địa điểm đã duyệt"
              description="Bạn chỉ có thể tạo Danh mục/Dịch vụ sau khi admin duyệt địa điểm."
              style={{ marginBottom: 16 }}
            />
          ) : !isSelectedLocationActive ? (
            <Alert
              type="info"
              showIcon
              message="Địa điểm chưa sẵn sàng"
              description="Hãy chọn một địa điểm đã duyệt để quản lý danh mục và dịch vụ."
              style={{ marginBottom: 16 }}
            />
          ) : categories.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Chưa có danh mục"
              description="Bạn cần tạo ít nhất 1 danh mục trước khi tạo dịch vụ."
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Card
            title={`${categoryTitle} (${categories.length})`}
            size="small"
            style={{ marginBottom: 16 }}
            extra={
              <Button
                onClick={() => locationId && loadCategories(locationId)}
                loading={loadingCategories}
                disabled={!locationId}
              >
                Tải lại
              </Button>
            }
          >
            <Table<CategoryRow>
              rowKey="category_id"
              loading={loadingCategories}
              dataSource={categories}
              pagination={false}
              scroll={{ y: 320 }}
              columns={[
                { title: "Tên danh mục", dataIndex: "category_name" },
                { title: "Thứ tự", dataIndex: "sort_order", width: 120 },
                {
                  title: "Hành động",
                  width: 200,
                  render: (_: unknown, row: CategoryRow) => (
                    <Space>
                      <Button
                        size="small"
                        onClick={() => openEditCategory(row)}
                      >
                        Sửa
                      </Button>
                      <Popconfirm
                        title="Xóa danh mục này?"
                        description="Bạn cần chuyển dịch vụ sang danh mục khác trước khi xóa."
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => deleteCategory(row)}
                        disabled={saving}
                      >
                        <Button size="small" danger disabled={saving}>
                          Xóa
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Table<ServiceRow>
            rowKey="service_id"
            loading={loading}
            dataSource={services}
            columns={columns}
            pagination={false}
            scroll={{ y: 520 }}
          />
        </Card>
      </Space>

      <Modal
        title={editing ? "Cập nhật dịch vụ" : "Tạo Dịch Vụ Mới"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSave}
        confirmLoading={saving}
        okText="Lưu"
        width={900}
      >
        <Form form={form} layout="vertical">
          <Card
            size="small"
            title="Thông tin cơ bản"
            style={{ marginBottom: 12 }}
          >
            <Row gutter={12}>
              <div className="w-full md:w-1/2 pr-2">
                <Form.Item
                  name="category_id"
                  label={categoryTitle}
                  rules={[{ required: true, message: "Chọn danh mục" }]}
                >
                  <Select
                    showSearch
                    placeholder={
                      categories.length ? "Chọn danh mục" : "Chưa có danh mục"
                    }
                    optionFilterProp="label"
                    disabled={categories.length === 0}
                    options={categories.map((c) => ({
                      value: c.category_id,
                      label: c.category_name,
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  name="service_name"
                  label="Tên dịch vụ"
                  rules={[{ required: true, message: "Nhập tên" }]}
                >
                  <Input placeholder="VD: Bò Wellington" />
                </Form.Item>

                <Form.Item
                  name="service_type"
                  label="Loại"
                  rules={[{ required: true, message: "Chọn loại" }]}
                >
                  <Select
                    options={serviceTypeOptions}
                    placeholder="Chọn loại"
                    onChange={(v) => {
                      if (isHotelLocation && String(v) === "room") {
                        form.setFieldValue("unit", "Tiếng");
                      }
                    }}
                  />
                </Form.Item>

                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea
                    rows={4}
                    placeholder="Mô tả chi tiết về dịch vụ..."
                  />
                </Form.Item>
              </div>

              <div className="w-full md:w-1/2 pl-2">
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev.service_type !== cur.service_type
                  }
                >
                  {({ getFieldValue }) => {
                    const st = String(getFieldValue("service_type") || "");
                    const isRoom = isHotelLocation && st === "room";
                    return (
                      <Form.Item
                        name="price"
                        label={isRoom ? "Tiền phòng/tiếng" : "Giá"}
                        rules={[
                          {
                            required: true,
                            message: isRoom
                              ? "Nhập tiền phòng/tiếng"
                              : "Nhập giá",
                          },
                        ]}
                      >
                        <InputNumber
                          style={{ width: "100%" }}
                          min={0}
                          addonAfter="VND"
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
                <Form.Item
                  name="quantity"
                  initialValue={1}
                  hidden={isFoodLocation || isHotelLocation}
                  label={isTouristLocation ? "Số vé" : "Số lượng"}
                  rules={
                    isFoodLocation || isHotelLocation
                      ? []
                      : [{ required: true, message: "Nhập số lượng" }]
                  }
                >
                  <InputNumber style={{ width: "100%" }} min={1} />
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev.service_type !== cur.service_type
                  }
                >
                  {({ getFieldValue }) => {
                    const st = String(getFieldValue("service_type") || "");
                    const isRoom = isHotelLocation && st === "room";
                    return (
                      <Form.Item name="unit" label="Đơn vị">
                        <Input
                          placeholder={
                            isRoom ? "Tiếng" : "VD: Phần, Cái, Ly..."
                          }
                          disabled={isRoom}
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
                <Form.Item
                  name="status"
                  label="Trạng thái"
                  initialValue="available"
                >
                  <Select
                    options={
                      isFoodLocation
                        ? [
                            { value: "available", label: "Còn" },
                            { value: "unavailable", label: "Hết" },
                          ]
                        : isTouristLocation
                          ? [
                              { value: "available", label: "Còn vé" },
                              { value: "unavailable", label: "Hết vé" },
                            ]
                          : [
                              {
                                value: "available",
                                label: "Available (Có sẵn)",
                              },
                              { value: "reserved", label: "Reserved" },
                              { value: "booked", label: "Booked" },
                              { value: "unavailable", label: "Unavailable" },
                            ]
                    }
                  />
                </Form.Item>
                <div className="-mt-2">
                  <Tag color="gold">Dịch vụ tạo mới sẽ chờ admin duyệt</Tag>
                </div>
              </div>
            </Row>
          </Card>

          <Card size="small" title="Hình ảnh dịch vụ">
            <Form.Item
              name="image_url"
              label="Ảnh dịch vụ (1 ảnh)"
              rules={[{ required: true, message: "Vui lòng upload 1 ảnh" }]}
            >
              <Input type="hidden" />
            </Form.Item>

            <div className="flex items-start gap-3">
              <div className="flex-1">
                <Upload.Dragger
                  accept="image/*"
                  multiple={false}
                  maxCount={1}
                  fileList={imageFileList}
                  showUploadList={false}
                  onRemove={() => {
                    setImageFileList([]);
                    form.setFieldValue("image_url", undefined);
                  }}
                  customRequest={async (options: unknown) => {
                    try {
                      const opt = asRecord(options);
                      const file = opt.file as File;
                      const resp = await ownerApi.uploadServiceImage(file);
                      const url = String(
                        asRecord(asRecord(resp).data).url || "",
                      );
                      if (!url) throw new Error("Upload thất bại");

                      setImageFileList([
                        {
                          uid: "service-image",
                          name: file.name,
                          status: "done",
                          url,
                          thumbUrl: resolveBackendUrl(url) || url,
                        },
                      ]);
                      form.setFieldValue("image_url", url);
                      (
                        opt.onSuccess as
                          | ((r: unknown, f: File) => void)
                          | undefined
                      )?.(resp, file);
                      message.success("Đã upload ảnh");
                    } catch (e: unknown) {
                      const opt = asRecord(options);
                      (opt.onError as ((err: unknown) => void) | undefined)?.(
                        e,
                      );
                      message.error(getErrorMessage(e, "Lỗi upload ảnh"));
                    }
                  }}
                >
                  <div className="py-5">
                    <div className="font-semibold">
                      Kéo thả ảnh vào đây hoặc nhấn để tải lên
                    </div>
                    <div className="text-sm text-gray-500">
                      Hỗ trợ JPG, PNG, WebP
                    </div>
                  </div>
                </Upload.Dragger>
              </div>

              <div className="w-28">
                <div className="text-xs text-gray-500 mb-2">Xem trước</div>
                {watchImageUrl ? (
                  <div className="relative">
                    <img
                      src={resolveBackendUrl(watchImageUrl) || watchImageUrl}
                      alt="Service preview"
                      className="w-28 h-28 object-cover rounded-lg border bg-white"
                    />
                    <Button
                      size="small"
                      className="!absolute !top-1 !right-1"
                      onClick={() => {
                        setImageFileList([]);
                        form.setFieldValue("image_url", undefined);
                      }}
                    >
                      Xóa
                    </Button>
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-lg border bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    Chưa có ảnh
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Form>
      </Modal>

      <Modal
        title={editingCategory ? "Cập nhật danh mục" : "Tạo danh mục"}
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={saveCategory}
        confirmLoading={saving}
        okText="Lưu"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="category_type"
            label="Loại danh mục"
            rules={[{ required: true, message: "Chọn loại" }]}
          >
            <Select
              disabled={Boolean(requiredCategoryType)}
              options={[
                { value: "menu", label: "Thực đơn" },
                { value: "room", label: "Phòng" },
                { value: "other", label: "Khác" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="category_name"
            label="Tên danh mục"
            rules={[{ required: true, message: "Nhập tên danh mục" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="Thứ tự"
            initialValue={0}
            rules={[
              { type: "number", min: 0, message: "Thứ tự không được âm" },
            ]}
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
};

export default OwnerServices;
