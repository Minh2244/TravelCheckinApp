import ExcelJS from "exceljs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = "Asia/Ho_Chi_Minh";

export const exportOwnerCommissions = async (data: any[], currentUserName: string) => {
  if (!data || data.length === 0) {
    throw new Error("Không có dữ liệu để xuất!");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUserName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Chi tiết Hoa hồng");

  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "CHI TIẾT CÁC KHOẢN HOA HỒNG ĐÃ CHỐT";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  let minDate = dayjs();
  let maxDate = dayjs(0);
  let totalAmount = 0;

  data.forEach((item) => {
    totalAmount += Number(item.total_due || 0);
    const d = dayjs(item.created_at || item.due_date || item.payment_time);
    if (d.isValid()) {
      if (d.isBefore(minDate)) minDate = d;
      if (d.isAfter(maxDate)) maxDate = d;
    }
  });

  const dateStr =
    data.length > 0 && maxDate.isAfter(dayjs(0))
      ? `Từ ${minDate.format("DD/MM/YYYY")} đến ${maxDate.format("DD/MM/YYYY")}`
      : `Ngày xuất: ${dayjs().tz(TZ).format("DD/MM/YYYY HH:mm")}`;

  sheet.mergeCells("A2:F2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `${dateStr} | Tổng số kỳ: ${data.length}`;
  subtitleCell.alignment = { horizontal: "center" };

  const headers = [
    "STT",
    "Kỳ đối soát",
    "Hạn nộp",
    "Trạng thái",
    "Số tiền hoa hồng (VND)",
    "Tổng phải nộp (VND)",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo 600
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  data.forEach((item, index) => {
    let statusText = "";
    if (item.status === "paid") statusText = "Đã thanh toán";
    else if (item.status === "overdue") statusText = "Quá hạn";
    else if (item.status === "payment_submitted") statusText = "Chờ admin duyệt";
    else statusText = "Chờ thanh toán";

    const row = sheet.addRow([
      index + 1,
      item.billing_period || "---",
      item.due_date ? dayjs(item.due_date).tz(TZ).format("DD/MM/YYYY") : "---",
      statusText,
      Number(item.commission_amount || 0),
      Number(item.total_due || 0),
    ]);

    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0";
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (colNumber !== 2) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    });
  });

  // Total row
  const totalRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "TỔNG CỘNG:",
    totalAmount,
  ]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (colNumber === 5) cell.alignment = { horizontal: "right" };
    if (colNumber === 6) {
      cell.numFmt = "#,##0";
      cell.font = { bold: true, color: { argb: "FFFF0000" } }; // Red color for total
      cell.alignment = { horizontal: "center" };
    }
  });

  // Footer: Người lập báo cáo
  sheet.addRow([]);
  sheet.addRow([]);
  const footerRow1 = sheet.addRow(["", "", "", "", "Người lập báo cáo"]);
  const footerRow2 = sheet.addRow(["", "", "", "", "(Ký, ghi rõ họ tên)"]);
  sheet.addRow([]);
  sheet.addRow([]);
  const footerRow3 = sheet.addRow(["", "", "", "", currentUserName]);

  // Merge footer cells to align center
  sheet.mergeCells(`E${footerRow1.number}:F${footerRow1.number}`);
  sheet.mergeCells(`E${footerRow2.number}:F${footerRow2.number}`);
  sheet.mergeCells(`E${footerRow3.number}:F${footerRow3.number}`);

  const footer1Cell = sheet.getCell(`E${footerRow1.number}`);
  footer1Cell.font = { bold: true, size: 12 };
  footer1Cell.alignment = { horizontal: "center" };

  const footer2Cell = sheet.getCell(`E${footerRow2.number}`);
  footer2Cell.font = { italic: true, color: { argb: "FF6B7280" } }; // Gray 500
  footer2Cell.alignment = { horizontal: "center" };

  const footer3Cell = sheet.getCell(`E${footerRow3.number}`);
  footer3Cell.font = { bold: true, size: 12 };
  footer3Cell.alignment = { horizontal: "center" };

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 35;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 25;
  sheet.getColumn(6).width = 25;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeDate = dayjs().tz(TZ).format("YYYYMMDD_HHmmss");
  link.download = `Chi_tiet_hoa_hong_${safeDate}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
