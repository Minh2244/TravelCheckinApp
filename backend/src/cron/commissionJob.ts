import cron from "node-cron";
import { pool } from "../config/database";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const startCommissionCron = () => {
  // Run at 00:00 on the 15th of every month
  cron.schedule("0 0 15 * *", async () => {
    console.log("[CRON] Bắt đầu tự động chốt hoa hồng định kỳ ngày 15...");
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Determine the billing period: 15th of last month to 14th of this month
      const now = new Date();
      const thisMonth = now.getMonth() + 1;
      const thisYear = now.getFullYear();
      
      let lastMonth = thisMonth - 1;
      let lastMonthYear = thisYear;
      if (lastMonth === 0) {
        lastMonth = 12;
        lastMonthYear = thisYear - 1;
      }
      
      const startDateStr = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-15 00:00:00`;
      const endDateStr = `${thisYear}-${String(thisMonth).padStart(2, "0")}-14 23:59:59`;
      
      const billingPeriod = `15/${String(lastMonth).padStart(2, "0")} - 14/${String(thisMonth).padStart(2, "0")}/${thisYear}`;

      // Due date is the 18th of this month
      const dueDateStr = `${thisYear}-${String(thisMonth).padStart(2, "0")}-18`;

      // Find all payments that need to be reconciled
      // Conditions:
      // - payment_time between startDateStr and endDateStr
      // - status = 'completed'
      // - commission_id IS NULL (not yet billed)
      // - transaction_source = 'onsite_pos' (or online_booking but paid to owner)
      // We assume all payments where owner owes admin (they received cash/transfer)
      // Currently, system creates commissions when owner gets paid directly.
      const [payments] = await conn.query<RowDataPacket[]>(
        `SELECT p.payment_id, p.amount, p.commission_amount, p.vat_amount, l.owner_id
         FROM payments p
         JOIN locations l ON l.location_id = p.location_id
         WHERE p.status = 'completed'
           AND p.commission_id IS NULL
           AND p.payment_time >= ?
           AND p.payment_time <= ?`,
        [startDateStr, endDateStr]
      );

      if (payments.length === 0) {
        console.log("[CRON] Không có khoản thanh toán nào cần chốt trong kỳ", billingPeriod);
        await conn.commit();
        return;
      }

      // Group by owner
      const ownerSums: Record<number, { commission: number; vat: number; paymentIds: number[] }> = {};
      for (const p of payments) {
        const oId = Number(p.owner_id);
        if (!ownerSums[oId]) {
          ownerSums[oId] = { commission: 0, vat: 0, paymentIds: [] };
        }
        ownerSums[oId].commission += Number(p.commission_amount || 0);
        ownerSums[oId].vat += Number(p.vat_amount || 0);
        ownerSums[oId].paymentIds.push(Number(p.payment_id));
      }

      // Insert commission records
      for (const ownerIdStr in ownerSums) {
        const ownerId = Number(ownerIdStr);
        const data = ownerSums[ownerId];
        if (data.commission <= 0 && data.vat <= 0) continue;

        const totalDue = +(data.commission + data.vat).toFixed(2);

        const [insertRes] = await conn.query<ResultSetHeader>(
          `INSERT INTO commissions (owner_id, payment_id, commission_amount, vat_amount, total_due, due_date, status, billing_period)
           VALUES (?, NULL, ?, ?, ?, ?, 'pending', ?)`,
          [ownerId, data.commission, data.vat, totalDue, dueDateStr, billingPeriod]
        );
        const newCommissionId = insertRes.insertId;

        // Update payments to link to this commission
        if (data.paymentIds.length > 0) {
          await conn.query(
            `UPDATE payments SET commission_id = ? WHERE payment_id IN (?)`,
            [newCommissionId, data.paymentIds]
          );
        }
        
        await conn.query(
          `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
          [
            1, // system admin
            "CRON_AUTO_COMMISSION",
            JSON.stringify({
              owner_id: ownerId,
              commission_id: newCommissionId,
              total_due: totalDue,
              billing_period: billingPeriod,
              payment_count: data.paymentIds.length,
              timestamp: new Date(),
            }),
          ]
        );
      }

      await conn.commit();
      console.log(`[CRON] Đã chốt xong kỳ hoa hồng ${billingPeriod} cho ${Object.keys(ownerSums).length} owners.`);

    } catch (error) {
      await conn.rollback();
      console.error("[CRON] Lỗi khi chạy tự động chốt hoa hồng:", error);
    } finally {
      conn.release();
    }
  });
};
