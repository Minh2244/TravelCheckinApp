import pool from "../../config/database";
import { periodFilter } from "./ownerAiService";
import { formatMonthlyRevenueComment } from "./revenueInsight";

function previousPeriodCondition(timeRange: string, dateColumn: string): { condition: string; label: string } | null {
  switch (timeRange) {
    case "today":
      return { condition: `DATE(${dateColumn}) = CURRENT_DATE() - INTERVAL 1 DAY`, label: "hôm qua" };
    case "this_week":
      return { condition: `YEARWEEK(${dateColumn}, 1) = YEARWEEK(CURRENT_DATE() - INTERVAL 1 WEEK, 1)`, label: "tuần trước" };
    case "this_month":
      return { condition: `MONTH(${dateColumn}) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(${dateColumn}) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)`, label: "tháng trước" };
    case "this_year":
      return { condition: `YEAR(${dateColumn}) = YEAR(CURRENT_DATE()) - 1`, label: "năm trước" };
    default:
      return null;
  }
}

function revenueDeltaText(current: number, previous: number | null): string {
  if (previous === null) return "Chưa có kỳ so sánh phù hợp.";
  if (previous <= 0 && current <= 0) return "Chưa có doanh thu ở cả hai kỳ.";
  if (previous <= 0) return "Kỳ trước chưa có doanh thu nên chưa tính được phần trăm tăng trưởng.";
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const direction = diff >= 0 ? "tăng" : "giảm";
  return `${direction} ${Math.abs(percent).toFixed(1)}% so với kỳ trước (${Math.abs(diff).toLocaleString("vi-VN")} đ).`;
}

