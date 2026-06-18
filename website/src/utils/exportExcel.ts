import ExcelJS from "exceljs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Ho_Chi_Minh";

export interface InvoiceData {
  payment_id: number;
  booking_id?: number | null;
  booked_full_name?: string;
  user_full_name?: string;
  phone?: string;
  location_name: string;
  location_id?: number;
  booking_service_name?: string;
  booking_service_type?: string;
  payment_time: string;
  payment_method?: string;
  amount: number | string;
  check_in_date?: string;
  check_out_date?: string;
  contact_name?: string;
  contact_phone?: string;
  food_items?: Array<{ name: string; quantity: number; price: number }>;
}

const cellBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

const headerStyle = {
  font: { bold: true, size: 11 } as Partial<ExcelJS.Font>,
  fill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  } as ExcelJS.Fill,
  border: cellBorder,
  alignment: { horizontal: "center", vertical: "middle" } as Partial<ExcelJS.Alignment>,
};

/**
 * Xuất báo cáo tổng hợp Excel (batch export)
 */
export const handleExportBatchExcel = async (
  filteredInvoices: InvoiceData[],
  selectedTypes: string[],
  dateRange: [dayjs.Dayjs, dayjs.Dayjs],
  currentUserName: string,
): Promise<void> => {
  // 1. Lọc theo loại dịch vụ (nếu chọn tất cả thì không filter)
  const allTypesSelected =
    selectedTypes.includes("restaurant") &&
    selectedTypes.includes("hotel") &&
    selectedTypes.includes("tourist");

  const data = allTypesSelected
    ? filteredInvoices
    : filteredInvoices.filter((inv) => {
        const type = inv.booking_service_type || "other";
        if (
          selectedTypes.includes("restaurant") &&
          (type === "restaurant" || type === "cafe")
        )
          return true;
        if (
          selectedTypes.includes("hotel") &&
          (type === "hotel" || type === "resort")
        )
          return true;
        if (selectedTypes.includes("tourist") && type === "tourist")
          return true;
        return false;
      });

  if (data.length === 0) {
    throw new Error("Không có dữ liệu phù hợp với bộ lọc dịch vụ!");
  }

  if (data.length > 5000) {
    throw new Error(
      `Dữ liệu quá lớn (${data.length} dòng). Vui lòng thu hẹp bộ lọc thời gian.`,
    );
  }

  // 2. Tạo workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUserName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Báo cáo doanh thu");

  // 3. Title rows
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "BÁO CÁO DOANH THU TỔNG HỢP GIAO DỊCH";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:I2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `Khoảng thời gian: từ ${dateRange[0].format("DD/MM/YYYY")} đến ${dateRange[1].format("DD/MM/YYYY")}`;
  subtitleCell.alignment = { horizontal: "center" };

  // 4. Headers
  const headers = [
    "STT",
    "Mã HĐ",
    "Khách Hàng",
    "Địa Điểm",
    "Dịch Vụ",
    "Chi Tiết Dịch Vụ",
    "Thời Gian",
    "Phương Thức",
    "Doanh Thu (VND)",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
    cell.border = cellBorder;
    cell.alignment = headerStyle.alignment;
  });

  // 5. Data rows
  data.forEach((inv, index) => {
    const row = sheet.addRow([
      index + 1,
      (() => {
        const t = inv.booking_service_type || "";
        const isHotel = t === "hotel" || t === "resort";
        const isTourist = t === "tourist" || t === "ticket";
        const pfx = isHotel ? "RS" : isTourist ? "SB" : "DI";
        return inv.booking_id && Number(inv.booking_id) > 0
          ? `#${pfx}-${inv.booking_id}`
          : `#${pfx}-POS-${inv.payment_id}`;
      })(),
      inv.booked_full_name || inv.user_full_name || "Khách vãng lai",
      inv.location_name,
      (() => {
        const d: any = inv;
        let t = d.booking_service_type || "";
        const notesStr = typeof d.notes === "string" ? d.notes.trim() : "";
        
        if (notesStr.startsWith("{")) {
            try {
                const parsed = JSON.parse(notesStr);
                if (parsed.service_type) t = parsed.service_type;
            } catch(e) {}
        }
        
        let isHotel = t === "hotel" || t === "resort" || t === "room";
        let isTourist = t === "tourist" || t === "ticket";
        let isRestaurant = t === "restaurant" || t === "cafe" || t === "table" || t === "food";
        if (notesStr.startsWith("HOTEL_STAY:") || notesStr.startsWith("BATCH_BOOKINGS:")) {
            isHotel = true;
            isTourist = false;
            isRestaurant = false;
        }

        const typeName = isHotel ? "Lưu trú" : isTourist ? "Du lịch" : isRestaurant ? "Ăn uống" : "Dịch vụ";
        return d.booking_service_name ? `${typeName} (${d.booking_service_name})` : typeName;
      })(),
      (() => {
        const d: any = inv;
        let t = d.booking_service_type || "";
        const notesStr = typeof d.notes === "string" ? d.notes.trim() : "";
        
        let qrData: any = null;
        try { qrData = typeof d.qr_data === "string" ? JSON.parse(d.qr_data) : (d.qr_data || {}); } catch(e) {}

        let details = "";
        let rooms = Array.isArray(d.hotel_rooms) ? d.hotel_rooms : [];
        let items = Array.isArray(d.items) ? d.items : Array.isArray(d.food_items) ? d.food_items : [];
        let prepItems = Array.isArray(d.prepaid_items) ? d.prepaid_items : [];
        let osItems = Array.isArray(d.onsite_items) ? d.onsite_items : [];

        if (notesStr.startsWith("{")) {
           try {
              const parsed = JSON.parse(notesStr);
              if (parsed && Array.isArray(parsed.items)) items = [...items, ...parsed.items];
              if (parsed && Array.isArray(parsed.hotel_rooms)) rooms = [...rooms, ...parsed.hotel_rooms];
              if (parsed && Array.isArray(parsed.prepaid_items)) prepItems = [...prepItems, ...parsed.prepaid_items];
              if (parsed && Array.isArray(parsed.onsite_items)) osItems = [...osItems, ...parsed.onsite_items];
              if (parsed && parsed.service_type) t = parsed.service_type;
           } catch(e) {}
        }

        let isHotel = t === "hotel" || t === "resort" || t === "room" || notesStr.startsWith("HOTEL_STAY:") || notesStr.startsWith("BATCH_BOOKINGS:");

        if (notesStr.startsWith("HOTEL_STAY:")) {
           if (qrData?.hotel_invoice?.room_number) {
               rooms.push({ room_name: qrData.hotel_invoice.room_number });
           }
        }
        
        if (notesStr.startsWith("BATCH_BOOKINGS:")) {
           if (qrData?.booking_ids) {
               details = `Nhóm ${qrData.booking_ids.length} phòng`;
           } else {
               details = "Đặt phòng nhóm";
           }
        }

        if (isHotel) {
          if (rooms.length > 0) {
            details = details || rooms.map((r: any) => `Phòng ${r.room_name || r.room_number}`).join(", ");
          }
        }
        
        if (!details) {
          if (prepItems.length > 0 || osItems.length > 0) {
            let parts = [];
            if (prepItems.length > 0) {
              const pNames = prepItems.map((it: any) => `${it.name || it.service_name || it.ticket_name || "Món"} (x${it.quantity || 1})`);
              parts.push(`Đã cọc: ${pNames.join(", ")}`);
            }
            if (osItems.length > 0) {
              const oNames = osItems.map((it: any) => `${it.name || it.service_name || it.ticket_name || "Món"} (x${it.quantity || 1})`);
              parts.push(`Tại quầy: ${oNames.join(", ")}`);
            }
            details = parts.join(" | ");
          } else {
            const allItems = [...items];
            if (allItems.length > 0) {
              const names = allItems.map((it: any) => {
                 const n = it.name || it.service_name || it.ticket_name || "Món";
                 return `${n} (x${it.quantity || 1})`;
              });
              details = names.join(", ");
            }
          }
        }
        if (!details && d.booking_service_name) {
          details = `${d.booking_service_name} (x1)`;
        }
        return details || "—";
      })(),
      dayjs(inv.payment_time).tz(TZ).format("DD/MM/YYYY HH:mm"),
      inv.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản",
      Number(inv.amount || 0),
    ]);
    row.eachCell((cell, colNumber) => {
      cell.border = cellBorder;
      if (colNumber === 9) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // 6. Total row
  const totalAmount = data.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "TỔNG CỘNG:",
    totalAmount,
  ]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.border = cellBorder;
    if (colNumber === 8) cell.alignment = { horizontal: "right" };
    if (colNumber === 9) {
      cell.numFmt = "#,##0";
      cell.font = { bold: true, color: { argb: "FFFF0000" } };
      cell.alignment = { horizontal: "right" };
    }
  });

  // 7. Signature
  sheet.addRow([]);
  sheet.addRow([]);
  const sigRow1 = sheet.addRow(["", "", "", "", "", "", "Người lập báo cáo"]);
  sigRow1.getCell(7).font = { bold: true };
  sigRow1.getCell(7).alignment = { horizontal: "center" };

  const sigRow2 = sheet.addRow(["", "", "", "", "", "", "(Ký, ghi rõ họ tên)"]);
  sigRow2.getCell(7).font = {
    italic: true,
    color: { argb: "FF94A3B8" },
  };
  sigRow2.getCell(7).alignment = { horizontal: "center" };

  sheet.addRow([]);
  const nameRow = sheet.addRow(["", "", "", "", "", "", currentUserName]);
  nameRow.getCell(7).font = { bold: true };
  nameRow.getCell(7).alignment = { horizontal: "center" };

  // 8. Auto-width columns
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value?.toString().length || 0;
      if (len > maxLength) maxLength = len;
    });
    column.width = Math.min(maxLength + 4, 40);
  });

  // 9. Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Bao_cao_doanh_thu_${dayjs().tz(TZ).format("YYYYMMDD_HHmmss")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
