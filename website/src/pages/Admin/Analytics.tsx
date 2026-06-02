import { useEffect, useState } from "react";
import { Card, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";

type DayRow = { date: string; total: number };
type ProvinceRow = { province: string; total: number };
type TypeRow = { location_type: string; total: number };

const Analytics = () => {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [byDay, setByDay] = useState<DayRow[]>([]);
  const [byProvince, setByProvince] = useState<ProvinceRow[]>([]);
  const [byType, setByType] = useState<TypeRow[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCheckinAnalytics({ from, to });
      if (res?.success) {
        setByDay(res.data?.by_day || []);
        setByProvince(res.data?.by_province || []);
        setByType(res.data?.by_type || []);
      } else {
        message.error(res?.message || "Không lấy được analytics");
      }
    } catch {
      message.error("Không lấy được analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayColumns: ColumnsType<DayRow> = [
    { title: "Ngày", dataIndex: "date", key: "date" },
    { title: "Check-in", dataIndex: "total", key: "total" },
  ];

  const provinceColumns: ColumnsType<ProvinceRow> = [
    { title: "Tỉnh/Thành", dataIndex: "province", key: "province" },
    { title: "Check-in", dataIndex: "total", key: "total" },
  ];

  const typeColumns: ColumnsType<TypeRow> = [
    {
      title: "Loại địa điểm",
      dataIndex: "location_type",
      key: "location_type",
    },
    { title: "Check-in", dataIndex: "total", key: "total" },
  ];

  return (
    <MainLayout>
      <Typography.Title level={3}>Analytics check-in</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="date"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={fetchData}
          >
            Tải dữ liệu
          </button>
        </div>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Theo ngày" loading={loading}>
          <Table
            columns={dayColumns}
            dataSource={byDay}
            rowKey="date"
            pagination={false}
          />
        </Card>
        <Card title="Theo tỉnh/thành" loading={loading}>
          <Table
            columns={provinceColumns}
            dataSource={byProvince}
            rowKey="province"
            pagination={false}
          />
        </Card>
        <Card title="Theo loại địa điểm" loading={loading}>
          <Table
            columns={typeColumns}
            dataSource={byType}
            rowKey="location_type"
            pagination={false}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default Analytics;
