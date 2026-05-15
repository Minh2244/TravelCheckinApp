import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarOutlined,
  GiftOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PercentageOutlined,
  SaveOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Row,
  Space,
  Table,
  Tag,
  DatePicker,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import dayjs from "dayjs";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type ServiceScope = "all" | "room" | "food" | "ticket" | "other";
type VoucherStatus = "active" | "inactive" | "expired";

type LocationType =
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

type OwnerLocationOption = {
  location_id: number;
  location_name: string;
  location_type: LocationType;
};

type OwnerVoucherRow = {
  voucher_id: number;
  code: string;
  campaign_name: string;
  campaign_description?: string | null;
  discount_type: "percent" | "amount";
  discount_value: number;
  start_date?: string | null;
  end_date?: string | null;
  usage_limit?: number | null;
  used_count?: number | null;
  status?: VoucherStatus;
  computed_status?: string;
  apply_to_service_type?: ServiceScope;
  location_id?: number | null;
  location_name?: string | null;
};

const scopeLabel: Record<ServiceScope, string> = {
  all: "Tất cả",
  room: "Khách sạn",
  food: "Ăn uống",
  ticket: "Du lịch",
  other: "Khác",
};

const locationTypesForScope = (
  scope: ServiceScope,
): Set<LocationType> | null => {
  if (scope === "all") return null;
  if (scope === "room") return new Set(["hotel", "resort"]);
  if (scope === "food") return new Set(["restaurant", "cafe"]);
  if (scope === "ticket") return new Set(["tourist"]);
  return new Set(["other"]);
};

