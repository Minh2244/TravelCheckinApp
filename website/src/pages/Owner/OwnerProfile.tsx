import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Space,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import { SaveOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";

import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type LoginHistoryRow = {
  login_id: number;
  success: 0 | 1;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
};

const PERSON_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)*$/u;
const PHONE_PATTERN = /^0\d{9}$/;

const normalizePersonName = (value: string) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const isValidPersonName = (value: string) =>
  PERSON_NAME_PATTERN.test(normalizePersonName(value));

const isValidPhoneNumber = (value: string) =>
  PHONE_PATTERN.test(String(value || "").trim());

const getRoleLabel = (role: string | null | undefined): string => {
  switch (
    String(role || "")
      .trim()
      .toLowerCase()
  ) {
    case "owner":
      return "Chủ địa điểm";
    case "employee":
      return "Nhân viên";
    case "admin":
      return "Quản trị viên";
    case "user":
      return "Người dùng";
    default:
      return role || "-";
  }
};

const getStatusLabel = (status: string | null | undefined): string => {
  switch (
    String(status || "")
      .trim()
      .toLowerCase()
  ) {
    case "active":
      return "Hoạt động";
    case "inactive":
      return "Ngừng hoạt động";
    case "pending":
      return "Chờ duyệt";
    default:
      return status || "-";
  }
};

