import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { getErrorMessage } from "../../utils/safe";

interface ItinerarySummary {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  total_items: number;
  total_estimated_cost: number;
  visited_count: number;
  created_at: string;
}

const Itineraries = () => {
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userApi.getItineraries();
      if (res.success) setItineraries(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Không thể tải lịch trình"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Xóa lịch trình "${title}"?`)) return;
    try {
      await userApi.deleteItinerary(id);
      setItineraries((prev) => prev.filter((i) => i.itinerary_id !== id));
    } catch (err) {
      alert(getErrorMessage(err, "Không thể xóa"));
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);

  const countDays = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / 86400000) + 1);
  };

  return (
    <UserLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>🗓️ Lịch trình của tôi</h2>
          <button
            onClick={() => navigate("/user/itineraries/create")}
            style={{
              padding: "10px 24px",
              background: "#1677ff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Tạo lịch trình mới
          </button>
        </div>

        {loading && <p style={{ textAlign: "center", color: "#888" }}>Đang tải...</p>}
        {error && <p style={{ textAlign: "center", color: "#ff4d4f" }}>{error}</p>}

        {!loading && !error && itineraries.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#999" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 16 }}>Chưa có lịch trình nào</p>
            <button
              onClick={() => navigate("/user/itineraries/create")}
              style={{
                padding: "10px 24px",
                background: "#1677ff",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                cursor: "pointer",
                marginTop: 12,
              }}
            >
              Tạo lịch trình đầu tiên
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {itineraries.map((it) => (
            <div
              key={it.itinerary_id}
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #f0f0f0",
                padding: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "box-shadow 0.2s",
              }}
              onClick={() => navigate(`/user/itineraries/${it.itinerary_id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{it.title}</h3>
                  {it.description && (
                    <p style={{ margin: "0 0 8px", color: "#666", fontSize: 14 }}>{it.description}</p>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#888" }}>
                    <span>📅 {formatDate(it.start_date)} — {formatDate(it.end_date)}</span>
                    <span>📍 {it.total_items} địa điểm</span>
                    <span>{countDays(it.start_date, it.end_date)} ngày</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(it.itinerary_id, it.title);
                  }}
                  style={{
                    padding: "6px 12px",
                    background: "#fff1f0",
                    color: "#ff4d4f",
                    border: "1px solid #ffa39e",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Xóa
                </button>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 16,
                  fontSize: 13,
                  color: "#555",
                }}
              >
                <span>
                  ✅ {it.visited_count}/{it.total_items} đã đến
                </span>
                {it.total_estimated_cost > 0 && (
                  <span>💰 {formatMoney(it.total_estimated_cost)} dự kiến</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </UserLayout>
  );
};

export default Itineraries;
