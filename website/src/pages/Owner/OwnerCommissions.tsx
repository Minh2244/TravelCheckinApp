import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Image,
  Input,
  Modal,
  Table,
  DatePicker,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import { getErrorMessage } from "../../utils/safe";

type CommissionRow = {
  commission_id: number;
  billing_period?: string | null;
  commission_amount?: number | string | null;
  vat_amount?: number | string | null;
  total_due?: number | string | null;
  due_date?: string | null;
  status?: string | null;
};

type PendingPaymentRow = {
  payment_id: number;
  amount: number;
  commission_amount: number;
  vat_amount: number;
  payment_time: string;
  booking_id?: number;
  location_name: string;
};

type AdminBankInfo = {
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  bank_bin?: string | null;
  qr_code?: string | null;
};

const OwnerCommissions = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CommissionRow[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingPaymentRow[]>([]);
  const [adminBank, setAdminBank] = useState<AdminBankInfo | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [filterMonth, setFilterMonth] = useState<dayjs.Dayjs | null>(() => {
    const now = dayjs();
    return now.date() >= 15 ? now : now.subtract(1, 'month');
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, pendingRes] = await Promise.all([
        ownerApi.getCommissions({}),
        ownerApi.getPendingCommissionPayments()
      ]);
      setItems((res?.data || []) as CommissionRow[]);
      setPendingItems((pendingRes?.data || []) as PendingPaymentRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải commissions"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAdminBank = useCallback(async () => {
    try {
      const res = await ownerApi.getAdminBankInfo();
      setAdminBank((res?.data || null) as AdminBankInfo | null);
    } catch (err: unknown) {
      setAdminBank(null);
      message.error(getErrorMessage(err, "Lỗi tải ngân hàng admin"));
    }
  }, []);

  useEffect(() => {
    void loadAdminBank();
  }, [loadAdminBank]);

  const columns: ColumnsType<CommissionRow> = useMemo(
    () => [
      { title: "#", dataIndex: "commission_id", width: 90 },
      { title: "Kỳ đối soát", dataIndex: "billing_period" },
      {
        title: "Hoa hồng",
        dataIndex: "commission_amount",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "Tổng phải trả",
        dataIndex: "total_due",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      { title: "Hạn", dataIndex: "due_date" },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (s: string) => (
          <Tag
            color={s === "paid" ? "green" : s === "pending" ? "orange" : "red"}
          >
            {statusToVi(s)}
          </Tag>
        ),
      },
    ],
    [],
  );

  const filteredPendingItems = useMemo(() => {
    if (!filterMonth) return pendingItems;
    const y = filterMonth.year();
    const m = filterMonth.month(); // 0-11
    const start = new Date(y, m, 15, 0, 0, 0).getTime();
    const end = new Date(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 14, 23, 59, 59).getTime();
    return pendingItems.filter((item) => {
      const t = new Date(item.payment_time).getTime();
      return t >= start && t <= end;
    });
  }, [pendingItems, filterMonth]);

  const unpaidItems = useMemo(
    () => items.filter((x) => String(x?.status || "") !== "paid"),
    [items],
  );
  const unpaidTotal = useMemo(() => {
    return unpaidItems.reduce((sum, x) => sum + Number(x?.total_due || 0), 0);
  }, [unpaidItems]);

  const pendingTotal = useMemo(() => {
    return pendingItems.reduce((sum, x) => sum + Number(x.commission_amount || 0), 0);
  }, [pendingItems]);

  const earliestDueDate = useMemo(() => {
    if (unpaidItems.length === 0) return null;
    let earliest = new Date(unpaidItems[0].due_date || "");
    for (const item of unpaidItems) {
      const d = new Date(item.due_date || "");
      if (d < earliest) earliest = d;
    }
    return earliest;
  }, [unpaidItems]);

  const daysRemaining = useMemo(() => {
    if (!earliestDueDate || isNaN(earliestDueDate.getTime())) return null;
    const now = new Date();
    const diff = new Date(earliestDueDate.getFullYear(), earliestDueDate.getMonth(), earliestDueDate.getDate()).getTime() - 
                 new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round(diff / (1000 * 3600 * 24));
  }, [earliestDueDate]);

  const createPaymentRequest = () => {
    if (unpaidItems.length === 0) {
      message.info("Bạn không có khoản cần thanh toán.");
      return;
    }

    let noteDraft = "";

    Modal.confirm({
      title: "Tạo yêu cầu thanh toán hoa hồng/VAT",
      content: (
        <div className="space-y-2">
          <div>
            Tổng cần thanh toán: <b>{formatMoney(unpaidTotal)}</b>
          </div>
          <div className="text-sm text-gray-500">
            Sau khi tạo yêu cầu, bạn chuyển khoản theo thông tin ngân hàng Admin
            và ghi đúng nội dung chuyển khoản.
          </div>
          <Input.TextArea
            placeholder="Ghi chú cho Admin (tuỳ chọn)"
            rows={3}
            onChange={(e) => {
              noteDraft = e.target.value;
            }}
          />
        </div>
      ),
      okText: "Tạo yêu cầu",
      cancelText: "Hủy",
      okButtonProps: { loading: requesting },
      onOk: async () => {
        try {
          setRequesting(true);
          const res = await ownerApi.createCommissionPaymentRequest({
            note: noteDraft?.trim() || undefined,
          });
          if (res?.success) {
            const transferNote = res?.data?.transfer_note;
            const qrUrl = adminBank?.bank_bin && adminBank?.bank_account
              ? `https://img.vietqr.io/image/${adminBank.bank_bin}-${adminBank.bank_account}-compact.png?amount=${unpaidTotal}&addInfo=${encodeURIComponent(transferNote)}&accountName=${encodeURIComponent(adminBank.bank_holder || "Admin")}`
              : null;

            Modal.info({
              title: "Đã tạo yêu cầu thanh toán",
              width: 400,
              content: (
                <div className="space-y-4">
                  {qrUrl ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border bg-slate-50 p-4 mt-2">
                      <Image src={qrUrl} alt="VietQR" width={220} preview={false} />
                      <div className="mt-2 text-center text-xs text-gray-500">Quét mã để thanh toán nhanh</div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-500">Mã yêu cầu:</span>
                      <span className="font-semibold">{res?.data?.request_id}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-500">Tổng tiền:</span>
                      <span className="font-semibold text-blue-600">{formatMoney(unpaidTotal)}</span>
                    </div>
                    <div className="flex flex-col pt-1">
                      <span className="text-gray-500 mb-1">Nội dung chuyển khoản:</span>
                      <span className="rounded bg-yellow-100 px-2 py-1 font-mono text-sm font-semibold">{transferNote}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 italic">
                      Admin sẽ xác nhận sau khi nhận được tiền.
                    </div>
                  </div>
                </div>
              ),
            });
            void load();
          } else {
            message.error(res?.message || "Không tạo được yêu cầu");
          }
        } catch (err: unknown) {
          message.error(getErrorMessage(err, "Lỗi tạo yêu cầu"));
        } finally {
          setRequesting(false);
        }
      },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={`rounded-2xl text-white shadow-md border-none ${unpaidTotal > 0 ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
            <div className="flex flex-col h-full justify-between gap-4">
              <div>
                <div className="text-white/90 text-sm font-medium mb-1">Tổng tiền cần thanh toán (Đã chốt)</div>
                <div className="text-3xl font-bold">{formatMoney(unpaidTotal)}</div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-2 mt-2">
                {earliestDueDate && (
                  <div className="bg-white/20 rounded-xl p-2 px-3 backdrop-blur-sm">
                    <div className="text-white/90 text-xs mb-1">Hạn thanh toán gần nhất</div>
                    <div className="text-lg font-bold">
                      {daysRemaining !== null && daysRemaining < 0 
                        ? `Quá hạn ${Math.abs(daysRemaining)} ngày` 
                        : daysRemaining !== null && daysRemaining === 0 
                        ? "Hết hạn hôm nay" 
                        : `Còn ${daysRemaining} ngày`}
                    </div>
                  </div>
                )}
                <Button
                  size="large"
                  className={`border-none font-semibold shadow-sm ml-auto ${unpaidTotal > 0 ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-white/40 text-white/80 hover:bg-white/40 cursor-not-allowed'}`}
                  onClick={createPaymentRequest}
                  loading={requesting}
                  disabled={unpaidTotal <= 0}
                >
                  Thanh toán tất cả
                </Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md border-none">
            <div className="flex flex-col h-full justify-between gap-4">
              <div>
                <div className="text-blue-100 text-sm font-medium mb-1">Tổng tạm tính (Chưa chốt)</div>
                <div className="text-3xl font-bold">{formatMoney(pendingTotal)}</div>
              </div>
              <div className="mt-auto pt-2">
                <div className="text-blue-100 text-sm opacity-80">
                  Số tiền này dự kiến sẽ chốt vào kỳ kế tiếp (Ngày 15 hàng tháng).
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card
          title="Chi tiết các khoản hoa hồng đã chốt"
          loading={loading}
          className="rounded-2xl"
        >
          <Table rowKey="commission_id" dataSource={items} columns={columns} />
        </Card>

        <Card
          title={
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span>Các giao dịch phát sinh chờ kết toán</span>
              <DatePicker.MonthPicker
                value={filterMonth}
                onChange={setFilterMonth}
                format="MM/YYYY"
                placeholder="Chọn kỳ đối soát"
                allowClear
              />
            </div>
          }
          loading={loading}
          className="rounded-2xl border border-indigo-100"
          headStyle={{ backgroundColor: '#f5f7ff', borderBottom: '1px solid #e0e7ff', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        >
          <div className="mb-4 text-sm text-gray-500">
            Các khoản này sẽ được hệ thống tự động gom lại và chốt vào 0h00 ngày 15 hàng tháng. 
            Đang hiển thị {filteredPendingItems.length} giao dịch.
          </div>
          
          <div className="max-h-[500px] overflow-y-auto pr-3 py-2">
            {filteredPendingItems.length === 0 ? (
              <div className="py-8 text-center text-gray-400">Không có dữ liệu</div>
            ) : (
              filteredPendingItems.map((item, index) => (
                <div key={item.payment_id} className="bg-white mb-3 border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow mr-1">
                  <div className="flex flex-col md:flex-row w-full gap-4 items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
                      {filteredPendingItems.length - index}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 text-base">{item.location_name}</span>
                        <Tag color="blue" className="m-0">Mã GD: #{item.payment_id}</Tag>
                      </div>
                      <div className="text-gray-500 text-sm">
                        {new Date(item.payment_time).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Giá trị GD</div>
                        <div className="font-medium">{formatMoney(Number(item.amount || 0))}</div>
                      </div>
                      <div className="text-right border-l pl-4 border-gray-100">
                        <div className="text-xs text-gray-400">Hoa hồng</div>
                        <div className="font-medium text-orange-600">
                          {formatMoney(Number(item.commission_amount || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default OwnerCommissions;
