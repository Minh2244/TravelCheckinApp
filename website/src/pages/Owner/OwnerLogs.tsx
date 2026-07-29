import { useCallback, useEffect, useState } from "react";
import { Card, Table, message, Tag, Space, DatePicker, Select, Button, Typography, Descriptions } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";

const { Text } = Typography;

type AuditLogRow = {
  log_id: number;
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  created_at?: string | null;
  action?: string | null;
  details?: string | null;
};

// Map action to human-readable Vietnamese and color
const ACTION_MAP: Record<string, { label: string; color: string }> = {
  CREATE_OWNER_LOCATION: { label: "Tạo địa điểm mới", color: "green" },
  UPDATE_OWNER_LOCATION: { label: "Cập nhật địa điểm", color: "blue" },
  CREATE_OWNER_SERVICE: { label: "Tạo dịch vụ mới", color: "green" },
  UPDATE_OWNER_SERVICE: { label: "Cập nhật dịch vụ", color: "blue" },
  DELETE_OWNER_SERVICE: { label: "Xóa dịch vụ", color: "red" },
  SOFT_DELETE_OWNER_SERVICE: { label: "Tạm ngưng dịch vụ", color: "orange" },
  UPLOAD_OWNER_SERVICE_IMAGE: { label: "Tải lên ảnh dịch vụ", color: "cyan" },
  CREATE_OWNER_VOUCHER: { label: "Tạo Voucher mới", color: "green" },
  UPDATE_OWNER_VOUCHER: { label: "Cập nhật Voucher", color: "blue" },
  DELETE_OWNER_VOUCHER: { label: "Xóa Voucher", color: "red" },
  CREATE_OWNER_EMPLOYEE: { label: "Thêm nhân viên", color: "green" },
  UPDATE_OWNER_EMPLOYEE: { label: "Cập nhật nhân viên", color: "blue" },
  TOGGLE_OWNER_EMPLOYEE: { label: "Đổi trạng thái nhân viên", color: "orange" },
  DELETE_OWNER_EMPLOYEE: { label: "Xóa nhân viên", color: "red" },
  UPDATE_OWNER_PROFILE: { label: "Cập nhật hồ sơ", color: "blue" },
  UPDATE_OWNER_BANK: { label: "Cập nhật ngân hàng", color: "blue" },
  UPLOAD_OWNER_AVATAR: { label: "Cập nhật ảnh đại diện", color: "cyan" },
  CREATE_HOTEL_ROOM: { label: "Tạo phòng mới", color: "green" },
  SET_HOTEL_ROOM_STATUS: { label: "Cập nhật trạng thái phòng", color: "blue" },
  HOTEL_ROOM_CHECKIN: { label: "Khách nhận phòng", color: "purple" },
  HOTEL_STAY_CHECKOUT: { label: "Khách trả phòng", color: "magenta" },
  HOTEL_STAY_CHECKOUT_BATCH: { label: "Trả phòng hàng loạt", color: "magenta" },
  SELL_POS_TICKETS: { label: "Bán vé POS", color: "purple" },
  SELL_POS_TICKETS_BATCH: { label: "Bán vé POS (nhiều vé)", color: "purple" },
  POS_ORDER_PAID: { label: "Thanh toán đơn hàng", color: "purple" },
  UPDATE_OWNER_BOOKING_STATUS: { label: "Cập nhật đặt chỗ", color: "blue" },
  REPLY_REVIEW: { label: "Trả lời đánh giá", color: "blue" },
  OWNER_DELETE_REVIEW: { label: "Xóa đánh giá", color: "red" },
  COMMISSION_PAYMENT_REQUEST: { label: "Yêu cầu rút tiền", color: "gold" },
  COMMISSION_PAYMENT_CONFIRMED: { label: "Xác nhận rút tiền", color: "green" },
  COMMISSION_PAYMENT_CANCELLED: { label: "Hủy yêu cầu rút tiền", color: "red" },
  MANUAL_COMMISSION_RECONCILIATION: { label: "Đối soát hoa hồng thủ công", color: "blue" },
  UPDATE_COMMISSION_RATE: { label: "Cập nhật tỷ lệ hoa hồng", color: "orange" },
  UPDATE_LOCATION_COMMISSION_RATE: { label: "Cập nhật tỷ lệ hoa hồng địa điểm", color: "orange" },
  APPROVE_OWNER: { label: "Duyệt chủ quán", color: "green" },
  APPROVE_LOCATION: { label: "Duyệt địa điểm", color: "green" },
  ADMIN_DELETE_REVIEW: { label: "Admin xóa đánh giá", color: "red" },
  DELETE_OWNER_SERVICE_ADMIN: { label: "Admin xóa dịch vụ", color: "red" },
  UPDATE_OWNER_SERVICE_APPROVAL: { label: "Cập nhật duyệt dịch vụ", color: "orange" },
  REVIEW_OWNER_VOUCHER_ADMIN: { label: "Duyệt Voucher", color: "orange" },
};

