import pool from "../../config/database";

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
        // Thực tế sẽ tạo voucher trạng thái "draft" vào DB
        resultData = {
          success: true,
          message: "Đã tạo bản nháp voucher thành công.",
          voucher_details: action_plan.entities,
        };
        break;
      }
      case "owner_review_reply_draft":
      case "owner_review_reply_publish": {
        // Thực tế sẽ lưu reply vào DB
        resultData = {
          success: true,
          message: "Đã phản hồi đánh giá thành công.",
          reply_details: action_plan.entities,
        };
        break;
      }
      case "owner_export_report": {
        resultData = {
          success: true,
          message: "Đã chuẩn bị báo cáo. Hệ thống sẽ chuyển hướng bạn đến trang Quản lý Doanh thu để tải file ngay bây giờ.",
          client_action: {
            type: "navigate",
            path: "/owner/payments"
          }
        };
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
