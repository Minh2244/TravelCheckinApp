import { useEffect, useState, useMemo } from "react";
import { Card, message, DatePicker, Button, Space, Typography, Select } from "antd";
import adminApi from "../../api/adminApi";
import { ReloadOutlined } from "@ant-design/icons";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import dayjs from "dayjs";

const { Title } = Typography;

type DayRow = { date: string; total: number };
type ProvinceRow = { province: string; total: number };
type TypeRow = { location_type: string; total: number };

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

const translateType = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'restaurant': return 'Ăn uống';
    case 'hotel': return 'Khách sạn';
    case 'tourist':
    case 'tour': return 'Du lịch';
    case 'entertainment': return 'Giải trí';
    case 'cafe': return 'Quán Cafe';
    case 'other': return 'Khác';
    default: return type ? (type === 'Không rõ' ? 'Chưa xác định' : type) : 'Khác';
  }
};

const getRegion = (province: string) => {
  if (!province) return "Không rõ";
  const normalized = province.toLowerCase().trim();
  
  const north = ["hà nội", "hải phòng", "hà giang", "cao bằng", "bắc kạn", "tuyên quang", "lào cai", "điện biên", "lai châu", "sơn la", "yên bái", "hòa bình", "thái nguyên", "lạng sơn", "quảng ninh", "bắc giang", "phú thọ", "vĩnh phúc", "bắc ninh", "hải dương", "hưng yên", "thái bình", "hà nam", "nam định", "ninh bình"];
  const central = ["thanh hóa", "nghệ an", "hà tĩnh", "quảng bình", "quảng trị", "huế", "đà nẵng", "quảng nam", "quảng ngãi", "bình định", "phú yên", "khánh hòa", "ninh thuận", "bình thuận", "kon tum", "gia lai", "đắk lắk", "đắk nông", "lâm đồng"];
  const south = ["hồ chí minh", "sài gòn", "bình phước", "tây ninh", "bình dương", "đồng nai", "vũng tàu", "long an", "tiền giang", "bến tre", "trà vinh", "vĩnh long", "đồng tháp", "an giang", "kiên giang", "cần thơ", "hậu giang", "sóc trăng", "bạc liêu", "cà mau"];

  if (north.some(k => normalized.includes(k))) return "Miền Bắc";
  if (central.some(k => normalized.includes(k))) return "Miền Trung";
  if (south.some(k => normalized.includes(k))) return "Miền Nam";
  
  return "Không rõ";
};

