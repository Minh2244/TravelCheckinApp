import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Col,
  Image,
  Row,
  Tag,
  message,
  Spin,
  Input,
} from "antd";
import {
  DashboardOutlined,
  LoadingOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  StarFilled,
  SearchOutlined,
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
  location_type?: string | null;
  first_image?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: string | number | null;
  total_reviews?: number | null;
  status?: string | null;
};

const OwnerNavigate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<unknown>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  
  // Search & Filter State
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const meData = asRecord(asRecord(me).data);
  const userName = String(asRecord(meData.actor).full_name || "Chủ cửa hàng");

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
        const locData = (locRes?.data || []) as LocationRow[];
        setLocations(locData);
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi tải dữ liệu"));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  const onSelectLocation = (locationId: number) => {
    localStorage.setItem(STORAGE_KEY, String(locationId));
    navigate("/owner/front-office");
  };

  const getLocationTypeTag = (type?: string | null) => {
    const t = String(type || "").toLowerCase();
    switch (t) {
      case "hotel":
      case "resort":
        return <Tag color="blue" className="rounded-full px-2.5 m-0 font-medium">Khách sạn</Tag>;
      case "restaurant":
      case "cafe":
        return <Tag color="orange" className="rounded-full px-2.5 m-0 font-medium">Nhà hàng / POS</Tag>;
      case "tourist":
        return <Tag color="green" className="rounded-full px-2.5 m-0 font-medium">Khu du lịch</Tag>;
      default:
        return <Tag color="default" className="rounded-full px-2.5 m-0 font-medium">Dịch vụ</Tag>;
    }
  };

  // Filter & Search Logic
  const filteredLocations = useMemo(() => {
    return locations.filter((l) => {
      // 1. Filter by category
      const type = String(l.location_type || "").toLowerCase();
      if (selectedCategory !== "all") {
        if (selectedCategory === "hotel" && type !== "hotel" && type !== "resort") return false;
        if (selectedCategory === "restaurant" && type !== "restaurant" && type !== "cafe") return false;
        if (selectedCategory === "tourist" && type !== "tourist") return false;
      }

      // 2. Filter by search text
      if (searchText.trim()) {
        const query = searchText.toLowerCase().trim();
        const nameMatch = l.location_name.toLowerCase().includes(query);
        const addressMatch = (l.address || "").toLowerCase().includes(query);
        return nameMatch || addressMatch;
      }

      return true;
    });
  }, [locations, selectedCategory, searchText]);

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1400px] px-6 py-6 md:py-10">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              Chào mừng trở lại, {userName}
            </h1>
            <p className="text-slate-500 text-sm md:text-base mb-0">
              Chọn một địa điểm để vào chế độ Vận Hành.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              icon={<DashboardOutlined />}
              onClick={() => navigate("/owner/dashboard")}
              className="border-slate-200 hover:border-blue-500 hover:text-blue-500 rounded-xl font-medium h-10 px-4 flex items-center gap-1.5"
            >
              Về Dashboard
            </Button>
            <Tag color="blue" className="rounded-full px-3 py-1 m-0 font-semibold border-0 bg-blue-50 text-blue-600 text-xs">
              Quyền Owner
            </Tag>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-100">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "all", label: "Tất cả" },
              { key: "hotel", label: "Khách sạn" },
              { key: "restaurant", label: "Nhà hàng / POS" },
              { key: "tourist", label: "Khu du lịch" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all duration-150 border-0 cursor-pointer ${
                  selectedCategory === tab.key
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Real-time Search Input */}
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder="Tìm kiếm địa điểm..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="rounded-2xl h-10 border-slate-200 hover:border-blue-500 focus:border-blue-500 shadow-sm"
              allowClear
            />
          </div>
        </div>

        {/* Locations Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            <div className="mt-4 text-slate-500 text-sm font-medium">Đang đồng bộ dữ liệu địa điểm...</div>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-4">
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Không tìm thấy địa điểm phù hợp</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-0">Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc danh mục khác.</p>
          </div>
        ) : (
          <Row gutter={[24, 24]}>
            {filteredLocations.map((l) => {
              const imageUrl = resolveBackendUrl(l.first_image) || null;

              return (
                <Col xs={24} sm={12} md={8} xl={6} key={l.location_id}>
                  <div
                    onClick={() => onSelectLocation(l.location_id)}
                    className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white p-3 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col h-full justify-between"
                  >
                    {/* Location Image Cover */}
                    <div className="relative h-48 w-full overflow-hidden rounded-2xl bg-slate-50 shadow-inner">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          width="100%"
                          height="100%"
                          style={{ objectFit: "cover" }}
                          preview={false}
                          className="transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                          <ShopOutlined className="text-4xl mb-2" />
                          <span className="text-xs">Chưa có ảnh địa điểm</span>
                        </div>
                      )}
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-85" />

                      {/* Header tags on image */}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        {getLocationTypeTag(l.location_type)}
                      </div>

                      {/* Active Status Badge */}
                      <div className="absolute top-3 right-3">
                        {l.status === "active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            Đang mở
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/90 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm shadow-sm">
                            Tạm dừng
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-3 right-3">
                        <span className="text-xs text-white/90 font-medium drop-shadow-sm">Mã chi nhánh: #{l.location_id}</span>
                      </div>
                    </div>

                    {/* Location Info Body */}
                    <div className="pt-4 flex-1 flex flex-col justify-between">
                      <div className="mb-4">
                        <h3 className="text-base font-extrabold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors duration-150 mb-2">
                          {l.location_name}
                        </h3>
                        
                        {/* Address */}
                        <div className="flex items-start gap-2 text-slate-400 text-xs mb-2.5">
                          <EnvironmentOutlined className="mt-0.5 text-slate-400 flex-shrink-0" />
                          <span className="line-clamp-2 text-slate-500">{l.address || "Chưa cập nhật địa chỉ"}</span>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2.5">
                          <PhoneOutlined className="text-slate-400 flex-shrink-0" />
                          <span className="text-slate-500">{l.phone || "Chưa có số điện thoại"}</span>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-yellow-500 flex items-center gap-1">
                            <StarFilled />
                            <span className="font-bold text-slate-700">{l.rating || "5.0"}</span>
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-400 font-medium">{l.total_reviews || 0} lượt đánh giá</span>
                        </div>
                      </div>

                      {/* Eye-catching Primary Call to Action Button */}
                      <div className="mt-2 w-full">
                        <div className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:from-blue-600 group-hover:to-indigo-700 border-0">
                          Vào quầy vận hành
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </MainLayout>
  );
};

export default OwnerNavigate;
