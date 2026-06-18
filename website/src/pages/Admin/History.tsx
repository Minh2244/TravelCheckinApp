import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Button,
  Card,
  DatePicker,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import {
  SearchOutlined,
  DollarOutlined,
  WalletOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ShopOutlined,
  PrinterOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import { useReactToPrint } from "react-to-print";
import { exportInvoiceExcel } from "../../utils/exportInvoiceExcel";
import InvoicePrintTemplate from "../../components/InvoicePrintTemplate";

const DATE_UI_FORMAT = "DD/MM/YYYY";

type RevenueSummary = {
  total: { amount: number; cash: number; transfer: number; count: number };
  onsite: { amount: number; cash: number; transfer: number; count: number };
  booking: { amount: number; cash: number; transfer: number; count: number };
};

export default function AdminHistory() {
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const [ownerOptions, setOwnerOptions] = useState<
    Array<{ value: number; label: string }>
  >([]);
  const [locationOptions, setLocationOptions] = useState<
    Array<{ value: number; label: string; owner_id: number }>
  >([]);

  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "all" | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "all" | null>(null);

  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(dayjs());

  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const res = await adminApi.getOwners({ limit: 1000 });
        const list = (res?.data || []) as any[];
        setOwnerOptions(
          list.map((o) => ({
            value: Number(o.user_id),
            label: `${o.full_name} ${o.phone ? `(${o.phone})` : ""}`,
          })),
        );
      } catch (e) {
        console.error("Lỗi lấy danh sách owner", e);
      }
    };
    void fetchOwners();
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await adminApi.getLocations({ limit: 2000 });
        const list = (res?.data || []) as any[];
        setLocationOptions(
          list.map((l) => ({
            value: Number(l.location_id),
            label: l.location_name,
            owner_id: Number(l.owner_id),
          })),
        );
      } catch (e) {
        console.error("Lỗi lấy danh sách địa điểm", e);
      }
    };
    void fetchLocations();
  }, []);

  const filteredLocations = useMemo(() => {
    if (selectedOwnerId === null) return [];
    if (selectedOwnerId === "all") return locationOptions;
    return locationOptions.filter((l) => l.owner_id === selectedOwnerId);
  }, [locationOptions, selectedOwnerId]);

  const getOwnerIdsParam = useCallback(() => {
    if (selectedOwnerId === "all") return ownerOptions.map((o) => o.value).join(",");
    if (selectedOwnerId !== null) return String(selectedOwnerId);
    return "";
  }, [selectedOwnerId, ownerOptions]);

  const getLocationIdsParam = useCallback(() => {
    if (selectedLocationId === "all") return filteredLocations.map((l) => l.value).join(",");
    if (selectedLocationId !== null) return String(selectedLocationId);
    return "";
  }, [selectedLocationId, filteredLocations]);

  const loadSummary = useCallback(async () => {
    if (selectedOwnerId === null || selectedLocationId === null) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const res = await adminApi.getHistoryRevenueSummary({
        owner_ids: getOwnerIdsParam(),
        location_ids: getLocationIdsParam(),
        from: startDate?.format("YYYY-MM-DD"),
        to: endDate?.format("YYYY-MM-DD"),
      });
      setSummary(res.data);
    } catch (e) {
      message.error("Lỗi tải tổng quan doanh thu");
    } finally {
      setLoading(false);
    }
  }, [selectedOwnerId, selectedLocationId, startDate, endDate, getOwnerIdsParam, getLocationIdsParam]);

  useEffect(() => {
    // Tự động load summary khi bộ lọc thay đổi, nhưng ẨN bảng
    void loadSummary();
    setShowTable(false);
  }, [loadSummary]);

  const handleShowInvoices = async () => {
    if (selectedOwnerId === null || selectedLocationId === null) {
      setInvoices([]);
      setShowTable(true);
      return;
    }
    setShowTable(true);
    setTableLoading(true);
    try {
      const res = await adminApi.getHistoryInvoices({
        owner_ids: getOwnerIdsParam(),
        location_ids: getLocationIdsParam(),
        from: startDate?.format("YYYY-MM-DD"),
        to: endDate?.format("YYYY-MM-DD"),
      });
      const parsedInvoices = (res.data || []).map((row: any) => {
        const notesStr = String(row.notes || "");
        let notesObj: any = null;
        try {
          notesObj = JSON.parse(notesStr);
        } catch (e) {}

        const isFood = notesObj?.service_type === "food";
        const isTable = notesObj?.service_type === "table";
        const isTicket = notesObj?.service_type === "ticket" || notesStr.startsWith("TOURIST_TICKETS:");
        const isHotelSingle = notesStr.startsWith("HOTEL_STAY:");
        const isHotelBatch = notesStr.startsWith("HOTEL_STAYS:");
        const isHotel = isHotelSingle || isHotelBatch;

        let prefix = "POS";
        if (isHotel) prefix = "RS";
        else if (isTicket) prefix = "SB";
        else if (isFood || isTable) prefix = "DI";

        const itemsRaw =
          (isFood || isTable || isTicket) && notesObj && Array.isArray(notesObj.items)
            ? notesObj.items
            : [];
        const items = itemsRaw.map((it: any) => ({
          service_name: String(it.service_name || ""),
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          line_total: Number(it.line_total || 0),
        }));

        let hotel = null;
        let hotel_rooms: any[] = [];
        if (isHotel) {
          let snapAny: any = null;
          try {
            snapAny = JSON.parse(row.qr_data || "null");
          } catch {}

          if (isHotelBatch && Array.isArray(snapAny?.hotel_invoices)) {
            hotel_rooms = snapAny.hotel_invoices;
          } else if (isHotelSingle && snapAny?.hotel_invoice) {
            hotel = snapAny.hotel_invoice;
            hotel_rooms = [hotel];
          }
        }

        let prepaid_items = Array.isArray(notesObj?.prepaid_items) ? notesObj.prepaid_items : [];
        let onsite_items: any[] = [];
        
        if (prepaid_items.length > 0) {
          onsite_items = items.map((it: any) => ({...it}));
          for (const pIt of prepaid_items) {
            const idx = onsite_items.findIndex((x) => String(x.service_name) === String(pIt.service_name));
            if (idx >= 0) {
              onsite_items[idx].quantity -= Number(pIt.quantity || 0);
              if (onsite_items[idx].quantity <= 0) {
                onsite_items.splice(idx, 1);
              } else {
                onsite_items[idx].line_total = onsite_items[idx].quantity * onsite_items[idx].unit_price;
              }
            }
          }
        } else {
          if (row.transaction_source === "online_booking") {
            prepaid_items = items;
          } else {
            onsite_items = items;
          }
        }

        const prepaid_amount = Number(notesObj?.prepaid_amount || prepaid_items.reduce((sum: number, x: any) => sum + Number(x.line_total || 0), 0));
        const onsite_amount = Number(notesObj?.onsite_amount || onsite_items.reduce((sum: number, x: any) => sum + Number(x.line_total || 0), 0));

        return {
          ...row,
          items,
          hotel,
          hotel_rooms,
          prefix,
          voucher_code: row.booking_voucher_code || row.voucher_code,
          discount_amount: row.booking_discount_amount || row.discount_amount,
          prepaid_items,
          onsite_items,
          prepaid_amount,
          onsite_amount,
          prepaid_payment_method: notesObj?.prepaid_payment_method || (prepaid_amount > 0 ? row.payment_method : null),
          onsite_payment_method: notesObj?.onsite_payment_method || (onsite_amount > 0 ? row.payment_method : null),
          performed_by: notesObj?.performed_by,
          table_name: notesObj?.table_name || notesObj?.table_names || null,
        };
      });

      parsedInvoices.sort((a: any, b: any) => new Date(b.payment_time).getTime() - new Date(a.payment_time).getTime());
      setInvoices(parsedInvoices);
    } catch (e) {
      message.error("Lỗi tải danh sách hóa đơn");
    } finally {
      setTableLoading(false);
    }
  };

  const printRef = useRef<HTMLDivElement>(null);
  const [printData, setPrintData] = useState<any>(null);

  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
    documentTitle: printData
      ? (() => {
          const t = printData.hotel ? "hotel" : printData.items ? "restaurant" : "tourist";
          const pfx = t === "hotel" ? "RS" : t === "restaurant" ? "DI" : "SB";
          const code = printData.booking_id && Number(printData.booking_id) > 0
            ? `${pfx}-${printData.booking_id}`
            : `${pfx}-POS-${printData.payment_id}`;
          return `Hoa_don_${code}`;
        })()
      : "Hoa_don",
  });

  const handlePrintRow = useCallback((row: any) => {
    setPrintData(row);
    setTimeout(() => {
      handlePrintTrigger();
    }, 100);
  }, [handlePrintTrigger]);

  const handleExportRowExcel = useCallback(async (row: any) => {
    try {
      const roleLabel = row.performed_by?.role === "owner" ? "Owner" : row.performed_by?.role === "employee" ? "Nhân viên" : null;
      const userName = row.performed_by?.name ? `${row.performed_by.name} ${roleLabel ? `(${roleLabel})` : ""}` : "Hệ thống";
      await exportInvoiceExcel(row as any, userName, row);
      message.success("Xuất Excel thành công!");
    } catch (err: any) {
      message.error("Lỗi xuất Excel: " + err?.message);
    }
  }, []);

  const expandedInvoiceRender = useCallback((row: any) => {
    const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
    const fallbackHotelRoom = row.hotel
      ? {
          stay_id: row.hotel.stay_id,
          room_number: row.hotel.room_number,
          guest_name: row.hotel.guest_name,
          guest_phone: row.hotel.guest_phone,
          checkin_time: row.hotel.checkin_time,
          checkout_time: row.hotel.checkout_time,
          total_amount: null as number | null,
        }
      : null;
    const roomsForRender =
      hotelRooms.length > 0 ? hotelRooms : fallbackHotelRoom ? [fallbackHotelRoom] : [];

    const bookedName =
      roomsForRender.find((x: any) => String(x.guest_name || "").trim())?.guest_name ||
      row.hotel?.guest_name ||
      row.performed_by?.name ||
      "-";
    const bookedPhone =
      roomsForRender.find((x: any) => String(x.guest_phone || "").trim())?.guest_phone ||
      row.hotel?.guest_phone ||
      row.performed_by?.phone ||
      "-";

    return (
      <div className="rounded-2xl border bg-slate-50/50 p-4 font-sans">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-base font-semibold text-blue-800">
              Hóa đơn{" "}
              {row.booking_id != null && Number(row.booking_id) > 0
                ? `#${row.prefix}-${row.booking_id}`
                : `#${row.prefix}-POS-${row.payment_id}`}
            </div>
            <div className="text-xs text-gray-500">
              {formatDateTimeVi(row.payment_time)}
              {row.table_name ? ` • ${row.table_name}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Thanh toán</div>
            <div>
              <Tag color={row.payment_method === "Cash" ? "gold" : "blue"}>
                {row.payment_method === "Cash"
                  ? "Tiền mặt"
                  : row.payment_method === "BankTransfer"
                  ? "Chuyển khoản"
                  : row.payment_method}
              </Tag>
            </div>
          </div>
        </div>

        {row.voucher_code ? (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="text-sm font-semibold text-emerald-800">🎫 Voucher áp dụng</div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Mã:</span>
                <span className="ml-1 font-semibold">{row.voucher_code}</span>
              </div>
              <div>
                <span className="text-slate-500">Giảm:</span>
                <span className="ml-1 font-semibold text-red-600">
                  -{formatMoney(row.discount_amount || 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Thực tế:</span>
                <span className="ml-1 font-semibold">
                  {formatMoney(row.final_amount || row.amount)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">Thông tin người đặt</div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <div className="text-gray-500">Người đặt</div>
                <div className="text-right font-semibold">{bookedName}</div>
                <div className="text-gray-500">SĐT</div>
                <div className="text-right font-semibold">{bookedPhone}</div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-3 text-sm">
              <div className="text-xs font-semibold text-gray-500">Tổng thanh toán</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-xs text-gray-500">{roomsForRender.length} phòng</div>
                <div className="text-xl font-bold">{formatMoney(row.amount)}</div>
              </div>
            </div>
          </div>
        ) : null}

        {roomsForRender.length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">Chi tiết phòng</div>
            <div className="space-y-2">
              {roomsForRender.map((rm: any, idx: number) => (
                <div key={idx} className="rounded-2xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-gray-800">{rm.room_number || "-"}</div>
                    <div className="font-bold">
                      {rm.total_amount != null ? formatMoney(rm.total_amount) : "-"}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="text-gray-500">Nhận phòng</div>
                    <div className="text-right font-medium">
                      {rm.checkin_time ? formatDateTimeVi(rm.checkin_time) : "-"}
                    </div>
                    <div className="text-gray-500">Trả phòng</div>
                    <div className="text-right font-medium">
                      {rm.checkout_time ? formatDateTimeVi(rm.checkout_time) : "-"}
                    </div>
                    <div className="text-gray-500">Thành tiền</div>
                    <div className="text-right font-semibold">
                      {rm.total_amount != null ? formatMoney(rm.total_amount) : "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : row.prepaid_items?.length > 0 || row.onsite_items?.length > 0 ? (
          <div className="mt-3 space-y-3">
            {row.prepaid_items?.length > 0 && (
              <div className="rounded-2xl border p-3 border-amber-100 bg-amber-50/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-amber-800">Món khách đã thanh toán trước khi check-in</div>
                  {row.prepaid_payment_method ? (
                    <Tag color={row.prepaid_payment_method === "Cash" ? "gold" : "blue"}>
                      {row.prepaid_payment_method === "Cash" ? "Tiền mặt" : row.prepaid_payment_method === "BankTransfer" ? "Chuyển khoản" : row.prepaid_payment_method}
                    </Tag>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Món</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {row.prepaid_items.map((it: any, i: number) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm font-sans">
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">{it.quantity}</div>
                      <div className="text-right">{formatMoney(it.unit_price)}</div>
                      <div className="text-right font-semibold">{formatMoney(it.line_total)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end border-t pt-3 text-sm font-semibold">{formatMoney(row.prepaid_amount)}</div>
              </div>
            )}
            {row.onsite_items?.length > 0 && (
              <div className="rounded-2xl border p-3 border-blue-100 bg-blue-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-blue-800">Món gọi thêm tại bàn</div>
                  {row.onsite_payment_method ? (
                    <Tag color={row.onsite_payment_method === "Cash" ? "gold" : "blue"}>
                      {row.onsite_payment_method === "Cash" ? "Tiền mặt" : row.onsite_payment_method === "BankTransfer" ? "Chuyển khoản" : row.onsite_payment_method}
                    </Tag>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
                  <div>Món</div>
                  <div className="text-right">SL</div>
                  <div className="text-right">Giá</div>
                  <div className="text-right">Thành tiền</div>
                </div>
                <div className="divide-y">
                  {row.onsite_items.map((it: any, i: number) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm font-sans">
                      <div className="min-w-0 truncate">{it.service_name}</div>
                      <div className="text-right font-semibold">{it.quantity}</div>
                      <div className="text-right">{formatMoney(it.unit_price)}</div>
                      <div className="text-right font-semibold">{formatMoney(it.line_total)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end border-t pt-3 text-sm font-semibold">{formatMoney(row.onsite_amount)}</div>
              </div>
            )}
          </div>
        ) : Array.isArray(row.items) && row.items.length > 0 ? (
          <div className="mt-3 bg-white rounded-2xl border p-3">
            <div className="grid grid-cols-[1fr_60px_110px_120px] border-b pb-2 text-xs font-semibold text-gray-500">
              <div>Món/Dịch vụ</div>
              <div className="text-right">SL</div>
              <div className="text-right">Giá</div>
              <div className="text-right">Thành tiền</div>
            </div>
            <div className="divide-y">
              {row.items.map((it: any, idx: number) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_60px_110px_120px] py-2 text-sm font-sans"
                >
                  <div className="min-w-0 truncate">{it.service_name}</div>
                  <div className="text-right font-semibold">{it.quantity}</div>
                  <div className="text-right">{formatMoney(it.unit_price)}</div>
                  <div className="text-right font-semibold">{formatMoney(it.line_total)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between gap-4 border-t pt-3">
              <div className="text-sm text-gray-600">
                Số lượng mục: <b>{row.items.length}</b> • Tổng SL:{" "}
                <b>
                  {row.items.reduce((s: number, x: any) => s + Number(x.quantity), 0)}
                </b>
              </div>
              <div className="text-lg font-bold text-blue-900">{formatMoney(row.amount)}</div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrintRow(row)}
          >
            In PDF
          </Button>
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={() => handleExportRowExcel(row)}
          >
            Xuất Excel
          </Button>
        </div>
      </div>
    );
  }, [handlePrintRow, handleExportRowExcel]);

  const columns: any[] = [
    {
      title: "Hóa đơn",
      render: (_: any, row: any) => {
        const vcTag = row.voucher_code ? (
          <Tag color="purple" className="ml-1 font-normal">
            VC
          </Tag>
        ) : null;
        if (row.booking_id) {
          return (
            <span className="font-semibold text-blue-700">
              #{row.prefix}-{row.booking_id}
              {vcTag}
            </span>
          );
        }
        return (
          <span className="font-semibold text-blue-700">
            #{row.prefix}-POS-{row.payment_id}
            {vcTag}
          </span>
        );
      },
    },
    {
      title: "Thời gian",
      render: (_: any, row: any) => <span className="text-xs">{formatDateTimeVi(row.payment_time)}</span>,
    },
    {
      title: "Địa điểm",
      dataIndex: "location_name",
    },
    {
      title: "Bàn/Phòng",
      render: (_: any, row: any) => row.hotel?.room_number || row.table_name || "-",
    },
    {
      title: "Khách đặt trước",
      render: (_: any, row: any) => {
        const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
        const firstWithGuest = hotelRooms.find((x: any) => Boolean(String(x.guest_name || "").trim()) || Boolean(String(x.guest_phone || "").trim()));
        const guestName = (row.booking_contact_name && String(row.booking_contact_name).trim()) || (firstWithGuest?.guest_name && String(firstWithGuest.guest_name).trim()) || (row.hotel?.guest_name && String(row.hotel.guest_name).trim()) || row.booked_full_name || row.user_full_name || row.performed_by?.name || "-";
        return guestName;
      }
    },
    {
      title: "SĐT",
      render: (_: any, row: any) => {
        const hotelRooms = Array.isArray(row.hotel_rooms) ? row.hotel_rooms : [];
        const firstWithGuest = hotelRooms.find((x: any) => Boolean(String(x.guest_name || "").trim()) || Boolean(String(x.guest_phone || "").trim()));
        const guestPhone = (row.booking_contact_phone && String(row.booking_contact_phone).trim()) || (firstWithGuest?.guest_phone && String(firstWithGuest.guest_phone).trim()) || (row.hotel?.guest_phone && String(row.hotel.guest_phone).trim()) || row.booked_phone || row.user_phone || row.performed_by?.phone || "-";
        return guestPhone;
      }
    },
    {
      title: "Số tiền",
      render: (_: any, row: any) => {
        const prepaid = Number(row.prepaid_amount || 0);
        const onsite = Number(row.onsite_amount || 0);
        const total = prepaid + onsite;
        const displayAmount = Number.isFinite(total) && total > 0 ? total : Number(row.amount || 0);
        return <b>{formatMoney(displayAmount)}</b>;
      },
    },
    {
      title: "Phương thức",
      render: (_: any, row: any) => {
        const m = row.payment_method;
        if ((row.prepaid_amount > 0 && row.onsite_amount > 0) || row.prepaid_items?.length > 0 || row.onsite_items?.length > 0) {
          return <span className="text-xs text-gray-400">Xem chi tiết</span>;
        }
        return (
          <Tag color={m === "Cash" ? "gold" : "blue"}>
            {m === "Cash" ? "Tiền mặt" : m === "BankTransfer" ? "Chuyển khoản" : m}
          </Tag>
        );
      },
    },
    {
      title: "Người thực hiện",
      render: (_: any, row: any) => {
        if (row.performed_by?.name) {
          if (row.performed_by.role === "user") return "-";
          const roleLabel = row.performed_by.role === "owner" ? "Owner" : row.performed_by.role === "employee" ? "Nhân viên" : null;
          return <span>{row.performed_by.name} {roleLabel ? <span className="text-xs text-gray-500">({roleLabel})</span> : ""}</span>;
        }
        return "-";
      }
    }
  ];

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Lịch sử giao dịch</h2>
          <p className="text-slate-500">Tra cứu doanh thu và danh sách hóa đơn theo chủ địa điểm</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 rounded-2xl shadow-sm border border-slate-100 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Chủ sở hữu</div>
            <Select
              allowClear
              placeholder="Vui lòng chọn Chủ sở hữu"
              options={[{ label: "--- Tất cả Chủ sở hữu ---", value: "all" }, ...ownerOptions]}
              value={selectedOwnerId}
              onChange={(v) => {
                setSelectedOwnerId(v || null);
                setSelectedLocationId(null);
              }}
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Địa điểm</div>
            <Select
              allowClear
              placeholder="Vui lòng chọn địa điểm"
              options={[{ label: "--- Tất cả Địa điểm ---", value: "all" }, ...filteredLocations]}
              value={selectedLocationId}
              onChange={(v) => setSelectedLocationId(v || null)}
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Từ ngày</div>
            <DatePicker
              format={DATE_UI_FORMAT}
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                if (d && endDate && d.isAfter(endDate, "day")) {
                  setEndDate(d);
                }
              }}
              disabledDate={(current) => current && current > dayjs().endOf("day")}
              className="w-full"
              allowClear={false}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Đến ngày</div>
            <DatePicker
              format={DATE_UI_FORMAT}
              value={endDate}
              onChange={(d) => {
                setEndDate(d);
                if (d && startDate && d.isBefore(startDate, "day")) {
                  setStartDate(d);
                }
              }}
              disabledDate={(current) => current && current > dayjs().endOf("day")}
              className="w-full"
              allowClear={false}
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* TỔNG DOANH THU */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-emerald-800 uppercase mb-1">
                Tổng doanh thu
              </div>
              <div className="text-2xl font-black text-emerald-950">
                {formatMoney(summary?.total?.amount || 0)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200/50 text-emerald-600">
              <DollarOutlined className="text-xl" />
            </div>
          </div>
        </Card>

        {/* TIỀN MẶT */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-amber-800 uppercase mb-1">
                Tiền mặt
              </div>
              <div className="text-2xl font-black text-amber-950">
                {formatMoney(summary?.total?.cash || 0)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200/50 text-amber-600">
              <WalletOutlined className="text-xl" />
            </div>
          </div>
        </Card>

        {/* CHUYỂN KHOẢN */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-blue-800 uppercase mb-1">
                Chuyển khoản
              </div>
              <div className="text-2xl font-black text-blue-950">
                {formatMoney(summary?.total?.transfer || 0)}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-200/50 text-blue-600">
              <CreditCardOutlined className="text-xl" />
            </div>
          </div>
        </Card>

        {/* TỔNG SỐ HÓA ĐƠN */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-purple-50 to-purple-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-purple-800 uppercase mb-1">
                Tổng số hóa đơn
              </div>
              <div className="text-2xl font-black text-purple-950">
                {summary?.total?.count || 0} <span className="text-base font-normal text-purple-700">đơn</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-200/50 text-purple-600">
              <FileTextOutlined className="text-xl" />
            </div>
          </div>
        </Card>

        {/* ONLINE */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-cyan-50 to-cyan-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-cyan-800 uppercase mb-1">
                Đặt trước (Online)
              </div>
              <div className="text-2xl font-black text-cyan-950">
                {formatMoney(summary?.booking?.amount || 0)}
              </div>
              <div className="text-xs text-cyan-700 mt-1">
                {summary?.booking?.count || 0} hóa đơn
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-200/50 text-cyan-600">
              <GlobalOutlined className="text-xl" />
            </div>
          </div>
        </Card>

        {/* POS */}
        <Card
          bodyStyle={{ padding: "16px 24px" }}
          className="rounded-2xl border-none shadow-sm transition-shadow hover:shadow-md bg-gradient-to-br from-rose-50 to-rose-100/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-rose-800 uppercase mb-1">
                Bán tại quầy (POS)
              </div>
              <div className="text-2xl font-black text-rose-950">
                {formatMoney(summary?.onsite?.amount || 0)}
              </div>
              <div className="text-xs text-rose-700 mt-1">
                {summary?.onsite?.count || 0} hóa đơn
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-200/50 text-rose-600">
              <ShopOutlined className="text-xl" />
            </div>
          </div>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="rounded-2xl shadow-sm border border-slate-100">
        {!showTable ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">
              Hệ thống không tải danh sách hóa đơn mặc định để tối ưu hiệu năng.<br/>
              Vui lòng sử dụng bộ lọc bên trên và bấm nút dưới đây để xem danh sách.
            </p>
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={handleShowInvoices}
              loading={loading}
              className="px-8 shadow-md"
            >
              Hiển thị lịch sử hóa đơn
            </Button>
          </div>
        ) : (
          <div>
            <div style={{ display: "none" }}>
              {printData && (
                <InvoicePrintTemplate
                  ref={printRef}
                  invoice={printData as any}
                  currentUserName={
                    printData.performed_by?.name
                      ? `${printData.performed_by.name} ${printData.performed_by.role === "owner" ? "(Owner)" : printData.performed_by.role === "employee" ? "(Nhân viên)" : ""}`
                      : "Hệ thống"
                  }
                  detailPayment={printData as any}
                />
              )}
            </div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Danh sách Hóa đơn</h3>
              <Button onClick={() => setShowTable(false)}>Ẩn bảng</Button>
            </div>
            <Table
              size="small"
              columns={columns}
              dataSource={invoices}
              loading={tableLoading}
              rowKey="payment_id"
              pagination={false}
              scroll={{ x: 1000, y: 600 }}
              expandable={{
                expandedRowRender: expandedInvoiceRender,
                rowExpandable: () => true,
                expandIconColumnIndex: columns.length,
                columnTitle: "Chi tiết",
              }}
            />
          </div>
        )}
      </Card>
    </MainLayout>
  );
}
