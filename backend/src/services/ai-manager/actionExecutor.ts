import pool from "../../config/database";
import { ownerGetOrderStats, ownerGetRevenueStructure, ownerGetTopServices, ownerAnalyzeReviews, ownerGetCancellationStats, ownerGetTopCustomers, ownerGetBusinessRecommendations } from "./ownerAiService";
import { adminGetUserGrowth, adminGetOwnersStats, adminGetRevenueStats, adminGetTopLocations, adminViewLocations, adminViewSosAlerts, adminSendPushNotification, adminAdjustCommissionRate, adminGetCancellationStats, adminGetTopServices, adminGetTopCustomers, adminGetBusinessRecommendations } from "./adminAiService";
import { formatMonthlyRevenueComment } from "./revenueInsight";

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

  /** Chuyển YYYY-MM-DD sang DD/MM/YYYY */
  const fmt = (d: string) => {
    const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };

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
        const valid_service_types = ['room', 'food', 'ticket', 'all'];
        const apply_to_service_type = valid_service_types.includes(ents.apply_to_service_type) ? ents.apply_to_service_type : 'all';
        const valid_location_types = ['hotel', 'restaurant', 'tourist', 'cafe', 'resort', 'all'];
        const apply_to_location_type = valid_location_types.includes(ents.apply_to_location_type) ? ents.apply_to_location_type : 'all';
        const max_discount_amount = Number(ents.max_discount_amount ?? 0) || null;
        const usage_limit = ents.usage_limit !== undefined ? Number(ents.usage_limit) : 100;
        const valid_target_groups = ['all', 'loyal'];
        const target_group = valid_target_groups.includes(ents.target_group) ? ents.target_group : 'all';
        const max_uses_per_user = ents.max_uses_per_user !== undefined ? Number(ents.max_uses_per_user) : 1;
        const quantity = ents.quantity !== undefined ? Number(ents.quantity) : 1;

        const target_location_name = ents.target_location_name ? String(ents.target_location_name) : null;
        let targetLocationIds: number[] = [];
        if (target_location_name) {
            const likeName = `%${target_location_name}%`;
            const [locs] = await pool.query<any[]>("SELECT location_id FROM locations WHERE owner_id = ? AND location_name LIKE ?", [actor_user_id, likeName]);
            if (locs.length > 0) {
                targetLocationIds = locs.map(r => r.location_id);
            } else {
                resultData = { success: false, message: `Không tìm thấy địa điểm nào tên "${target_location_name}" của sếp.` };
                break;
            }
        }

        const generatedCodes: string[] = [];
        for (let i = 0; i < quantity; i++) {
          let currentCode = quantity > 1 ? `${code}_${i+1}` : code;
          const currentName = quantity > 1 ? `${campaign_name} ${i+1}` : campaign_name;
          
          let attempt = 0;
          let success = false;
          while (!success && attempt < 3) {
            try {
              const [res] = await pool.query<any>(
                `INSERT INTO vouchers
                  (owner_id, code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date, status, apply_to_service_type, apply_to_location_type, max_discount_amount, usage_limit, max_uses_per_user, target_group)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
                [actor_user_id, currentCode, currentName, discount_type, discount_value, min_order_value, start_date, end_date, apply_to_service_type, apply_to_location_type, max_discount_amount, usage_limit, max_uses_per_user, target_group]
              );
              const insertId = res.insertId;
              
              if (targetLocationIds.length > 0) {
                  const valuesSql = targetLocationIds.map(() => "(?, ?)").join(", ");
                  const flatParams = targetLocationIds.flatMap((id) => [insertId, id]);
                  await pool.query(`INSERT INTO voucher_locations (voucher_id, location_id) VALUES ${valuesSql}`, flatParams);
              }

              generatedCodes.push(currentCode);
              success = true;
            } catch (err: any) {
              if (err.code === 'ER_DUP_ENTRY') {
                attempt++;
                currentCode = `${code}_${Math.floor(Math.random() * 90000 + 10000)}`;
              } else {
                throw err;
              }
            }
          }
          if (!success) {
            resultData = { success: false, message: `❌ Mã voucher ${currentCode} đã trùng lặp quá nhiều lần. Vui lòng thử lại.` };
            break;
          }
        }

        const fmtMoney = (v: number) => v.toLocaleString('vi-VN') + ' đ';
        const fmt = (d: string) => d.match(/^(\d{4})-(\d{2})-(\d{2})/) ? `${d.substr(8,2)}/${d.substr(5,2)}/${d.substr(0,4)}` : d;
        resultData = {
          success: true,
          message: `✅ Đã tạo ${quantity > 1 ? `**${quantity}** mã` : 'mã'} voucher thành công!\n• Mã: ${generatedCodes.join(', ')}\n• Giảm: ${fmtMoney(discount_value)}\n• Hạn: ${fmt(start_date)} → ${fmt(end_date)}\n• Đơn tối thiểu: ${min_order_value > 0 ? fmtMoney(min_order_value) : 'Không giới hạn'}\n• Lượt dùng / mã: ${usage_limit} (Tối đa ${max_uses_per_user} lần/user)`,
        };
        break;
      }
      case "admin_create_system_voucher": {
        const ents = action_plan.entities as any || {};
        const code = ents.code || `SYSDEAL${Math.floor(Math.random() * 9000 + 1000)}`;
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
        const campaign_name = ents.campaign_name || ents.title || 'Voucher Toàn Hệ Thống';
        const valid_service_types = ['room', 'food', 'ticket', 'all'];
        const apply_to_service_type = valid_service_types.includes(ents.apply_to_service_type) ? ents.apply_to_service_type : 'all';
        const valid_location_types = ['hotel', 'restaurant', 'tourist', 'cafe', 'resort', 'all'];
        const apply_to_location_type = valid_location_types.includes(ents.apply_to_location_type) ? ents.apply_to_location_type : 'all';
        const max_discount_amount = Number(ents.max_discount_amount ?? 0) || null;
        const usage_limit = ents.usage_limit !== undefined ? Number(ents.usage_limit) : 100;
        const valid_target_groups = ['all', 'loyal'];
        const target_group = valid_target_groups.includes(ents.target_group) ? ents.target_group : 'all';
        const max_uses_per_user = ents.max_uses_per_user !== undefined ? Number(ents.max_uses_per_user) : 1;
        const quantity = ents.quantity !== undefined ? Number(ents.quantity) : 1;

        const target_id = ents.target_id ? Number(ents.target_id) : null;
        const target_location_name = ents.target_location_name ? String(ents.target_location_name) : null;
        let targetLocationIds: number[] = [];
        
        if (target_id) {
            const [locs] = await pool.query<any[]>("SELECT location_id FROM locations WHERE owner_id = ?", [target_id]);
            if (locs.length > 0) {
                targetLocationIds = locs.map(r => r.location_id);
            } else {
                const [locs2] = await pool.query<any[]>("SELECT location_id FROM locations WHERE location_id = ?", [target_id]);
                if (locs2.length > 0) {
                    targetLocationIds = locs2.map(r => r.location_id);
                } else {
                    resultData = { success: false, message: `Không tìm thấy owner hoặc địa điểm nào có ID là ${target_id}.` };
                    break;
                }
            }
        } else if (target_location_name) {
            const likeName = `%${target_location_name}%`;
            const [locs] = await pool.query<any[]>("SELECT location_id FROM locations WHERE location_name LIKE ?", [likeName]);
            if (locs.length > 0) {
                targetLocationIds = locs.map(r => r.location_id);
            } else {
                const [locs2] = await pool.query<any[]>("SELECT l.location_id FROM locations l JOIN users u ON l.owner_id = u.user_id WHERE u.full_name LIKE ? AND u.role = 'owner'", [likeName]);
                if (locs2.length > 0) {
                    targetLocationIds = locs2.map(r => r.location_id);
                } else {
                    resultData = { success: false, message: `Không tìm thấy địa điểm hoặc owner nào tên "${target_location_name}".` };
                    break;
                }
            }
        }

        const generatedCodes: string[] = [];
        for (let i = 0; i < quantity; i++) {
          let currentCode = quantity > 1 ? `${code}_${i+1}` : code;
          const currentName = quantity > 1 ? `${campaign_name} ${i+1}` : campaign_name;
          
          let attempt = 0;
          let success = false;
          while (!success && attempt < 3) {
            try {
              const [res] = await pool.query<any>(
                `INSERT INTO vouchers 
                  (owner_id, code, campaign_name, discount_type, discount_value, min_order_value, start_date, end_date, status, apply_to_service_type, apply_to_location_type, max_discount_amount, usage_limit, max_uses_per_user, target_group) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
                [actor_user_id, currentCode, currentName, discount_type, discount_value, min_order_value, start_date, end_date, apply_to_service_type, apply_to_location_type, max_discount_amount, usage_limit, max_uses_per_user, target_group]
              );
              const insertId = res.insertId;
              
              if (targetLocationIds.length > 0) {
                  const valuesSql = targetLocationIds.map(() => "(?, ?)").join(", ");
                  const flatParams = targetLocationIds.flatMap((id) => [insertId, id]);
                  await pool.query(`INSERT INTO voucher_locations (voucher_id, location_id) VALUES ${valuesSql}`, flatParams);
              }

              generatedCodes.push(currentCode);
              success = true;
            } catch (err: any) {
              if (err.code === 'ER_DUP_ENTRY') {
                attempt++;
                currentCode = `${code}_${Math.floor(Math.random() * 90000 + 10000)}`;
              } else {
                throw err;
              }
            }
          }
          if (!success) {
            resultData = { success: false, message: `❌ Mã voucher ${currentCode} đã trùng lặp quá nhiều lần. Vui lòng thử lại.` };
            break;
          }
        }

        if (!resultData.hasOwnProperty('success')) {
          const fmtMoney = (v: number) => v.toLocaleString('vi-VN') + ' đ';
          resultData = {
            success: true,
            message: `✅ Đã tạo ${quantity > 1 ? `**${quantity}** mã` : 'mã'} voucher hệ thống thành công!\n• Mã: ${generatedCodes.join(', ')}\n• Giảm: ${fmtMoney(discount_value)}\n• Hạn: ${fmt(start_date)} → ${fmt(end_date)}\n• Đơn tối thiểu: ${min_order_value > 0 ? fmtMoney(min_order_value) : 'Không giới hạn'}\n• Lượt dùng / mã: ${usage_limit} (Tối đa ${max_uses_per_user} lần/user)`,
          };
        }
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
        const target_role = ents.target_role;
        const action = ents.action || "lock";
        const statusValue = action === "unlock" ? "active" : "locked";
        const actionLabel = action === "unlock" ? "mở khóa" : "khóa";
        
        if (user_id) {
          await pool.query("UPDATE users SET status = ? WHERE user_id = ?", [statusValue, user_id]);
          resultData = {
            success: true,
            message: `Đã ${actionLabel} tài khoản user ID ${user_id} thành công.`,
          };
        } else if (target_role) {
          let condition = "role IN ('user', 'owner')";
          let roleLabel = "User và Owner";
          if (target_role === "user") {
            condition = "role = 'user'";
            roleLabel = "tất cả User";
          } else if (target_role === "owner") {
            condition = "role = 'owner'";
            roleLabel = "tất cả Owner";
          }
          const [res] = await pool.query<any>(`UPDATE users SET status = ? WHERE ${condition}`, [statusValue]);
          resultData = {
            success: true,
            message: `Đã ${actionLabel} thành công ${res.affectedRows || 0} tài khoản ${roleLabel} trên hệ thống.`,
          };
        } else {
          resultData = {
            success: false,
            message: `Thiếu thông tin đối tượng cần ${actionLabel}.`,
          };
        }
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
      case "owner_manage_booking": {
        const ents = action_plan.entities as any || {};
        const booking_id = ents.booking_id;
        const action = ents.action;
        
        if (!booking_id) {
          resultData = { success: false, message: "Thiếu ID đơn hàng để xử lý." };
          break;
        }
        
        let newStatus = 'pending';
        let actionLabel = '';
        if (action === 'approve') { newStatus = 'confirmed'; actionLabel = 'xác nhận'; }
        else if (action === 'cancel') { newStatus = 'cancelled'; actionLabel = 'hủy'; }
        else if (action === 'complete') { newStatus = 'completed'; actionLabel = 'hoàn thành'; }
        
        await pool.query(
          "UPDATE bookings SET status = ? WHERE booking_id = ?",
          [newStatus, booking_id]
        );
        
        resultData = {
          success: true,
          message: `Đã ${actionLabel} đơn hàng #${booking_id} thành công.`
        };
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
          message: `✅ Đã tạo voucher hệ thống **${code}** thành công!\n• Giảm: ${fmtMoney(discount_value)}\n• Hạn: ${fmt(start_date)} → ${fmt(end_date)}\n• Đơn tối thiểu: ${min_order_value > 0 ? fmtMoney(min_order_value) : 'Không giới hạn'}`,
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
              msg += `\n\n${formatMonthlyRevenueComment(
                months,
                rows.map((row) => ({ month: Number(row.m), total: Number(row.total || 0) }))
              )}`;
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
              msg += `- Từ ${fmt(start_date_param)} đến ${fmt(end_date_param)}: ${total.toLocaleString('vi-VN')} đ\n`;
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
            msg = await adminGetRevenueStats(time_range, months, start_date_param, end_date_param);
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

      case "admin_view_users":
      case "admin_get_user_growth": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date_param = ents.start_date as string | undefined;
        const end_date_param = ents.end_date as string | undefined;
        let msg = await adminGetUserGrowth(time_range, months, start_date_param, end_date_param);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_owners": {
        const ents = action_plan.entities as any || {};
        const limit = Number(ents.limit) || 5;
        let msg = await adminGetOwnersStats(limit);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_top_locations": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "all";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        const limit = Number(ents.limit) || 3;
        let msg = await adminGetTopLocations(time_range, months, start_date, end_date, limit);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_cancellation_stats": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        let msg = await adminGetCancellationStats(time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_top_services": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        const limit = Number(ents.limit) || 5;
        let msg = await adminGetTopServices(time_range, months, start_date, end_date, limit);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_top_customers": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        const limit = Number(ents.limit) || 5;
        let msg = await adminGetTopCustomers(time_range, months, start_date, end_date, limit);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_get_business_recommendations": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        let msg = await adminGetBusinessRecommendations(time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_view_locations": {
        let msg = await adminViewLocations();
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_view_sos_alerts": {
        let msg = await adminViewSosAlerts();
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_send_push_notification": {
        const ents = action_plan.entities as any || {};
        const title = ents.title || "Thông báo từ hệ thống";
        const message = ents.message || "";
        let msg = await adminSendPushNotification(actor_user_id, title, message);
        resultData = { success: true, message: msg };
        break;
      }

      case "admin_adjust_commission_rate": {
        const ents = action_plan.entities as any || {};
        const commission_rate = Number(ents.commission_rate || 0);
        const location_id = ents.location_id ? Number(ents.location_id) : undefined;
        const owner_id = ents.owner_id ? Number(ents.owner_id) : undefined;
        let msg = await adminAdjustCommissionRate(commission_rate, location_id, owner_id);
        resultData = { success: true, message: msg };
        break;
      }

      case "owner_get_order_stats": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
          const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
          const start_date = ents.start_date;
          const end_date = ents.end_date;
          let msg = await ownerGetOrderStats(actor_user_id, time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }

      case "owner_get_cancellation_stats": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        let msg = await ownerGetCancellationStats(actor_user_id, time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }
      
      case "owner_get_revenue_structure": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
          const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
          const start_date = ents.start_date;
          const end_date = ents.end_date;
          let msg = await ownerGetRevenueStructure(actor_user_id, time_range, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }
      
      case "owner_get_top_services": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "today";
          const location_name = ents.location_name;
          const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
          const start_date = ents.start_date;
          const end_date = ents.end_date;
          let msg = await ownerGetTopServices(actor_user_id, time_range, location_name, months, start_date, end_date);
        resultData = { success: true, message: msg };
        break;
      }

      case "owner_get_top_customers": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        const limit = Number(ents.limit) || 5;
        let msg = await ownerGetTopCustomers(actor_user_id, time_range, months, start_date, end_date, limit);
        resultData = { success: true, message: msg };
        break;
      }

      case "owner_get_business_recommendations": {
        const ents = action_plan.entities as any || {};
        const time_range = ents.time_range || "this_month";
        const months: number[] = Array.isArray(ents.months) ? ents.months.map(Number) : [];
        const start_date = ents.start_date as string | undefined;
        const end_date = ents.end_date as string | undefined;
        let msg = await ownerGetBusinessRecommendations(actor_user_id, time_range, months, start_date, end_date);
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
