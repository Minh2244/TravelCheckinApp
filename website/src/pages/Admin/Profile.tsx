import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Pagination,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { SaveOutlined, UserOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { UploadProps } from "antd";

import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord } from "../../utils/safe";
import { formatDateVi } from "../../utils/formatDateVi";

interface AdminProfileDto {
  user_id: number;
  email: string | null;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  has_avatar_blob?: boolean;
  has_password?: boolean;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface LoginHistoryRow {
  login_id: number;
  success: 0 | 1;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
}

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
    case "admin":
      return "Quản trị viên";
    case "owner":
      return "Chủ địa điểm";
    case "employee":
      return "Nhân viên";
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

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const Profile = () => {
  const [profile, setProfile] = useState<AdminProfileDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<
    string | null
  >(null);
  const [pendingAvatarRemove, setPendingAvatarRemove] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginHistoryRow[]>([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [loginHistoryPagination, setLoginHistoryPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  });

  const [profileForm] = Form.useForm();
  const watchedAvatarUrl = Form.useWatch("avatar_url", profileForm);

  const persistLocalUser = (updates: {
    full_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
  }) => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr) as {
        full_name?: string;
        phone?: string | null;
        avatar_url?: string | null;
        email?: string | null;
        role?: string;
      };
      const nextAvatarUrl = updates.avatar_url;
      const shouldPersistAvatar =
        typeof nextAvatarUrl === "string" &&
        nextAvatarUrl.length > 0 &&
        // Tránh lưu data URL khổng lồ vào localStorage
        !(nextAvatarUrl.startsWith("data:") && nextAvatarUrl.length > 2000);

      sessionStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          ...updates,
          avatar_url: shouldPersistAvatar ? nextAvatarUrl : user.avatar_url,
        }),
      );
    } catch {
      // ignore
    }
  };

  const fetchProfile = async (): Promise<AdminProfileDto | null> => {
    try {
      setLoading(true);
      const response = await adminApi.getAdminProfile();
      if (response?.success) {
        const raw = response.data as AdminProfileDto;
        const data: AdminProfileDto = {
          ...raw,
          avatar_url:
            typeof raw.avatar_url === "string" &&
            raw.avatar_url.trim().toLowerCase().startsWith("data:")
              ? null
              : raw.avatar_url,
        };
        setProfile(data);
        profileForm.setFieldsValue({
          full_name: data.full_name,
          phone: data.phone,
          avatar_url: "",
        });

        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        if (
          typeof raw.avatar_url === "string" &&
          raw.avatar_url.trim().toLowerCase().startsWith("data:")
        ) {
          message.warning(
            "Ảnh đại diện đang lưu dưới dạng data URL quá dài. Hệ thống đã ẩn giá trị này khỏi ô nhập để tránh rối giao diện.",
          );
        }

        // DB rút gọn: không dùng avatar BLOB nữa. Hiển thị theo avatar_url.
        setAvatarObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        return data;
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải thông tin admin"));
    } finally {
      setLoading(false);
    }
    return null;
  };

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLoginHistory = async () => {
    try {
      setLoginHistoryLoading(true);
      const resp = await adminApi.getAdminLoginHistory({
        page: loginHistoryPagination.current,
        limit: loginHistoryPagination.pageSize,
      });
      if (resp?.success) {
        setLoginHistory((resp.data || []) as LoginHistoryRow[]);
        setLoginHistoryPagination((p) => ({
          ...p,
          total: resp.pagination?.total || 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải lịch sử đăng nhập"));
    } finally {
      setLoginHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginHistoryPagination.current, loginHistoryPagination.pageSize]);

  const submitProfile = async () => {
    try {
      const values = (await profileForm.validateFields()) as {
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

      // Determine what avatar action to take
      let avatarAction: "upload" | "url" | "remove" | "keep" = "keep";
      let finalAvatarUrl: string | null = null;

      if (pendingAvatarRemove) {
        avatarAction = "remove";
        finalAvatarUrl = null;
      } else if (pendingAvatarFile) {
        avatarAction = "upload";
        // Upload first
        setUploadingAvatar(true);
        const uploadResp = await adminApi.uploadAdminAvatar(pendingAvatarFile);
        if (!uploadResp?.success) {
          message.error("Upload ảnh thất bại. Vui lòng thử lại.");
          return;
        }
        finalAvatarUrl =
          (uploadResp.data?.avatar_url as string | null | undefined) ?? null;
        if (!finalAvatarUrl) {
          message.error("Upload ảnh thất bại (thiếu URL). Vui lòng thử lại.");
          return;
        }
        // Upload already saved avatar_path in DB, so we skip avatar in updateAdminProfile
        avatarAction = "keep"; // Upload already handled it
      } else if (manualAvatarUrl) {
        // User entered a URL
        avatarAction = "url";
        finalAvatarUrl = manualAvatarUrl;
      }
      // else: keep current avatar (no change)

      // Update profile - if avatar was just uploaded, skip_avatar=true to not override
      const updateData: {
        full_name: string;
        phone: string | null;
        avatar_url?: string | null;
        skip_avatar?: boolean;
      } = {
        full_name: normalizedFullName,
        phone: normalizedPhone,
      };

      if (avatarAction === "keep") {
        updateData.skip_avatar = true;
      } else if (avatarAction === "remove") {
        updateData.avatar_url = null;
      } else if (avatarAction === "url") {
        updateData.avatar_url = finalAvatarUrl;
      }

      const response = await adminApi.updateAdminProfile(updateData);

      if (response?.success) {
        message.success("Đã cập nhật thông tin");
        const refreshed = await fetchProfile();
        persistLocalUser({
          full_name: refreshed?.full_name || normalizedFullName,
          phone: refreshed?.phone ?? normalizedPhone,
          avatar_url: refreshed?.avatar_url ?? null,
        });
        window.dispatchEvent(new CustomEvent("tc-avatar-updated"));

        profileForm.setFieldsValue({ avatar_url: "" });
        setPendingAvatarFile(null);
        setPendingAvatarRemove(false);
        setPendingAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi cập nhật thông tin"));
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const extractUploadFile = (info: unknown): File | null => {
    const root = asRecord(info);
    const file = asRecord(root.file);
    const fileList = Array.isArray(root.fileList) ? root.fileList : [];
    const first = asRecord(fileList[0]);

    const candidate =
      file.originFileObj ?? first.originFileObj ?? (root.file as unknown);

    if (!candidate) return null;

    if (typeof candidate !== "object") return null;
    const maybeFile = candidate as { size?: unknown; type?: unknown };
    const isBlobLike =
      typeof maybeFile.size === "number" && typeof maybeFile.type === "string";

    return isBlobLike ? (candidate as File) : null;
  };

  const onAvatarUploadChange: UploadProps["onChange"] = async (info) => {
    const file = extractUploadFile(info);
    if (!file) {
      message.error("Không đọc được file ảnh. Vui lòng chọn lại.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      message.error("Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG/PNG/WebP)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error("Ảnh quá lớn (tối đa 50MB)");
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPendingAvatarFile(file);
    setPendingAvatarRemove(false);
    setPendingAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localPreviewUrl;
    });
    profileForm.setFieldsValue({ avatar_url: "" });
    message.success("Đã chọn ảnh. Bấm Lưu thay đổi để áp dụng.");
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-6">
          <div className="text-sm text-gray-500">Admin / Thông tin cá nhân</div>
          <h2 className="mt-1 text-2xl font-bold text-gray-800">
            Thông tin cá nhân
          </h2>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white shadow-md">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[320px_1fr]">
            {/* Left */}
            <div className="border-b border-gray-100 bg-gray-50/60 p-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-col items-center text-center">
                <Avatar
                  size={120}
                  src={
                    pendingAvatarPreview ||
                    (watchedAvatarUrl
                      ? resolveBackendUrl(watchedAvatarUrl)
                      : null) ||
                    avatarObjectUrl ||
                    resolveBackendUrl(profile?.avatar_url) ||
                    undefined
                  }
                  icon={
                    !pendingAvatarPreview &&
                    !watchedAvatarUrl &&
                    !avatarObjectUrl &&
                    !profile?.avatar_url ? (
                      <UserOutlined />
                    ) : undefined
                  }
                />

                <div className="mt-4 text-lg font-semibold text-gray-900">
                  {profile?.full_name || "-"}
                </div>
                <div className="text-sm text-gray-500">
                  {profile?.email || "-"}
                </div>

                <div className="mt-4 w-full">
                  <div className="flex w-full gap-2">
                    <div className="flex-1">
                      <Upload
                        accept="image/png,image/jpeg,image/webp"
                        showUploadList={false}
                        beforeUpload={() => false}
                        onChange={onAvatarUploadChange}
                        disabled={uploadingAvatar}
                      >
                        <Button type="primary" block loading={uploadingAvatar}>
                          Tải ảnh lên
                        </Button>
                      </Upload>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Hỗ trợ JPG/PNG/WebP, tối đa 50MB.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        setPendingAvatarFile(null);
                        setPendingAvatarRemove(true);
                        setPendingAvatarPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                        message.info(
                          "Đã chọn xóa avatar. Bấm Lưu thay đổi để áp dụng.",
                        );
                      }}
                    >
                      Xóa avatar
                    </Button>
                    <Button
                      onClick={() => {
                        setPendingAvatarFile(null);
                        setPendingAvatarRemove(false);
                        setPendingAvatarPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                        profileForm.setFieldsValue({
                          avatar_url: "",
                        });
                      }}
                    >
                      Hủy thay đổi
                    </Button>
                  </div>
                </div>

                <div className="mt-6 w-full rounded-xl bg-white p-4 text-left text-sm shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Trạng thái</span>
                    <span className="font-medium text-gray-900">
                      {getStatusLabel(profile?.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-600">Vai trò</span>
                    <span className="font-medium text-gray-900">
                      {getRoleLabel(profile?.role)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="p-6">
              <Card
                title="Thông tin cá nhân"
                variant="borderless"
                loading={loading}
                className="shadow-none"
                styles={{ header: { fontWeight: 600 } }}
              >
                <Form layout="vertical" form={profileForm}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Form.Item
                      label="Họ tên"
                      name="full_name"
                      rules={[
                        { required: true, message: "Vui lòng nhập họ và tên" },
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
                      <Input placeholder="Nhập họ và tên" maxLength={100} />
                    </Form.Item>

                    <Form.Item label="Email">
                      <Input
                        value={profile?.email || ""}
                        disabled
                        placeholder="-"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Số điện thoại"
                      name="phone"
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
                        placeholder="Nhập số điện thoại"
                        inputMode="numeric"
                        maxLength={10}
                        onChange={(event) => {
                          profileForm.setFieldValue(
                            "phone",
                            event.target.value
                              .replace(/[^0-9]/g, "")
                              .slice(0, 10),
                          );
                        }}
                      />
                    </Form.Item>

                    <Form.Item label="Vai trò">
                      <Input value={getRoleLabel(profile?.role)} disabled />
                    </Form.Item>
                  </div>

                  <Form.Item
                    label="URL ảnh đại diện (tùy chọn)"
                    name="avatar_url"
                    extra="Dán URL http/https (không hỗ trợ data URL). Hoặc upload ảnh từ thiết bị."
                    rules={[
                      {
                        validator: async (_rule, value?: string | null) => {
                          const v =
                            typeof value === "string" ? value.trim() : "";
                          if (!v) return;
                          const lower = v.toLowerCase();
                          if (lower.startsWith("data:")) {
                            throw new Error(
                              "Không hỗ trợ data URL. Vui lòng dùng URL http/https hoặc upload ảnh.",
                            );
                          }
                          if (v.length > 2048) {
                            throw new Error("URL quá dài (tối đa 2048 ký tự)");
                          }
                          if (!/^https?:\/\//i.test(v)) {
                            throw new Error(
                              "URL phải bắt đầu bằng http:// hoặc https://",
                            );
                          }
                        },
                      },
                    ]}
                  >
                    <Input placeholder="https://..." />
                  </Form.Item>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={submitProfile}
                    >
                      Lưu thay đổi
                    </Button>
                    <Button onClick={fetchProfile}>Đặt lại</Button>
                  </div>
                </Form>
              </Card>

              <Divider className="my-6" />

              <Divider className="my-6" />

              <Card
                title="Lịch sử đăng nhập"
                variant="borderless"
                className="shadow-none"
                styles={{
                  header: { fontWeight: 600 },
                  body: { paddingTop: 8 },
                }}
              >
                <Table
                  rowKey="login_id"
                  size="small"
                  loading={loginHistoryLoading}
                  dataSource={loginHistory}
                  pagination={false}
                  rowClassName={(_, idx) =>
                    idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }
                  columns={
                    [
                      {
                        title: "Thời gian",
                        dataIndex: "created_at",
                        key: "created_at",
                        width: 190,
                        render: (v: string) => formatDateVi(v),
                      },
                      {
                        title: "Kết quả",
                        dataIndex: "success",
                        key: "success",
                        width: 120,
                        render: (v: 0 | 1) =>
                          v === 1 ? (
                            <Tag color="green">Thành công</Tag>
                          ) : (
                            <Tag color="red">Thất bại</Tag>
                          ),
                      },
                      {
                        title: "Địa chỉ IP",
                        dataIndex: "ip_address",
                        key: "ip_address",
                        width: 160,
                        render: (v: string | null) => v || "-",
                      },
                      {
                        title: "Thiết bị / trình duyệt",
                        dataIndex: "user_agent",
                        key: "user_agent",
                        render: (v: string | null) => {
                          const value = v || "-";
                          return (
                            <Typography.Text
                              ellipsis={{ tooltip: value }}
                              style={{ maxWidth: 520, display: "inline-block" }}
                            >
                              {value}
                            </Typography.Text>
                          );
                        },
                      },
                    ] as ColumnsType<LoginHistoryRow>
                  }
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-gray-500">
                    Tổng {loginHistoryPagination.total} lần đăng nhập
                  </div>
                  <Pagination
                    current={loginHistoryPagination.current}
                    pageSize={5}
                    total={loginHistoryPagination.total}
                    showSizeChanger={false}
                    onChange={(page) =>
                      setLoginHistoryPagination((p) => ({
                        ...p,
                        current: page,
                      }))
                    }
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
