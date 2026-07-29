import pool from "../../config/database";
import { periodFilter } from "./ownerAiService";

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
