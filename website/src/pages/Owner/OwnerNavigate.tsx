import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Image,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  DashboardOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord, getErrorMessage } from "../../utils/safe";

const STORAGE_KEY = "tc_front_office_location_id";

type LocationRow = {
  location_id: number;
  location_name: string;
  first_image?: string | null;
};

const OwnerNavigate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState<number | null>(null);

  const meData = asRecord(asRecord(me).data);
  const employeeContext = asRecord(meData.employee_context);
  const role = String(asRecord(meData.actor).role || "");

  const locationOptions = useMemo(
    () =>
      locations.map((l) => ({
        value: Number(l.location_id),
        label: `${l.location_name} (#${l.location_id})`,
      })),
    [locations],
  );

  const selectedLocation = useMemo(() => {
    if (!locationId) return null;
    return (
      locations.find((l) => Number(l.location_id) === Number(locationId)) ||
      null
    );
  }, [locationId, locations]);

  const selectedLocationImageUrl = useMemo(() => {
    const firstImage =
      (selectedLocation?.first_image as string | null | undefined) || null;
    return resolveBackendUrl(firstImage) || null;
  }, [selectedLocation]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const meRes = await ownerApi.getMe();
        setMe(meRes);

        const meResData = asRecord(asRecord(meRes).data);
        if (String(asRecord(meResData.actor).role) === "employee") {
          navigate("/employee/front-office", { replace: true });
          return;
        }

        const locRes = await ownerApi.getLocations();
        setLocations((locRes?.data || []) as LocationRow[]);

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && Number.isFinite(Number(stored))) {
          setLocationId(Number(stored));
        } else if (locRes?.data?.[0]?.location_id) {
          setLocationId(Number(locRes.data[0].location_id));
        }
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải dữ liệu"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const onEnterFrontOffice = () => {
    if (role === "employee") {
      navigate("/employee/front-office");
      return;
    }
    if (!locationId) {
      message.warning("Vui lòng chọn địa điểm làm việc");
      return;
    }
    localStorage.setItem(STORAGE_KEY, String(locationId));
    navigate("/owner/front-office");
  };

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-6xl px-2 md:px-4 -mt-2 md:-mt-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-2 md:p-3">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(59,130,246,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />

          <Card
            loading={loading}
            className="shadow-sm relative z-10"
            variant="borderless"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <Typography.Title level={2} className="!mb-0">
                  Chế độ làm việc
                </Typography.Title>
                <Typography.Paragraph className="!mt-1 !mb-0 text-gray-600 text-base">
                  Chọn nhanh <b>Front-office</b> để vận hành tại quầy, hoặc quay
                  về
                  <b> Back-office</b> để quản lý dịch vụ/địa điểm.
                </Typography.Paragraph>
              </div>
              <Space wrap>
                <Button
                  icon={<DashboardOutlined />}
                  onClick={() => navigate("/owner/dashboard")}
                >
                  Về Dashboard
                </Button>
                <Tag color={role === "owner" ? "geekblue" : "purple"}>
                  {role === "owner" ? "Owner" : "Employee"}
                </Tag>
              </Space>
            </div>

            <Divider className="!my-3" />

            <Row gutter={[16, 16]} align="stretch">
              <Col xs={24} md={14}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <QrcodeOutlined />
                      <span>Front-office</span>
                    </Space>
                  }
                  extra={<Tag color="geekblue">Vận hành tại quầy</Tag>}
                  className="border border-blue-100"
                >
                  <Typography.Paragraph className="text-gray-600 text-base">
                    Duyệt check-in, xử lý booking, bán vé/POS/PMS theo địa điểm.
                  </Typography.Paragraph>

                  {role === "owner" ? (
                    <>
                      <Typography.Text strong>
                        Địa điểm làm việc
                      </Typography.Text>
                      <div className="mt-2">
                        <Select
                          style={{ width: "100%" }}
                          value={locationId ?? undefined}
                          options={locationOptions}
                          placeholder="Chọn địa điểm"
                          showSearch
                          optionFilterProp="label"
                          onChange={(v) => setLocationId(Number(v))}
                          size="large"
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          Hệ thống sẽ ghi nhớ địa điểm bạn chọn.
                        </div>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border bg-gray-50">
                        {selectedLocationImageUrl ? (
                          <Image
                            src={selectedLocationImageUrl}
                            width="100%"
                            height={280}
                            style={{ objectFit: "cover" }}
                            preview
                          />
                        ) : (
                          <div className="h-[280px] w-full flex items-center justify-center text-gray-400">
                            Chưa có ảnh địa điểm
                          </div>
                        )}
                        <div className="p-3">
                          <div className="font-medium">
                            {selectedLocation
                              ? `${selectedLocation.location_name} (#${selectedLocation.location_id})`
                              : "Chưa chọn địa điểm"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Front-office sẽ dùng địa điểm này để vận hành.
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border bg-gray-50 p-3">
                      <div className="font-medium">
                        {employeeContext.location_name
                          ? `${String(employeeContext.location_name)} (#${String(employeeContext.location_id)})`
                          : "Chưa được gán địa điểm"}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Chức vụ: {String(employeeContext.position || "-")}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <Button
                      icon={<ArrowRightOutlined />}
                      type="primary"
                      onClick={onEnterFrontOffice}
                      disabled={role === "owner" && !locationId}
                    >
                      Vào Front-office
                    </Button>
                  </div>
                </Card>
              </Col>

              <Col xs={24} md={10}>
                <Card
                  type="inner"
                  title={
                    <Space>
                      <AppstoreOutlined />
                      <span>Back-office</span>
                    </Space>
                  }
                  extra={<Tag color="blue">Quản lý</Tag>}
                  className="border border-indigo-100"
                >
                  <Typography.Paragraph className="text-gray-600 text-base">
                    Quản lý địa điểm, danh mục/dịch vụ, sơ đồ vận hành, booking,
                    báo cáo.
                  </Typography.Paragraph>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span>Địa điểm & hình ảnh</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span>Dịch vụ & danh mục</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span>Sơ đồ vận hành</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <span>Booking, thanh toán, thống kê</span>
                    </div>
                  </div>

                  <Divider className="!my-3" />
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <div className="text-sm font-medium text-blue-900">
                      Mẹo nhanh
                    </div>
                    <div className="mt-1 text-xs text-blue-900/70">
                      Nếu bạn đổi sơ đồ/giá/danh mục, hãy refresh Front-office
                      để cập nhật.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Tag color="blue">Dịch vụ</Tag>
                      <Tag color="blue">Sơ đồ vận hành</Tag>
                      <Tag color="blue">Quản lí đặt chỗ</Tag>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default OwnerNavigate;
