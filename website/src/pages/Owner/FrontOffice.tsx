import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import ownerApi from "../../api/ownerApi";
import FrontOfficeLayout from "../../layouts/FrontOfficeLayout";
import { formatMoney } from "../../utils/formatMoney";
import FrontOfficeHotel from "./FrontOfficeHotel";
import FrontOfficeRestaurant from "./FrontOfficeRestaurant";
import FrontOfficeTourist from "./FrontOfficeTourist";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { UserOutlined } from "@ant-design/icons";

const STORAGE_KEY = "tc_front_office_location_id";

type CheckinRow = {
  checkin_id: number;
  user_name?: string | null;
  user_phone?: string | null;
  checkin_time?: string | null;
  status?: string | null;
};

type BookingRow = {
  booking_id: number;
  user_name?: string | null;
  user_phone?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  service_name?: string | null;
  final_amount?: number | string | null;
  status?: string | null;
};

const FrontOffice = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [locationImageUrl, setLocationImageUrl] = useState<string | null>(null);
  const [context, setContext] = useState<unknown>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const meData = asRecord(asRecord(me).data);
  const role = String(asRecord(meData.actor).role || "");

  const logoutToLogin = useCallback(() => {
    try {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("user");
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const isSupportedTypedFrontOffice = (t: string) => {
    return (
      t === "hotel" ||
      t === "resort" ||
      t === "restaurant" ||
      t === "cafe" ||
      t === "tourist"
    );
  };

  const load = useCallback(async (resolvedLocationId: number) => {
    setLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([
        ownerApi.getCheckins({
          location_id: resolvedLocationId,
          status: "pending",
        }),
        ownerApi.getBookings({ location_id: resolvedLocationId }),
      ]);
      setCheckins(cRes?.data || []);
      setBookings(bRes?.data || []);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải dữ liệu Front-office"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fallback auto-refresh cho màn hình vận hành tổng quát (các loại địa điểm khác)
  useEffect(() => {
    if (!locationId) return;
    const t = String(locationType || "");
    if (isSupportedTypedFrontOffice(t)) return;

    const tick = () => {
      void load(locationId);
    };

    const id = window.setInterval(() => {
      if (document.hidden) return;
      tick();
    }, 5000);

    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, locationId, locationType]);

  const loadContext = useCallback(
    async (resolvedLocationId: number) => {
      try {
        const ctxRes = await ownerApi.getFrontOfficeContext({
          location_id: resolvedLocationId,
        });
        const data = asRecord(asRecord(ctxRes).data);
        const loc = data.location;
        const locR = asRecord(loc);

        setLocationName((locR.location_name as string | undefined) ?? null);
        setLocationType((locR.location_type as string | undefined) ?? null);
        const firstImage = locR.first_image;
        setLocationImageUrl(
          resolveBackendUrl(
            typeof firstImage === "string" ? firstImage : undefined,
          ) || null,
        );
        setContext(data.pos ?? null);

        const t = String(locR.location_type || "");
        if (!isSupportedTypedFrontOffice(t)) {
          await load(resolvedLocationId);
        }
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải context Front-office"));

        // Fallback to old behavior if context endpoint isn't available
        try {
          const locRes = await ownerApi.getLocations();
          const loc = (locRes?.data || []).find((item: unknown) => {
            const r = asRecord(item);
            return Number(r.location_id) === resolvedLocationId;
          });
          const locR = asRecord(loc);
          setLocationName((locR.location_name as string | undefined) ?? null);
          const firstImage = locR.first_image;
          setLocationImageUrl(
            resolveBackendUrl(
              typeof firstImage === "string" ? firstImage : undefined,
            ) || null,
          );
        } catch {
          setLocationName(null);
          setLocationImageUrl(null);
        }
        await load(resolvedLocationId);
      }
    },
    [load],
  );

  useEffect(() => {
    const run = async () => {
      try {
        const meRes = await ownerApi.getMe();
        setMe(meRes);

        const meResData = asRecord(asRecord(meRes).data);
        if (String(asRecord(meResData.actor).role) === "employee") {
          const ctx = asRecord(meResData.employee_context);
          if (!ctx.location_id) {
            message.error("Nhân viên chưa được gán địa điểm");
            navigate("/owner/dashboard");
            return;
          }
          const id = Number(ctx.location_id);
          setLocationId(id);
          setLocationName((ctx.location_name as string | undefined) ?? null);
          await loadContext(id);
          return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        const id =
          stored && Number.isFinite(Number(stored)) ? Number(stored) : null;
        if (!id) {
          navigate("/owner/navigate");
          return;
        }
        setLocationId(id);

        await loadContext(id);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải thông tin"));
      }
    };

    void run();
  }, [loadContext, navigate]);

  const verify = useCallback(
    async (row: CheckinRow) => {
      const notes = await new Promise<string | null>((resolve) => {
        let v = "";
        Modal.confirm({
          title: `Xác thực check-in #${row.checkin_id}`,
          content: (
            <div>
              <div className="text-xs text-gray-500 mb-2">
                Ghi chú (tuỳ chọn)
              </div>
              <Input
                onChange={(e) => (v = e.target.value)}
                placeholder="Ghi chú"
              />
            </div>
          ),
          okText: "Xác thực",
          cancelText: "Hủy",
          onOk: () => resolve(v.trim() ? v.trim() : null),
          onCancel: () => resolve(null),
        });
      });

      if (notes === null) return;

      try {
        await ownerApi.verifyCheckin(Number(row.checkin_id), notes);
        message.success("Đã xác thực check-in");
        if (locationId) await load(locationId);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xác thực check-in"));
      }
    },
    [load, locationId],
  );

  const fail = useCallback(
    async (row: CheckinRow) => {
      const reason = await new Promise<string | null>((resolve) => {
        let v = "";
        Modal.confirm({
          title: `Từ chối check-in #${row.checkin_id}`,
          content: (
            <div>
              <div className="text-xs text-gray-500 mb-2">Lý do</div>
              <Input
                onChange={(e) => (v = e.target.value)}
                placeholder="Lý do"
              />
            </div>
          ),
          okText: "Từ chối",
          okButtonProps: { danger: true },
          cancelText: "Hủy",
          onOk: () => resolve(v.trim() ? v.trim() : null),
          onCancel: () => resolve(null),
        });
      });

      if (reason === null) return;

      try {
        await ownerApi.failCheckin(Number(row.checkin_id), reason);
        message.success("Đã từ chối check-in");
        if (locationId) await load(locationId);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi từ chối check-in"));
      }
    },
    [load, locationId],
  );

  const checkinColumns = useMemo(
    () => [
      { title: "#", dataIndex: "checkin_id", width: 80 },
      { title: "Khách", dataIndex: "user_name" },
      { title: "SĐT", dataIndex: "user_phone" },
      { title: "Thời gian", dataIndex: "checkin_time", width: 170 },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 120,
        render: (s: string) => (
          <Tag
            color={
              s === "pending" ? "orange" : s === "verified" ? "green" : "red"
            }
          >
            {String(s).toUpperCase()}
          </Tag>
        ),
      },
      {
        title: "Hành động",
        width: 200,
        render: (_: unknown, row: CheckinRow) => (
          <Space>
            <Button size="small" type="primary" onClick={() => verify(row)}>
              Duyệt
            </Button>
            <Button size="small" danger onClick={() => fail(row)}>
              Từ chối
            </Button>
          </Space>
        ),
      },
    ],
    [fail, verify],
  );

  const bookingColumns = useMemo(
    () => [
      { title: "#", dataIndex: "booking_id", width: 80 },
      { title: "Khách", dataIndex: "user_name" },
      {
        title: "Liên hệ",
        width: 180,
        render: (_: unknown, row: BookingRow) => {
          const name = String(row.contact_name || "").trim();
          const phone = String(
            row.contact_phone || row.user_phone || "",
          ).trim();
          if (!name && !phone) return "-";
          if (name && phone) return `${name} - ${phone}`;
          return name || phone;
        },
      },
      { title: "Dịch vụ", dataIndex: "service_name" },
      {
        title: "Số tiền",
        dataIndex: "final_amount",
        width: 140,
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 140,
        render: (s: string) => {
          const color =
            s === "pending"
              ? "orange"
              : s === "confirmed"
                ? "blue"
                : s === "completed"
                  ? "green"
                  : "red";
          return <Tag color={color}>{String(s).toUpperCase()}</Tag>;
        },
      },
    ],
    [],
  );

  const subtitle =
    role === "employee"
      ? `Nhân viên • ${String(asRecord(meData.employee_context).position || "-")}`
      : "Owner";

  const renderByType = () => {
    if (!locationId) return null;
    const t = String(locationType || "");

    if (t === "hotel" || t === "resort") {
      const floors = Array.isArray(asRecord(context).floors)
        ? (asRecord(context).floors as unknown[])
            .map((x) => Number(x))
            .filter((x) => Number.isFinite(x))
        : [];
      return (
        <FrontOfficeHotel
          locationId={locationId}
          floors={floors}
          role={role === "employee" ? "employee" : "owner"}
        />
      );
    }

    if (t === "restaurant" || t === "cafe") {
      return (
        <FrontOfficeRestaurant
          locationId={locationId}
          role={role === "employee" ? "employee" : "owner"}
        />
      );
    }

    if (t === "tourist") {
      return (
        <FrontOfficeTourist
          locationId={locationId}
          role={role === "employee" ? "employee" : "owner"}
        />
      );
    }

    // Fallback operational view
    return (
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <Card title="Check-in chờ duyệt" loading={loading}>
          <Table
            rowKey="checkin_id"
            dataSource={checkins}
            columns={checkinColumns}
            pagination={false}
          />
        </Card>

        <Card title="Bookings" loading={loading}>
          <Table
            rowKey="booking_id"
            dataSource={bookings.slice(0, 50)}
            columns={bookingColumns}
            pagination={false}
          />
        </Card>
      </Space>
    );
  };

  return (
    <FrontOfficeLayout
      title={
        locationType === "hotel" || locationType === "resort"
          ? "Front-office (PMS)"
          : locationType === "restaurant" || locationType === "cafe"
            ? "Front-office (POS)"
            : locationType === "tourist"
              ? "Front-office (Tourist)"
              : "Front-office"
      }
      subtitle={subtitle}
      locationName={locationName}
      locationImageUrl={locationImageUrl}
      onBack={() => {
        if (role === "employee") {
          logoutToLogin();
          return;
        }
        navigate("/owner/navigate");
      }}
      extra={
        <Dropdown
          placement="bottomRight"
          menu={{
            items: [
              {
                key: "logout",
                label: "Đăng xuất",
                onClick: logoutToLogin,
              },
            ],
          }}
          trigger={["click"]}
        >
          <Button shape="circle" aria-label="Tài khoản">
            <Avatar
              size={28}
              icon={<UserOutlined />}
              style={{ backgroundColor: "transparent" }}
            />
          </Button>
        </Dropdown>
      }
    >
      {renderByType()}
    </FrontOfficeLayout>
  );
};

export default FrontOffice;
