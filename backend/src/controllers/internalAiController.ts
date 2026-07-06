import type { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket } from "mysql2/promise";

export const getDashboardStatsForAi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, userId } = req.body;

    if (!role || !userId) {
      res.status(400).json({ success: false, message: "Missing role or userId" });
      return;
    }

    if (role === "admin") {
      const [locRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM locations WHERE status = 'active'");
      const activeLocations = locRows[0]?.count || 0;

      const [userRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM users WHERE role = 'user' AND deleted_at IS NULL");
      const totalUsers = userRows[0]?.count || 0;

      const [reviewRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM reviews WHERE status = 'active'");
      const totalReviews = reviewRows[0]?.count || 0;

      const [revRows] = await pool.query<RowDataPacket[]>("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'");
      const totalRevenue = revRows[0]?.total || 0;

      res.json({
        success: true,
        data: {
          activeLocations,
          totalUsers,
          totalReviews,
          totalRevenue
        },
        context_string: `Hệ thống (Admin) hiện có ${activeLocations} địa điểm hoạt động, ${totalUsers} người dùng. Tổng số bài đánh giá là ${totalReviews}. Tổng doanh thu toàn hệ thống là ${Number(totalRevenue).toLocaleString('vi-VN')} VNĐ.`
      });
      return;
    } 
    
    if (role === "owner" || role === "employee") {
      const [locRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM locations WHERE owner_id = ? AND status = 'active'", [userId]);
      const activeLocations = locRows[0]?.count || 0;

      const [revRows] = await pool.query<RowDataPacket[]>(`
        SELECT COALESCE(SUM(p.amount), 0) as total 
        FROM payments p
        JOIN locations l ON l.location_id = p.location_id
        WHERE l.owner_id = ? AND p.status = 'completed'
      `, [userId]);
      const totalRevenue = revRows[0]?.total || 0;

      res.json({
        success: true,
        data: {
          activeLocations,
          totalRevenue
        },
        context_string: `Bạn đang quản lý ${activeLocations} địa điểm. Tổng doanh thu các chi nhánh của bạn là ${Number(totalRevenue).toLocaleString('vi-VN')} VNĐ.`
      });
      return;
    }

    res.status(403).json({ success: false, message: "Invalid role" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