export async function adminGetUserGrowth(time_range: string, months: number[], start_date?: string, end_date?: string): Promise<string> {
  try {
    let condition = "";
    let prevCondition = "";
    let params: any[] = [];
    let prevParams: any[] = [];
    let currentLabel = "";
    let prevLabel = "";

    const fmt = (d: string) => {
      const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
    };

    if (time_range === "all" || time_range === "toàn bộ" || time_range === "từ trước đến nay" || time_range === "từ đó đến nay") {
      currentLabel = "từ trước đến nay";
      condition = "1=1";
    } else if (months && months.length > 0) {
      const yearNow = new Date().getFullYear();
      const monthPlaceholders = months.map(() => "?").join(", ");
      condition = `YEAR(created_at) = ? AND MONTH(created_at) IN (${monthPlaceholders})`;
      params = [yearNow, ...months];
      const vnMonths = ["", "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
      currentLabel = months.map(m => vnMonths[m]).join(" và ");
    } else if (start_date && end_date) {
      condition = `created_at >= ? AND created_at <= ?`;
      params = [start_date + " 00:00:00", end_date + " 23:59:59"];
      currentLabel = `từ ${fmt(start_date)} đến ${fmt(end_date)}`;
    } else {
      currentLabel = "tháng này";
      prevLabel = "tháng trước";
      condition = "MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())";
      prevCondition = "MONTH(created_at) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)";

      if (time_range === "today") {
          currentLabel = "hôm nay"; prevLabel = "hôm qua";
          condition = "DATE(created_at) = CURRENT_DATE()";
          prevCondition = "DATE(created_at) = CURRENT_DATE() - INTERVAL 1 DAY";
      } else if (time_range === "this_week") {
          currentLabel = "tuần này"; prevLabel = "tuần trước";
          condition = "YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)";
          prevCondition = "YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE() - INTERVAL 1 WEEK, 1)";
      } else if (time_range === "this_year") {
          currentLabel = "năm nay"; prevLabel = "năm trước";
          condition = "YEAR(created_at) = YEAR(CURRENT_DATE())";
          prevCondition = "YEAR(created_at) = YEAR(CURRENT_DATE()) - 1";
      }
    }

    const [rowsCurrent] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM users WHERE ${condition} AND role = 'user'`, params
    );
    const currentTotal = Number(rowsCurrent[0]?.total || 0);

    let msg = "";
    if (time_range === "all" || time_range === "toàn bộ" || time_range === "từ trước đến nay" || time_range === "từ đó đến nay") {
      msg = `Đây là thống kê số lượng người dùng trên hệ thống:\n`;
      msg += `- **Tổng số lượng tài khoản user**: **${currentTotal}** người\n`;
    } else {
      msg = `Đây là số liệu người dùng đăng ký mới của hệ thống:\n`;
      msg += `- Tăng trưởng user mới (${currentLabel}): **${currentTotal}** người\n`;
    }

    if (prevCondition) {
      const [rowsPrev] = await pool.query<any[]>(
        `SELECT COUNT(*) as total FROM users WHERE ${prevCondition} AND role = 'user'`, prevParams
      );
      const prevTotal = Number(rowsPrev[0]?.total || 0);
      msg += `- Tăng trưởng user mới (${prevLabel}): **${prevTotal}** người\n`;

      if (currentTotal > prevTotal && prevTotal > 0) {
        const percent = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
        msg += `\n=> 📈 Tuyệt vời! Lượng user mới **TĂNG ${percent}%** so với ${prevLabel}.`;
      } else if (currentTotal < prevTotal && prevTotal > 0) {
         const percent = Math.round(((prevTotal - currentTotal) / prevTotal) * 100);
         msg += `\n=> 📉 Lượng user mới **GIẢM ${percent}%** so với ${prevLabel}.`;
      } else if (currentTotal === 0 && prevTotal === 0) {
         msg += `\n(Hệ thống chưa ghi nhận người dùng mới nào trong 2 kỳ gần đây)`;
      } else {
         msg += `\n=> Tăng trưởng ổn định so với ${prevLabel}.`;
      }
    }

    // Lấy top 20 user chi tiết
    const [detailRows] = await pool.query<any[]>(
      `SELECT full_name, email, role, created_at FROM users WHERE ${condition} AND role = 'user' ORDER BY created_at DESC LIMIT 20`, params
    );

    if (detailRows.length > 0) {
      msg += `\n\nDanh sách chi tiết ${detailRows.length} user mới nhất:\n`;
      detailRows.forEach((row, index) => {
         const emailStr = row.email ? ` - ${row.email}` : "";
         msg += `${index + 1}. **${row.full_name || 'Khách'}**${emailStr} (${row.role})\n`;
      });
      if (currentTotal > 20) {
          msg += `... (và ${currentTotal - 20} người khác)`;
      }
    }

    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tính toán dữ liệu: " + e.message;
  }
}

export async function adminGetOwnersStats(limit: number = 5): Promise<string> {
  try {
    // Top owners based on payments where owner location matches
    const [rows] = await pool.query<any[]>(
      `SELECT u.user_id, u.full_name, u.email, COUNT(DISTINCT l.location_id) as total_locations, COALESCE(SUM(p.amount), 0) as total_revenue
       FROM users u
       LEFT JOIN locations l ON u.user_id = l.owner_id
       LEFT JOIN payments p ON l.location_id = p.location_id AND p.status = 'completed'
       WHERE u.role = 'owner'
       GROUP BY u.user_id
       ORDER BY total_revenue DESC
       LIMIT ?`, [limit]
    );

    let msg = `Đây là danh sách Top ${limit} Owner kinh doanh tốt nhất hệ thống:\n\n`;

    if (rows.length === 0) {
        msg += "(Chưa có dữ liệu Owner nào)";
        return msg;
    }

    rows.forEach((row, index) => {
        const rev = Number(row.total_revenue).toLocaleString('vi-VN');
        const emailStr = row.email ? ` (${row.email})` : "";
        msg += `${index + 1}. **${row.full_name || 'Owner'}**${emailStr}\n`;
        msg += `   - Số lượng cơ sở: ${row.total_locations}\n`;
        msg += `   - Tổng doanh thu mang lại: ${rev} đ\n\n`;
    });

    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tính toán dữ liệu: " + e.message;
  }
}

export async function adminGetRevenueStats(time_range: string, months: number[], start_date?: string, end_date?: string): Promise<string> {
  try {
    let msg = `Đây là số liệu doanh thu của TOÀN HỆ THỐNG:\n`;
    const fmt = (d: string) => {
      const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
    };

    if (time_range === "all" || time_range === "toàn bộ" || time_range === "từ trước đến nay") {
      const [rows] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'`
      );
      const total = Number(rows[0]?.total || 0);
      msg += `- Từ trước đến nay: ${total.toLocaleString('vi-VN')} đ\n`;
      return msg;
    }

    if (months && months.length > 0) {
      const yearNow = new Date().getFullYear();
      const monthPlaceholders = months.map(() => "?").join(", ");
      const [rows] = await pool.query<any[]>(
        `SELECT MONTH(payment_time) as m, COALESCE(SUM(amount), 0) as total 
         FROM payments 
         WHERE status = 'completed'
         AND YEAR(payment_time) = ?
         AND MONTH(payment_time) IN (${monthPlaceholders})
         GROUP BY MONTH(payment_time) ORDER BY m`,
        [yearNow, ...months]
      );
      let grandTotal = 0;
      const vnMonths = ["", "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
      for (const row of rows) {
        const t = Number(row.total || 0);
        grandTotal += t;
        msg += `- ${vnMonths[row.m] || `Tháng ${row.m}`}: ${t.toLocaleString('vi-VN')} đ\n`;
      }
      msg += `\n=> 💰 **Tổng cộng ${months.map(m => vnMonths[m]).join(" + ")}: ${grandTotal.toLocaleString('vi-VN')} đ**`;
      msg += `\n\n${formatMonthlyRevenueComment(
        months,
        rows.map((row) => ({ month: Number(row.m), total: Number(row.total || 0) }))
      )}`;
    } else if (start_date && end_date) {
      const [rows] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM payments 
         WHERE status = 'completed'
         AND payment_time >= ? AND payment_time <= ?`,
        [start_date + " 00:00:00", end_date + " 23:59:59"]
      );
      const total = Number(rows[0]?.total || 0);
      msg += `- Từ ${fmt(start_date)} đến ${fmt(end_date)}: ${total.toLocaleString('vi-VN')} đ\n`;
    } else {
      let currentLabel = "tháng này";
      let prevLabel = "tháng trước";
      let currentCondition = "MONTH(payment_time) = MONTH(CURRENT_DATE()) AND YEAR(payment_time) = YEAR(CURRENT_DATE())";
      let prevCondition = "MONTH(payment_time) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(payment_time) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)";

      if (time_range === "today") {
          currentLabel = "hôm nay"; prevLabel = "hôm qua";
          currentCondition = "DATE(payment_time) = CURRENT_DATE()";
          prevCondition = "DATE(payment_time) = CURRENT_DATE() - INTERVAL 1 DAY";
      } else if (time_range === "this_week") {
          currentLabel = "tuần này"; prevLabel = "tuần trước";
          currentCondition = "YEARWEEK(payment_time, 1) = YEARWEEK(CURRENT_DATE(), 1)";
          prevCondition = "YEARWEEK(payment_time, 1) = YEARWEEK(CURRENT_DATE() - INTERVAL 1 WEEK, 1)";
      } else if (time_range === "this_year") {
          currentLabel = "năm nay"; prevLabel = "năm trước";
          currentCondition = "YEAR(payment_time) = YEAR(CURRENT_DATE())";
          prevCondition = "YEAR(payment_time) = YEAR(CURRENT_DATE()) - 1";
      }

      const [rowsCurrent] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
         WHERE status = 'completed' AND ${currentCondition}`
      );
      const currentTotal = Number(rowsCurrent[0]?.total || 0);

      const [rowsPrev] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
         WHERE status = 'completed' AND ${prevCondition}`
      );
      const prevTotal = Number(rowsPrev[0]?.total || 0);

      msg += `- Doanh thu ${currentLabel}: ${currentTotal.toLocaleString('vi-VN')} đ\n`;
      msg += `- Doanh thu ${prevLabel}: ${prevTotal.toLocaleString('vi-VN')} đ\n`;
      
      if (currentTotal === 0 && prevTotal === 0) {
        msg += `\n(Hệ thống hiện chưa ghi nhận giao dịch nào trong 2 kỳ gần đây)`;
      } else if (currentTotal >= prevTotal) {
        msg += `\n=> 📈 Tuyệt vời! Doanh thu hệ thống **TĂNG** (hoặc bằng) so với ${prevLabel}. Sếp đang làm rất tốt! 🎉`;
      } else {
        msg += `\n=> 📉 Doanh thu hệ thống **GIẢM**. Sếp có muốn xem xét tạo Voucher Hệ Thống để kích cầu không?`;
      }
    }
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tính toán dữ liệu: " + e.message;
  }
}

export async function adminGetCancellationStats(time_range: string, months: number[] = [], start_date?: string, end_date?: string): Promise<string> {
  try {
    const period = periodFilter("created_at", time_range, months, start_date, end_date);
    const [posRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_orders,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM pos_orders
       WHERE ${period.condition}`,
      period.params
    );
    const [bookingRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_orders,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM hotel_stays
       WHERE ${period.condition}`,
      period.params
    );

    const posTotal = Number(posRows[0]?.total_orders || 0);
    const posCancelled = Number(posRows[0]?.cancelled_orders || 0);
    const bookingTotal = Number(bookingRows[0]?.total_orders || 0);
    const bookingCancelled = Number(bookingRows[0]?.cancelled_orders || 0);
    const totalOrders = posTotal + bookingTotal;
    const totalCancelled = posCancelled + bookingCancelled;
    const rate = totalOrders > 0 ? ((totalCancelled / totalOrders) * 100).toFixed(1) : "0.0";

    let msg = `📉 **Tỷ lệ hủy đơn toàn hệ thống ${period.label}**\n\n`;
    if (totalOrders === 0) return msg + "Chưa có đơn nào trong khoảng thời gian này.";
    msg += `- **Tổng đơn:** ${totalOrders} đơn\n`;
    msg += `- **Đơn hủy:** ${totalCancelled} đơn\n`;
    msg += `- **Tỷ lệ hủy:** ${rate}%\n\n`;
    msg += `Chi tiết:\n`;
    msg += `- POS/tại quầy: ${posCancelled}/${posTotal} đơn hủy\n`;
    msg += `- Booking/lưu trú: ${bookingCancelled}/${bookingTotal} đơn hủy`;
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tính tỷ lệ hủy đơn: " + e.message;
  }
}

export async function adminGetTopServices(time_range: string, months: number[] = [], start_date?: string, end_date?: string, limit: number = 5): Promise<string> {
  try {
    const period = periodFilter("oi.created_at", time_range, months, start_date, end_date);
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const [rows] = await pool.query<any[]>(
      `SELECT s.service_name,
              l.location_name,
              u.full_name as owner_name,
              SUM(oi.quantity) as total_sold,
              COALESCE(SUM(oi.line_total), 0) as total_revenue
       FROM pos_order_items oi
       JOIN pos_orders o ON oi.order_id = o.order_id
       JOIN services s ON oi.service_id = s.service_id
       JOIN locations l ON o.location_id = l.location_id
       LEFT JOIN users u ON l.owner_id = u.user_id
       WHERE o.status IN ('paid', 'completed')
         AND ${period.condition}
       GROUP BY s.service_id, s.service_name, l.location_name, u.full_name
       ORDER BY total_sold DESC, total_revenue DESC
       LIMIT ?`,
      [...period.params, safeLimit]
    );

    let msg = `🏆 **Top ${safeLimit} dịch vụ được dùng nhiều nhất toàn hệ thống ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Chưa có dịch vụ nào được bán ra trong khoảng thời gian này.";
    rows.forEach((row, index) => {
      msg += `${index + 1}. **${row.service_name}** - ${Number(row.total_sold || 0)} lượt\n`;
      msg += `   - Doanh thu: ${Number(row.total_revenue || 0).toLocaleString('vi-VN')} đ\n`;
      msg += `   - Địa điểm: ${row.location_name || "N/A"}${row.owner_name ? ` | Owner: ${row.owner_name}` : ""}\n`;
    });
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi thống kê top dịch vụ: " + e.message;
  }
}

