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


export function timeRangeLabel(timeRange: string): string {
    const map: Record<string, string> = {
        'today': 'Hôm nay',
        'this_week': 'Tuần này',
        'this_month': 'Tháng này',
        'this_year': 'Năm nay',
        'all': 'Từ trước đến nay'
    };
    return map[timeRange] || timeRange;
}

/** Chuyển YYYY-MM-DD sang DD/MM/YYYY */
export function formatDateVi(dateStr: string): string {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return dateStr;
}

export function periodFilter(dateColumn: string, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    let condition = "1=1";
    let params: any[] = [];
    let label = `(${timeRangeLabel(time_range)})`;
    
    if (time_range === "all" || time_range === "toàn bộ" || time_range === "từ trước đến nay" || time_range === "từ đó đến nay") {
        condition = "1=1";
        params = [];
        label = "(Từ trước đến nay)";
    } else if (months && months.length > 0) {
        const yearNow = new Date().getFullYear();
        const placeholders = months.map(() => "?").join(", ");
        condition = `YEAR(${dateColumn}) = ? AND MONTH(${dateColumn}) IN (${placeholders})`;
        params = [yearNow, ...months];
        label = `(Tháng ${months.join(", ")}/${yearNow})`;
    } else if (start_date && end_date) {
        condition = `${dateColumn} >= ? AND ${dateColumn} <= ?`;
        params = [start_date + " 00:00:00", end_date + " 23:59:59"];
        label = `(Từ ${formatDateVi(start_date)} đến ${formatDateVi(end_date)})`;
    } else {
        condition = getTimeCondition(time_range, dateColumn);
    }
    
    return { condition, params, label };
}

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

export async function ownerGetOrderStats(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("created_at", time_range, months, start_date, end_date);
    const posTimeCond = period.condition;
    const extraParams = period.params;
    const [posRows] = await pool.query<any[]>(`
        SELECT 
            SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM pos_orders 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${posTimeCond}
    `, [actor_user_id, ...extraParams]);

    const bookingTimeCond = period.condition;
    const [bookingRows] = await pool.query<any[]>(`
        SELECT 
            SUM(CASE WHEN status IN ('inhouse', 'checked_out') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM hotel_stays 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${bookingTimeCond}
    `, [actor_user_id, ...extraParams]);

    const posComp = Number(posRows[0]?.completed_orders || 0);
    const posCanc = Number(posRows[0]?.cancelled_orders || 0);
    const bookComp = Number(bookingRows[0]?.completed_orders || 0);
    const bookCanc = Number(bookingRows[0]?.cancelled_orders || 0);

    const totalComp = posComp + bookComp;
    const totalCanc = posCanc + bookCanc;
    
    let msg = `📊 **Báo cáo Đơn hàng ${period.label}**\n\n`;
    msg += `✅ **Đơn hoàn thành:** ${totalComp} đơn\n`;
    msg += `   - Tại quầy: ${posComp} đơn\n`;
    msg += `   - Đặt trước (Online): ${bookComp} đơn\n\n`;
    
    msg += `❌ **Đơn bị hủy:** ${totalCanc} đơn\n`;
    msg += `   - Tại quầy: ${posCanc} đơn\n`;
    msg += `   - Đặt trước (Online): ${bookCanc} đơn\n`;

    return msg;
}

export async function ownerGetCancellationStats(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("created_at", time_range, months, start_date, end_date);
    const [posRows] = await pool.query<any[]>(`
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM pos_orders 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${period.condition}
    `, [actor_user_id, ...period.params]);

    const [bookingRows] = await pool.query<any[]>(`
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM hotel_stays 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${period.condition}
    `, [actor_user_id, ...period.params]);

    const posTotal = Number(posRows[0]?.total_orders || 0);
    const posCancelled = Number(posRows[0]?.cancelled_orders || 0);
    const bookingTotal = Number(bookingRows[0]?.total_orders || 0);
    const bookingCancelled = Number(bookingRows[0]?.cancelled_orders || 0);
    const totalOrders = posTotal + bookingTotal;
    const totalCancelled = posCancelled + bookingCancelled;
    const rate = totalOrders > 0 ? ((totalCancelled / totalOrders) * 100).toFixed(1) : "0.0";

    let msg = `📉 **Tỷ lệ hủy đơn ${period.label}**\n\n`;
    if (totalOrders === 0) {
        return msg + "Chưa có đơn nào trong khoảng thời gian này.";
    }
    msg += `- **Tổng đơn:** ${totalOrders} đơn\n`;
    msg += `- **Đơn hủy:** ${totalCancelled} đơn\n`;
    msg += `- **Tỷ lệ hủy:** ${rate}%\n\n`;
    msg += `Chi tiết:\n`;
    msg += `- POS/tại quầy: ${posCancelled}/${posTotal} đơn hủy\n`;
    msg += `- Booking/lưu trú: ${bookingCancelled}/${bookingTotal} đơn hủy`;
    return msg;
}

