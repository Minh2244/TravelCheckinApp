import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image } from "antd";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { CheckinItem, DiaryItem } from "../../types/user.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

const moodsList = [
  { value: "happy", label: "Vui vẻ", emoji: "", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { value: "excited", label: "Hào hứng", emoji: "", bg: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "neutral", label: "Bình thường", emoji: "", bg: "bg-slate-50 text-slate-700 border-slate-100" },
  { value: "sad", label: "Buồn bã", emoji: "", bg: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "angry", label: "Bực bội", emoji: "", bg: "bg-rose-50 text-rose-700 border-rose-100" },
  { value: "tired", label: "Mệt mỏi", emoji: "", bg: "bg-indigo-50 text-indigo-700 border-indigo-100" }
] as const;

const getDiaryImages = (diary: DiaryItem): string[] => {
  if (!diary.images) return [];
  if (Array.isArray(diary.images)) return diary.images;
  try {
    const parsed = JSON.parse(diary.images as unknown as string);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    if (typeof diary.images === "string" && String(diary.images).trim().length > 0) {
      return [String(diary.images).trim()];
    }
  }
  return [];
};

const getMoodCardStyles = (moodValue: string) => {
  switch (moodValue) {
    case "happy":
      return "bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border-emerald-200/60 text-emerald-800";
    case "excited":
      return "bg-gradient-to-r from-amber-50/80 to-orange-50/80 border-amber-200/60 text-amber-900";
    case "neutral":
      return "bg-gradient-to-r from-slate-50/90 to-sky-50/90 border-slate-200/60 text-slate-800";
    case "sad":
      return "bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-blue-200/60 text-blue-900";
    case "angry":
      return "bg-gradient-to-r from-rose-50/80 to-red-50/80 border-rose-200/60 text-rose-950";
    case "tired":
      return "bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-indigo-200/60 text-indigo-950";
    default:
      return "bg-[#f0fbf9]/60 border-teal-100 text-slate-800";
  }
};

const Checkins = () => {
  const [items, setItems] = useState<CheckinItem[]>([]);
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // States for writing/editing diary modal
  const [writingCheckin, setWritingCheckin] = useState<any | null>(null);
  const [customLocName, setCustomLocName] = useState("");
  const [diaryNotes, setDiaryNotes] = useState("");
  const [diaryMood, setDiaryMood] = useState<"happy" | "excited" | "neutral" | "sad" | "angry" | "tired">("happy");
  const [diaryPhotos, setDiaryPhotos] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [savingDiary, setSavingDiary] = useState(false);

  const navigate = useNavigate();

  const itemsWithKind = useMemo(() => {
    return items.map((item) => {
      const isUserCreated = Number(item.is_user_created) === 1;
      return {
        ...item,
        isUserCreated,
        kindLabel: isUserCreated ? "Tự check-in" : "Hệ thống",
      };
    });
  }, [items]);

  // Group check-ins by location for timeline view
  const groupedCheckins = useMemo(() => {
    const groups: Record<string, {
      location_id: number;
      location_name: string;
      address: string;
      first_image: string | null;
      location_latitude: number | string | null;
      location_longitude: number | string | null;
      checkin_latitude: number | string | null;
      checkin_longitude: number | string | null;
      status: string;
      is_user_created: number | boolean;
      location_owner_id: number | null;
      kindLabel: string;
      records: Array<{
        checkin_id: number;
        checkin_time: string;
        status: string;
      }>;
      originalItem: CheckinItem;
    }> = {};

    itemsWithKind.forEach((item) => {
      const key = item.location_id ? `loc_${item.location_id}` : `name_${item.location_name}`;
      if (!groups[key]) {
        groups[key] = {
          location_id: item.location_id,
          location_name: item.location_name,
          address: item.address,
          first_image: item.first_image,
          location_latitude: item.location_latitude ?? null,
          location_longitude: item.location_longitude ?? null,
          checkin_latitude: item.checkin_latitude ?? null,
          checkin_longitude: item.checkin_longitude ?? null,
          status: item.status,
          is_user_created: item.is_user_created ?? false,
          location_owner_id: item.location_owner_id ? Number(item.location_owner_id) : null,
          kindLabel: item.kindLabel,
          records: [],
          originalItem: item,
        };
      }
      groups[key].records.push({
        checkin_id: item.checkin_id,
        checkin_time: item.checkin_time,
        status: item.status,
      });
    });

    // Sort locations by latest check-in time descending
    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.records[0]?.checkin_time || 0).getTime();
      const timeB = new Date(b.records[0]?.checkin_time || 0).getTime();
      return timeB - timeA;
    });
  }, [itemsWithKind]);

  // Travel statistics calculation
  const travelStats = useMemo(() => {
    const totalCheckins = items.length;
    const uniqueLocations = groupedCheckins.length;

    let favoriteLoc = null;
    let maxVisits = 0;
    groupedCheckins.forEach((group) => {
      if (group.records.length > maxVisits) {
        maxVisits = group.records.length;
        favoriteLoc = group.location_name;
      }
    });

    const selfCreatedCount = itemsWithKind.filter((x) => x.isUserCreated).length;
    const systemCreatedCount = itemsWithKind.filter((x) => !x.isUserCreated).length;

    let milestone = {
      title: "Tân Thủ Khởi Hành",
      icon: "",
      color: "from-sky-100 to-indigo-100 border border-indigo-200/50 text-indigo-700 shadow-sm",
      description: "Chuyến đi đầu tiên luôn là trải nghiệm khó quên nhất. Hãy tiếp tục hành trình khám phá thế giới xung quanh.",
    };

    if (totalCheckins >= 1 && totalCheckins <= 3) {
      milestone = {
        title: "Thám Hiểm Tập Sự",
        icon: "",
        color: "from-teal-100/80 to-emerald-100/80 border border-teal-200/50 text-teal-800 shadow-sm",
        description: "Bạn đang bắt đầu tích lũy những dấu chân đầu tiên. Những chân trời mới đang mở ra chào đón bạn.",
      };
    } else if (totalCheckins >= 4 && totalCheckins <= 10) {
      milestone = {
        title: "Lãng Khách Muôn Phương",
        icon: "",
        color: "from-amber-100/80 to-orange-100/80 border border-amber-200/50 text-amber-800 shadow-sm",
        description: "Những bước đi vững chãi và trải nghiệm phong phú. Bạn đã là một tay du hành cừ khôi trên mọi nẻo đường.",
      };
    } else if (totalCheckins > 10) {
      milestone = {
        title: "Bậc Thầy Dịch Chuyển",
        icon: "",
        color: "from-purple-100 to-fuchsia-100 border border-purple-200/50 text-purple-800 shadow-sm",
        description: "Không có giới hạn nào có thể ngăn cản bước chân bạn. Bản đồ thế giới chính là sân chơi của bạn.",
      };
    }

    return {
      totalCheckins,
      uniqueLocations,
      favoriteLoc,
      maxVisits,
      selfCreatedCount,
      systemCreatedCount,
      milestone,
    };
  }, [items, groupedCheckins, itemsWithKind]);

  // Load checkins and diaries
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [checkinsRes, diariesRes] = await Promise.all([
        userApi.getCheckins(),
        userApi.getDiaries(),
      ]);
      setItems(checkinsRes.data ?? []);
      setDiaries(diariesRes.data ?? []);
    } catch {
      setError("Không thể tải dữ liệu hành trình");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleShare = async (locationId: number) => {
    const url = `${window.location.origin}/user/location/${locationId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        setShareStatus("Đã chia sẻ liên kết thành công");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Đã sao chép liên kết vào bộ nhớ tạm");
      } else {
        setShareStatus(url);
      }
    } catch {
      setShareStatus("Không thể thực hiện chia sẻ");
    }
    setTimeout(() => setShareStatus(null), 3000);
  };

  const handleViewOnMap = (item: {
    location_id: number;
    location_name: string;
    address: string;
    status: string;
    is_user_created: number | boolean;
    location_owner_id: number | null;
    location_latitude: number | string | null;
    location_longitude: number | string | null;
    checkin_latitude: number | string | null;
    checkin_longitude: number | string | null;
    checkin_id?: number;
    first_image?: string | null;
  }) => {
    const latRaw = item.location_latitude ?? item.checkin_latitude;
    const lngRaw = item.location_longitude ?? item.checkin_longitude;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;

    navigate("/user/map", {
      state: {
        focusCheckin: {
          checkin_id: item.checkin_id || 0,
          location_id: item.location_id,
          location_name: item.location_name,
          address: item.address,
          status: item.status,
          is_user_created: item.is_user_created,
          location_owner_id: item.location_owner_id ?? null,
          lat: hasCoords ? lat : null,
          lng: hasCoords ? lng : null,
          first_image: item.first_image,
        },
      },
    });
  };

  const handleDelete = async (item: CheckinItem) => {
    const confirmText = "Xóa lượt check-in tự do này sẽ đồng thời gỡ bỏ địa điểm bạn tự tạo trên hệ thống. Bạn có chắc chắn muốn xóa?";
    if (!window.confirm(confirmText)) return;

    setDeletingId(item.checkin_id);
    setError(null);
    try {
      const resp = await userApi.deleteCheckin(item.checkin_id);
      if (!resp.success) {
        throw new Error(resp.message ?? "Xóa thất bại");
      }
      setItems((prev) => prev.filter((x) => x.checkin_id !== item.checkin_id));
    } catch {
      setError("Không thể xóa lượt check-in");
    } finally {
      setDeletingId(null);
    }
  };

  // Writing/Editing memoirs modal trigger
  const openWriteDiaryModal = (item: any, existingDiary?: DiaryItem) => {
    setWritingCheckin(item);
    setCustomLocName(item.location_name ?? "");
    if (existingDiary) {
      setDiaryNotes(existingDiary.notes ?? "");
      setDiaryMood(existingDiary.mood ?? "happy");
      setDiaryPhotos([]);
      setExistingImages(existingDiary.images && Array.isArray(existingDiary.images) ? existingDiary.images : []);
    } else {
      setDiaryNotes("");
      setDiaryMood("happy");
      setDiaryPhotos([]);
      setExistingImages([]);
    }
  };

  const handleDiaryPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setDiaryPhotos((prev) => [...prev, ...files]);
    }
  };

  const handleRemovePhoto = (isExisting: boolean, index: number) => {
    if (isExisting) {
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setDiaryPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveDiary = async () => {
    if (!diaryNotes.trim() || !writingCheckin) return;
    setSavingDiary(true);
    try {
      let imageUrls: string[] = [...existingImages];
      if (diaryPhotos.length > 0) {
        for (const file of diaryPhotos) {
          const uploadRes = await userApi.uploadReviewImage(file);
          if (uploadRes.success && uploadRes.data?.image_url) {
            imageUrls.push(uploadRes.data.image_url);
          }
        }
      }

      await userApi.createDiary({
        location_id: writingCheckin.location_id || null,
        location_name: customLocName.trim() ? customLocName.trim() : null,
        mood: diaryMood,
        notes: diaryNotes.trim(),
        images: imageUrls,
      });

      // Reload
      await fetchData();
      setWritingCheckin(null);
      setDiaryNotes("");
      setDiaryMood("happy");
      setDiaryPhotos([]);
      setExistingImages([]);
      setCustomLocName("");
    } catch {
      alert("Không thể lưu kỷ niệm hành trình");
    } finally {
      setSavingDiary(false);
    }
  };

  const handleDeleteDiary = async (diaryId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa kỷ niệm nhật ký này?")) return;
    try {
      await userApi.deleteDiary(diaryId);
      await fetchData();
    } catch {
      alert("Không thể thực hiện xóa kỷ niệm");
    }
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusLabel = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "VERIFIED") return "Đã xác minh";
    if (s === "PENDING") return "Đang chờ duyệt";
    if (s === "FAILED") return "Thất bại";
    return status;
  };

  const getMoodDetails = (moodValue: string) => {
    return moodsList.find((m) => m.value === moodValue) ?? moodsList[2];
  };

  return (
    <UserLayout title="Nhật ký hành trình" activeKey="/user/checkins">
      <section className="user-section p-4 sm:p-6 lg:p-8 font-sans">
        <p className="text-xs text-slate-500 text-left">
          Lưu lại các bước chân và kỷ niệm. Viết nhật ký, ghi nhận cảm xúc dưới mỗi điểm đã ghé thăm.
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-12 text-sm text-gray-500 text-center animate-pulse">
            Đang tải dữ liệu hành trình và kỷ niệm...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 text-center">
            Lỗi: {error}
          </div>
        ) : null}

        {shareStatus ? (
          <div className="mt-4 text-xs text-teal-600 text-center font-bold">
            {shareStatus}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-12 text-sm text-gray-500 text-center">
            Bạn chưa có bước chân check-in nào trong lịch sử.
          </div>
        ) : null}

        {groupedCheckins.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start mt-6">
            
            {/* Left Column: Timeline Feed with independent scroll */}
            <div className="max-h-[78vh] overflow-y-auto pr-4 sleek-scrollbar pb-6">
              <div className="relative border-l border-dashed border-teal-200/70 ml-8 pl-6 space-y-5 py-2 text-left">
                {groupedCheckins.map((group) => {
                  let imageUrl = resolveBackendUrl(group.first_image);
                  const latestRecord = group.records[0];

                  // Match diaries related to this location
                  const matchedDiary = diaries.find(
                    (d) => d.location_id === group.location_id || d.location_name === group.location_name
                  );

                  // Fallback to diary image if no location image exists (especially for custom locations)
                  if (!imageUrl && matchedDiary) {
                    const diaryImages = getDiaryImages(matchedDiary);
                    if (diaryImages.length > 0) {
                      imageUrl = resolveBackendUrl(diaryImages[0]);
                    }
                  }

                  return (
                    <div
                      key={group.location_id ? `loc_${group.location_id}` : `name_${group.location_name}`}
                      className="group relative flex flex-col justify-between"
                    >
                      {/* Interactive dynamic map pin icon */}
                      <div className="absolute -left-[36px] top-4 z-10 flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-teal-600 border-2 border-white text-white flex items-center justify-center shadow-sm transition-all group-hover:bg-teal-500 group-hover:scale-110" />
                      </div>

                      {/* Glassmorphic timeline card */}
                      <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl p-4 transition-all duration-300 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          {/* Image Box */}
                          <div className="relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shadow-inner">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={group.location_name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-teal-50 to-slate-100" />
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="flex-1 min-w-0 w-full space-y-1.5 text-left">
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="inline-flex rounded bg-teal-50 border border-teal-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-teal-700">
                                {getStatusLabel(group.status)}
                              </span>
                              <span className="inline-flex rounded bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700">
                                {group.kindLabel}
                              </span>
                            </div>

                            <h3 className="text-sm font-black text-slate-800 group-hover:text-teal-600 transition truncate">
                              {group.location_name}
                            </h3>

                            <p className="text-[10px] text-slate-500 truncate">
                              Địa chỉ: {group.address}
                            </p>

                            {/* Single vs Multiple Visited lists */}
                            {group.records.length === 1 ? (
                              <p className="text-[10px] font-bold text-slate-400">
                                Ghé thăm: <span className="text-slate-600">{formatDateTime(latestRecord.checkin_time)}</span>
                              </p>
                            ) : (
                              <div className="pt-0.5">
                                <details className="group/details border border-teal-100 rounded-xl bg-teal-50/10 overflow-hidden">
                                  <summary className="cursor-pointer select-none font-bold text-teal-700 py-1 px-3 hover:bg-teal-50/30 transition flex items-center justify-between text-[10px]">
                                    <span>Đã ghé thăm {group.records.length} lần gần đây</span>
                                    <svg className="w-2.5 h-2.5 transform group-open/details:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </summary>
                                  <div className="border-t border-teal-100/50 bg-white max-h-[85px] overflow-y-auto divide-y divide-slate-100">
                                    {group.records.map((rec, rIdx) => (
                                      <div key={rec.checkin_id} className="flex px-3 py-1.5 text-[9px]">
                                        <span className="text-slate-600 font-semibold">
                                          Lần {group.records.length - rIdx}: {formatDateTime(rec.checkin_time)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nest Memoir/Diary section inside timeline card */}
                        {matchedDiary ? (
                          <div className={`mt-2 border rounded-xl p-3.5 space-y-2 relative overflow-hidden text-left shadow-sm transition-all duration-300 ${getMoodCardStyles(matchedDiary.mood)}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">Kỷ niệm đã lưu giữ</span>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border ${getMoodDetails(matchedDiary.mood).bg}`}>
                                  <span>{getMoodDetails(matchedDiary.mood).label}</span>
                                </span>
                                
                                {/* Edit memoir button */}
                                <button
                                  type="button"
                                  onClick={() => openWriteDiaryModal(group, matchedDiary)}
                                  className="text-[9px] font-bold active:scale-95 transition bg-white/80 hover:bg-white text-teal-800 px-2 py-0.5 rounded border border-teal-200/50 shadow-sm"
                                >
                                  Sửa
                                </button>

                                {/* Delete memoir button */}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteDiary(matchedDiary.diary_id)}
                                  className="text-[9px] font-bold active:scale-95 transition bg-white/80 hover:bg-white text-red-800 px-2 py-0.5 rounded border border-red-200/50 shadow-sm"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                            <p className="text-xs leading-relaxed italic whitespace-pre-wrap font-medium opacity-95">
                              "{matchedDiary.notes}"
                            </p>
                            {getDiaryImages(matchedDiary).length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1.5">
                                {getDiaryImages(matchedDiary).map((img, idx) => (
                                  <div key={idx} className="h-20 w-20 rounded-xl overflow-hidden border border-white/80 bg-white flex-shrink-0 shadow-sm transition hover:scale-105">
                                    <Image src={resolveBackendUrl(img) || ""} alt="memories" className="h-full w-full object-cover" preview={{ mask: <span className="text-[10px]">Xem</span> }} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div 
                            onClick={() => openWriteDiaryModal(group)}
                            className="mt-2 border border-dashed border-teal-200/60 hover:border-teal-400 hover:bg-teal-50/10 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all group/memoir"
                          >
                            <div className="flex items-center gap-2 text-slate-400 group-hover/memoir:text-teal-700 transition">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span className="text-[10px] text-slate-400 font-bold group-hover/memoir:text-teal-600">Chưa viết nhật ký cho chuyến đi này. Bấm để viết...</span>
                            </div>
                            <button
                              type="button"
                              className="rounded-xl bg-teal-600 group-hover/memoir:bg-teal-700 px-3 py-1 text-[9px] font-bold text-white shadow-sm transition active:scale-95"
                            >
                              Lưu giữ kỷ niệm
                            </button>
                          </div>
                        )}

                        {/* Standard map & share buttons */}
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 w-full">
                          <button
                            type="button"
                            className="rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:shadow transition flex items-center gap-1"
                            onClick={() => handleViewOnMap({
                              location_id: group.location_id,
                              location_name: group.location_name,
                              address: group.address,
                              status: group.status,
                              is_user_created: group.is_user_created,
                              location_owner_id: group.location_owner_id,
                              location_latitude: group.location_latitude,
                              location_longitude: group.location_longitude,
                              checkin_latitude: group.checkin_latitude,
                              checkin_longitude: group.checkin_longitude,
                              checkin_id: latestRecord.checkin_id,
                              first_image: group.first_image
                            })}
                          >
                            Bản đồ
                          </button>

                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 shadow-sm transition flex items-center gap-1"
                            onClick={() => handleShare(group.location_id)}
                          >
                            Chia sẻ
                          </button>

                          {group.is_user_created && (
                            <button
                              type="button"
                              disabled={deletingId === latestRecord.checkin_id}
                              className="rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-600 shadow-sm transition flex items-center gap-1 active:scale-95 ml-auto disabled:opacity-55"
                              onClick={() => void handleDelete({ ...group.originalItem, checkin_id: latestRecord.checkin_id })}
                            >
                              {deletingId === latestRecord.checkin_id ? "Đang xóa..." : "Xóa địa điểm"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Statistics panel (stationary) */}
            <div className="hidden lg:flex w-full max-w-[280px] flex-col bg-gradient-to-br from-[#ccefe8]/90 via-[#e2f7f3] to-[#ccefe8]/80 border border-teal-200 rounded-2xl p-4 shadow-sm relative overflow-hidden text-left group sticky top-4">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400/0 via-teal-400/50 to-teal-400/0" />

              <div className="relative z-10 flex flex-col items-center text-center pb-3.5 border-b border-slate-200/50">
                <div className={`h-16 w-16 rounded-full bg-gradient-to-tr ${travelStats.milestone.color} flex items-center justify-center text-3xl shadow-sm mb-2 transition duration-500 group-hover:scale-105`} />
                <span className="text-[9px] font-bold tracking-wider text-teal-700/80 uppercase font-sans">DANH HIỆU LỮ KHÁCH</span>
                <h4 className="text-sm font-black text-slate-800 mt-0.5 font-heading">
                  {travelStats.milestone.title}
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed px-1 mt-1.5 italic">
                  "{travelStats.milestone.description}"
                </p>
              </div>

              <div className="relative z-10 py-4 space-y-4 flex-1">
                <h5 className="text-[9px] font-bold tracking-wider text-slate-500 uppercase font-sans">THỐNG KÊ HÀNH TRÌNH</h5>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between shadow-inner">
                    <span className="text-[9px] font-bold text-slate-400">Lượt đi</span>
                    <span className="text-base font-black text-teal-700 mt-1">{travelStats.totalCheckins}</span>
                  </div>

                  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 flex flex-col justify-between shadow-inner">
                    <span className="text-[9px] font-bold text-slate-400">Địa điểm</span>
                    <span className="text-base font-black text-teal-700 mt-1">{travelStats.uniqueLocations}</span>
                  </div>
                </div>

                {travelStats.favoriteLoc && (
                  <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 space-y-1 shadow-inner">
                    <span className="text-[9px] font-bold text-slate-400">Ghé thăm nhiều nhất</span>
                    <div className="text-xs font-black text-slate-800 truncate">{travelStats.favoriteLoc}</div>
                    <div className="text-[9px] text-slate-500">
                      Đã ghé thăm <span className="font-bold text-teal-700">{travelStats.maxVisits} lần</span>
                    </div>
                  </div>
                )}

                {travelStats.totalCheckins > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                      <span>Hệ thống ({travelStats.systemCreatedCount})</span>
                      <span>Tự check-in ({travelStats.selfCreatedCount})</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      <div 
                        className="h-full bg-teal-500 transition-all duration-500" 
                        style={{ width: `${(travelStats.systemCreatedCount / travelStats.totalCheckins) * 100}%` }}
                      />
                      <div 
                        className="h-full bg-amber-400 transition-all duration-500" 
                        style={{ width: `${(travelStats.selfCreatedCount / travelStats.totalCheckins) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10 pt-2.5 border-t border-slate-200/50 flex items-center justify-between text-[8px] font-mono text-slate-400">
                <span>TRAVEL PLANNER CO-PILOT</span>
                <span>v1.2.0</span>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* Writing/Editing Diary modal */}
      {writingCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800">Lưu Giữ Kỷ Niệm Hành Trình</h3>
              <button
                type="button"
                onClick={() => setWritingCheckin(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Địa điểm ghé thăm</label>
                {Number(writingCheckin.is_user_created) === 1 || writingCheckin.location_name === "Vị trí tự do" ? (
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-bold text-slate-800 text-xs focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all duration-200"
                    placeholder="Đặt tên cho địa điểm của bạn (Ví dụ: Nhà trọ Phú Mỹ)"
                    value={customLocName}
                    onChange={(e) => setCustomLocName(e.target.value)}
                  />
                ) : (
                  <div className="mt-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-800 text-xs">
                    {writingCheckin.location_name}
                  </div>
                )}
              </div>

              {/* Mood selector */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Cảm xúc của bạn hôm nay thế nào?</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {moodsList.map((m) => {
                    const isSelected = diaryMood === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setDiaryMood(m.value)}
                        className={`flex flex-col items-center justify-center rounded-xl p-2 border transition duration-200 ${
                          isSelected 
                            ? `${m.bg} border-teal-400 ring-2 ring-teal-500/10 font-bold scale-[1.03]`
                            : "border-slate-200/50 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-[9px] tracking-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Memoir Notes */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Kể lại trải nghiệm và cảm xúc của bạn</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 transition focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10"
                  rows={4}
                  placeholder="Điểm này có gì đặc biệt, điều gì làm bạn nhớ nhất..."
                  value={diaryNotes}
                  onChange={(e) => setDiaryNotes(e.target.value)}
                />
              </div>

              {/* Memories photo upload */}
              <div>
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Thêm ảnh kỷ niệm chuyến đi (không bắt buộc)</label>
                <div className="mt-2 w-full rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 p-4 relative group">
                  {(existingImages.length > 0 || diaryPhotos.length > 0) ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        {existingImages.map((img, i) => (
                          <div key={`existing-${i}`} className="h-16 w-16 rounded-xl overflow-hidden border border-white/80 bg-white flex-shrink-0 shadow-sm relative group/item">
                            <img src={resolveBackendUrl(img) || ""} alt="memories-preview" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => handleRemovePhoto(true, i)} className="absolute top-0.5 right-0.5 bg-rose-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[8px] opacity-0 group-hover/item:opacity-100 transition shadow-md">✕</button>
                          </div>
                        ))}
                        {diaryPhotos.map((file, i) => (
                          <div key={`new-${i}`} className="h-16 w-16 rounded-xl overflow-hidden border border-white/80 bg-white flex-shrink-0 shadow-sm relative group/item">
                            <img src={URL.createObjectURL(file)} alt="memories-preview" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => handleRemovePhoto(false, i)} className="absolute top-0.5 right-0.5 bg-rose-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[8px] opacity-0 group-hover/item:opacity-100 transition shadow-md">✕</button>
                          </div>
                        ))}
                      </div>
                      <label className="self-end bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3 py-1.5 text-[9px] font-bold cursor-pointer transition inline-block">
                        Thêm ảnh
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiaryPhotoChange} />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-4 space-y-1.5 text-center text-slate-400 hover:text-slate-600 transition">
                      <span className="text-[11px] font-bold">Bấm để chọn một hoặc nhiều ảnh kỷ niệm</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiaryPhotoChange} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWritingCheckin(null)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveDiary}
                disabled={savingDiary || !diaryNotes.trim()}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 disabled:pointer-events-none transition"
              >
                {savingDiary ? "Đang lưu..." : "Lưu kỷ niệm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default Checkins;
