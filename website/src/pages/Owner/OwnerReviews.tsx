import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Image,
  Modal,
  Space,
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportRow, setReportRow] = useState<ReviewRow | null>(null);
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

  const openReport = useCallback((row: ReviewRow) => {
    setReportRow(row);
    setReportReason("");
    setReportOpen(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportRow) return;
    try {
      await ownerApi.reportReviewUser(reportRow.review_id, reportReason);
      message.success("Đã báo cáo tài khoản user tới admin");
      setReportOpen(false);
      setReportReason("");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi gửi báo cáo"));
    }
  }, [reportReason, reportRow]);

  const filteredItems = useMemo(() => {
    if (!ratingFilter) return items;
    return items.filter((row) => Number(row.rating) === ratingFilter);
  }, [items, ratingFilter]);

  const columns: ColumnsType<ReviewRow> = useMemo(
    () => [
      { title: "#", dataIndex: "review_id", width: 80 },
      { title: "Địa điểm", dataIndex: "location_name" },
      { title: "Khách", dataIndex: "user_name" },
      { title: "Rating", dataIndex: "rating", width: 80 },
      {
        title: "Thời gian",
        dataIndex: "created_at",
        width: 170,
        render: (value: string) => formatDateTimeVi(value),
      },
      { title: "Nội dung", dataIndex: "comment" },
      {
        title: "Ảnh",
        key: "images",
        width: 210,
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
        title: "Trạng thái",
        dataIndex: "status",
        width: 120,
        render: (s: string) => (
          <Tag
            color={s === "active" ? "green" : s === "hidden" ? "orange" : "red"}
          >
            {String(s).toUpperCase()}
          </Tag>
        ),
      },
      {
        title: "Hành động",
        width: 320,
        render: (_: unknown, row: ReviewRow) => (
          <Space>
            <Button size="small" onClick={() => openReply(row)}>
              Phản hồi
            </Button>
            <Button size="small" onClick={() => toggleHide(row)}>
              {row.status === "hidden" ? "Hiện" : "Ẩn"}
            </Button>
            <Popconfirm
              title="Xóa đánh giá này?"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => deleteReview(row)}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
            <Button size="small" onClick={() => openReport(row)}>
              Báo cáo user
            </Button>
          </Space>
        ),
      },
    ],
    [deleteReview, openReply, openReport, toggleHide],
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

      <Modal
        title={`Báo cáo user từ review #${reportRow?.review_id ?? ""}`}
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        onOk={() => {
          void submitReport();
        }}
        okText="Gửi báo cáo"
      >
        <Input.TextArea
          rows={5}
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="Mô tả lý do báo cáo (ngôn từ thô tục, xúc phạm, spam...)"
        />
      </Modal>
    </MainLayout>
  );
};

export default OwnerReviews;