const getActionInfo = (action: string | null | undefined) => {
  if (!action) return { label: "Không rõ", color: "default" };
  return ACTION_MAP[action] || { label: action, color: "default" };
};

const OwnerLogs = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  
  // Filters and Pagination
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined);
  const [selectedActor, setSelectedActor] = useState<string | undefined>(undefined);
  
  // Employees list for actor filter
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchEmployees = async () => {
    try {
      const res = await ownerApi.getEmployees();
      setEmployees(res?.data || []);
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined;
      const endDate = dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined;
      
      const res = await ownerApi.getAuditLogs(page, 50, selectedAction, startDate, endDate, selectedActor);
      setItems((res?.data || []) as AuditLogRow[]);
      setTotal(res?.total || 0);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải nhật ký"));
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, selectedAction, selectedActor]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReset = () => {
    setDateRange([null, null]);
    setSelectedAction(undefined);
    setSelectedActor(undefined);
    setPage(1);
  };

  const exportExcel = async () => {
    try {
      setLoading(true);
      // Fetch all matching without pagination for export (large limit)
      const startDate = dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined;
      const endDate = dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined;
      
      const res = await ownerApi.getAuditLogs(1, 10000, selectedAction, startDate, endDate, selectedActor);
      const allData: AuditLogRow[] = res?.data || [];
      
      if (allData.length === 0) {
        message.warning("Không có dữ liệu để xuất");
        return;
      }

      const userStr = sessionStorage.getItem("user");
      const userProfile = userStr ? JSON.parse(userStr) : null;
      const currentUserName = userProfile?.full_name || "";

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Nhật ký");

      sheet.columns = [
        { width: 8 },   // STT
        { width: 22 },  // Thời gian
        { width: 25 },  // Người thực hiện
        { width: 30 },  // Email
        { width: 35 },  // Hành động (Mã)
        { width: 30 },  // Hành động (Tiếng Việt)
        { width: 60 },  // Chi tiết
      ];

      let rowCount = 1;

      // Title
      sheet.mergeCells(`A${rowCount}:G${rowCount}`);
      const titleCell = sheet.getCell(`A${rowCount}`);
      titleCell.value = "BÁO CÁO NHẬT KÝ HOẠT ĐỘNG";
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };
      rowCount++;

      // Subtitle
      sheet.mergeCells(`A${rowCount}:G${rowCount}`);
      const subtitleCell = sheet.getCell(`A${rowCount}`);
      subtitleCell.value = `Ngày xuất báo cáo: ${dayjs().format('DD/MM/YYYY HH:mm')}`;
      subtitleCell.font = { italic: true, color: { argb: "FF6B7280" } };
      subtitleCell.alignment = { horizontal: "center" };
      rowCount++;
      rowCount++; // Empty row

      // Header
      const headers = ["STT", "Thời gian", "Người thực hiện", "Email", "Hành động (Mã)", "Hành động (Tiếng Việt)", "Chi tiết"];
      const hRow = sheet.addRow(headers);
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: "FF4B5563" } };
        cell.border = { bottom: { style: "thin" }, top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      rowCount++;

      // Data
      allData.forEach((row, i) => {
        const time = row.created_at ? formatDateTimeVi(String(row.created_at)) : "";
        const actorName = row.full_name || "Hệ thống/Không rõ";
        const email = row.email || "";
        const actionCode = row.action || "";
        const actionLabel = getActionInfo(row.action).label;
        const details = row.details || "";
        
        const r = sheet.addRow([allData.length - i, time, actorName, email, actionCode, actionLabel, details]);
        r.getCell(1).alignment = { horizontal: "center" };
        r.eachCell(c => {
          c.border = { bottom: { style: "thin" }, top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        rowCount++;
      });

      // Total row
      const tRow = sheet.addRow(["", "", "", "", "", "Tổng số hoạt động:", allData.length]);
      tRow.getCell(6).font = { bold: true };
      tRow.getCell(6).alignment = { horizontal: "right" };
      tRow.getCell(7).font = { bold: true };
      tRow.getCell(7).alignment = { horizontal: "left" };
      rowCount++;

      rowCount += 2;

      // Signature
      sheet.mergeCells(`F${rowCount}:G${rowCount}`);
      sheet.getCell(`F${rowCount}`).value = "Người xuất báo cáo";
      sheet.getCell(`F${rowCount}`).font = { bold: true };
      sheet.getCell(`F${rowCount}`).alignment = { horizontal: "center" };
      
      rowCount++;
      sheet.mergeCells(`F${rowCount}:G${rowCount}`);
      sheet.getCell(`F${rowCount}`).value = "(Ký và ghi rõ họ tên)";
      sheet.getCell(`F${rowCount}`).font = { italic: true, color: { argb: "FF94A3B8" } };
      sheet.getCell(`F${rowCount}`).alignment = { horizontal: "center" };

      rowCount += 4;
      if (currentUserName) {
        sheet.mergeCells(`F${rowCount}:G${rowCount}`);
        sheet.getCell(`F${rowCount}`).value = currentUserName;
        sheet.getCell(`F${rowCount}`).font = { bold: true };
        sheet.getCell(`F${rowCount}`).alignment = { horizontal: "center" };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `nhat_ky_hoat_dong_${dayjs().format('YYYYMMDD')}.xlsx`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success("Đã xuất Excel thành công");
    } catch (err: unknown) {
      message.error("Lỗi khi xuất Excel");
    } finally {
      setLoading(false);
    }
  };

  const actionOptions = Object.keys(ACTION_MAP).map(key => ({
    label: ACTION_MAP[key].label,
    value: key,
  }));

  const actorOptions = employees.map(emp => ({
    label: `${emp.full_name} (${emp.email})`,
    value: emp.user_id,
  }));

  const renderExpandedRow = (record: AuditLogRow) => {
    let parsedDetails: any = null;
    try {
      if (record.details) {
        parsedDetails = JSON.parse(record.details);
      }
    } catch (e) {
      // Ignore parse error
    }

    if (!parsedDetails) {
      return <Text type="secondary">Không có thông tin chi tiết hoặc định dạng không hợp lệ.</Text>;
    }

    return (
      <div style={{ backgroundColor: '#fafafa', padding: 16, borderRadius: 8 }}>
        <Descriptions size="small" column={1} bordered>
          {Object.entries(parsedDetails).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {typeof value === 'object' ? (
                <pre style={{ margin: 0, fontSize: '0.85em' }}>{JSON.stringify(value, null, 2)}</pre>
              ) : (
                String(value)
              )}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </div>
    );
  };

  return (
    <MainLayout>
      <Card title="Nhật ký thao tác" loading={loading}>
        <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
          <DatePicker
            value={dateRange[0]}
            onChange={(date) => { setDateRange([date, dateRange[1]]); setPage(1); }}
            placeholder="Từ ngày"
            format="DD/MM/YYYY"
          />
          <DatePicker
            value={dateRange[1]}
            onChange={(date) => { setDateRange([dateRange[0], date]); setPage(1); }}
            placeholder="Đến ngày"
            format="DD/MM/YYYY"
            disabledDate={(current) => {
              if (!dateRange[0]) return false;
              // Can not select days before start date
              return current && current < dateRange[0].startOf('day');
            }}
          />
          <Select
            allowClear
            style={{ width: 250 }}
            placeholder="Lọc theo hành động"
            options={actionOptions}
            value={selectedAction}
            onChange={(v) => { setSelectedAction(v); setPage(1); }}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          {employees.length > 0 && (
            <Select
              allowClear
              style={{ width: 250 }}
              placeholder="Người thực hiện"
              options={actorOptions}
              value={selectedActor}
              onChange={(v) => { setSelectedActor(v); setPage(1); }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          )}
          <Button type="primary" onClick={() => setPage(1)}>Tìm kiếm</Button>
          <Button onClick={handleReset}>Xóa bộ lọc</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportExcel}>Xuất Excel</Button>
        </Space>

        <Table
          rowKey="log_id"
          dataSource={items}
          pagination={{ 
            current: page,
            pageSize: 50, 
            total: total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `Tổng ${t} dòng`
          }}
          scroll={{ x: 'max-content', y: 600 }}
          expandable={{
            expandedRowRender: renderExpandedRow,
            rowExpandable: (record) => !!record.details,
            expandIconColumnIndex: 5,
          }}
          columns={[
            {
              title: "STT",
              key: "index",
              width: 60,
              render: (_: unknown, __: unknown, index: number) => total - ((page - 1) * 50 + index),
            },
            {
              title: "Thời gian",
              dataIndex: "created_at",
              width: 180,
              render: (v: unknown) => (v ? formatDateTimeVi(String(v)) : "-"),
            },
            {
              title: "Người thực hiện",
              dataIndex: "full_name",
              width: 200,
              render: (v: string, record: AuditLogRow) => {
                if (!v) return <Text type="secondary">Hệ thống</Text>;
                return <div>
                  <div>{v}</div>
                  <div style={{ fontSize: 12, color: 'gray' }}>{record.email}</div>
                </div>;
              }
            },
            { 
              title: "Hành động (Action)", 
              dataIndex: "action", 
              width: 240,
              render: (v: string) => {
                const info = getActionInfo(v);
                return <Tag color={info.color}>{info.label}</Tag>;
              }
            },
            { 
              title: "Chi tiết", 
              dataIndex: "details",
              render: (v: string) => {
                if (!v) return "-";
                // Show a brief summary of the JSON keys
                try {
                  const obj = JSON.parse(v);
                  const keys = Object.keys(obj).slice(0, 3);
                  return <Text type="secondary" ellipsis={{ tooltip: true }}>{`Có cập nhật: ${keys.join(', ')}...`}</Text>;
                } catch {
                  return <Text type="secondary" ellipsis={{ tooltip: true }}>{v.substring(0, 50)}...</Text>;
                }
              }
            },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

export default OwnerLogs;
