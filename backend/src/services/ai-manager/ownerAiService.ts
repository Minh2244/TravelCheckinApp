import pool from "../../config/database";

export function getTimeCondition(timeRange: string, dateColumn: string): string {
    switch (timeRange) {
        case "today":
            return `DATE(${dateColumn}) = CURRENT_DATE()`;
        case "this_week":
            return `YEARWEEK(${dateColumn}, 1) = YEARWEEK(CURRENT_DATE(), 1)`;
        case "this_month":
            return `MONTH(${dateColumn}) = MONTH(CURRENT_DATE()) AND YEAR(${dateColumn}) = YEAR(CURRENT_DATE())`;
        case "this_year":
            return `YEAR(${dateColumn}) = YEAR(CURRENT_DATE())`;
        default:
            return "1=1";
    }
}

export async function ownerGetOrderStats(actor_user_id: number, time_range: string) {
    const posTimeCond = getTimeCondition(time_range, "created_at");
    const [posRows] = await pool.query<any[]>(`
        SELECT 
            SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM pos_orders 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${posTimeCond}
    `, [actor_user_id]);

    const bookingTimeCond = getTimeCondition(time_range, "created_at");
    const [bookingRows] = await pool.query<any[]>(`
        SELECT 
            SUM(CASE WHEN status IN ('inhouse', 'checked_out') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM hotel_stays 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${bookingTimeCond}
    `, [actor_user_id]);

    const posComp = Number(posRows[0]?.completed_orders || 0);
    const posCanc = Number(posRows[0]?.cancelled_orders || 0);
    const bookComp = Number(bookingRows[0]?.completed_orders || 0);
    const bookCanc = Number(bookingRows[0]?.cancelled_orders || 0);

    const totalComp = posComp + bookComp;
    const totalCanc = posCanc + bookCanc;
    
    let msg = `📊 **Báo cáo Đơn hàng (${time_range})**\n\n`;
    msg += `✅ **Đơn hoàn thành:** ${totalComp} đơn\n`;
    msg += `   - Tại quầy: ${posComp} đơn\n`;
    msg += `   - Đặt trước (Online): ${bookComp} đơn\n\n`;
    
    msg += `❌ **Đơn bị hủy:** ${totalCanc} đơn\n`;
    msg += `   - Tại quầy: ${posCanc} đơn\n`;
    msg += `   - Đặt trước (Online): ${bookCanc} đơn\n`;

    return msg;
}

export async function ownerGetRevenueStructure(actor_user_id: number, time_range: string) {
    const timeCond = getTimeCondition(time_range, "payment_time");
    const [rows] = await pool.query<any[]>(`
        SELECT l.location_type, COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN locations l ON p.location_id = l.location_id
        WHERE l.owner_id = ? AND p.status = 'completed' AND ${timeCond}
        GROUP BY l.location_type
    `, [actor_user_id]);

    let msg = `💰 **Cơ cấu Doanh thu theo Mảng kinh doanh (${time_range})**\n\n`;
    let grandTotal = 0;
    for (const row of rows) {
        grandTotal += Number(row.total);
    }
    if (grandTotal === 0) return msg + "Không có doanh thu nào trong khoảng thời gian này.";
    
    const typeMapping: Record<string, string> = {
        'hotel': 'Khách sạn',
        'restaurant': 'Ăn uống (Nhà hàng)',
        'tourist': 'Du lịch (Tham quan)',
        'cafe': 'Ăn uống (Cafe)',
        'resort': 'Nghỉ dưỡng (Resort)',
        'other': 'Khác'
    };

    for (const row of rows) {
        const amt = Number(row.total);
        if (amt === 0) continue;
        const percent = ((amt / grandTotal) * 100).toFixed(1);
        const name = typeMapping[row.location_type] || row.location_type;
        msg += `- **${name}**: ${amt.toLocaleString('vi-VN')} đ (${percent}%)\n`;
    }
    msg += `\n**Tổng cộng:** ${grandTotal.toLocaleString('vi-VN')} đ`;
    return msg;
}