const OwnerProfile = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form] = Form.useForm();

  const [actor, setActor] = useState<unknown>(null);
  const actorRole = String(asRecord(actor).role || "");
  const isOwner = useMemo(() => actorRole === "owner", [actorRole]);

  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<
    string | null
  >(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await ownerApi.getMe();
      const u = asRecord(asRecord(me).data).actor;
      setActor(u || null);

      form.setFieldsValue({
        full_name: asRecord(u).full_name,
        phone: asRecord(u).phone,
        avatar_url: "",
      });
      setPendingAvatarRemove(false);

      if (String(asRecord(u).role) === "owner") {
        const historyRes = await ownerApi.getLoginHistory(50);
        setLoginHistory((historyRes?.data || []) as LoginHistoryRow[]);
      } else {
        setLoginHistory([]);
      }
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải hồ sơ"));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    };
  }, [pendingAvatarPreview]);

  const onPickAvatarFile: UploadProps["beforeUpload"] = (file) => {
    if (!isOwner) return false;
    setPendingAvatarFile(file as File);
    setPendingAvatarRemove(false);
    setPendingAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file as File);
    });
    form.setFieldsValue({ avatar_url: "" });
    return false;
  };

  const persistLocalUser = (updates: {
    full_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
  }) => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return;
    try {
      const parsed = JSON.parse(userStr);
      sessionStorage.setItem("user", JSON.stringify({ ...parsed, ...updates }));
    } catch {
      // ignore
    }
  };

  const onSave = async () => {
    if (!isOwner) {
      message.info("Nhân viên chỉ xem thông tin (không chỉnh sửa)");
      return;
    }
    try {
      const values = (await form.validateFields()) as {
        full_name: string;
        phone?: string | null;
        avatar_url?: string | null;
      };
      const normalizedFullName = normalizePersonName(values.full_name);
      const normalizedPhone = values.phone?.trim() ? values.phone.trim() : null;
      const manualAvatarUrl = values.avatar_url?.trim()
        ? values.avatar_url.trim()
        : null;
      setSaving(true);

      if (pendingAvatarFile) {
        setUploadingAvatar(true);
        const uploadResp = await ownerApi.uploadAvatar(pendingAvatarFile);
        const uploadedUrl = uploadResp?.data?.avatar_url as string | undefined;
        if (!uploadedUrl) {
          message.error("Upload ảnh đại diện thất bại");
          return;
        }

        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          skip_avatar: true,
        });

        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      } else if (pendingAvatarRemove) {
        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          avatar_url: null,
        });
      } else {
        await ownerApi.updateProfile({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          ...(manualAvatarUrl
            ? { avatar_url: manualAvatarUrl }
            : { skip_avatar: true }),
        });
      }

      const refreshed = await ownerApi.getMe();
      const refreshedActor = asRecord(asRecord(refreshed).data).actor;
      persistLocalUser({
        full_name:
          String(asRecord(refreshedActor).full_name || "") ||
          normalizedFullName,
        phone:
          (asRecord(refreshedActor).phone as string | null | undefined) ??
          normalizedPhone,
        avatar_url:
          (asRecord(refreshedActor).avatar_url as string | null | undefined) ??
          null,
      });

      message.success("Đã cập nhật hồ sơ");
      window.dispatchEvent(new Event("tc-avatar-updated"));
      form.setFieldsValue({ avatar_url: "" });
      await load();
    } catch (err: unknown) {
      if (asRecord(err).errorFields) return;
      message.error(getErrorMessage(err, "Lỗi cập nhật hồ sơ"));
    } finally {
      setUploadingAvatar(false);
      setSaving(false);
    }
  };

  const avatarSrc =
    pendingAvatarPreview ||
    resolveBackendUrl(form.getFieldValue("avatar_url")) ||
    resolveBackendUrl(
      typeof asRecord(actor).avatar_url === "string"
        ? (asRecord(actor).avatar_url as string)
        : undefined,
    ) ||
    undefined;

  return (
    <MainLayout>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card
          title="Thông tin cá nhân"
          loading={loading}
          extra={
            isOwner ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
                loading={saving || uploadingAvatar}
              >
                Lưu
              </Button>
            ) : null
          }
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card bordered>
              <div className="flex flex-col items-center">
                <Avatar size={120} src={avatarSrc} icon={<UserOutlined />} />
                <div className="mt-3 text-lg font-semibold">
                  {String(asRecord(actor).full_name || "-")}
                </div>
                <div className="text-sm text-gray-500">
                  {String(asRecord(actor).email || "")}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={onPickAvatarFile}
                  >
                    <Button icon={<UploadOutlined />} disabled={!isOwner}>
                      Tải ảnh lên
                    </Button>
                  </Upload>
                  <Button
                    onClick={() => {
                      if (!isOwner) return;
                      form.setFieldsValue({ avatar_url: "" });
                      setPendingAvatarFile(null);
                      setPendingAvatarRemove(true);
                      setPendingAvatarPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                    }}
                    disabled={!isOwner}
                  >
                    Xóa avatar
                  </Button>
                </div>

                <Divider className="my-4" />

                <div className="w-full text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Trạng thái</span>
                    <Tag
                      color={
                        String(asRecord(actor).status) === "active"
                          ? "green"
                          : "red"
                      }
                    >
                      {getStatusLabel(String(asRecord(actor).status || "-"))}
                    </Tag>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-500">Vai trò</span>
                    <Tag color="blue">
                      {getRoleLabel(String(asRecord(actor).role || "-"))}
                    </Tag>
                  </div>
                </div>
              </div>
            </Card>

            <Card bordered>
              <div className="text-sm font-medium mb-3">Thông tin cá nhân</div>
              <Form form={form} layout="vertical" disabled={!isOwner}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Form.Item
                    name="full_name"
                    label="Họ tên"
                    rules={[
                      { required: true, message: "Nhập họ tên" },
                      {
                        validator: async (_rule, value?: string) => {
                          const normalized = normalizePersonName(value || "");
                          if (!normalized) return;
                          if (!isValidPersonName(normalized)) {
                            throw new Error(
                              "Họ tên không được chứa ký tự đặc biệt",
                            );
                          }
                        },
                      },
                    ]}
                  >
                    <Input maxLength={100} />
                  </Form.Item>
                  <Form.Item label="Email" style={{ marginBottom: 0 }}>
                    <Input
                      value={String(asRecord(actor).email || "")}
                      disabled
                    />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Form.Item
                    name="phone"
                    label="Số điện thoại"
                    rules={[
                      {
                        validator: async (_rule, value?: string) => {
                          const normalized = String(value || "").trim();
                          if (!normalized) return;
                          if (!isValidPhoneNumber(normalized)) {
                            throw new Error(
                              "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
                            );
                          }
                        },
                      },
                    ]}
                  >
                    <Input
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) => {
                        form.setFieldValue(
                          "phone",
                          event.target.value
                            .replace(/[^0-9]/g, "")
                            .slice(0, 10),
                        );
                      }}
                    />
                  </Form.Item>
                  <Form.Item label="Vai trò" style={{ marginBottom: 0 }}>
                    <Input
                      value={getRoleLabel(String(asRecord(actor).role || ""))}
                      disabled
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  name="avatar_url"
                  label="URL ảnh đại diện (tùy chọn)"
                  extra="Dán URL http/https hoặc dùng đường dẫn /uploads/... nếu cần."
                  rules={[
                    {
                      validator: async (_rule, value?: string) => {
                        const normalized = String(value || "").trim();
                        if (!normalized) return;
                        if (normalized.toLowerCase().startsWith("data:")) {
                          throw new Error(
                            "Không hỗ trợ data URL. Vui lòng dùng URL http/https hoặc upload ảnh.",
                          );
                        }
                        if (
                          !/^https?:\/\//i.test(normalized) &&
                          !normalized.startsWith("/uploads/")
                        ) {
                          throw new Error(
                            "URL phải bắt đầu bằng http://, https:// hoặc /uploads/...",
                          );
                        }
                      },
                    },
                  ]}
                >
                  <Input placeholder="https://... hoặc /uploads/..." />
                </Form.Item>

                {!isOwner ? (
                  <div className="text-xs text-gray-500">
                    Bạn đang đăng nhập bằng tài khoản <strong>nhân viên</strong>
                    . Trang này chỉ hiển thị thông tin.
                  </div>
                ) : null}
              </Form>
            </Card>
          </div>
        </Card>

        {isOwner ? (
          <Card title="Lịch sử đăng nhập" loading={loading}>
            {loginHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                Chưa có lịch sử đăng nhập.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100">
                <div className="hidden md:grid grid-cols-[220px_120px_180px_minmax(260px,1fr)] gap-3 border-b bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div>Thời gian</div>
                  <div>Thành công</div>
                  <div>Địa chỉ IP</div>
                  <div>Thiết bị / trình duyệt</div>
                </div>
                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 bg-white">
                  {loginHistory.map((item) => (
                    <div
                      key={item.login_id}
                      className="px-4 py-3 text-sm text-gray-700"
                    >
                      <div className="hidden md:grid md:grid-cols-[220px_120px_180px_minmax(260px,1fr)] md:gap-3">
                        <div>{formatDateTimeVi(item.created_at)}</div>
                        <div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              item.success
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {item.success ? "Thành công" : "Thất bại"}
                          </span>
                        </div>
                        <div>{item.ip_address || "-"}</div>
                        <div className="break-words">
                          {item.device_info || item.user_agent || "-"}
                        </div>
                      </div>
                      <div className="space-y-2 md:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                              Thời gian
                            </div>
                            <div className="mt-1 font-medium text-gray-900">
                              {formatDateTimeVi(item.created_at)}
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              item.success
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {item.success ? "Thành công" : "Thất bại"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                              Địa chỉ IP
                            </div>
                            <div className="mt-1">{item.ip_address || "-"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                              Thiết bị / trình duyệt
                            </div>
                            <div className="mt-1 break-words">
                              {item.device_info || item.user_agent || "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : null}
      </Space>
    </MainLayout>
  );
};

export default OwnerProfile;
