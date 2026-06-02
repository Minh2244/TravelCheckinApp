import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Image,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";
import { getErrorMessage } from "../../utils/safe";

type CommissionRow = {
  commission_id: number;
  location_name?: string | null;
  commission_amount?: number | string | null;
  vat_amount?: number | string | null;
  total_due?: number | string | null;
  due_date?: string | null;
  status?: string | null;
};

type AdminBankInfo = {
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  qr_code?: string | null;
};

const OwnerCommissions = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CommissionRow[]>([]);
  const [adminBank, setAdminBank] = useState<AdminBankInfo | null>(null);
  const [adminBankLoading, setAdminBankLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getCommissions({});
      setItems((res?.data || []) as CommissionRow[]);
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
    setAdminBankLoading(true);
    try {
      const res = await ownerApi.getAdminBankInfo();
      setAdminBank((res?.data || null) as AdminBankInfo | null);
    } catch (err: unknown) {
      setAdminBank(null);
      message.error(getErrorMessage(err, "Lỗi tải ngân hàng admin"));
    } finally {
      setAdminBankLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminBank();
  }, [loadAdminBank]);

  const columns: ColumnsType<CommissionRow> = useMemo(
    () => [
      { title: "#", dataIndex: "commission_id", width: 90 },
      { title: "Địa điểm", dataIndex: "location_name" },
      {
        title: "Hoa hồng",
        dataIndex: "commission_amount",
        render: (v: unknown) => formatMoney(Number(v || 0)),
      },
      {
        title: "VAT",
        dataIndex: "vat_amount",
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

  const unpaidItems = useMemo(
    () => items.filter((x) => String(x?.status || "") !== "paid"),
    [items],
  );
  const unpaidTotal = useMemo(() => {
    return unpaidItems.reduce((sum, x) => sum + Number(x?.total_due || 0), 0);
  }, [unpaidItems]);

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
            Modal.info({
              title: "Đã tạo yêu cầu thanh toán",
              content: (
                <div className="space-y-2">
                  <div>
                    Mã yêu cầu: <b>{res?.data?.request_id}</b>
                  </div>
                  <div>
                    Nội dung chuyển khoản: <b>{res?.data?.transfer_note}</b>
                  </div>
                  <div className="text-sm text-gray-500">
                    Admin sẽ xác nhận sau khi nhận được tiền.
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
        <Card
          title="Ngân hàng Admin (để chuyển khoản hoa hồng/VAT)"
          loading={adminBankLoading}
          className="rounded-2xl"
        >
          {adminBank?.bank_name ||
          adminBank?.bank_account ||
          adminBank?.bank_holder ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: "bank_name",
                      label: "Ngân hàng",
                      children: adminBank?.bank_name || "—",
                    },
                    {
                      key: "bank_account",
                      label: "Số tài khoản",
                      children: (
                        <span className="text-base font-semibold">
                          {adminBank?.bank_account || "—"}
                        </span>
                      ),
                    },
                    {
                      key: "bank_holder",
                      label: "Chủ tài khoản",
                      children: adminBank?.bank_holder || "—",
                    },
                  ]}
                />
                <div className="text-sm text-gray-500">
                  Chuyển khoản đúng thông tin và ghi đúng nội dung chuyển khoản
                  theo mã yêu cầu.
                </div>
              </div>

              {adminBank?.qr_code ? (
                <div className="flex items-start justify-center">
                  <div className="rounded-2xl border bg-white p-3">
                    <Image
                      width={260}
                      src={adminBank.qr_code}
                      alt="VietQR admin"
                      preview
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border bg-slate-50 p-6 text-sm text-gray-500">
                  Admin chưa cấu hình đủ thông tin để tạo QR.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-gray-500">
              Admin chưa cấu hình ngân hàng.
            </div>
          )}
        </Card>

        <Card
          title="Hoa hồng (Admin đối soát)"
          loading={loading}
          className="rounded-2xl"
        >
          <div className="mb-3 rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500">Tổng cần thanh toán</div>
                <div className="text-2xl font-bold">
                  {formatMoney(unpaidTotal)}
                </div>
              </div>
              <Space>
                <Button
                  type="primary"
                  onClick={createPaymentRequest}
                  loading={requesting}
                  disabled={unpaidItems.length === 0}
                >
                  Thanh toán tất cả
                </Button>
              </Space>
            </div>
          </div>
          <Table rowKey="commission_id" dataSource={items} columns={columns} />
        </Card>
      </div>
    </MainLayout>
  );
};

export default OwnerCommissions;