export async function ownerGetTopServices(actor_user_id: number, time_range: string, location_name?: string) {
    let msg = `🏆 **Top Dịch vụ Bán chạy (${time_range})**\n\n`;
    
    let locationCond = "";
    const params: any[] = [actor_user_id];
    
    if (location_name) {
        locationCond = "AND l.location_name LIKE ?";
        params.push(`%${location_name}%`);
        msg += `*(Tại địa điểm: ${location_name})*\n\n`;
    }

    const timeCond = getTimeCondition(time_range, "oi.created_at");
    
    // pos_order_items (Dịch vụ ăn uống, vé, cafe)
    const [rows] = await pool.query<any[]>(`
        SELECT s.service_name, SUM(oi.quantity) as total_sold, SUM(oi.line_total) as total_revenue
        FROM pos_order_items oi
        JOIN pos_orders o ON oi.order_id = o.order_id
        JOIN services s ON oi.service_id = s.service_id
        JOIN locations l ON o.location_id = l.location_id
        WHERE l.owner_id = ? ${locationCond} AND o.status IN ('paid', 'completed') AND ${timeCond}
        GROUP BY s.service_id, s.service_name
        ORDER BY total_sold DESC
        LIMIT 5
    `, params);

    if (rows.length === 0) {
        return msg + "Không có dịch vụ nào được bán ra trong thời gian này.";
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        msg += `${i + 1}. **${row.service_name}** - Bán được: ${row.total_sold} - Doanh thu: ${Number(row.total_revenue).toLocaleString('vi-VN')} đ\n`;
    }
    
    return msg;
}

export async function ownerAnalyzeReviews(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    let timeCond = getTimeCondition(time_range, "created_at");
    let label = `(${time_range})`;
    let params: any[] = [actor_user_id];
    
    if (months.length > 0) {
        const yearNow = new Date().getFullYear();
        const monthPlaceholders = months.map(() => "?").join(", ");
        timeCond = `YEAR(created_at) = ? AND MONTH(created_at) IN (${monthPlaceholders})`;
        params = [actor_user_id, yearNow, ...months];
        label = `(Tháng ${months.join(", ")})`;
    } else if (start_date && end_date) {
        timeCond = `created_at >= ? AND created_at <= ?`;
        params = [actor_user_id, start_date + " 00:00:00", end_date + " 23:59:59"];
        label = `(Từ ${start_date} đến ${end_date})`;
    }

    const [rows] = await pool.query<any[]>(`
        SELECT COUNT(*) as total_reviews, 
               AVG(rating) as avg_rating,
               SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as bad_reviews
        FROM reviews 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${timeCond}
    `, params);

    const total = Number(rows[0]?.total_reviews || 0);
    const avg = Number(rows[0]?.avg_rating || 0).toFixed(1);
    const bad = Number(rows[0]?.bad_reviews || 0);

    let msg = `⭐ **Phân tích Đánh giá Khách hàng ${label}**\n\n`;
    if (total === 0) {
        return msg + "Chưa có đánh giá nào trong khoảng thời gian này.";
    }

    msg += `- **Tổng số bài đánh giá:** ${total}\n`;
    msg += `- **Số sao trung bình:** ${avg} ⭐\n`;
    if (bad > 0) {
        msg += `- **Đánh giá tiêu cực (1-2 sao):** ${bad} bài ⚠️\n\n`;
    } else {
        msg += `- **Đánh giá tiêu cực (1-2 sao):** Không có (Rất tốt!) 🎉\n\n`;
    }
    
    if (Number(avg) >= 4.5) {
        msg += "Tuyệt vời! Khách hàng đang rất hài lòng với dịch vụ của sếp. Hãy tiếp tục phát huy nhé! 🥳";
    } else if (Number(avg) >= 3.5) {
        msg += "Mức độ hài lòng khá ổn định, nhưng vẫn còn không gian để cải thiện chất lượng dịch vụ tốt hơn.";
    } else {
        msg += "⚠️ Cảnh báo: Số sao trung bình đang thấp. Sếp cần xem chi tiết các đánh giá 1-2 sao để khắc phục ngay vấn đề nhé!";
    }

    return msg;
}