export async function ownerGetRevenueStructure(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const timeCond = period.condition;
    const extraParams = period.params;
    const [rows] = await pool.query<any[]>(`
        SELECT l.location_type, COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN locations l ON p.location_id = l.location_id
        WHERE l.owner_id = ? AND p.status = 'completed' AND ${timeCond}
        GROUP BY l.location_type
    `, [actor_user_id, ...extraParams]);

    let msg = `💰 **Cơ cấu Doanh thu theo Mảng kinh doanh ${period.label}**\n\n`;
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

export async function ownerGetTopServices(actor_user_id: number, time_range: string, location_name?: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("oi.created_at", time_range, months, start_date, end_date);
    const timeCond = period.condition;
    const extraParams = period.params;
    let msg = `🏆 **Top Dịch vụ Bán chạy ${period.label}**\n\n`;
    
    let locationCond = "";
    const params: any[] = [actor_user_id];
    
    if (location_name) {
        locationCond = "AND l.location_name LIKE ?";
        params.push(`%${location_name}%`);
        msg += `*(Tại địa điểm: ${location_name})*\n\n`;
    }

    
    
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
    `, [...params, ...extraParams]);

    if (rows.length === 0) {
        return msg + "Không có dịch vụ nào được bán ra trong thời gian này.";
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        msg += `${i + 1}. **${row.service_name}** - Bán được: ${row.total_sold} - Doanh thu: ${Number(row.total_revenue).toLocaleString('vi-VN')} đ\n`;
    }
    
    return msg;
}

export async function ownerGetTopCustomers(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string, limit: number = 5) {
    const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const [rows] = await pool.query<any[]>(`
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            COUNT(p.payment_id) as total_payments,
            COALESCE(SUM(p.amount), 0) as total_spent
        FROM payments p
        JOIN users u ON p.user_id = u.user_id
        JOIN locations l ON p.location_id = l.location_id
        WHERE l.owner_id = ?
          AND p.status = 'completed'
          AND p.user_id IS NOT NULL
          AND ${period.condition}
        GROUP BY u.user_id, u.full_name, u.email
        ORDER BY total_spent DESC
        LIMIT ?
    `, [actor_user_id, ...period.params, safeLimit]);

    let msg = `🏅 **Top ${safeLimit} khách hàng chi tiêu cao nhất ${period.label}**\n\n`;
    if (rows.length === 0) {
        return msg + "Chưa có dữ liệu chi tiêu của khách hàng trong khoảng thời gian này.";
    }
    rows.forEach((row, index) => {
        const name = row.full_name || "Khách hàng";
        const email = row.email ? ` (${row.email})` : "";
        msg += `${index + 1}. **${name}**${email}\n`;
        msg += `   - Chi tiêu: ${Number(row.total_spent).toLocaleString('vi-VN')} đ\n`;
        msg += `   - Số giao dịch: ${Number(row.total_payments || 0)}\n`;
    });
    return msg;
}

export async function ownerGetBusinessRecommendations(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const revenuePeriod = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const orderPeriod = periodFilter("created_at", time_range, months, start_date, end_date);

    const [revenueRows] = await pool.query<any[]>(`
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN locations l ON p.location_id = l.location_id
        WHERE l.owner_id = ?
          AND p.status = 'completed'
          AND ${revenuePeriod.condition}
    `, [actor_user_id, ...revenuePeriod.params]);
    const currentRevenue = Number(revenueRows[0]?.total || 0);

    let previousRevenue: number | null = null;
    const previous = !months.length && !start_date && !end_date ? previousPeriodCondition(time_range, "p.payment_time") : null;
    if (previous) {
        const [prevRows] = await pool.query<any[]>(`
            SELECT COALESCE(SUM(p.amount), 0) as total
            FROM payments p
            JOIN locations l ON p.location_id = l.location_id
            WHERE l.owner_id = ?
              AND p.status = 'completed'
              AND ${previous.condition}
        `, [actor_user_id]);
        previousRevenue = Number(prevRows[0]?.total || 0);
    }

    const [posRows] = await pool.query<any[]>(`
        SELECT COUNT(*) as total_orders,
               SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM pos_orders
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?)
          AND ${orderPeriod.condition}
    `, [actor_user_id, ...orderPeriod.params]);
    const [bookingRows] = await pool.query<any[]>(`
        SELECT COUNT(*) as total_orders,
               SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
        FROM hotel_stays
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?)
          AND ${orderPeriod.condition}
    `, [actor_user_id, ...orderPeriod.params]);

    const totalOrders = Number(posRows[0]?.total_orders || 0) + Number(bookingRows[0]?.total_orders || 0);
    const cancelledOrders = Number(posRows[0]?.cancelled_orders || 0) + Number(bookingRows[0]?.cancelled_orders || 0);
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    const [weakRows] = await pool.query<any[]>(`
        SELECT l.location_id,
               l.location_name,
               COALESCE(SUM(CASE WHEN p.status = 'completed' AND ${revenuePeriod.condition} THEN p.amount ELSE 0 END), 0) as total_revenue
        FROM locations l
        LEFT JOIN payments p ON p.location_id = l.location_id
        WHERE l.owner_id = ?
        GROUP BY l.location_id, l.location_name
        ORDER BY total_revenue ASC
        LIMIT 1
    `, [...revenuePeriod.params, actor_user_id]);

    const [serviceRows] = await pool.query<any[]>(`
        SELECT s.service_name,
               SUM(oi.quantity) as total_sold,
               COALESCE(SUM(oi.line_total), 0) as total_revenue
        FROM pos_order_items oi
        JOIN pos_orders o ON oi.order_id = o.order_id
        JOIN services s ON oi.service_id = s.service_id
        JOIN locations l ON o.location_id = l.location_id
        WHERE l.owner_id = ?
          AND o.status IN ('paid', 'completed')
          AND ${periodFilter("oi.created_at", time_range, months, start_date, end_date).condition}
        GROUP BY s.service_id, s.service_name
        ORDER BY total_sold DESC, total_revenue DESC
        LIMIT 1
    `, [actor_user_id, ...periodFilter("oi.created_at", time_range, months, start_date, end_date).params]);

    const weakLocation = weakRows[0];
    const topService = serviceRows[0];
    const revenueText = revenueDeltaText(currentRevenue, previousRevenue);
    const previousLabel = previous ? previous.label : "kỳ trước";

    const recommendations: string[] = [];
    if (previousRevenue !== null && previousRevenue > 0 && currentRevenue < previousRevenue * 0.9) {
        recommendations.push(`Doanh thu đang giảm so với ${previousLabel}. Nên tạo voucher ngắn hạn 3 ngày để kéo lại nhu cầu.`);
    }
    if (cancelRate >= 15) {
        recommendations.push(`Tỷ lệ hủy ${cancelRate.toFixed(1)}% khá cao. Nên kiểm tra bước xác nhận booking, thời gian phản hồi và điều kiện hủy.`);
    }
    if (weakLocation) {
        const name = weakLocation.location_name || "địa điểm doanh thu thấp";
        recommendations.push(`Địa điểm cần kích cầu: **${name}**. Gợi ý voucher: giảm 50.000 đ, hạn 3 ngày, áp dụng riêng cho địa điểm này.`);
    }
    if (topService) {
        recommendations.push(`Dịch vụ đang có tín hiệu tốt: **${topService.service_name}** (${Number(topService.total_sold || 0)} lượt). Có thể đẩy combo hoặc voucher nhẹ để tăng giá trị đơn.`);
    }
    if (recommendations.length === 0) {
        recommendations.push("Các chỉ số chưa có tín hiệu xấu rõ. Nên tiếp tục theo dõi doanh thu và tỷ lệ hủy trước khi tạo voucher mới.");
    }

    let msg = `🧠 **Khuyến nghị AI vận hành ${revenuePeriod.label}**\n\n`;
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
    msg += `\nAI chỉ đề xuất. Nếu sếp muốn tạo voucher, hãy nhắn rõ mức giảm/thời hạn rồi xác nhận bản nháp.`;
    return msg;
}

export async function ownerAnalyzeReviews(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("created_at", time_range, months, start_date, end_date);
    const [rows] = await pool.query<any[]>(`
        SELECT COUNT(*) as total_reviews, 
               AVG(rating) as avg_rating,
               SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as bad_reviews
        FROM reviews 
        WHERE location_id IN (SELECT location_id FROM locations WHERE owner_id = ?) 
        AND ${period.condition}
    `, [actor_user_id, ...period.params]);
    
    let label = period.label;

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



export async function ownerGetTopLocations(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const [rows] = await pool.query<any[]>(
        `SELECT l.location_name, COUNT(p.payment_id) as total_orders, SUM(p.amount) as total_revenue
         FROM locations l
         JOIN payments p ON l.location_id = p.location_id
         WHERE l.owner_id = ? AND p.status = 'completed' AND ${period.condition}
         GROUP BY l.location_id
         ORDER BY total_revenue DESC LIMIT 5`,
        [actor_user_id, ...period.params]
    );
    let msg = `🏆 **Top Địa điểm Kinh doanh tốt nhất ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Không có dữ liệu trong khoảng thời gian này.";
    for (let i = 0; i < rows.length; i++) {
        msg += `${i + 1}. **${rows[i].location_name}** - Doanh thu: ${Number(rows[i].total_revenue).toLocaleString('vi-VN')} đ (Số đơn: ${rows[i].total_orders})\n`;
    }
    return msg;
}