export async function adminGetTopCustomers(time_range: string, months: number[] = [], start_date?: string, end_date?: string, limit: number = 5): Promise<string> {
  try {
    const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const [rows] = await pool.query<any[]>(
      `SELECT u.user_id,
              u.full_name,
              u.email,
              COUNT(p.payment_id) as total_payments,
              COALESCE(SUM(p.amount), 0) as total_spent
       FROM payments p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.status = 'completed'
         AND p.user_id IS NOT NULL
         AND ${period.condition}
       GROUP BY u.user_id, u.full_name, u.email
       ORDER BY total_spent DESC
       LIMIT ?`,
      [...period.params, safeLimit]
    );

    let msg = `🏅 **Top ${safeLimit} khách hàng chi tiêu cao nhất toàn hệ thống ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Chưa có dữ liệu chi tiêu của khách hàng trong khoảng thời gian này.";
    rows.forEach((row, index) => {
      const name = row.full_name || "Khách hàng";
      const email = row.email ? ` (${row.email})` : "";
      msg += `${index + 1}. **${name}**${email}\n`;
      msg += `   - Chi tiêu: ${Number(row.total_spent || 0).toLocaleString('vi-VN')} đ\n`;
      msg += `   - Số giao dịch: ${Number(row.total_payments || 0)}\n`;
    });
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi thống kê top khách hàng: " + e.message;
  }
}

export async function adminGetBusinessRecommendations(time_range: string, months: number[] = [], start_date?: string, end_date?: string): Promise<string> {
  try {
    const revenuePeriod = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const orderPeriod = periodFilter("created_at", time_range, months, start_date, end_date);

    const [revenueRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(p.amount), 0) as total
       FROM payments p
       WHERE p.status = 'completed'
         AND ${revenuePeriod.condition}`,
      revenuePeriod.params
    );
    const currentRevenue = Number(revenueRows[0]?.total || 0);

    let previousRevenue: number | null = null;
    const previous = !months.length && !start_date && !end_date ? previousPeriodCondition(time_range, "p.payment_time") : null;
    if (previous) {
      const [prevRows] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         WHERE p.status = 'completed'
           AND ${previous.condition}`
      );
      previousRevenue = Number(prevRows[0]?.total || 0);
    }

    const [posRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_orders,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM pos_orders
       WHERE ${orderPeriod.condition}`,
      orderPeriod.params
    );
    const [bookingRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_orders,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM hotel_stays
       WHERE ${orderPeriod.condition}`,
      orderPeriod.params
    );
    const totalOrders = Number(posRows[0]?.total_orders || 0) + Number(bookingRows[0]?.total_orders || 0);
    const cancelledOrders = Number(posRows[0]?.cancelled_orders || 0) + Number(bookingRows[0]?.cancelled_orders || 0);
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    const [weakRows] = await pool.query<any[]>(
      `SELECT l.location_id,
              l.location_name,
              u.full_name as owner_name,
              COALESCE(SUM(CASE WHEN p.status = 'completed' AND ${revenuePeriod.condition} THEN p.amount ELSE 0 END), 0) as total_revenue
       FROM locations l
       LEFT JOIN users u ON l.owner_id = u.user_id
       LEFT JOIN payments p ON p.location_id = l.location_id
       GROUP BY l.location_id, l.location_name, u.full_name
       ORDER BY total_revenue ASC
       LIMIT 1`,
      revenuePeriod.params
    );

    const servicePeriod = periodFilter("oi.created_at", time_range, months, start_date, end_date);
    const [serviceRows] = await pool.query<any[]>(
      `SELECT s.service_name,
              l.location_name,
              SUM(oi.quantity) as total_sold,
              COALESCE(SUM(oi.line_total), 0) as total_revenue
       FROM pos_order_items oi
       JOIN pos_orders o ON oi.order_id = o.order_id
       JOIN services s ON oi.service_id = s.service_id
       JOIN locations l ON o.location_id = l.location_id
       WHERE o.status IN ('paid', 'completed')
         AND ${servicePeriod.condition}
       GROUP BY s.service_id, s.service_name, l.location_name
       ORDER BY total_sold DESC, total_revenue DESC
       LIMIT 1`,
      servicePeriod.params
    );

    const weakLocation = weakRows[0];
    const topService = serviceRows[0];
    const previousLabel = previous ? previous.label : "kỳ trước";
    const revenueText = revenueDeltaText(currentRevenue, previousRevenue);
    const recommendations: string[] = [];

    if (previousRevenue !== null && previousRevenue > 0 && currentRevenue < previousRevenue * 0.9) {
      recommendations.push(`Doanh thu toàn hệ thống đang giảm so với ${previousLabel}. Có thể chuẩn bị voucher hệ thống ngắn hạn để kích cầu.`);
    }
    if (cancelRate >= 15) {
      recommendations.push(`Tỷ lệ hủy ${cancelRate.toFixed(1)}% khá cao. Nên rà soát nhóm địa điểm có hủy nhiều và kiểm tra quy trình xác nhận đơn.`);
    }
    if (weakLocation) {
      const name = weakLocation.location_name || "địa điểm doanh thu thấp";
      const ownerName = weakLocation.owner_name ? ` của owner ${weakLocation.owner_name}` : "";
      recommendations.push(`Địa điểm cần chú ý: **${name}**${ownerName}. Có thể gợi ý owner tạo voucher riêng hoặc admin tạo voucher hỗ trợ theo địa điểm.`);
    }
    if (topService) {
      recommendations.push(`Dịch vụ nổi bật: **${topService.service_name}** tại ${topService.location_name || "một địa điểm"} (${Number(topService.total_sold || 0)} lượt). Có thể đẩy chiến dịch theo dịch vụ đang có nhu cầu tốt.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Chưa có tín hiệu bất thường lớn. Nên tiếp tục theo dõi doanh thu, tỷ lệ hủy và top dịch vụ trước khi mở chiến dịch mới.");
    }

    let msg = `🧠 **Khuyến nghị AI toàn hệ thống ${revenuePeriod.label}**\n\n`;
    msg += `**Chỉ số chính**\n`;
    msg += `- Doanh thu: ${currentRevenue.toLocaleString("vi-VN")} đ\n`;
    if (previousRevenue !== null) msg += `- Doanh thu ${previousLabel}: ${previousRevenue.toLocaleString("vi-VN")} đ\n`;
    msg += `- Xu hướng doanh thu: ${revenueText}\n`;
    msg += `- Tổng đơn: ${totalOrders} đơn\n`;
    msg += `- Đơn hủy: ${cancelledOrders} đơn\n`;
    msg += `- Tỷ lệ hủy: ${cancelRate.toFixed(1)}%\n\n`;
    msg += `**Đề xuất**\n`;
    recommendations.forEach((item, index) => {
      msg += `${index + 1}. ${item}\n`;
    });
    msg += `\nAI chỉ đề xuất. Voucher hệ thống hoặc thao tác ghi dữ liệu vẫn cần admin xác nhận bản nháp.`;
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tạo khuyến nghị AI: " + e.message;
  }
}

