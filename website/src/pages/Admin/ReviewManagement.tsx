import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Image,
  Popconfirm,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

type OwnerOption = {
  owner_id: number;
  owner_name: string;
};

type LocationOption = {
  location_id: number;
  location_name: string;
};

type ReviewRow = {
  review_id: number;
  location_id: number;
  user_id: number;
  owner_id?: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  location_name?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  rating?: number | string | null;
  comment?: string | null;
  images?: string[] | string | null;
  status?: string;
  created_at?: string;
  reply_id?: number | null;
  reply_content?: string | null;
  reply_created_at?: string | null;
};

const parseReviewImages = (value: ReviewRow["images"]): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => resolveBackendUrl(String(item || "").trim()))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => resolveBackendUrl(String(item || "").trim()))
        .filter((item): item is string => Boolean(item));
    }
  } catch {
    const single = resolveBackendUrl(trimmed);
    return single ? [single] : [];
  }
  return [];
};

const ReviewManagement = () => {
  const [loading, setLoading] = useState(false);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number>(0);

  const loadOwners = useCallback(async () => {
    try {
      const res = await adminApi.getOwners({ page: 1, limit: 500 });
      const data = Array.isArray(res?.data) ? res.data : [];
      setOwners(
        data
          .map((item: any) => ({
            owner_id: Number(item.user_id),
            owner_name: String(item.full_name || item.email || "Owner"),
          }))
          .filter((item: OwnerOption) => Number.isFinite(item.owner_id)),
      );
    } catch {
      setOwners([]);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    if (!ownerId) {
      setLocations([]);
      return;
    }
    try {
      const res = await adminApi.getOwnerLocations(ownerId);
      const data = Array.isArray(res?.data) ? res.data : [];
      setLocations(
        data
          .map((item: any) => ({
            location_id: Number(item.location_id),
            location_name: String(item.location_name || "Địa điểm"),
          }))
          .filter((item: LocationOption) => Number.isFinite(item.location_id)),
      );
    } catch {
      setLocations([]);
    }
  }, [ownerId]);

  const loadReviews = useCallback(async () => {
    if (!ownerId || !locationId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, number> = {};
      params.owner_id = ownerId;
      params.location_id = locationId;
      if (ratingFilter > 0) params.rating = ratingFilter;
      const res = await adminApi.getReviews({
        ...params,
        range: "all",
      });
      const data = Array.isArray(res?.data) ? (res.data as ReviewRow[]) : [];
      // 1/ user tự xóa bình luận rồi sao trang admin vẫn còn mà không tự xóa theo
      // => Lọc bỏ những đánh giá đã bị xóa (ẩn trên giao diện admin)
      setRows(data.filter((r) => String(r.status || "").toLowerCase() !== "deleted"));
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh sách đánh giá"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, ownerId, ratingFilter]);

  useEffect(() => {
    void loadOwners();
  }, [loadOwners]);

  useEffect(() => {
    setLocationId(null);
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleDelete = useCallback(
    async (row: ReviewRow) => {
      try {
        await adminApi.deleteReview(row.review_id);
        message.success("Đã xóa đánh giá");
        await loadReviews();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa đánh giá"));
      }
    },
    [loadReviews],
  );

  const handleDeleteOwnerReply = useCallback(
    async (row: ReviewRow) => {
      try {
        await adminApi.deleteOwnerReply(row.review_id);
        message.success("Đã xóa phản hồi của owner");
        await loadReviews();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa phản hồi owner"));
      }
    },
    [loadReviews],
  );

  const userReviewColumns: ColumnsType<ReviewRow> = useMemo(
    () => [
      {
        title: "STT",
        render: (_: unknown, __: ReviewRow, index: number) => rows.length - index,
      },
      { title: "Địa điểm", dataIndex: "location_name" },
      { title: "User", dataIndex: "user_name" },
      {
        title: "Liên hệ",
        render: (_: unknown, row: ReviewRow) => (
          <div className="text-xs">
            <div>{row.user_email || "-"}</div>
            <div>{row.user_phone || "-"}</div>
          </div>
        ),
      },
      { title: "Sao", dataIndex: "rating" },
      {
        title: "Đánh giá & Phản hồi",
        key: "comments",
        render: (_: unknown, row: ReviewRow) => (
          <div className="flex flex-col gap-3 min-w-[300px] whitespace-normal py-2">
            {/* User Comment */}
            <div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap font-medium">
                {row.comment || <span className="italic text-slate-400 font-normal">Không có nội dung</span>}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-500">
                <Popconfirm
                  title="Xóa đánh giá này của User?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => handleDelete(row)}
                >
                  <button type="button" className="hover:text-red-600 transition">
                    Xóa đánh giá
                  </button>
                </Popconfirm>
              </div>
            </div>

            {/* Owner Reply */}
            {row.reply_content && (
              <div className="flex gap-2">
                {/* Curved line like Facebook */}
                <div className="w-6 border-l-2 border-b-2 border-slate-300 rounded-bl-xl ml-2 mb-6"></div>
                
                <div className="flex-1 bg-slate-100 p-3 rounded-2xl rounded-tl-sm mt-1">
                  <div className="text-[12px] font-bold text-slate-900 mb-1">
                    Phản hồi của Owner
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{row.reply_content}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-500">
                    <Popconfirm
                      title="Xóa phản hồi này của Owner?"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => handleDeleteOwnerReply(row)}
                    >
                      <button type="button" className="hover:text-red-600 transition">
                        Xóa phản hồi
                      </button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      },
      {
        title: "Ảnh",
        key: "images",
        render: (_: unknown, row: ReviewRow) => {
          const images = parseReviewImages(row.images);
          if (!images.length) return "-";
          return (
            <Image.PreviewGroup>
              <div className="flex flex-wrap gap-2">
                {images.slice(0, 4).map((src, idx) => (
                  <Image
                    key={`${row.review_id}-${idx}`}
                    src={src}
                    alt={`review-${row.review_id}-${idx}`}
                    width={44}
                    height={44}
                    className="rounded border object-cover"
                  />
                ))}
                {images.length > 4 ? (
                  <div className="flex h-[44px] w-[44px] items-center justify-center rounded border text-xs text-gray-500">
                    +{images.length - 4}
                  </div>
                ) : null}
              </div>
            </Image.PreviewGroup>
          );
        },
      },
      {
        title: "Thời gian",
        dataIndex: "created_at",
        render: (value: string) => formatDateTimeVi(value),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (status: string) => {
          const v = String(status || "").toLowerCase();
          const label = v === "active" ? "HIỆN" : v === "hidden" ? "ẨN" : "ĐÃ XÓA";
          return (
            <Tag
              color={
                v === "active"
                  ? "green"
                  : v === "hidden"
                    ? "orange"
                    : "red"
              }
            >
              {label}
            </Tag>
          );
        },
      }
    ],
    [handleDelete, handleDeleteOwnerReply, rows.length],
  );

  return (
    <MainLayout>
      <Card title="Quản lí đánh giá">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void loadReviews();
            }}
            disabled={!ownerId || !locationId}
          >
            Làm mới
          </Button>

          <Select
            allowClear
            placeholder="Chọn owner"
            style={{ minWidth: 260 }}
            value={ownerId ?? undefined}
            onChange={(value) => {
              const nextOwner = Number(value) || null;
              setOwnerId(nextOwner);
              setLocationId(null);
              if (!nextOwner) {
                setLocations([]);
                setRows([]);
              }
            }}
            options={owners.map((item) => ({
              value: item.owner_id,
              label: item.owner_name,
            }))}
          />

          <Select
            allowClear
            placeholder="Chọn địa điểm"
            style={{ minWidth: 260 }}
            value={locationId ?? undefined}
            onChange={(value) => {
              const nextLocation = Number(value) || null;
              setLocationId(nextLocation);
              if (!nextLocation) {
                setRows([]);
              }
            }}
            options={locations.map((item) => ({
              value: item.location_id,
              label: item.location_name,
            }))}
          />

          <Select
            style={{ width: 160 }}
            value={ratingFilter}
            onChange={(value) => setRatingFilter(Number(value) || 0)}
            options={[
              { value: 0, label: "Tất cả sao" },
              { value: 5, label: "5 sao" },
              { value: 4, label: "4 sao" },
              { value: 3, label: "3 sao" },
              { value: 2, label: "2 sao" },
              { value: 1, label: "1 sao" },
            ]}
          />
        </div>

        {!locationId ? (
          <div className="mb-3 text-sm text-amber-700">
            Vui lòng chọn owner và địa điểm để xem quản lí đánh giá.
          </div>
        ) : null}

        <div className="space-y-6">
          <Card className="shadow-sm border-blue-50 overflow-hidden" styles={{ body: { padding: 0 } }} title={<span className="text-blue-700 font-semibold px-4 py-2 block border-b bg-blue-50/50">Tất cả bình luận & phản hồi</span>}>
            <Table<ReviewRow>
              rowKey={(row, idx) => `user-review-${row.review_id}-${idx}`}
              loading={loading}
              dataSource={rows}
              columns={userReviewColumns}
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              className="px-2 pb-2 pt-1"
            />
          </Card>
        </div>
      </Card>
    </MainLayout>
  );
};

export default ReviewManagement;