const OwnerVouchers = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OwnerVoucherRow[]>([]);
  const [locations, setLocations] = useState<OwnerLocationOption[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<
    OwnerLocationOption[]
  >([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    | "all"
    | VoucherStatus
    | "computed_active"
    | "computed_inactive"
    | "computed_expired"
  >("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerVoucherRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const watchCode = Form.useWatch("code", form);
  const watchCampaignName = Form.useWatch("campaign_name", form);
  const watchCampaignDesc = Form.useWatch("campaign_description", form);
  const watchDiscountType = Form.useWatch("discount_type", form);
  const watchDiscountValue = Form.useWatch("discount_value", form);
  const watchLocationId = Form.useWatch("location_id", form);
  const watchUsageLimit = Form.useWatch("usage_limit", form);
  const watchStatus = Form.useWatch("status", form);
  const watchStart = Form.useWatch("start_date", form);
  const watchEnd = Form.useWatch("end_date", form);

  const previewApplyText = useMemo(() => {
    if (watchLocationId == null) return "Toàn quốc";
    const id = Number(watchLocationId);
    const found = locations.find((l) => l.location_id === id);
    return found?.location_name ?? `#${id}`;
  }, [watchLocationId, locations]);

  const previewStatusText = useMemo(() => {
    const v = String((watchStatus as string) || "inactive");
    return v.toUpperCase();
  }, [watchStatus]);

  const previewStatusStyle = useMemo(() => {
    const s = (watchStatus as VoucherStatus) || "inactive";
    if (s === "active") return { backgroundColor: "#2ecc71" };
    if (s === "expired") return { backgroundColor: "#e74c3c" };
    return { backgroundColor: "#f39c12" };
  }, [watchStatus]);

  const refreshVouchers = async (silent = false) => {
    try {
      const vRes = await ownerApi.getVouchers();
      setItems((vRes?.data || []) as OwnerVoucherRow[]);
    } catch (err: unknown) {
      if (!silent) {
        message.error(getErrorMessage(err, "Lỗi tải vouchers"));
      }
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, lRes] = await Promise.all([
        ownerApi.getVouchers(),
        ownerApi.getLocations(),
      ]);
      const locs = (lRes?.data || []) as OwnerLocationOption[];
      setItems((vRes?.data || []) as OwnerVoucherRow[]);
      setLocations(locs);
      setFilteredLocations(locs);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải vouchers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: SSE để Owner thấy trạng thái mới ngay sau khi Admin duyệt/xóa
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) return;

    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as { type?: string };
        if (
          data?.type === "owner_voucher_updated" ||
          data?.type === "owner_voucher_deleted"
        ) {
          void refreshVouchers(true);
        }
      } catch {
        // ignore
      }
    };

    // Fallback: khi quay lại tab thì refresh 1 lần
    const onVisibility = () => {
      if (!document.hidden) void refreshVouchers(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      es.close();
    };
  }, []);

  const onCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      location_id: null,
      discount_type: "percent",
      apply_to_service_type: "all",
      min_order_value: 0,
      usage_limit: 100,
      max_uses_per_user: 1,
      status: "inactive",
    });
    setFilteredLocations(locations);
    setOpen(true);
  };

  const onEdit = useCallback(
    (row: OwnerVoucherRow) => {
      setEditing(row);
      form.setFieldsValue({
        ...row,
        location_id: row.location_id ?? null,
        start_date: row.start_date ? dayjs(row.start_date) : null,
        end_date: row.end_date ? dayjs(row.end_date) : null,
        apply_to_service_type: (row.apply_to_service_type ||
          "all") as ServiceScope,
        status: row.status || "inactive",
      });
      const scope = (row.apply_to_service_type || "all") as ServiceScope;
      const typeSet = locationTypesForScope(scope);
      const list = typeSet
        ? locations.filter((l) =>
            typeSet.has((l.location_type || "other") as LocationType),
          )
        : locations;
      setFilteredLocations(list);
      setOpen(true);
    },
    [form, locations],
  );

  const onSave = async () => {
    try {
      const valuesRaw = await form.validateFields();
      const values = {
        ...valuesRaw,
        location_id: valuesRaw.location_id ?? null,
        start_date: valuesRaw.start_date
          ? dayjs(valuesRaw.start_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
        end_date: valuesRaw.end_date
          ? dayjs(valuesRaw.end_date).format("YYYY-MM-DD HH:mm:ss")
          : null,
      };
      setSaving(true);
      if (editing) {
        await ownerApi.updateVoucher(editing.voucher_id, values);
        message.success("Đã cập nhật voucher");
      } else {
        await ownerApi.createVoucher(values);
        message.success("Đã tạo voucher (chờ admin duyệt)");
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const record = asRecord(err);
      if (Array.isArray(record.errorFields)) return;
      message.error(getErrorMessage(err, "Lỗi lưu voucher"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = useCallback(
    async (row: OwnerVoucherRow) => {
      try {
        await ownerApi.deleteVoucher(row.voucher_id);
        message.success("Đã xóa voucher");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa voucher"));
      }
    },
    [load],
  );

  const columns: ColumnsType<OwnerVoucherRow> = useMemo(
    () => [
      { title: "#", dataIndex: "voucher_id", width: 80 },
      { title: "Code", dataIndex: "code" },
      {
        title: "Phạm vi",
        width: 160,
        render: (_: unknown, row) =>
          scopeLabel[(row.apply_to_service_type || "all") as ServiceScope],
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        render: (v: unknown, row) => {
          if (typeof v === "string" && v.trim()) return v;
          return row.location_id != null ? "" : "Tất cả";
        },
      },
      {
        title: "Giảm",
        width: 140,
        render: (_: unknown, row) => {
          if (row.discount_type === "percent") return `${row.discount_value}%`;
          return `${Number(row.discount_value || 0).toLocaleString("vi-VN")}₫`;
        },
      },
      {
        title: "Đã dùng",
        width: 120,
        render: (_: unknown, row) =>
          `${Number(row.used_count || 0)}/${Number(row.usage_limit || 0)}`,
      },
      {
        title: "Trạng thái",
        dataIndex: "computed_status",
        width: 120,
        render: (s: string) => (
          <Tag
            color={
              s === "active" ? "green" : s === "inactive" ? "orange" : "red"
            }
          >
            {String(s).toUpperCase()}
          </Tag>
        ),
      },
      {
        title: "Hiệu lực",
        width: 220,
        render: (_: unknown, row) => (
          <div className="text-xs text-gray-600">
            <div>{row.start_date ? formatDateTimeVi(row.start_date) : ""}</div>
            <div>{row.end_date ? formatDateTimeVi(row.end_date) : ""}</div>
          </div>
        ),
      },
      {
        title: "Hành động",
        width: 180,
        render: (_: unknown, row) => (
          <Space>
            <Button size="small" onClick={() => onEdit(row)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa voucher?"
              description="Owner sẽ không còn thấy voucher này."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => onDelete(row)}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [onDelete, onEdit],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (items || [])
      .filter((row) => {
        if (statusFilter === "all") return true;
        const s = String(row.computed_status || row.status || "inactive");
        if (statusFilter === "computed_active") return s === "active";
        if (statusFilter === "computed_inactive") return s === "inactive";
        if (statusFilter === "computed_expired") return s === "expired";
        return s === statusFilter;
      })
      .filter((row) => {
        if (!normalizedSearch) return true;
        const hay = [
          row.code,
          row.campaign_name,
          row.campaign_description,
          row.location_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(normalizedSearch);
      });
  }, [items, search, statusFilter]);

  return (
    <MainLayout>
      <Card
        title="Voucher"
        loading={loading}
        extra={
          <Space>
            <Button onClick={() => refreshVouchers(false)}>Tải lại</Button>
            <Button type="primary" onClick={onCreate}>
              Tạo voucher
            </Button>
          </Space>
        }
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Space>
            <Input
              allowClear
              placeholder="Tìm theo code / chiến dịch / địa điểm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 320 }}
            />
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 220 }}
              options={[
                { value: "all", label: "Tất cả" },
                {
                  value: "computed_inactive",
                  label: "Ngừng hoạt động (chờ duyệt)",
                },
                { value: "computed_active", label: "Đang hoạt động" },
                { value: "computed_expired", label: "Hết hạn" },
              ]}
            />
          </Space>
        </div>
        <Table
          rowKey="voucher_id"
          dataSource={filteredItems}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={null}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={980}
      >
        <div className="bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-900 text-lg font-semibold">
              <GiftOutlined />
              <span>{editing ? "Cập nhật Voucher" : "Tạo Voucher Mới"}</span>
            </div>
            <div className="text-slate-500 text-sm">
              Thiết kế và quản lý voucher khuyến mãi cho chiến dịch của bạn
            </div>
          </div>

          <div className="h-px bg-slate-100 my-5" />

          <Form
            form={form}
            layout="vertical"
            onValuesChange={(changed) => {
              if (changed.apply_to_service_type) {
                const scope = changed.apply_to_service_type as ServiceScope;
                const typeSet = locationTypesForScope(scope);
                const list = typeSet
                  ? locations.filter((l) =>
                      typeSet.has((l.location_type || "other") as LocationType),
                    )
                  : locations;
                setFilteredLocations(list);
                const current = form.getFieldValue("location_id") as
                  | number
                  | null;
                if (
                  current != null &&
                  !list.some((l) => l.location_id === current)
                ) {
                  form.setFieldsValue({ location_id: null });
                }
              }
            }}
          >
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <InfoCircleOutlined className="text-sky-500" />
                    <div className="font-semibold">Thông tin cơ bản</div>
                  </div>

                  <Form.Item
                    name="code"
                    label="Mã Code"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="VD: TET2026" />
                  </Form.Item>

                  <Form.Item
                    name="campaign_name"
                    label="Tên chiến dịch"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="VD: Tết 2026 - Giảm giá toàn sản phẩm" />
                  </Form.Item>

                  <Form.Item
                    name="campaign_description"
                    label={
                      <span>
                        Mô tả chiến dịch{" "}
                        <span className="text-slate-400 font-normal">
                          (tùy chọn)
                        </span>
                      </span>
                    }
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Ghi chú nội dung chiến dịch"
                    />
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <CalendarOutlined className="text-sky-500" />
                    <div className="font-semibold">Thời gian áp dụng</div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="start_date"
                        label="Ngày bắt đầu"
                        rules={[{ required: true }]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="end_date"
                        label="Ngày kết thúc"
                        rules={[{ required: true }]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="status"
                    label="Trạng thái"
                    rules={[{ required: true }]}
                  >
                    <Select
                      disabled
                      options={[
                        {
                          value: "inactive",
                          label: "Ngừng hoạt động (chờ duyệt)",
                        },
                        { value: "active", label: "Đang hoạt động" },
                        { value: "expired", label: "Hết hạn" },
                      ]}
                    />
                  </Form.Item>
                </div>
              </Col>

              <Col xs={24} md={12}>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <PercentageOutlined className="text-sky-500" />
                    <div className="font-semibold">Cài đặt chiết khấu</div>
                  </div>

                  <Form.Item
                    name="discount_type"
                    label="Loại giảm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "percent", label: "Phần trăm (%)" },
                        { value: "amount", label: "Số tiền" },
                      ]}
                    />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="discount_value"
                        label="Giá trị giảm"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={0} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_discount_amount"
                        label="Giảm tối đa (nếu %)"
                      >
                        <InputNumber style={{ width: "100%" }} min={0} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="min_order_value"
                    label="Giá trị đơn tối thiểu"
                    rules={[{ required: true }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={0} />
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <GlobalOutlined className="text-sky-500" />
                    <div className="font-semibold">Phạm vi áp dụng</div>
                  </div>

                  <Form.Item
                    name="apply_to_service_type"
                    label="Phạm vi áp dụng"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={(
                        [
                          "all",
                          "room",
                          "food",
                          "ticket",
                          "other",
                        ] as ServiceScope[]
                      ).map((v) => ({ value: v, label: scopeLabel[v] }))}
                    />
                  </Form.Item>

                  <Form.Item
                    name="location_id"
                    label="Áp dụng cho địa điểm"
                    rules={[{ required: true }]}
                  >
                    <Select
                      allowClear
                      placeholder="Tất cả"
                      options={[
                        { value: null, label: "Tất cả" },
                        ...filteredLocations.map((l) => ({
                          value: l.location_id,
                          label: `${l.location_name} (#${l.location_id})`,
                        })),
                      ]}
                    />
                  </Form.Item>
                </div>

                <div className="h-px bg-slate-100 my-6" />

                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100 text-slate-800">
                    <TeamOutlined className="text-sky-500" />
                    <div className="font-semibold">Giới hạn sử dụng</div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="usage_limit"
                        label="Giới hạn lượt dùng"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={1} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="max_uses_per_user"
                        label="Tối đa mỗi user"
                        rules={[{ required: true }]}
                      >
                        <InputNumber style={{ width: "100%" }} min={1} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>

            <div className="mt-2">
              <div className="rounded-xl p-5 text-white bg-gradient-to-r from-indigo-600 to-purple-700 shadow-[0_5px_15px_rgba(52,152,219,0.3)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-bold tracking-wide bg-white/20 px-3 py-2 rounded-md">
                    {(watchCode as string) || "MÃ VOUCHER"}
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={previewStatusStyle}
                  >
                    {previewStatusText}
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold">
                  {(watchCampaignName as string) || "Tên chiến dịch"}
                </div>
                <div className="opacity-90 mt-1">
                  {(watchCampaignDesc as string) || "Mô tả chiến dịch"}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Giảm giá</div>
                    <div className="text-base font-semibold">
                      {watchDiscountType === "amount"
                        ? `${Number(watchDiscountValue || 0).toLocaleString("vi-VN")}₫`
                        : `${Number(watchDiscountValue || 0)}%`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Giới hạn</div>
                    <div className="text-base font-semibold">
                      {Number(watchUsageLimit || 0)} lượt
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Thời gian</div>
                    <div className="text-base font-semibold">
                      {watchStart
                        ? dayjs(watchStart).format("DD/MM/YYYY")
                        : "--"}{" "}
                      - {watchEnd ? dayjs(watchEnd).format("DD/MM/YYYY") : "--"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/15 p-3">
                    <div className="text-xs opacity-80">Áp dụng</div>
                    <div className="text-base font-semibold">
                      {previewApplyText}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                <Button
                  onClick={() => setOpen(false)}
                  style={{
                    backgroundColor: "#ecf0f1",
                    borderColor: "#ecf0f1",
                    color: "#7f8c8d",
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={onSave}
                  loading={saving}
                  icon={<SaveOutlined />}
                  style={{ backgroundColor: "#2ecc71", borderColor: "#2ecc71" }}
                >
                  Lưu Voucher
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </Modal>
    </MainLayout>
  );
};

export default OwnerVouchers;
