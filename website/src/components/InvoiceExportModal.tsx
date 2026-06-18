import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Modal,
  Select,
  DatePicker,
  Button,
  Typography,
  message,
  Divider,
} from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { handleExportBatchExcel } from "../utils/exportExcel";
import type { InvoiceData } from "../utils/exportExcel";
import adminApi from "../api/adminApi";

dayjs.extend(utc);
dayjs.extend(timezone);


const { Text } = Typography;
const TZ = "Asia/Ho_Chi_Minh";

// ---- Types ----
interface LocationOption {
  location_id: number;
  location_name: string;
}

interface OwnerOption {
  user_id: number;
  full_name: string;
}

interface InvoiceExportModalProps {
  open: boolean;
  onClose: () => void;
  role: "admin" | "owner";
  currentUserName: string;
  invoices: InvoiceData[];
  locations?: LocationOption[];
  owners?: OwnerOption[];
}

const InvoiceExportModal: React.FC<InvoiceExportModalProps> = ({
  open,
  onClose,
  role,
  currentUserName,
  invoices,
  locations = [],
  owners = [],
}) => {
  // -- Batch report state --
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().tz(TZ).startOf("month"),
    dayjs().tz(TZ).endOf("month"),
  ]);
  const [isAllTime, setIsAllTime] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "all">("all");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "all">("all");
  const [exporting, setExporting] = useState(false);

  // -- Owner locations (admin: fetch when owner selected) --
  const [ownerLocations, setOwnerLocations] = useState<LocationOption[]>([]);

  const fetchOwnerLocations = useCallback(async (ownerId: number) => {
    try {
      const res = await adminApi.getOwnerLocations(ownerId);
      setOwnerLocations(res?.data || []);
    } catch {
      setOwnerLocations([]);
    }
  }, []);

  useEffect(() => {
    if (role === "admin" && selectedOwnerId !== "all") {
      fetchOwnerLocations(selectedOwnerId as number);
    } else {
      setOwnerLocations([]);
    }
  }, [role, selectedOwnerId, fetchOwnerLocations]);

  const filteredLocations = useMemo(() => {
    if (role === "owner") return locations;
    if (selectedOwnerId === "all") return [];
    return ownerLocations;
  }, [role, locations, selectedOwnerId, ownerLocations]);

  // -- Filtered invoices for batch --
  const filteredInvoices = useMemo(() => {
    let data = [...invoices];

    if (role === "admin" && selectedOwnerId !== "all") {
      const ownerLocIds = new Set(filteredLocations.map((l) => l.location_id));
      if (selectedLocationId !== "all") {
        data = data.filter((inv) => inv.location_id === selectedLocationId);
      } else {
        data = data.filter((inv) => inv.location_id && ownerLocIds.has(inv.location_id));
      }
    } else if (selectedLocationId !== "all") {
      data = data.filter((inv) => inv.location_id === selectedLocationId);
    }

    if (!isAllTime && dateRange) {
      const [from, to] = dateRange;
      data = data.filter((inv) => {
        const t = dayjs(inv.payment_time);
        return t.isAfter(from.startOf("day")) && t.isBefore(to.endOf("day"));
      });
    }

    return data;
  }, [invoices, selectedLocationId, dateRange, isAllTime, role, selectedOwnerId, filteredLocations]);

  const batchStats = useMemo(() => {
    const total = filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    return { count: filteredInvoices.length, total };
  }, [filteredInvoices]);

  const handleExportBatch = async () => {
    if (!isAllTime && !dateRange) {
      message.warning("Vui lòng chọn khoảng thời gian!");
      return;
    }
    if (batchStats.count === 0) {
      message.warning("Không có dữ liệu phù hợp với bộ lọc!");
      return;
    }
    setExporting(true);
    try {
      const effectiveDateRange: [dayjs.Dayjs, dayjs.Dayjs] = isAllTime
        ? [dayjs("2020-01-01"), dayjs().tz(TZ)]
        : dateRange!;
      await handleExportBatchExcel(
        filteredInvoices,
        ["restaurant", "hotel", "tourist"],
        effectiveDateRange,
        currentUserName,
      );
      message.success("Xuất báo cáo thành công!");
    } catch (err: any) {
      message.error(err?.message || "Có lỗi xảy ra khi xuất báo cáo");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="Xuất báo cáo tổng hợp"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div style={{ minHeight: 250, paddingTop: 16 }}>
        {/* Date range */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>Khoảng thời gian:</Text>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <DatePicker
              style={{ flex: 1 }}
              value={isAllTime || !dateRange ? null : dateRange[0]}
              onChange={(date) => {
                if (date) {
                  setDateRange([date, dateRange ? dateRange[1] : dayjs().tz(TZ)]);
                  setIsAllTime(false);
                }
              }}
              disabled={isAllTime}
              format="DD/MM/YYYY"
              placeholder="Từ ngày"
              disabledDate={(current) =>
                current && current > dayjs().tz(TZ).endOf("day")
              }
            />
            <span style={{ alignSelf: "center", color: "#6b7280" }}>-</span>
            <DatePicker
              style={{ flex: 1 }}
              value={isAllTime || !dateRange ? null : dateRange[1]}
              onChange={(date) => {
                if (date) {
                  setDateRange([dateRange ? dateRange[0] : dayjs().tz(TZ), date]);
                  setIsAllTime(false);
                }
              }}
              disabled={isAllTime}
              format="DD/MM/YYYY"
              placeholder="Đến ngày"
              disabledDate={(current) =>
                current && current > dayjs().tz(TZ).endOf("day")
              }
            />
            <Button
              type={isAllTime ? "primary" : "default"}
              onClick={() => {
                setIsAllTime(!isAllTime);
                if (!isAllTime) setDateRange(null);
                else setDateRange([dayjs().tz(TZ).startOf("month"), dayjs().tz(TZ).endOf("month")]);
              }}
            >
              Tất cả
            </Button>
          </div>
        </div>

        {/* Admin: Owner filter */}
        {role === "admin" && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Owner:</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={selectedOwnerId}
              onChange={(val) => {
                setSelectedOwnerId(val);
                setSelectedLocationId("all");
              }}
              options={[
                { value: "all", label: "Tất cả Owner" },
                ...owners.map((o) => ({
                  value: o.user_id,
                  label: o.full_name,
                })),
              ]}
            />
          </div>
        )}

        {/* Location filter */}
        {((role === "owner") || (role === "admin" && selectedOwnerId !== "all")) && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>Địa điểm:</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              options={[
                { value: "all", label: "Tất cả địa điểm" },
                ...filteredLocations.map((loc) => ({
                  value: loc.location_id,
                  label: loc.location_name,
                })),
              ]}
            />
          </div>
        )}

        <Divider style={{ margin: "16px 0" }} />

        {/* Stats preview */}
        <div
          style={{
            background: "#f9fafb",
            padding: "16px",
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <Text>
            Kết quả: <Text strong>{batchStats.count} giao dịch</Text> | Tổng doanh thu:{" "}
            <Text strong style={{ color: "#ef4444", fontSize: 16 }}>
              {batchStats.total.toLocaleString("vi-VN")} VND
            </Text>
          </Text>
        </div>

        {/* Export button */}
        <Button
          type="primary"
          size="large"
          icon={<FileExcelOutlined />}
          onClick={handleExportBatch}
          loading={exporting}
          disabled={batchStats.count === 0}
          block
        >
          Tải báo cáo Excel
        </Button>
      </div>
    </Modal>
  );
};

export default InvoiceExportModal;
