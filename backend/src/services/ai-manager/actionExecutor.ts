import pool from "../../config/database";
import { ownerGetOrderStats, ownerGetRevenueStructure, ownerGetTopServices, ownerAnalyzeReviews } from "./ownerAiService";

export interface ExecuteActionPayload {
  command_id: string;
  actor_user_id: number;
  role: "owner" | "admin";
  route: string;
  action_key: string;
  action_plan: Record<string, unknown>;
}

export async function executeManagerAiAction(payload: ExecuteActionPayload): Promise<Record<string, unknown>> {
  // Ghi log vào ai_action_runs nếu cần, hoặc giả định Controller đã ghi.
  // Ở đây tập trung vào logic thực thi (draft voucher, reply review).

  const { action_key, action_plan, actor_user_id, command_id, role, route } = payload;
  let resultData = {};

  try {
    // Insert initial record
    await pool.query(
      `INSERT INTO ai_action_runs 
        (command_id, actor_user_id, assistant_scope, route, action_key, risk_level, action_plan, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'executing') 
       ON DUPLICATE KEY UPDATE status = 'executing'`,
      [
        command_id,
        actor_user_id,
        role,
        route,
        action_key,
        action_plan.risk_level || "low",
        JSON.stringify(action_plan)
      ]
    );

    switch (action_key) {
            case "owner_voucher_draft": {
        const ents = action_plan.entities as any || {};
        const code = ents.code || `DEAL${Math.floor(Math.random() * 9000 + 1000)}`;
        // Đọc discount_value (tên mới) hoặc discount_amount (tên cũ từ Gemini)
        const discount_value = Number(ents.discount_value ?? ents.discount_amount ?? 0);
        if (!discount_value) {
          resultData = { success: false, message: "Thiếu thông tin số tiền giảm giá. Sếp vui lòng nhập lại!" };
          break;
        }
        // DB chỉ chấp nhận 'percent' hoặc 'amount'
        const raw_type = String(ents.discount_type || 'amount').toLowerCase();
        const discount_type = raw_type === 'percent' || raw_type === 'percentage' ? 'percent' : 'amount';
        const today = new Date().toISOString().split('T')[0];
        // Đọc end_date (tên mới) hoặc expiry_date (tên cũ)
        const start_date = ents.start_date || today;
        const end_date = ents.end_date || ents.expiry_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const min_order_value = Number(ents.min_order_value ?? 0);
        const campaign_name = ents.campaign_name || ents.title || 'Voucher từ AI';

        await pool.query(
          `INSERT INTO vouchers 
            (owner_id, code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [actor_user_id, code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date]
        );

        const fmtMoney = (v: number) => v.toLocaleString('vi-VN') + ' đ';
        resultData = {
          success: true,
          message: `✅ Đã tạo voucher **${code}** thành công!\n• Giảm: ${fmtMoney(discount_value)}\n• Hạn: ${start_date} → ${end_date}\n• Đơn tối thiểu: ${min_order_value > 0 ? fmtMoney(min_order_value) : 'Không giới hạn'}`,
        };
        break;
      }
      case "owner_review_reply_draft":
      case "owner_review_reply_publish": {
        const ents = action_plan.entities as any || {};
        const review_id = ents.review_id;
        const content = ents.reply_content || ents.content || "Cảm ơn bạn đã đánh giá!";
        
        if (review_id) {
          await pool.query(
            `INSERT INTO review_replies (review_id, content, role, created_by, created_at, updated_at) 
             VALUES (?, ?, 'owner', ?, NOW(), NOW())`,
            [review_id, content, actor_user_id]
          );
          
          await pool.query(
            "UPDATE reviews SET has_owner_reply = 1 WHERE review_id = ?",
            [review_id]
          );
        }

        resultData = {
          success: true,
          message: "Đã phản hồi đánh giá thành công.",
          reply_details: action_plan.entities,
        };
        break;
      }
      case "admin_user_lock": {
        const ents = action_plan.entities as any || {};
        const user_id = ents.user_id;
        
        if (user_id) {
          await pool.query("UPDATE users SET status = 'locked' WHERE user_id = ?", [user_id]);
        }
        
        resultData = {
          success: true,
          message: `Đã khóa tài khoản user ID ${user_id} thành công.`,
        };
        break;
      }
      case "owner_view_employees":
      case "owner_manage_employees": {
        const ents = action_plan.entities as any || {};
        const employee_id = ents.employee_id;
        const action = ents.action; // "ban" | "unban" | "count"
        
        if (employee_id && (action === 'ban' || action === 'unban')) {
          const newStatus = action === 'ban' ? 'locked' : 'active';
          const setDeletedAt = action === 'ban' ? 'NOW()' : 'NULL';
          
          await pool.query(
            `UPDATE users 
             SET status = ?, deleted_at = ${setDeletedAt} 
             WHERE user_id = ? AND role = 'employee'`, 
            [newStatus, employee_id]
          );
          
          resultData = {
            success: true,
            message: action === 'ban' 
              ? `Đã khóa tài khoản nhân viên (ID: ${employee_id}) thành công.` 
              : `Đã mở khóa tài khoản nhân viên (ID: ${employee_id}) thành công.`,
          };
        } else if (!employee_id && (action === 'ban' || action === 'unban')) {
          const targetStatus = action === 'ban' ? 'active' : 'locked';
          const newStatus = action === 'ban' ? 'locked' : 'active';
          const setDeletedAt = action === 'ban' ? 'NOW()' : 'NULL';
          
          const [result] = await pool.query<any>(
            `UPDATE users u
             INNER JOIN employee_locations el ON u.user_id = el.employee_id
             SET u.status = ?, u.deleted_at = ${setDeletedAt}
             WHERE el.owner_id = ? AND u.role = 'employee' AND u.status = ?`,
            [newStatus, actor_user_id, targetStatus]
          );
          
          const affected = result?.affectedRows || 0;
          resultData = {
            success: true,
            message: action === 'ban'
              ? `Đã khóa thành công **${affected} tài khoản** nhân viên.`
              : `Đã mở khóa thành công **${affected} tài khoản** nhân viên.`,
          };
        } else {
          // Count employees
          const [rows] = await pool.query<any[]>(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) as active_count,
                    SUM(CASE WHEN u.status = 'locked' THEN 1 ELSE 0 END) as locked_count
             FROM users u
             INNER JOIN employee_locations el ON u.user_id = el.employee_id
             WHERE el.owner_id = ? AND u.role = 'employee' AND u.deleted_at IS NULL`,
            [actor_user_id]
          );
          
          const total = Number(rows[0]?.total || 0);
          const active = Number(rows[0]?.active_count || 0);
          const locked = Number(rows[0]?.locked_count || 0);
          
          resultData = {
            success: true,
            message: `Sếp hiện đang có tổng cộng **${total} nhân viên**.\nTrong đó:\n- Đang hoạt động: ${active} người\n- Đã khóa: ${locked} người`,
          };
        }
        break;
      }
      case "admin_location_review": {
        const ents = action_plan.entities as any || {};
        const location_id = ents.location_id;
        const decision = ents.decision || "approved"; // approved or rejected
        const reason = ents.reason || "";
        
        if (location_id) {
          await pool.query(
            "UPDATE locations SET status = ?, rejection_reason = ? WHERE location_id = ?", 
            [decision, reason, location_id]
          );
        }
        
        resultData = {
          success: true,
          message: `Đã ${decision} địa điểm ID ${location_id}.`,
        };
        break;
      }
      case "admin_create_system_voucher": {
        const ents = action_plan.entities as any || {};
        const code = ents.code || `SYS_DEAL${Math.floor(Math.random() * 9000 + 1000)}`;
        const discount_value = Number(ents.discount_value ?? ents.discount_amount ?? 0);
        
        if (!discount_value) {
          resultData = { success: false, message: "Thiếu thông tin số tiền giảm giá. Sếp vui lòng nhập lại!" };
          break;
        }

        const raw_type = String(ents.discount_type || 'amount').toLowerCase();
        const discount_type = raw_type === 'percent' || raw_type === 'percentage' ? 'percent' : 'amount';
        const today = new Date().toISOString().split('T')[0];
        const start_date = ents.start_date || today;
        const end_date = ents.end_date || ents.expiry_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const min_order_value = Number(ents.min_order_value ?? 0);
        const campaign_name = ents.campaign_name || ents.title || 'Voucher Hệ Thống (từ AI)';

        await pool.query(
          `INSERT INTO vouchers 
            (owner_id, location_id, code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date, status) 
           VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date]
        );

        const fmtMoney = (v: number) => v.toLocaleString('vi-VN') + ' đ';
        resultData = {
          success: true,
          message: `✅ Đã tạo voucher hệ thống **${code}** thành công!\n• Giảm: ${fmtMoney(discount_value)}\n• Hạn: ${start_date} → ${end_date}\n• Đơn tối thiểu: ${min_order_value > 0 ? fmtMoney(min_order_value) : 'Không giới hạn'}`,
        };
        break;
      }
      case "export_revenue_report": {
        const exportEntities = action_plan.entities as any || {};
        console.log("[AI Export DEBUG] entities:", JSON.stringify(exportEntities));
        resultData = {
          success: true,
          message: "Đã tạo báo cáo thành công. File đang được tải xuống máy của bạn.",
          client_action: {
            type: "event",
            event_name: "trigger_export_report",
            data: exportEntities
          }
        };
        break;
      }
      case "get_dashboard_stats": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date_param = ents.start_date as string | undefined;
        const end_date_param = ents.end_date as string | undefined;
        let msg = "Đây là số liệu doanh thu của sếp:\n";
        try {
          if (role === "owner") {
            // Trường hợp 1: Query theo nhiều tháng cụ thể (ví dụ: tháng 5 và 6)
            if (months.length > 0) {
              const yearNow = new Date().getFullYear();
              const monthPlaceholders = months.map(() => "?").join(", ");
              const [rows] = await pool.query<any[]>(
                `SELECT MONTH(payment_time) as m, COALESCE(SUM(amount), 0) as total 
                 FROM payments 
                 WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
                 AND status = 'completed'
                 AND YEAR(payment_time) = ?
                 AND MONTH(payment_time) IN (${monthPlaceholders})
                 GROUP BY MONTH(payment_time) ORDER BY m`,
                [actor_user_id, yearNow, ...months]
              );
              let grandTotal = 0;
              const vnMonths = ["", "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
              for (const row of rows) {
                const t = Number(row.total || 0);
                grandTotal += t;
                msg += `- ${vnMonths[row.m] || `Tháng ${row.m}`}: ${t.toLocaleString('vi-VN')} đ\n`;
              }
              msg += `\n=> 💰 **Tổng cộng ${months.map(m => vnMonths[m]).join(" + ")}: ${grandTotal.toLocaleString('vi-VN')} đ**`;
            }
            // Trường hợp 2: Query theo start_date/end_date cụ thể
            else if (start_date_param && end_date_param) {
              const [rows] = await pool.query<any[]>(
                `SELECT COALESCE(SUM(amount), 0) as total 
                 FROM payments 
                 WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
                 AND status = 'completed'
                 AND payment_time >= ? AND payment_time <= ?`,
                [actor_user_id, start_date_param + " 00:00:00", end_date_param + " 23:59:59"]
              );
              const total = Number(rows[0]?.total || 0);
              msg += `- Từ ${start_date_param} đến ${end_date_param}: ${total.toLocaleString('vi-VN')} đ\n`;
            }
            // Trường hợc 3: time_range (today/this_week/this_month/this_year)
            else {
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
                 WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
                 AND status = 'completed' AND ${currentCondition}`, [actor_user_id]);
              const currentTotal = Number(rowsCurrent[0]?.total || 0);

              const [rowsPrev] = await pool.query<any[]>(
                `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
                 WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
                 AND status = 'completed' AND ${prevCondition}`, [actor_user_id]);
              const prevTotal = Number(rowsPrev[0]?.total || 0);

              msg += `- Doanh thu ${currentLabel}: ${currentTotal.toLocaleString('vi-VN')} đ\n`;
              msg += `- Doanh thu ${prevLabel}: ${prevTotal.toLocaleString('vi-VN')} đ\n`;
              
              if (currentTotal === 0 && prevTotal === 0) {
                msg += `\n(Hệ thống hiện chưa ghi nhận giao dịch nào trong 2 kỳ gần đây)`;
              } else if (currentTotal >= prevTotal) {
                msg += `\n=> 📈 Tuyệt vời! Doanh thu ${currentLabel} **TĂNG** (hoặc bằng) so với ${prevLabel}. Sếp đang làm rất tốt! 🎉`;
              } else {
                msg += `\n=> 📉 Doanh thu ${currentLabel} **GIẢM**. Sếp có muốn dùng chức năng Tạo Voucher để thu hút khách không?`;
              }
            }
          } else {
            // Admin query
            const [rowsCurrent] = await pool.query<any[]>(
              `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
               WHERE status = 'completed' AND MONTH(payment_time) = MONTH(CURRENT_DATE()) AND YEAR(payment_time) = YEAR(CURRENT_DATE())`
            );
            const currentTotal = Number(rowsCurrent[0]?.total || 0);

            const [rowsPrev] = await pool.query<any[]>(
              `SELECT COALESCE(SUM(amount), 0) as total FROM payments 
               WHERE status = 'completed' AND MONTH(payment_time) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) AND YEAR(payment_time) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)`
            );
            const prevTotal = Number(rowsPrev[0]?.total || 0);

            msg = `Đây là số liệu doanh thu của TOÀN HỆ THỐNG:\n`;
            msg += `- Doanh thu tháng này: ${currentTotal.toLocaleString('vi-VN')} đ\n`;
            msg += `- Doanh thu tháng trước: ${prevTotal.toLocaleString('vi-VN')} đ\n`;
            
            if (currentTotal === 0 && prevTotal === 0) {
              msg += `\n(Hệ thống hiện chưa ghi nhận giao dịch nào trong 2 kỳ gần đây)`;
            } else if (currentTotal >= prevTotal) {
              msg += `\n=> 📈 Tuyệt vời! Doanh thu hệ thống **TĂNG** (hoặc bằng) so với tháng trước. Sếp đang làm rất tốt! 🎉`;
            } else {
              msg += `\n=> 📉 Doanh thu hệ thống **GIẢM**. Sếp có muốn xem xét tạo Voucher Hệ Thống để kích cầu không?`;
            }
          }
        } catch (e: any) {
          msg = "Đã xảy ra lỗi khi tính toán dữ liệu: " + e.message;
        }

        resultData = {
          success: true,
          message: msg,
        };
        break;
      }

      case "owner_get_order_stats": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
        let msg = await ownerGetOrderStats(actor_user_id, time_range);
        resultData = { success: true, message: msg };
        break;
      }
      
      case "owner_get_revenue_structure": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
        let msg = await ownerGetRevenueStructure(actor_user_id, time_range);
        resultData = { success: true, message: msg };
        break;
      }
      
      case "owner_get_top_services": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
        const location_name = ents.location_name;
        let msg = await ownerGetTopServices(actor_user_id, time_range, location_name);
        resultData = { success: true, message: msg };
        break;
      }

      case "owner_analyze_reviews": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        let msg = await ownerAnalyzeReviews(actor_user_id, time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }
      default:
        resultData = {
          success: true,
          message: `Hành động ${action_key} đã được ghi nhận (chưa có handler thực thi chi tiết).`,
        };
    }

    // Cập nhật status thành succeeded trong ai_action_runs
    await pool.query(
      "UPDATE ai_action_runs SET status = 'succeeded', result_data = ? WHERE command_id = ?",
      [JSON.stringify(resultData), command_id]
    );

    return resultData;
  } catch (error: any) {
    // Cập nhật status thành failed
    await pool.query(
      "UPDATE ai_action_runs SET status = 'failed', error_message = ? WHERE command_id = ?",
      [error.message || "Unknown error", command_id]
    );
    throw error;
  }
}
