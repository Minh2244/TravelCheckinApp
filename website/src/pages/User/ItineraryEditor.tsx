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

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addCost, setAddCost] = useState("");

  const numDays =
    startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
      : 0;

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

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await locationApi.getLocations({ keyword: searchQuery.trim() });
      if (res.success) setSearchResults((res.data || []).map((l: any) => ({ location_id: l.location_id, name: l.name, address: l.address || "", type: l.type })));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const addFromSystem = (loc: LocationOption) => {
    setItems((prev) => [...prev, { tempId: newTempId(), day_number: activeDay, sort_order: prev.filter((i) => i.day_number === activeDay).length, location_id: loc.location_id, custom_name: "", custom_address: "", time: addTime, note: addNote, estimated_cost: addCost, location_name: loc.name }]);
    closeModal();
  };

  const addCustom = () => {
    if (!customName.trim()) return;
    setItems((prev) => [...prev, { tempId: newTempId(), day_number: activeDay, sort_order: prev.filter((i) => i.day_number === activeDay).length, location_id: null, custom_name: customName.trim(), custom_address: customAddress.trim(), time: addTime, note: addNote, estimated_cost: addCost }]);
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

  const removeItem = (tempId: string) => setItems((prev) => prev.filter((i) => i.tempId !== tempId));

  const updateItem = (tempId: string, field: keyof ItineraryItemForm, value: string) =>
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i)));

  const handleSave = async () => {
    if (!title.trim()) { alert("Tên lịch trình không được để trống"); return; }
    if (!startDate || !endDate) { alert("Vui lòng chọn ngày bắt đầu và kết thúc"); return; }
    if (new Date(startDate) > new Date(endDate)) { alert("Ngày kết thúc phải sau ngày bắt đầu"); return; }
    try {
      setSaving(true);
      const payload = { title: title.trim(), description: description.trim() || undefined, start_date: startDate, end_date: endDate, items: items.map((item, idx) => ({ day_number: item.day_number, sort_order: idx, location_id: item.location_id, custom_name: item.custom_name || undefined, custom_address: item.custom_address || undefined, time: item.time || undefined, note: item.note || undefined, estimated_cost: item.estimated_cost ? Number(item.estimated_cost) : undefined })) };
      if (isEdit) await userApi.updateItinerary(Number(id), payload);
      else await userApi.createItinerary(payload);
      navigate("/user/itineraries");
    } catch (err) { alert(getErrorMessage(err, "Không thể lưu lịch trình")); } finally { setSaving(false); }
  };

  const dayItems = items.filter((i) => i.day_number === activeDay);

  if (loading) {
    return (
      <UserLayout title="Lịch trình" activeKey="/user/itineraries">
        <div className="flex items-center justify-center py-20">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout title={isEdit ? "Sửa lịch trình" : "Tạo lịch trình"} activeKey="/user/itineraries">
      <section className="user-section p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/user/itineraries")} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 transition-colors">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase">{isEdit ? "CHỈNH SỬA" : "TẠO MỚI"}</span>
              <h2 className="text-xl font-black text-slate-800 font-heading">{isEdit ? "Sửa lịch trình" : "Tạo lịch trình mới"}</h2>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Đang lưu...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                Lưu lịch trình
              </>
            )}
          </button>
        </div>

        {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 mb-4">{error}</div>}

        {/* Form thông tin chung */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm mb-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Thông tin chuyến đi
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tên lịch trình *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Du lịch Đà Lạt 3 ngày"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mô tả</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chuyến đi (tùy chọn)"
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ngày bắt đầu *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ngày kết thúc *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs theo ngày */}
        {numDays > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Địa điểm theo ngày
            </h3>

            {/* Day tabs */}
            <div className="flex flex-wrap gap-2 mb-5 border-b border-slate-100 pb-4">
              {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => {
                const dayItemCount = items.filter((i) => i.day_number === day).length;
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    className={`relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                      activeDay === day
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                    }`}
                  >
                    Ngày {day}
                    {dayItemCount > 0 && (
                      <span className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold px-1 ${
                        activeDay === day ? "bg-white/25 text-white" : "bg-indigo-100 text-indigo-600"
                      }`}>
                        {dayItemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Items */}
            {dayItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 py-10 text-center mb-4">
                <div className="text-3xl mb-2">📍</div>
                <p className="text-sm text-slate-500">Chưa có địa điểm cho ngày {activeDay}</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {dayItems.map((item, idx) => (
                  <div
                    key={item.tempId}
                    className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all"
                  >
                    <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-800 truncate">
                        {item.location_name || item.custom_name || "Chưa có tên"}
                      </div>
                      {item.custom_address && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">📍 {item.custom_address}</div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <input
                          value={item.time}
                          onChange={(e) => updateItem(item.tempId, "time", e.target.value)}
                          placeholder="Giờ"
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-300 outline-none"
                        />
                        <input
                          value={item.note}
                          onChange={(e) => updateItem(item.tempId, "note", e.target.value)}
                          placeholder="Ghi chú"
                          className="flex-1 min-w-[100px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-300 outline-none"
                        />
                        <input
                          value={item.estimated_cost}
                          onChange={(e) => updateItem(item.tempId, "estimated_cost", e.target.value)}
                          placeholder="Chi phí"
                          type="number"
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-300 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.tempId)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-100/50 hover:border-indigo-300 transition-all"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm địa điểm
            </button>
          </div>
        )}
      </section>

      {/* Modal thêm địa điểm */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase">THÊM ĐỊA ĐIỂM</span>
                <h3 className="text-lg font-black text-slate-800 font-heading">Ngày {activeDay}</h3>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Tìm kiếm hệ thống */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tìm từ hệ thống</label>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
                  placeholder="Nhập tên địa điểm..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  {searching ? "..." : "Tìm"}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-100 overflow-hidden">
                  {searchResults.map((loc) => (
                    <button
                      key={loc.location_id}
                      onClick={() => addFromSystem(loc)}
                      className="w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-indigo-50 transition-colors"
                    >
                      <div className="text-sm font-semibold text-slate-800">{loc.name}</div>
                      <div className="text-xs text-slate-500">{loc.address} · {loc.type}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">hoặc nhập tự do</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Nhập tự do */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tên địa điểm *</label>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ví dụ: Nhà hàng ABC" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Địa chỉ</label>
                <input value={customAddress} onChange={(e) => setCustomAddress(e.target.value)} placeholder="Ví dụ: 123 Đường XYZ, Đà Lạt" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Giờ</label>
                  <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 focus:border-indigo-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Chi phí dự kiến (VND)</label>
                  <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú</label>
                <input value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Ghi chú (tùy chọn)" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 outline-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Hủy
              </button>
              <button
                onClick={addCustom}
                disabled={!customName.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Thêm địa điểm
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default ItineraryEditor;
