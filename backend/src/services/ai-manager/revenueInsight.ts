export interface MonthlyRevenuePoint {
  month: number;
  total: number;
}

const VN_MONTHS = [
  "",
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export function monthLabel(month: number): string {
  return VN_MONTHS[month] || `Tháng ${month}`;
}

export function formatMonthlyRevenueInsight(months: number[], rows: MonthlyRevenuePoint[]): string {
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    totals.set(Number(row.month), Number(row.total || 0));
  });

  const normalizedMonths = [...new Set(months.map(Number).filter((month) => month >= 1 && month <= 12))].sort((a, b) => a - b);
  const points = normalizedMonths.map((month) => ({
    month,
    total: Number(totals.get(month) || 0),
  }));
  const grandTotal = points.reduce((sum, item) => sum + item.total, 0);

  let msg = "";
  for (const item of points) {
    const share = grandTotal > 0 ? ` (${((item.total / grandTotal) * 100).toFixed(1)}%)` : " (0.0%)";
    msg += `- ${monthLabel(item.month)}: ${item.total.toLocaleString("vi-VN")} đ${share}\n`;
  }

  if (points.length >= 2) {
    msg += "\n**Nhận xét xu hướng:**\n";
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const diff = current.total - previous.total;
      if (previous.total > 0) {
        const percent = Math.abs((diff / previous.total) * 100).toFixed(1);
        const direction = diff >= 0 ? "tăng" : "giảm";
        msg += `- ${monthLabel(current.month)} ${direction} ${percent}% so với ${monthLabel(previous.month)} (${Math.abs(diff).toLocaleString("vi-VN")} đ).\n`;
      } else if (current.total > 0) {
        msg += `- ${monthLabel(current.month)} có doanh thu trở lại sau khi ${monthLabel(previous.month)} chưa ghi nhận doanh thu.\n`;
      } else {
        msg += `- ${monthLabel(current.month)} và ${monthLabel(previous.month)} đều chưa ghi nhận doanh thu.\n`;
      }
    }

    const highest = [...points].sort((a, b) => b.total - a.total)[0];
    const lowest = [...points].sort((a, b) => a.total - b.total)[0];
    if (highest && lowest) {
      msg += `- Cao nhất: ${monthLabel(highest.month)} (${highest.total.toLocaleString("vi-VN")} đ).\n`;
      msg += `- Thấp nhất: ${monthLabel(lowest.month)} (${lowest.total.toLocaleString("vi-VN")} đ).\n`;
    }
  }

  msg += `\n=> Tổng cộng ${points.map((item) => monthLabel(item.month)).join(" + ")}: ${grandTotal.toLocaleString("vi-VN")} đ`;
  return msg;
}

export function formatMonthlyRevenueComment(months: number[], rows: MonthlyRevenuePoint[]): string {
  const totals = new Map<number, number>();
  rows.forEach((row) => {
    totals.set(Number(row.month), Number(row.total || 0));
  });

  const normalizedMonths = [...new Set(months.map(Number).filter((month) => month >= 1 && month <= 12))].sort((a, b) => a - b);
  const points = normalizedMonths.map((month) => ({
    month,
    total: Number(totals.get(month) || 0),
  }));
  const grandTotal = points.reduce((sum, item) => sum + item.total, 0);

  if (!points.length) {
    return "Chưa có đủ dữ liệu tháng để nhận xét tỷ lệ doanh thu.";
  }

  let msg = "**Tỷ trọng doanh thu:**\n";
  for (const item of points) {
    const share = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : "0.0";
    msg += `- ${monthLabel(item.month)} chiếm ${share}% tổng doanh thu.\n`;
  }

  if (points.length >= 2) {
    msg += "\n**Nhận xét xu hướng:**\n";
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const diff = current.total - previous.total;
      if (previous.total > 0) {
        const percent = Math.abs((diff / previous.total) * 100).toFixed(1);
        const direction = diff >= 0 ? "tăng" : "giảm";
        msg += `- ${monthLabel(current.month)} ${direction} ${percent}% so với ${monthLabel(previous.month)} (${Math.abs(diff).toLocaleString("vi-VN")} đ).\n`;
      } else if (current.total > 0) {
        msg += `- ${monthLabel(current.month)} có doanh thu trở lại sau khi ${monthLabel(previous.month)} chưa ghi nhận doanh thu.\n`;
      } else {
        msg += `- ${monthLabel(current.month)} và ${monthLabel(previous.month)} đều chưa ghi nhận doanh thu.\n`;
      }
    }

    const highest = [...points].sort((a, b) => b.total - a.total)[0];
    const lowest = [...points].sort((a, b) => a.total - b.total)[0];
    if (highest && lowest) {
      msg += `- Tháng mạnh nhất là ${monthLabel(highest.month)} với ${highest.total.toLocaleString("vi-VN")} đ.\n`;
      msg += `- Tháng yếu nhất là ${monthLabel(lowest.month)} với ${lowest.total.toLocaleString("vi-VN")} đ.`;
    }
  }

  return msg;
}