export async function adminGetTopLocations(time_range: string, months: number[] = [], start_date?: string, end_date?: string, limit: number = 3): Promise<string> {
  try {
     const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const [rows] = await pool.query<any[]>(
      `SELECT l.location_name, COUNT(p.payment_id) as total_orders, SUM(p.amount) as total_revenue
       FROM locations l
       JOIN payments p ON l.location_id = p.location_id
       WHERE p.status = 'completed' AND ${period.condition}
       GROUP BY l.location_id
       ORDER BY total_revenue DESC LIMIT ?`,
      [...period.params, limit]
    );

    let msg = `🏆 **Top ${limit} Địa điểm Doanh thu cao nhất ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Không có dữ liệu địa điểm nào trong khoảng thời gian này.";
    for (let i = 0; i < rows.length; i++) {
        msg += `${i + 1}. **${rows[i].location_name}** - Doanh thu: ${Number(rows[i].total_revenue).toLocaleString('vi-VN')} đ (Số đơn: ${rows[i].total_orders})\n`;
    }
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi tính toán dữ liệu: " + e.message;
  }
}

export async function adminViewLocations(): Promise<string> {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT l.location_id, l.location_name, l.status, l.commission_rate, u.full_name as owner_name 
       FROM locations l
       JOIN users u ON l.owner_id = u.user_id
       WHERE u.role = 'owner'`
    );
    let msg = "📋 **Danh sách các địa điểm trên hệ thống:**\n\n";
    if (rows.length === 0) return msg + "Không có địa điểm nào.";
    
    const translateStatus = (s: string) => {
      const val = String(s || "").toLowerCase();
      if (val === "active") return "Hoạt động";
      if (val === "pending") return "Chờ duyệt";
      if (val === "rejected") return "Bị từ chối";
      if (val === "inactive") return "Tạm ngưng";
      return s;
    };

    for (const row of rows) {
      msg += `- ID ${row.location_id}: **${row.location_name}** | Trạng thái: **${translateStatus(row.status)}** | Chủ: ${row.owner_name || "N/A"} | Phí: ${row.commission_rate}%\n`;
    }
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi lấy danh sách địa điểm: " + e.message;
  }
}

