import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Image,
  Modal,
  Table,
  Tag,
  message,
  Input,
  Select,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

type ReviewStatus = "active" | "hidden" | "pending" | string;

type ReviewRow = {
  review_id: number;
  location_id?: number | null;
  location_name?: string | null;
  user_name?: string | null;
  rating?: number | string | null;
  comment?: string | null;
  images?: string[] | string | null;
  status: ReviewStatus;
  created_at?: string | null;
  reply_content?: string | null;
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

const OwnerReviews = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyRow, setReplyRow] = useState<ReviewRow | null>(null);

  const [locations, setLocations] = useState<
    Array<{ location_id: number; location_name: string }>
  >([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const [ratingFilter, setRatingFilter] = useState<number>(0);

  const load = useCallback(async () => {
    if (!selectedLocationId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await ownerApi.getReviews(
        selectedLocationId ? { location_id: selectedLocationId } : {},
      );
      setItems((res?.data || []) as ReviewRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải reviews"));
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await ownerApi.getLocations({});
      const data = Array.isArray(res?.data) ? res.data : [];
      setLocations(
        data
          .map((item: any) => ({
            location_id: Number(item.location_id),
            location_name: String(item.location_name || ""),
          }))
          .filter(
            (item: { location_id: number; location_name: string }) =>
              Number.isFinite(item.location_id) && Boolean(item.location_name),
          ),
      );
    } catch {
      setLocations([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const openReply = useCallback((row: ReviewRow) => {
    setReplyRow(row);
    setReplyText(String(row.reply_content || ""));
    setReplyOpen(true);
  }, []);

  const submitReply = async () => {
    try {
      if (!replyRow) return;
      await ownerApi.replyReview(replyRow.review_id, replyText);
      message.success("Đã phản hồi");
      setReplyOpen(false);
      await load();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi phản hồi"));
    }
  };

  const toggleHide = useCallback(
    async (row: ReviewRow) => {
      try {
        const hidden = row.status !== "hidden";
        await ownerApi.hideReview(row.review_id, hidden);
        message.success("Đã cập nhật trạng thái");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi cập nhật"));
      }
    },
    [load],
  );

  const deleteReview = useCallback(
    async (row: ReviewRow) => {
      try {
        await ownerApi.deleteReview(row.review_id);
        message.success("Đã xóa đánh giá");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa đánh giá"));
      }
    },
    [load],
  );

  const deleteReply = useCallback(
    async (row: ReviewRow) => {
      try {
        await ownerApi.deleteReply(row.review_id);
        message.success("Đã xóa phản hồi");
        await load();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa phản hồi"));
      }
    },
    [load],
  );
  const filteredItems = useMemo(() => {
    if (!ratingFilter) return items;
    return items.filter((row) => Number(row.rating) === ratingFilter);
  }, [items, ratingFilter]);

  const columns: ColumnsType<ReviewRow> = useMemo(
    () => [
      {
        title: "STT",
        width: 64,
        align: "center",
        render: (_: unknown, __: ReviewRow, index: number) => filteredItems.length - index,
      },
      { 
        title: "Nội dung đánh giá", 
        key: "comments",
        render: (_: unknown, row: ReviewRow) => (
          <div className="flex min-w-0 flex-col gap-3 whitespace-normal py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{row.location_name || "-"}</span>
              <span>{row.user_name || "-"}</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                {Number(row.rating || 0).toFixed(1)} sao
              </span>
              <span>{formatDateTimeVi(row.created_at || "")}</span>
            </div>
            {/* User Comment */}
            <div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap font-medium">
                {row.comment || <span className="italic text-slate-400 font-normal">Không có nội dung</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  className="rounded-full bg-blue-50 px-3 py-1 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                  onClick={() => openReply(row)}
                >
                  {row.reply_content ? "Sửa phản hồi" : "Phản hồi"}
                </button>
                <Popconfirm
                  title="Xóa đánh giá này của User?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => deleteReview(row)}
                >
                  <button type="button" className="rounded-full bg-red-50 px-3 py-1 text-red-600 transition hover:bg-red-100 hover:text-red-700">
                    Xóa
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
                    Phản hồi của bạn (Owner)
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">{row.reply_content}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      className="rounded-full bg-blue-50 px-3 py-1 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                      onClick={() => openReply(row)}
                    >
                      Sửa
                    </button>
                    <Popconfirm
                      title="Xóa phản hồi này của bạn?"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => deleteReply(row)}
                    >
                      <button type="button" className="rounded-full bg-red-50 px-3 py-1 text-red-600 transition hover:bg-red-100 hover:text-red-700">
                        Xóa
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
        width: 110,
        render: (_: unknown, row: ReviewRow) => {
          const images = parseReviewImages(row.images);
          if (!images.length) return "-";
          return (
            <Image.PreviewGroup>
              <div className="flex flex-wrap gap-1.5">
                {images.slice(0, 2).map((src, idx) => (
                  <Image
                    key={`${row.review_id}-${idx}`}
                    src={src}
                    alt={`review-${row.review_id}-${idx}`}
                    width={40}
                    height={40}
                    className="rounded border object-cover"
                  />
                ))}
                {images.length > 2 ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded border text-xs text-gray-500">
                    +{images.length - 2}
                  </div>
                ) : null}
              </div>
            </Image.PreviewGroup>
          );
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 105,
        render: (s: string) => {
          const v = String(s || "").toLowerCase();
          const label =
            v === "active"
              ? "HIỆN"
              : v === "hidden"
                ? "ẨN"
                : v === "deleted"
                  ? "ĐÃ XÓA"
                  : String(s).toUpperCase();
          return (
            <Tag
              color={v === "active" ? "green" : v === "hidden" ? "orange" : "red"}
            >
              {label}
            </Tag>
          );
        },
      }
    ],
    [deleteReview, deleteReply, filteredItems.length, openReply, toggleHide],
  );

  return (
    <MainLayout>
      <Card title="Đánh giá" loading={loading}>
        <div className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Chọn địa điểm"
            style={{ minWidth: 280 }}
            value={selectedLocationId ?? undefined}
            onChange={(value) => setSelectedLocationId(Number(value) || null)}
            options={locations.map((loc) => ({
              value: loc.location_id,
              label: loc.location_name,
            }))}
          />
          <Select
            style={{ width: 150 }}
            value={ratingFilter}
            onChange={(value) => setRatingFilter(Number(value) || 0)}
            options={[
              { value: 0, label: "Tất cả " },
              { value: 1, label: "1 sao" },
              { value: 2, label: "2 sao" },
              { value: 3, label: "3 sao" },
              { value: 4, label: "4 sao" },
              { value: 5, label: "5 sao" },
            ]}
          />
        </div>
        {!selectedLocationId ? (
          <div className="mb-3 text-sm text-amber-700"></div>
        ) : null}
          <Table<ReviewRow>
            rowKey="review_id"
            dataSource={filteredItems}
            columns={columns}
            pagination={false}
            scroll={{ y: "calc(100vh - 300px)" }}
            size="small"
          />
      </Card>

      <Modal
        title={`Phản hồi review #${replyRow?.review_id ?? ""}`}
        open={replyOpen}
        onCancel={() => setReplyOpen(false)}
        onOk={submitReply}
        okText="Gửi"
      >
        <Input.TextArea
          rows={4}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
      </Modal>

      
    </MainLayout>
  );
};

export default OwnerReviews;
