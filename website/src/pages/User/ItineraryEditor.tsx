import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import locationApi from "../../api/locationApi";
import { getErrorMessage } from "../../utils/safe";

interface ItineraryItemForm {
  tempId: string;
  day_number: number;
  sort_order: number;
  location_id: number | null;
  custom_name: string;
  custom_address: string;
  time: string;
  note: string;
  estimated_cost: string;
  location_name?: string;
}

interface LocationOption {
  location_id: number;
  name: string;
  address: string;
  type: string;
}

let tempCounter = 0;
const newTempId = () => `temp_${++tempCounter}`;

const ItineraryEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState<ItineraryItemForm[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal thêm địa điểm
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addCost, setAddCost] = useState("");

  // Tính số ngày
  const numDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;

  // Load dữ liệu khi edit
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await userApi.getItineraryDetail(Number(id));
        if (!cancelled && res.success) {
          const d = res.data;
          setTitle(d.title);
          setDescription(d.description || "");
          setStartDate(d.start_date?.slice(0, 10) || "");
          setEndDate(d.end_date?.slice(0, 10) || "");
          setItems(
            (d.items || []).map((item: any, idx: number) => ({
              tempId: newTempId(),
              day_number: item.day_number,
              sort_order: item.sort_order ?? idx,
              location_id: item.location_id,
              custom_name: item.custom_name || "",
              custom_address: item.custom_address || "",
              time: item.time || "",
              note: item.note || "",
              estimated_cost: item.estimated_cost != null ? String(item.estimated_cost) : "",
              location_name: item.location_name || "",
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, "Không thể tải lịch trình"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // Tìm kiếm địa điểm
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await locationApi.getLocations({ keyword: searchQuery.trim() });
      if (res.success) {
        setSearchResults(
          (res.data || []).map((l: any) => ({
            location_id: l.location_id,
            name: l.name,
            address: l.address || "",
            type: l.type,
          }))
        );
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Thêm địa điểm từ hệ thống
  const addFromSystem = (loc: LocationOption) => {
    setItems((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        day_number: activeDay,
        sort_order: prev.filter((i) => i.day_number === activeDay).length,
        location_id: loc.location_id,
        custom_name: "",
        custom_address: "",
        time: addTime,
        note: addNote,
        estimated_cost: addCost,
        location_name: loc.name,
      },
    ]);
    closeModal();
  };

  // Thêm địa điểm tự do
  const addCustom = () => {
    if (!customName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        day_number: activeDay,
        sort_order: prev.filter((i) => i.day_number === activeDay).length,
        location_id: null,
        custom_name: customName.trim(),
        custom_address: customAddress.trim(),
        time: addTime,
        note: addNote,
        estimated_cost: addCost,
      },
    ]);
    closeModal();
  };

  const closeModal = () => {
    setShowAddModal(false);
    setSearchQuery("");
    setSearchResults([]);
    setCustomName("");
    setCustomAddress("");
    setAddTime("");
    setAddNote("");
    setAddCost("");
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof ItineraryItemForm, value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("Tên lịch trình không được để trống"); return; }
    if (!startDate || !endDate) { alert("Vui lòng chọn ngày bắt đầu và kết thúc"); return; }
    if (new Date(startDate) > new Date(endDate)) { alert("Ngày kết thúc phải sau ngày bắt đầu"); return; }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        items: items.map((item, idx) => ({
          day_number: item.day_number,
          sort_order: idx,
          location_id: item.location_id,
          custom_name: item.custom_name || undefined,
          custom_address: item.custom_address || undefined,
          time: item.time || undefined,
          note: item.note || undefined,
          estimated_cost: item.estimated_cost ? Number(item.estimated_cost) : undefined,
        })),
      };

      if (isEdit) {
        await userApi.updateItinerary(Number(id), payload);
      } else {
        await userApi.createItinerary(payload);
      }
      navigate("/user/itineraries");
    } catch (err) {
      alert(getErrorMessage(err, "Không thể lưu lịch trình"));
    } finally {
      setSaving(false);
    }
  };

  const dayItems = items.filter((i) => i.day_number === activeDay);

  if (loading) {
    return (
      <UserLayout>
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải...</div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>{isEdit ? "✏️ Sửa lịch trình" : "🗓️ Tạo lịch trình mới"}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("/user/itineraries")}
              style={{ padding: "8px 16px", background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 6, cursor: "pointer" }}
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 24px",
                background: saving ? "#ccc" : "#1677ff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>

        {error && <p style={{ color: "#ff4d4f", marginBottom: 16 }}>{error}</p>}

        {/* Thông tin chung */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: 20, marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Tên lịch trình *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Du lịch Đà Lạt 3 ngày"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 15, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chuyến đi (tùy chọn)"
              rows={2}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Ngày bắt đầu *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 15, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Ngày kết thúc *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 15, boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>

        {/* Tabs theo ngày */}
        {numDays > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: 20 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  style={{
                    padding: "8px 16px",
                    background: activeDay === day ? "#1677ff" : "#f5f5f5",
                    color: activeDay === day ? "#fff" : "#333",
                    border: activeDay === day ? "none" : "1px solid #d9d9d9",
                    borderRadius: 6,
                    fontWeight: activeDay === day ? 600 : 400,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Ngày {day}
                </button>
              ))}
            </div>

            {/* Danh sách item trong ngày */}
            {dayItems.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999", padding: "30px 0" }}>
                Chưa có địa điểm nào cho ngày {activeDay}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {dayItems.map((item, idx) => (
                  <div
                    key={item.tempId}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 12,
                      background: "#fafafa",
                      borderRadius: 8,
                      border: "1px solid #f0f0f0",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#1677ff", minWidth: 24 }}>{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {item.location_name || item.custom_name || "Chưa có tên"}
                      </div>
                      {item.custom_address && (
                        <div style={{ fontSize: 13, color: "#888" }}>📍 {item.custom_address}</div>
                      )}
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 13, color: "#666" }}>
                        <input
                          value={item.time}
                          onChange={(e) => updateItem(item.tempId, "time", e.target.value)}
                          placeholder="Giờ"
                          style={{ width: 70, padding: "4px 6px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          value={item.note}
                          onChange={(e) => updateItem(item.tempId, "note", e.target.value)}
                          placeholder="Ghi chú"
                          style={{ flex: 1, padding: "4px 6px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          value={item.estimated_cost}
                          onChange={(e) => updateItem(item.tempId, "estimated_cost", e.target.value)}
                          placeholder="Chi phí"
                          type="number"
                          style={{ width: 100, padding: "4px 6px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.tempId)}
                      style={{ padding: "4px 8px", background: "#fff1f0", color: "#ff4d4f", border: "1px solid #ffa39e", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#f6ffed",
                color: "#52c41a",
                border: "1px solid #b7eb8f",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Thêm địa điểm
            </button>
          </div>
        )}
      </div>

      {/* Modal thêm địa điểm */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: "#fff", borderRadius: 12, width: 500, maxHeight: "80vh", overflow: "auto", padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>Thêm địa điểm — Ngày {activeDay}</h3>

            {/* Tìm kiếm từ hệ thống */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Tìm từ hệ thống</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
                  placeholder="Nhập tên địa điểm..."
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6 }}
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  style={{ padding: "8px 16px", background: "#1677ff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  {searching ? "..." : "Tìm"}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginTop: 8, border: "1px solid #f0f0f0", borderRadius: 6, maxHeight: 150, overflow: "auto" }}>
                  {searchResults.map((loc) => (
                    <div
                      key={loc.location_id}
                      onClick={() => addFromSystem(loc)}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f6ffed")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <strong>{loc.name}</strong>
                      <div style={{ fontSize: 12, color: "#888" }}>{loc.address} · {loc.type}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center", color: "#999", margin: "12px 0", fontSize: 13 }}>— hoặc nhập địa điểm tự do —</div>

            {/* Nhập tự do */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Tên địa điểm *</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ví dụ: Nhà hàng ABC"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Địa chỉ</label>
              <input
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Ví dụ: 123 Đường XYZ, Đà Lạt"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Giờ</label>
                <input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Chi phí dự kiến (VND)</label>
                <input
                  type="number"
                  value={addCost}
                  onChange={(e) => setAddCost(e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, marginBottom: 4, display: "block" }}>Ghi chú</label>
              <input
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="Ghi chú (tùy chọn)"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d9d9d9", borderRadius: 6, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                style={{ padding: "8px 16px", background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 6, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={addCustom}
                disabled={!customName.trim()}
                style={{
                  padding: "8px 16px",
                  background: customName.trim() ? "#52c41a" : "#ccc",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: customName.trim() ? "pointer" : "not-allowed",
                  fontWeight: 600,
                }}
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default ItineraryEditor;