export async function adminViewSosAlerts(): Promise<string> {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT s.alert_id, s.location_text, s.message, s.status, s.created_at, u.full_name, u.email
       FROM sos_alerts s
       LEFT JOIN users u ON s.user_id = u.user_id
       ORDER BY s.created_at DESC`
    );
    let msg = "🚨 **Danh sách cảnh báo khẩn cấp (SOS Alerts):**\n\n";
    if (rows.length === 0) return msg + "Không có cảnh báo nào.";
    for (const row of rows) {
      const timeStr = new Date(row.created_at).toLocaleString('vi-VN');
      msg += `- [${row.status.toUpperCase()}] **${row.full_name || row.email || "Khách"}**: "${row.message}" tại *${row.location_text || "Không xác định"}* (${timeStr})\n`;
    }
    return msg;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi lấy danh sách cảnh báo SOS: " + e.message;
  }
}

export async function adminSendPushNotification(sent_by: number, title: string, message: string): Promise<string> {
  try {
    await pool.query(
      `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, created_at) 
       VALUES (?, ?, 'all', NULL, ?, NOW())`,
      [title, message, sent_by]
    );
    return `✅ Đã gửi thông báo đẩy đến toàn bộ người dùng thành công!\n• Tiêu đề: **${title}**\n• Nội dung: "${message}"`;
  } catch (e: any) {
    return "Đã xảy ra lỗi khi gửi thông báo: " + e.message;
  }
}

export async function adminAdjustCommissionRate(commission_rate: number, location_id?: number, owner_id?: number): Promise<string> {
  try {
    if (location_id) {
      const [loc] = await pool.query<any[]>("SELECT location_name FROM locations WHERE location_id = ?", [location_id]);
      if (loc.length === 0) return `❌ Không tìm thấy địa điểm với ID ${location_id}.`;
      await pool.query("UPDATE locations SET commission_rate = ? WHERE location_id = ?", [commission_rate, location_id]);
      return `✅ Đã cập nhật tỷ lệ hoa hồng cho địa điểm **${loc[0].location_name}** (ID ${location_id}) thành **${commission_rate}%**!`;
    } else if (owner_id) {
      const [owner] = await pool.query<any[]>("SELECT full_name FROM users WHERE user_id = ? AND role = 'owner'", [owner_id]);
      if (owner.length === 0) return `❌ Không tìm thấy chủ cơ sở với ID ${owner_id}.`;
      const [res] = await pool.query<any>("UPDATE locations SET commission_rate = ? WHERE owner_id = ?", [commission_rate, owner_id]);
      return `✅ Đã cập nhật tỷ lệ hoa hồng thành **${commission_rate}%** cho tất cả **${res.affectedRows || 0} địa điểm** của chủ cơ sở **${owner[0].full_name}** (ID ${owner_id})!`;
    } else {
      // Adjust system-wide commission rate if neither is provided
      await pool.query("UPDATE locations SET commission_rate = ?", [commission_rate]);
      return `✅ Đã cập nhật tỷ lệ hoa hồng toàn hệ thống cho mọi địa điểm thành **${commission_rate}%**!`;
    }
  } catch (e: any) {
    return "Đã xảy ra lỗi khi cập nhật tỷ lệ hoa hồng: " + e.message;
  }
}
