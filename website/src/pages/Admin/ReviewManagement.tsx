import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
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
  const [timeRange, setTimeRange] = useState<
    "today" | "week" | "month" | "year" | "all"
  >("today");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportTarget, setReportTarget] = useState<ReviewRow | null>(null);
  const [reportType, setReportType] = useState<"user" | "owner">("user");

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
        range: timeRange,
        date: selectedDate || undefined,
      });
      setRows(Array.isArray(res?.data) ? (res.data as ReviewRow[]) : []);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh sách đánh giá"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locationId, ownerId, ratingFilter, selectedDate, timeRange]);

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

  const openReportUser = useCallback((row: ReviewRow) => {
    setReportTarget(row);
    setReportType("user");
    setReportReason("");
    setReportOpen(true);
  }, []);

  const openReportOwner = useCallback((row: ReviewRow) => {
    setReportTarget(row);
    setReportType("owner");
    setReportReason("");
    setReportOpen(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportTarget) return;
    try {
      if (reportType === "owner") {
        await adminApi.reportOwnerReply(reportTarget.review_id, {
          reason: reportReason,
        });
        message.success("Đã báo cáo owner");
      } else {
        await adminApi.reportReviewUser(reportTarget.review_id, {
          reason: reportReason,
        });
        message.success("Đã tạo báo cáo user vi phạm");
      }
      setReportOpen(false);
      setReportReason("");
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi gửi báo cáo"));
    }
  }, [reportReason, reportTarget, reportType]);

  const repliedRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.reply_id != null ||
          Boolean(String(row.reply_content || "").trim()),
      ),
    [rows],
  );

  const userReviewColumns: ColumnsType<ReviewRow> = useMemo(
    () => [
      {
        title: "Thứ tự",
        render: (_: unknown, __: ReviewRow, index: number) => index + 1,
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
        title: "Nội dung",
        dataIndex: "comment",
        render: (value: string) => (
          <div className="text-sm">{value || "-"}</div>
        ),
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
        render: (status: string) => (
          <Tag
            color={
              status === "active"
                ? "green"
                : status === "hidden"
                  ? "orange"
                  : "red"
            }
          >
            {String(status || "-").toUpperCase()}
          </Tag>
        ),
      },
      {
        title: "Hành động",
        render: (_: unknown, row: ReviewRow) => (
          <Space>
            <Popconfirm
              title="Xóa đánh giá này?"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                void handleDelete(row);
              }}
            >
              <Button danger size="small">
                Xóa
              </Button>
            </Popconfirm>
            <Button
              size="small"
              onClick={() => {
                openReportUser(row);
              }}
            >
              Báo cáo user
            </Button>
          </Space>
        ),
      },
    ],
    [handleDelete, openReportUser],
  );

  const ownerReplyColumns: ColumnsType<ReviewRow> = useMemo(
    () => [
      {
        title: "Thứ tự",
        render: (_: unknown, __: ReviewRow, index: number) => index + 1,
      },
      { title: "Tên Owner", dataIndex: "owner_name" },
      { title: "Địa điểm", dataIndex: "location_name" },
      {
        title: "Liên hệ",
        render: (_: unknown, row: ReviewRow) => (
          <div className="text-xs">
            <div>{row.owner_email || "-"}</div>
            <div>{row.owner_phone || "-"}</div>
          </div>
        ),
      },
      { title: "User", dataIndex: "user_name" },
      {
        title: "Nội dung",
        render: (_: unknown, row: ReviewRow) => {
          const images = parseReviewImages(row.images);
          return (
            <div className="space-y-2">
              <div className="text-sm">{row.comment || "-"}</div>
              {images.length > 0 ? (
                <Image.PreviewGroup>
                  <div className="flex flex-wrap gap-2">
                    {images.slice(0, 4).map((src, idx) => (
                      <Image
                        key={`reply-${row.review_id}-${idx}`}
                        src={src}
                        alt={`reply-review-${row.review_id}-${idx}`}
                        width={40}
                        height={40}
                        className="rounded border object-cover"
                      />
                    ))}
                    {images.length > 4 ? (
                      <div className="flex h-[40px] w-[40px] items-center justify-center rounded border text-xs text-gray-500">
                        +{images.length - 4}
                      </div>
                    ) : null}
                  </div>
                </Image.PreviewGroup>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "Sao",
        dataIndex: "rating",
      },
      {
        title: "Phản hồi",
        dataIndex: "reply_content",
        render: (value: unknown) => (
          <div className="text-sm">{String(value || "-")}</div>
        ),
      },
      {
        title: "Thời gian",
        render: (_: unknown, row: ReviewRow) =>
          formatDateTimeVi(
            String(row.reply_created_at || row.created_at || ""),
          ),
      },
      {
        title: "Hành động",
        render: (_: unknown, row: ReviewRow) => (
          <Space>
            <Popconfirm
              title="Xóa phản hồi owner này?"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                void handleDeleteOwnerReply(row);
              }}
            >
              <Button danger size="small">
                Xóa
              </Button>
            </Popconfirm>
            <Button
              size="small"
              onClick={() => {
                openReportOwner(row);
              }}
            >
              Báo cáo owner
            </Button>
          </Space>
        ),
      },
    ],
    [handleDeleteOwnerReply, openReportOwner],
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
              { value: 1, label: "1 sao" },
              { value: 2, label: "2 sao" },
              { value: 3, label: "3 sao" },
              { value: 4, label: "4 sao" },
              { value: 5, label: "5 sao" },
              { value: 0, label: "Tất cả sao" },
            ]}
          />

          <Segmented
            value={timeRange}
            onChange={(value) => setTimeRange(value as any)}
            options={[
              { value: "today", label: "Hôm nay" },
              { value: "week", label: "7 ngày" },
              { value: "month", label: "1 tháng" },
              { value: "year", label: "1 năm" },
              { value: "all", label: "Tất cả" },
            ]}
          />

          <DatePicker
            allowClear
            format="DD/MM/YYYY"
            value={selectedDate ? dayjs(selectedDate, "YYYY-MM-DD") : null}
            placeholder="Chọn ngày"
            onChange={(value) => {
              setSelectedDate(value ? value.format("YYYY-MM-DD") : null);
            }}
          />
        </div>

        {!locationId ? (
          <div className="mb-3 text-sm text-amber-700">
            Vui lòng chọn owner và địa điểm để xem quản lí đánh giá.
          </div>
        ) : null}

        <div className="space-y-4">
          <Card size="small" title="Đánh giá của users">
            <Table<ReviewRow>
              rowKey={(row) => `user-review-${row.review_id}`}
              loading={loading}
              dataSource={rows}
              columns={userReviewColumns}
              size="small"
              pagination={false}
            />
          </Card>

          <Card size="small" title="Phản hồi của owner tới users">
            <Table<ReviewRow>
              rowKey={(row) => `owner-reply-${row.review_id}`}
              loading={loading}
              dataSource={repliedRows}
              columns={ownerReplyColumns}
              size="small"
              pagination={false}
            />
          </Card>
        </div>
      </Card>

      <Modal
        title={`${reportType === "owner" ? "Báo cáo owner" : "Báo cáo user"} từ review #${reportTarget?.review_id ?? ""}`}
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
          onChange={(event) => setReportReason(event.target.value)}
          placeholder="Mô tả lý do báo cáo"
        />
      </Modal>
    </MainLayout>
  );
};

export default ReviewManagement;
