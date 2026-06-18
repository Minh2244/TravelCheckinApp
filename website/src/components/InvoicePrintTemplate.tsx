import { forwardRef } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { formatMoney } from "../utils/formatMoney";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "Asia/Ho_Chi_Minh";

export interface InvoicePrintData {
  payment_id: number;
  booking_id?: number | null;
  booked_full_name?: string;
  user_full_name?: string;
  phone?: string;
  location_name: string;
  location_address?: string;
  booking_service_name?: string;
  booking_service_type?: string;
  payment_time: string;
  payment_method?: string;
  amount: number | string;
  check_in_date?: string;
  check_out_date?: string;
  contact_name?: string;
  contact_phone?: string;
  food_items?: Array<{ name: string; quantity: number; price: number }>;
}

interface DetailPayment {
  payment_id: number;
  payment_time: string;
  amount: number;
  payment_method: string;
  table_name?: string | null;
  total_qty?: number;
  items_count?: number;
  items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  prepaid_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  onsite_items?: Array<{
    service_id: number;
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  prepaid_amount?: number;
  onsite_amount?: number;
  prepaid_payment_method?: string | null;
  onsite_payment_method?: string | null;
  hotel?: {
    room_number?: string | null;
    guest_name?: string | null;
    guest_phone?: string | null;
    checkin_time?: string | null;
    checkout_time?: string | null;
    total_amount?: number | null;
  } | null;
  hotel_rooms?: Array<{
    room_number?: string | null;
    guest_name?: string | null;
    checkin_time?: string | null;
    checkout_time?: string | null;
    total_amount?: number | null;
  }> | null;
}

interface InvoicePrintProps {
  invoice: InvoicePrintData;
  currentUserName: string;
  detailPayment?: DetailPayment | null;
}

const formatPaymentMethod = (v: string | null | undefined) => {
  if (v === "Cash") return "Tiền mặt";
  if (v === "BankTransfer") return "Chuyển khoản";
  return v || "—";
};

const ItemTable = ({
  title,
  items,
  paymentMethod,
  itemLabel = "Món",
}: {
  title: string;
  items: Array<{
    service_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  paymentMethod?: string | null;
  itemLabel?: string;
}) => {
  if (!items.length) return null;
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        background: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
        {paymentMethod && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>
            {formatPaymentMethod(paymentMethod)}
          </span>
        )}
      </div>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ textAlign: "left", padding: "4px 0", color: "#6b7280" }}>{itemLabel}</th>
            <th style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", width: 50 }}>SL</th>
            <th style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", width: 90 }}>Giá</th>
            <th style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", width: 100 }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "4px 0" }}>{it.service_name}</td>
              <td style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>
                {it.quantity}
              </td>
              <td style={{ textAlign: "right", padding: "4px 0" }}>
                {formatMoney(it.unit_price)}
              </td>
              <td style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>
                {formatMoney(it.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: "right", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
        {formatMoney(items.reduce((s, it) => s + Number(it.line_total || 0), 0))}
      </div>
    </div>
  );
};

