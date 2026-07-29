import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Image,
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
    let label = "Dịch vụ";
    let colorClass = "from-slate-500 to-slate-600";

    switch (t) {
      case "hotel":
      case "resort":
        label = "Khách sạn";
        colorClass = "from-blue-500 to-indigo-600";
        break;
      case "restaurant":
      case "cafe":
        label = "Nhà hàng";
        colorClass = "from-orange-500 to-rose-500";
        break;
      case "tourist":
        label = "Du lịch";
        colorClass = "from-emerald-500 to-teal-600";
        break;
    }

    return (
      <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${colorClass} px-2.5 py-1 text-[10px] font-bold text-white shadow-sm uppercase tracking-wider`}>
        {label}
      </span>
    );
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-[34px] font-black text-slate-900 tracking-tight mb-2.5 flex items-center gap-2">
              Chào mừng trở lại, {userName} <span className="inline-block animate-waving-hand origin-bottom-right">👋</span>
            </h1>
            <p className="text-slate-500 text-sm md:text-[15px] mb-0 font-medium max-w-2xl">
              Chọn một địa điểm kinh doanh bên dưới để bắt đầu phiên làm việc và vào chế độ Vận Hành (POS / Lễ tân).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              icon={<DashboardOutlined className="text-lg" />}
              onClick={() => navigate("/owner/dashboard")}
              className="border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-[14px] font-bold h-11 px-5 flex items-center gap-2 shadow-sm transition-all"
            >
              Về Dashboard
            </Button>
            <div className="flex items-center justify-center px-4 py-2.5 rounded-[14px] bg-indigo-50 border border-indigo-100 shadow-sm">
              <span className="relative flex h-2.5 w-2.5 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Quyền Owner</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col gap-4 mb-8 bg-white/80 backdrop-blur-xl p-4 rounded-[20px] shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-100/60 sticky top-[80px] z-20">
          {/* Category Filter Tabs */}
          <div className="flex flex-nowrap overflow-x-auto items-center gap-1.5 scrollbar-hide">
            {[
              { key: "all", label: "Tất cả" },
              { key: "hotel", label: "Khách sạn" },
              { key: "restaurant", label: "Nhà hàng" },
              { key: "tourist", label: "Khu du lịch" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all duration-300 border-0 cursor-pointer flex items-center justify-center min-w-[90px] ${selectedCategory === tab.key
                  ? "bg-slate-800 text-white shadow-md transform scale-100"
                  : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Real-time Search Input */}
          <div className="w-full sm:max-w-[420px]">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors duration-300">
                <SearchOutlined className={`text-base ${searchText ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-400'}`} />
              </div>
              <Input
                placeholder="Tìm kiếm theo tên, địa chỉ..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                bordered={false}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 hover:bg-slate-200/50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all duration-300 rounded-[14px] text-sm font-medium text-slate-700 placeholder-slate-400"
              />
            </div>
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
          <div className="flex flex-wrap gap-6 justify-start">
            {filteredLocations.map((l) => {
              const imageUrl = resolveBackendUrl(l.first_image) || null;

              return (
                <div
                  key={l.location_id}
                  className="w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] max-w-[200px]"
                >
                  <div
                    onClick={() => onSelectLocation(l.location_id)}
                    className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-slate-100 bg-white p-2 shadow-sm hover:shadow-xl hover:shadow-blue-500/15 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full justify-between"
                  >
                    {/* Location Image Cover */}
                    <div className="relative h-36 w-full overflow-hidden rounded-[14px] bg-slate-50">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          width="100%"
                          height="100%"
                          style={{ objectFit: "cover" }}
                          preview={false}
                          className="transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 bg-slate-100/50">
                          <ShopOutlined className="text-3xl mb-1.5 opacity-50" />
                          <span className="text-[11px] font-medium opacity-50">Chưa có ảnh</span>
                        </div>
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-300" />

                      {/* Header tags on image */}
                      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                        {getLocationTypeTag(l.location_type)}
                      </div>

                      {/* Active Status Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {l.status === "active" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider shadow-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            Đang mở
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 px-2 py-0.5 text-[9px] font-bold text-slate-300 uppercase tracking-wider shadow-sm">
                            Tạm dừng
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-end">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center rounded-md bg-white/20 backdrop-blur-sm px-1.5 py-0.5 text-[9px] text-white font-semibold uppercase tracking-wider border border-white/10">
                            #{l.location_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-1.5 py-0.5">
                          <StarFilled className="text-yellow-400 text-[10px]" />
                          <span className="text-[10px] font-bold text-white">{l.rating || "5.0"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location Info Body */}
                    <div className="pt-3 px-1.5 pb-0.5 flex-1 flex flex-col justify-between">
                      <div className="mb-3">
                        <h3 className="text-[15px] font-extrabold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors duration-200 mb-1.5 leading-snug tracking-tight">
                          {l.location_name}
                        </h3>

                        <div className="space-y-1">
                          {/* Address */}
                          <div className="flex items-start gap-2 text-slate-500 text-[12px]">
                            <EnvironmentOutlined className="mt-[2px] text-slate-400 flex-shrink-0" />
                            <span className="line-clamp-2 min-h-[34px] leading-relaxed">{l.address || "Chưa cập nhật địa chỉ"}</span>
                          </div>

                          {/* Phone */}
                          <div className="flex items-center gap-2 text-slate-500 text-[12px]">
                            <PhoneOutlined className="text-slate-400 flex-shrink-0" />
                            <span>{l.phone || "Chưa có số điện thoại"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Eye-catching Primary Call to Action Button */}
                      <div className="mt-2 w-full">
                        <div className="w-full h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-[12px] flex items-center justify-center transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:from-blue-600 group-hover:to-indigo-700 overflow-hidden relative">
                          <span className="relative z-10 flex items-center gap-1.5">
                            Vào quầy vận hành
                            <svg className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default OwnerNavigate;