export async function ownerViewBookings(actor_user_id: number, time_range: string, status?: string, location_name?: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("h.created_at", time_range, months, start_date, end_date);
    let query = `SELECT h.id, h.customer_name, h.customer_phone, h.total_price, h.status, l.location_name
                 FROM hotel_stays h
                 JOIN locations l ON h.location_id = l.location_id
                 WHERE l.owner_id = ? AND ${period.condition}`;
    const params: any[] = [actor_user_id, ...period.params];
    if (status) {
        query += " AND h.status = ?";
        params.push(status);
    }
    if (location_name) {
        query += " AND l.location_name LIKE ?";
        params.push(`%${location_name}%`);
    }
    query += " ORDER BY h.created_at DESC LIMIT 10";
    
    const [rows] = await pool.query<any[]>(query, params);
    let msg = `📋 **Danh sách Đặt chỗ (Booking) ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Không tìm thấy đơn đặt chỗ nào phù hợp.";
    
    for (const row of rows) {
        msg += `- **[${row.status}]** Khách: ${row.customer_name} (${row.customer_phone}) - Tại: ${row.location_name} - Tiền: ${Number(row.total_price).toLocaleString('vi-VN')} đ\n`;
    }
    return msg;
}

export async function ownerViewCommissions(actor_user_id: number, time_range: string, months: number[] = [], start_date?: string, end_date?: string) {
    const period = periodFilter("p.payment_time", time_range, months, start_date, end_date);
    const [rows] = await pool.query<any[]>(
        `SELECT SUM(p.amount) as total_revenue, l.commission_rate, l.location_name
         FROM payments p
         JOIN locations l ON p.location_id = l.location_id
         WHERE l.owner_id = ? AND p.status = 'completed' AND ${period.condition}
         GROUP BY l.location_id, l.commission_rate, l.location_name`,
        [actor_user_id, ...period.params]
    );
    let msg = `💸 **Báo cáo Hoa hồng Dự kiến ${period.label}**\n\n`;
    if (rows.length === 0) return msg + "Không có giao dịch phát sinh hoa hồng.";
    
    let totalCommission = 0;
    for (const row of rows) {
        const rev = Number(row.total_revenue);
        const rate = Number(row.commission_rate || 0);
        const comm = (rev * rate) / 100;
        totalCommission += comm;
        msg += `- **${row.location_name}**: Doanh thu ${rev.toLocaleString('vi-VN')} đ x ${rate}% = ${comm.toLocaleString('vi-VN')} đ\n`;
    }
    msg += `\n**Tổng hoa hồng dự kiến:** ${totalCommission.toLocaleString('vi-VN')} đ`;
    return msg;
}