const InvoicePrintTemplate = forwardRef<HTMLDivElement, InvoicePrintProps>(
  ({ invoice, currentUserName, detailPayment }, ref) => {
    const d = detailPayment;
    const hasDetail = d && Array.isArray(d.items);

    // Determine if merged invoice (prepaid + onsite)
    const isMerged =
      hasDetail &&
      Number(d.prepaid_amount || 0) > 0 &&
      Number(d.onsite_amount || 0) > 0;

    const prepaidItems = Array.isArray(d?.prepaid_items) ? d.prepaid_items : [];
    const onsiteItems = Array.isArray(d?.onsite_items) ? d.onsite_items : [];
    const hasSplitItems = prepaidItems.length > 0 || onsiteItems.length > 0;

    return (
      <div
        ref={ref}
        style={{
          padding: 24,
          fontFamily: "'Times New Roman', Times, serif",
          maxWidth: 700,
          margin: "0 auto",
          fontSize: 14,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Hóa đơn #{(() => {
              const t = invoice.booking_service_type || "";
              const isHotel = t === "hotel" || t === "resort";
              const isTourist = t === "tourist" || t === "ticket";
              const prefix = isHotel ? "RS" : isTourist ? "SB" : "DI";
              return invoice.booking_id && Number(invoice.booking_id) > 0
                ? `${prefix}-${invoice.booking_id}`
                : `${prefix}-POS-${invoice.payment_id}`;
            })()}
          </h2>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            {dayjs(invoice.payment_time).tz(TZ).format("HH:mm DD/MM/YYYY")}
            {d?.table_name ? ` • Bàn ${d.table_name}` : ""}
          </div>
        </div>

        {/* Payment method */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Thanh toán</div>
          <div>{formatPaymentMethod(d?.payment_method || invoice.payment_method)}</div>
        </div>

        {/* Hotel rooms */}
        {d?.hotel_rooms && d.hotel_rooms.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {d.hotel_rooms.map((rm, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  background: "#f0f9ff",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  🏨 Phòng {rm.room_number || "—"}
                </div>
                {rm.guest_name && <div>Khách: {rm.guest_name}</div>}
                {rm.checkin_time && (
                  <div>
                    Nhận phòng: {dayjs(rm.checkin_time).tz(TZ).format("HH:mm DD/MM/YYYY")}
                  </div>
                )}
                {rm.checkout_time && (
                  <div>
                    Trả phòng: {dayjs(rm.checkout_time).tz(TZ).format("HH:mm DD/MM/YYYY")}
                  </div>
                )}
                {rm.total_amount != null && (
                  <div style={{ fontWeight: 600, marginTop: 4 }}>
                    Thành tiền: {formatMoney(rm.total_amount)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Merged invoice: prepaid + onsite sections */}
        {isMerged && hasSplitItems ? (
          <>
            {prepaidItems.length > 0 && (
              <ItemTable
                title="Món khách đã thanh toán trước"
                items={prepaidItems}
                paymentMethod={d.prepaid_payment_method}
              />
            )}
            {onsiteItems.length > 0 && (
              <ItemTable
                title="Món gọi thêm tại bàn"
                items={onsiteItems}
                paymentMethod={d.onsite_payment_method}
              />
            )}
          </>
        ) : hasDetail && d.items && d.items.length > 0 ? (
          /* Normal invoice: single items list */
          <ItemTable
            title={(() => {
              const t = invoice.booking_service_type || "";
              const isTourist = t === "tourist" || t === "ticket";
              return isTourist ? "Chi tiết vé" : "Chi tiết món ăn";
            })()}
            items={d.items}
            paymentMethod={d.payment_method}
            itemLabel={(() => {
              const t = invoice.booking_service_type || "";
              return (t === "tourist" || t === "ticket") ? "Hạng vé" : "Món";
            })()}
          />
        ) : (
          /* Fallback: no detail data */
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "4px 0", color: "#6b7280" }}>
                    Tên dịch vụ
                  </th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", width: 50 }}>
                    SL
                  </th>
                  <th style={{ textAlign: "right", padding: "4px 0", color: "#6b7280", width: 100 }}>
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0" }}>
                    {invoice.booking_service_name || invoice.location_name || "Dịch vụ"}
                  </td>
                  <td style={{ textAlign: "right", padding: "4px 0" }}>1</td>
                  <td style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>
                    {formatMoney(invoice.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #e5e7eb",
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {hasDetail
              ? `Số món: ${d.items_count || d.items?.length || 0} • Tổng SL: ${d.total_qty || 0}`
              : ""}
          </div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {formatMoney(d?.amount || invoice.amount)}
          </div>
        </div>

        {/* Merged total breakdown */}
        {isMerged && (
          <div style={{ textAlign: "right", color: "#6b7280", fontSize: 12, marginTop: 4 }}>
            (Đã thanh toán trước: {formatMoney(d.prepaid_amount)} • Thanh toán tại bàn: {formatMoney(d.onsite_amount)})
          </div>
        )}

        {/* Signature */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
          <div style={{ textAlign: "center", width: 200 }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>Người lập hóa đơn</div>
            <div style={{ fontStyle: "italic", color: "#94a3b8", marginBottom: 32 }}>
              (Ký, ghi rõ họ tên)
            </div>
            <div style={{ fontWeight: "bold" }}>{currentUserName}</div>
          </div>
        </div>
      </div>
    );
  },
);

InvoicePrintTemplate.displayName = "InvoicePrintTemplate";
export default InvoicePrintTemplate;
