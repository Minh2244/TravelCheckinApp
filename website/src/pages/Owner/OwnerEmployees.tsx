import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type EmployeeRow = {
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  position?: string | null;
};

type LocationRow = {
  location_id: number;
  location_name: string;
  location_type: string;
};

const OwnerEmployees = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, lRes] = await Promise.all([
        ownerApi.getEmployees(),
        ownerApi.getLocations(),
      ]);
      setItems((eRes?.data || []) as EmployeeRow[]);
      setLocations((lRes?.data || []) as LocationRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải nhân viên"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = () => {
    if (locations.length === 0) {
      Modal.warning({
        title: "Chưa có địa điểm",
        content: "Bạn cần tạo ít nhất 1 địa điểm trước khi tạo nhân viên.",
      });
      return;
    }
    setMode("create");
    setEditingId(null);
    form.resetFields();
    setOpen(true);
  };

  const onEdit = async (row: EmployeeRow) => {
    if (locations.length === 0) {
      Modal.warning({
        title: "Chưa có địa điểm",
        content: "Bạn cần tạo ít nhất 1 địa điểm trước khi sửa nhân viên.",
      });
      return;
    }

    setMode("edit");
    setEditingId(row.user_id);

    try {
      const detail = await ownerApi.getEmployeeDetail(row.user_id);
      const employee = (detail?.data?.employee || {}) as EmployeeRow;
      const assignments = (detail?.data?.assignments || []) as Array<
        Record<string, unknown>
      >;

      const active = assignments.find((a) => String(a.status) === "active");
      const locationId =
        active?.location_id != null ? Number(active.location_id) : undefined;
      const position =
        typeof active?.position === "string"
          ? String(active.position)
          : undefined;

      form.setFieldsValue({
        full_name: employee.full_name ?? row.full_name ?? "",
        email: employee.email ?? row.email ?? undefined,
        phone: employee.phone ?? row.phone ?? undefined,
        password: undefined,
        location_id: locationId ?? row.location_id ?? undefined,
        position: position ?? row.position ?? undefined,
      });

      setOpen(true);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải chi tiết nhân viên"));
    }
  };

  const onDelete = async (row: EmployeeRow) => {
    Modal.confirm({
      title: "Xóa nhân viên",
      content: `Bạn chắc chắn muốn xóa nhân viên ${row.full_name || ""}?`,
      okText: "Xóa",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await ownerApi.deleteEmployee(row.user_id);
          message.success("Đã xóa nhân viên");
          await load();
        } catch (err: unknown) {
          message.error(getErrorMessage(err, "Lỗi xóa nhân viên"));
        }
      },
    });
  };

  const onSave = async () => {
    try {
      const values = (await form.validateFields()) as Record<string, unknown>;
      setSaving(true);

      const passwordRaw = String(values.password || "").trim();
      const password = mode === "edit" ? passwordRaw || undefined : passwordRaw;

      const payload = {
        full_name: String(values.full_name || "").trim(),
        email: String(values.email || "").trim() || undefined,
        phone: String(values.phone || "").trim() || undefined,
        password,
        location_id: Number(values.location_id),
        position: String(values.position || "").trim(),
      };

      if (mode === "create") {
        await ownerApi.createEmployee(payload);
        message.success("Đã tạo nhân viên");
      } else {
        if (!editingId) {
          message.error("Không xác định được nhân viên đang sửa");
          return;
        }
        await ownerApi.updateEmployee(editingId, payload);
        message.success("Đã cập nhật nhân viên");
      }

      setOpen(false);
      await load();
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi tạo nhân viên"));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<EmployeeRow> = useMemo(
    () => [
      { title: "#", dataIndex: "user_id", width: 80 },
      { title: "Tên", dataIndex: "full_name" },
      { title: "Email", dataIndex: "email" },
      { title: "SĐT", dataIndex: "phone" },
      {
        title: "Địa điểm làm việc",
        dataIndex: "location_name",
        render: (_, r) => r.location_name || "-",
      },
      {
        title: "Vị trí làm việc",
        dataIndex: "position",
        width: 140,
        render: (_, r) => r.position || "-",
      },
      { title: "Trạng thái", dataIndex: "status", width: 120 },
      {
        title: "Hành động",
        key: "actions",
        width: 160,
        render: (_, r) => (
          <Space orientation="horizontal" size="small">
            <Button size="small" onClick={() => void onEdit(r)}>
              Sửa
            </Button>
            <Button danger size="small" onClick={() => void onDelete(r)}>
              Xóa
            </Button>
          </Space>
        ),
      },
    ],
    [locations.length],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((l) => ({
        value: l.location_id,
        label: `${l.location_name} (#${l.location_id})`,
        location_type: l.location_type,
      })),
    [locations],
  );

  const getPositionOptions = (locationId?: number) => {
    const loc = locations.find(
      (l) => Number(l.location_id) === Number(locationId),
    );
    const t = String(loc?.location_type || "").toLowerCase();
    if (t === "hotel" || t === "resort") {
      return [
        { value: "Lễ tân", label: "Lễ tân" },
        { value: "Buồng phòng", label: "Buồng phòng" },
      ];
    }
    if (t === "restaurant" || t === "cafe") {
      return [
        { value: "Thu ngân", label: "Thu ngân" },
        { value: "Phục vụ", label: "Phục vụ" },
      ];
    }
    if (t === "tourist") {
      return [
        { value: "Soát vé", label: "Soát vé" },
        { value: "Hướng dẫn", label: "Hướng dẫn" },
      ];
    }
    return [
      { value: "Thu ngân", label: "Thu ngân" },
      { value: "Phục vụ", label: "Phục vụ" },
    ];
  };

  return (
    <MainLayout>
      <Card
        title="Nhân viên"
        loading={loading}
        extra={
          <Button type="primary" onClick={onCreate}>
            Thêm nhân viên
          </Button>
        }
      >
        <Table
          rowKey="user_id"
          dataSource={items}
          columns={columns}
          pagination={false}
          scroll={{ y: 560 }}
        />
      </Card>

      <Modal
        title={mode === "create" ? "Tạo nhân viên" : "Sửa nhân viên"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSave}
        confirmLoading={saving}
        okText={mode === "create" ? "Tạo" : "Lưu"}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="full_name"
            label="Tên"
            rules={[{ required: true, message: "Nhập tên" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="SĐT">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              {
                validator: async (_, value) => {
                  const v = String(value || "").trim();
                  if (mode === "create") {
                    if (!v) throw new Error("Nhập mật khẩu");
                    if (v.length < 6)
                      throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
                    return;
                  }

                  if (!v) return;
                  if (v.length < 6)
                    throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
                },
              },
            ]}
          >
            <Input.Password
              placeholder={
                mode === "create" ? "Nhập mật khẩu" : "Để trống nếu không đổi"
              }
            />
          </Form.Item>

          <Form.Item
            name="location_id"
            label="Địa điểm làm việc"
            rules={[{ required: true, message: "Chọn địa điểm" }]}
          >
            <Select
              options={locationOptions}
              onChange={() => {
                // reset position when switching location
                form.setFieldsValue({ position: undefined });
              }}
            />
          </Form.Item>

          <Form.Item
            shouldUpdate={(prev, cur) => prev.location_id !== cur.location_id}
            noStyle
          >
            {({ getFieldValue }) => {
              const locId = getFieldValue("location_id");
              return (
                <Form.Item
                  name="position"
                  label="Chức vụ"
                  rules={[{ required: true, message: "Chọn chức vụ" }]}
                >
                  <Select
                    disabled={!locId}
                    options={getPositionOptions(locId)}
                    placeholder={locId ? "Chọn chức vụ" : "Chọn địa điểm trước"}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
};

export default OwnerEmployees;
