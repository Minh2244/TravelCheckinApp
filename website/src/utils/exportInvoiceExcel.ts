import ExcelJS from "exceljs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { formatMoney } from "./formatMoney";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Ho_Chi_Minh";

export interface InvoiceDetail {
  payment_id: number;
  booking_id?: number | null;
  booked_full_name?: string;
  user_full_name?: string;
  phone?: string;
  location_name: string;
  location_address?: string;
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


const fmtMethod = (v: string | null | undefined) => {
  if (v === "Cash") return "Tiền mặt";
  if (v === "BankTransfer") return "Chuyển khoản";
  return v || "—";
};

/**
 * Xuất hóa đơn đơn lẻ Excel — giống website
 */
export const exportInvoiceExcel = async (
  invoice: InvoiceDetail,
  currentUserName: string,
  detailPayment?: any,
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hóa đơn");

  sheet.columns = [
    { width: 8 },   // STT
    { width: 35 },  // Tên món
    { width: 12 },  // SL
    { width: 15 },  // Giá
    { width: 18 },  // Thành tiền
  ];

  let row = 1;

  // Title
  sheet.mergeCells(`A${row}:E${row}`);
  const titleCell = sheet.getCell(`A${row}`);
  const t = invoice.booking_service_type || "";
  const isHotel = t === "hotel" || t === "resort";
  const isTourist = t === "tourist" || t === "ticket";
  const prefix = isHotel ? "RS" : isTourist ? "SB" : "DI";
  const invoiceCode = invoice.booking_id && Number(invoice.booking_id) > 0
    ? `${prefix}-${invoice.booking_id}`
    : `${prefix}-POS-${invoice.payment_id}`;
  titleCell.value = `Hóa đơn #${invoiceCode}`;
  titleCell.font = { bold: true, size: 16 };
  row++;

  // Time + table
  sheet.mergeCells(`A${row}:E${row}`);
  const timeCell = sheet.getCell(`A${row}`);
  let timeText = dayjs(invoice.payment_time).tz(TZ).format("HH:mm DD/MM/YYYY");
  if (detailPayment?.table_name) timeText += ` • Bàn ${detailPayment.table_name}`;
  timeCell.value = timeText;
  timeCell.font = { color: { argb: "FF6B7280" }, size: 11 };
  row++;
  row++;

  // Payment method
  sheet.getCell(`A${row}`).value = "Thanh toán";
  sheet.getCell(`A${row}`).font = { bold: true };
  row++;
  sheet.getCell(`A${row}`).value = fmtMethod(detailPayment?.payment_method || invoice.payment_method);
  row++;
  row++;

  const d = detailPayment;
  const hasDetail = d && Array.isArray(d.items);
  const isMerged = hasDetail && Number(d.prepaid_amount || 0) > 0 && Number(d.onsite_amount || 0) > 0;
  const prepaidItems = Array.isArray(d?.prepaid_items) ? d.prepaid_items : [];
  const onsiteItems = Array.isArray(d?.onsite_items) ? d.onsite_items : [];

  // Render items helper
  const renderItems = (
    title: string,
    items: Array<{ service_name: string; quantity: number; unit_price: number; line_total: number }>,
    paymentMethod?: string | null,
  ) => {
    sheet.mergeCells(`A${row}:E${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = title + (paymentMethod ? ` (${fmtMethod(paymentMethod)})` : "");
    titleCell.font = { bold: true, size: 12 };
    row++;

    // Header
    const itemNameHeader = isTourist ? "Hạng vé" : "Món";
    const headers = ["STT", itemNameHeader, "SL", "Giá", "Thành tiền"];
    const hRow = sheet.addRow(headers);
    hRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FF6B7280" } };
      cell.border = { bottom: { style: "thin" } };
    });
    row++;

    items.forEach((it, idx) => {
      const r = sheet.addRow([
        idx + 1,
        it.service_name,
        it.quantity,
        it.unit_price,
        it.line_total,
      ]);
      r.eachCell((cell, col) => {
        if (col >= 3) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        }
        if (col === 5) cell.font = { bold: true };
      });
      row++;
    });

    // Subtotal
    const subTotal = items.reduce((s, it) => s + Number(it.line_total || 0), 0);
    const subRow = sheet.addRow(["", "", "", "", subTotal]);
    subRow.getCell(5).font = { bold: true, size: 12 };
    subRow.getCell(5).numFmt = "#,##0";
    subRow.getCell(5).alignment = { horizontal: "right" };
    row++;
    row++;
  };

  // Render items
  if (d && Array.isArray(d.hotel_rooms) && d.hotel_rooms.length > 0) {
    d.hotel_rooms.forEach((rm: any) => {
      sheet.mergeCells(`A${row}:D${row}`);
      const rmTitleCell = sheet.getCell(`A${row}`);
      rmTitleCell.value = `🏨 Phòng ${rm.room_number || "—"}`;
      rmTitleCell.font = { bold: true, size: 12 };
      row++;

      if (rm.guest_name) {
        sheet.mergeCells(`A${row}:D${row}`);
        sheet.getCell(`A${row}`).value = `Khách: ${rm.guest_name}`;
        row++;
      }
      if (rm.checkin_time) {
        sheet.mergeCells(`A${row}:D${row}`);
        sheet.getCell(`A${row}`).value = `Nhận phòng: ${dayjs(rm.checkin_time).tz(TZ).format("HH:mm DD/MM/YYYY")}`;
        row++;
      }
      if (rm.checkout_time) {
        sheet.mergeCells(`A${row}:D${row}`);
        sheet.getCell(`A${row}`).value = `Trả phòng: ${dayjs(rm.checkout_time).tz(TZ).format("HH:mm DD/MM/YYYY")}`;
        row++;
      }
      if (rm.total_amount != null) {
        sheet.mergeCells(`A${row}:D${row}`);
        sheet.getCell(`A${row}`).value = "Thành tiền phòng:";
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`E${row}`).value = rm.total_amount;
        sheet.getCell(`E${row}`).numFmt = "#,##0";
        sheet.getCell(`E${row}`).alignment = { horizontal: "right" };
        sheet.getCell(`E${row}`).font = { bold: true };
        row++;
      }
      row++;
    });
  } else if (isMerged && (prepaidItems.length > 0 || onsiteItems.length > 0)) {
    if (prepaidItems.length > 0) {
      renderItems("Món khách đã thanh toán trước khi check-in", prepaidItems, d.prepaid_payment_method);
    }
    if (onsiteItems.length > 0) {
      renderItems("Món gọi thêm tại bàn", onsiteItems, d.onsite_payment_method);
    }
  } else if (hasDetail && d.items && d.items.length > 0) {
    renderItems(isTourist ? "Chi tiết vé" : "Chi tiết món ăn", d.items, d.payment_method);
  } else {
    // Fallback
    const headers = ["STT", "Tên dịch vụ", "SL", "", "Thành tiền"];
    const hRow = sheet.addRow(headers);
    hRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FF6B7280" } };
      cell.border = { bottom: { style: "thin" } };
    });
    row++;
    const r = sheet.addRow([
      1,
      invoice.booking_service_name || invoice.location_name || "Dịch vụ",
      1,
      "",
      Number(invoice.amount || 0),
    ]);
    r.eachCell((cell, col) => {
      if (col === 5) {
        cell.numFmt = "#,##0";
        cell.font = { bold: true };
        cell.alignment = { horizontal: "right" };
      }
    });
    row++;
    row++;
  }

  // Summary
  const summaryRow = sheet.addRow(["", "", "", "", d?.amount || Number(invoice.amount || 0)]);
  summaryRow.getCell(5).font = { bold: true, size: 14 };
  summaryRow.getCell(5).numFmt = "#,##0";
  summaryRow.getCell(5).alignment = { horizontal: "right" };
  row++;

  if (isMerged) {
    sheet.mergeCells(`A${row}:E${row}`);
    const noteCell = sheet.getCell(`A${row}`);
    noteCell.value = `(Đã thanh toán trước: ${formatMoney(d.prepaid_amount)} • Thanh toán tại bàn: ${formatMoney(d.onsite_amount)})`;
    noteCell.font = { color: { argb: "FF6B7280" }, size: 10 };
    row++;
  }

  // Signature
  row += 2;
  sheet.getCell(`D${row}`).value = "Người lập hóa đơn";
  sheet.getCell(`D${row}`).font = { bold: true };
  sheet.getCell(`D${row}`).alignment = { horizontal: "center" };
  sheet.mergeCells(`D${row}:E${row}`);
  row++;
  sheet.getCell(`D${row}`).value = "(Ký, ghi rõ họ tên)";
  sheet.getCell(`D${row}`).font = { italic: true, color: { argb: "FF94A3B8" } };
  sheet.getCell(`D${row}`).alignment = { horizontal: "center" };
  sheet.mergeCells(`D${row}:E${row}`);
  row += 2;
  sheet.getCell(`D${row}`).value = currentUserName;
  sheet.getCell(`D${row}`).font = { bold: true };
  sheet.getCell(`D${row}`).alignment = { horizontal: "center" };
  sheet.mergeCells(`D${row}:E${row}`);

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Hoa_don_${invoiceCode}_${dayjs().tz(TZ).format("YYYYMMDD")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