const AnalyticsTab = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ]);
  
  const [loading, setLoading] = useState(false);
  const [byDay, setByDay] = useState<DayRow[]>([]);
  const [byProvince, setByProvince] = useState<ProvinceRow[]>([]);
  const [byType, setByType] = useState<TypeRow[]>([]);

  const [globalProvince, setGlobalProvince] = useState("all");
  const [availableProvinces, setAvailableProvinces] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCheckinAnalytics({ 
        from: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : "all", 
        to: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : "all",
        province: globalProvince
      });
      if (res?.success) {
        setByDay(res.data?.by_day || []);
        setByProvince(res.data?.by_province || []);
        setByType(res.data?.by_type || []);

        if (globalProvince === "all") {
           setAvailableProvinces(res.data?.by_province.map((p: any) => p.province) || []);
        }
      } else {
        message.error(res?.message || "Không lấy được dữ liệu thống kê");
      }
    } catch {
      message.error("Lỗi khi tải dữ liệu thống kê");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalProvince]);

  const formattedByDay = useMemo(() => {
    return byDay.map(d => ({
      ...d,
      displayDate: new Date(d.date).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' })
    }));
  }, [byDay]);

  const regionData = useMemo(() => {
    const map = new Map<string, number>();
    map.set("Miền Bắc", 0);
    map.set("Miền Trung", 0);
    map.set("Miền Nam", 0);

    byProvince.forEach(p => {
      if (p.province && p.province !== 'Không rõ') {
        const region = getRegion(p.province);
        if (region !== "Không rõ") {
          map.set(region, (map.get(region) || 0) + Number(p.total));
        }
      }
    });

    return Array.from(map.entries())
      .map(([region, total]) => ({ province: region, total }))
      .filter(r => r.total > 0);
  }, [byProvince]);

  const translatedByType = useMemo(() => {
    const dataMap = new Map<string, number>();
    
    // Khởi tạo các dịch vụ cơ bản với giá trị 0
    ['restaurant', 'hotel', 'tourist'].forEach(t => dataMap.set(t, 0));
    
    byType.forEach(t => {
      const type = t.location_type?.toLowerCase() || 'other';
      dataMap.set(type, (dataMap.get(type) || 0) + Number(t.total));
    });

    return Array.from(dataMap.entries())
      .map(([type, total], index) => ({
        location_type: type,
        display_type: translateType(type),
        total,
        fill: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.total - a.total); // Sắp xếp giảm dần theo total
  }, [byType]);

  // Removed table columns

  return (
    <div className="space-y-6">
      {/* Header & Main Filter */}
      <Card 
        bordered={false} 
        style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
      >
        <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
          <div>
            <Title level={4} style={{ margin: 0 }}>Thống kê dữ liệu Check-in</Title>
            <p className="text-gray-500 m-0 text-sm mt-1">Phân tích hành vi và xu hướng người dùng toàn hệ thống</p>
          </div>
          <Space size="middle" className="flex-wrap">
            <Select
              value={globalProvince}
              onChange={(val) => setGlobalProvince(val || "all")}
              style={{ width: 180 }}
              size="large"
              allowClear
              placeholder="Tất cả địa điểm"
              options={[
                { value: "all", label: "Tất cả địa điểm" },
                ...availableProvinces.map(p => ({ value: p, label: p }))
              ]}
            />

            <DatePicker 
              value={dateRange[0]}
              onChange={(date) => setDateRange([date, dateRange[1]])}
              format="DD/MM/YYYY"
              placeholder="Từ ngày"
              size="large"
              style={{ borderRadius: 8, width: 140 }}
            />
            <DatePicker 
              value={dateRange[1]}
              onChange={(date) => setDateRange([dateRange[0], date])}
              format="DD/MM/YYYY"
              placeholder="Đến ngày"
              size="large"
              style={{ borderRadius: 8, width: 140 }}
            />
            <Button
              onClick={() => setDateRange([null, null])}
              size="large"
              style={{ borderRadius: 8 }}
            >
              Tất cả thời gian
            </Button>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={fetchData}
              loading={loading}
              size="large"
              style={{ borderRadius: 8, background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)", border: "none" }}
            >
              Cập nhật
            </Button>
          </Space>
        </div>
      </Card>

      {/* Main Trend Chart */}
      <Card 
        bordered={false} 
        style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
        title={<span className="font-semibold text-lg text-gray-800">📈 Xu hướng Check-in theo thời gian</span>}
        loading={loading}
      >
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer>
            <AreaChart data={formattedByDay} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
              />
              <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" name="Lượt Check-in" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Distributions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Province Analytics */}
        <Card 
          bordered={false} 
          style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
          title={<span className="font-semibold text-lg text-gray-800">🗺️ Phân bố theo Khu vực</span>}
          loading={loading}
          bodyStyle={{ paddingRight: 0 }}
        >
          <div className="pr-6">
            <div className="w-full overflow-y-auto custom-scrollbar" style={{ height: 350 }}>
              <div style={{ height: Math.max(300, regionData.length * 50) }}>
                <ResponsiveContainer>
                  <BarChart data={regionData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <YAxis dataKey="province" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} width={100} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Check-in" maxBarSize={40}>
                      {regionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Location Type Analytics */}
        <Card 
          bordered={false} 
          style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
          title={<span className="font-semibold text-lg text-gray-800">🏪 Phân bố theo Dịch vụ</span>}
          loading={loading}
        >
          <div className="flex flex-col gap-6 items-center">
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={translatedByType.filter(i => i.total > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="display_type"
                    label={(props: any) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                  >
                    {translatedByType.filter(i => i.total > 0).map((item, index) => (
                      <Cell key={`cell-${index}`} fill={item.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                  <Legend 
                    verticalAlign="bottom" 
                    content={() => (
                      <ul className="flex justify-center gap-6 pt-4 text-sm m-0 p-0" style={{ listStyle: 'none' }}>
                        {translatedByType.map((item, index) => (
                          <li key={`item-${index}`} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }}></span>
                            <span className="text-gray-600 font-medium">{item.display_type}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default AnalyticsTab;
