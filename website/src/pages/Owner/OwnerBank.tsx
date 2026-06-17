import { useCallback, useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Row, Col, AutoComplete, Image } from "antd";
import {
  BankOutlined,
  CreditCardOutlined,
  UserOutlined,
  SaveOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type OwnerBankDto = {
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  bank_bin: string | null;
  contact_info: string | null;
  qr_code: string | null;
};

const VIETNAMESE_BANKS = [
  { name: "Vietcombank (VCB)", bin: "970436", shortName: "Vietcombank" },
  { name: "VietinBank (CTG)", bin: "970415", shortName: "VietinBank" },
  { name: "BIDV", bin: "970418", shortName: "BIDV" },
  { name: "Agribank", bin: "970405", shortName: "Agribank" },
  { name: "Techcombank (TCB)", bin: "970407", shortName: "Techcombank" },
  { name: "MB Bank (MBB)", bin: "970422", shortName: "MB Bank" },
  { name: "ACB", bin: "970416", shortName: "ACB" },
  { name: "VPBank", bin: "970432", shortName: "VPBank" },
  { name: "TPBank", bin: "970423", shortName: "TPBank" },
  { name: "Sacombank", bin: "970403", shortName: "Sacombank" },
  { name: "VIB", bin: "970441", shortName: "VIB" },
  { name: "Eximbank", bin: "970431", shortName: "Eximbank" },
  { name: "SHB", bin: "970443", shortName: "SHB" },
  { name: "MSB", bin: "970426", shortName: "MSB" },
  { name: "HDBank", bin: "970437", shortName: "HDBank" },
  { name: "OCB", bin: "970448", riverName: "OCB", shortName: "OCB" },
  { name: "LPBank", bin: "970449", shortName: "LPBank" },
  { name: "SeABank", bin: "970440", shortName: "SeABank" },
  { name: "Nam A Bank", bin: "970428", shortName: "Nam A Bank" },
  { name: "PVcomBank", bin: "970412", shortName: "PVcomBank" },
  { name: "Bac A Bank", bin: "970409", shortName: "Bac A Bank" },
  { name: "Vietbank", bin: "970429", shortName: "Vietbank" },
];

const OwnerBank = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState<OwnerBankDto | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getBank();
      const data = (res?.data || null) as OwnerBankDto | null;
      setBank(data);
      form.setFieldsValue(data ? asRecord(data) : {});
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải ngân hàng"));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await ownerApi.updateBank(values);
      message.success("Đã cập nhật ngân hàng");
      await load();
    } catch (err: unknown) {
      const record = asRecord(err);
      if (Array.isArray(record.errorFields)) return;
      message.error(getErrorMessage(err, "Lỗi cập nhật ngân hàng"));
    } finally {
      setSaving(false);
    }
  };

  const bankOptions = VIETNAMESE_BANKS.map((b) => ({
    value: b.shortName,
    label: `${b.name} - BIN: ${b.bin}`,
    bin: b.bin,
  }));

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cấu hình ngân hàng</h2>
        <p className="text-gray-500">Thiết lập tài khoản nhận tiền thanh toán dịch vụ/vé từ khách hàng</p>
      </div>

      <Card
        loading={loading}
        style={{
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(99,102,241,0.08)",
          border: "1px solid #e8e8f2",
          overflow: "hidden",
        }}
      >
        <Row gutter={[32, 24]}>
          {/* Cột trái: Form */}
          <Col xs={24} lg={14}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Thiết lập tài khoản</span>
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} style={{ borderRadius: 8 }}>
                Lưu tài cài đặt
              </Button>
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Row gutter={16}>
                <Col xs={24} md={16}>
                  <Form.Item
                    name="bank_name"
                    label={<span style={{ fontWeight: 600 }}>Tên ngân hàng</span>}
                    rules={[{ required: true, message: "Chọn hoặc nhập tên ngân hàng" }]}
                  >
                    <AutoComplete
                      options={bankOptions}
                      filterOption={(inputValue, option) =>
                        option!.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                      onSelect={(_, option) => {
                        if (option && "bin" in option) {
                          form.setFieldsValue({ bank_bin: option.bin });
                        }
                      }}
                    >
                      <Input
                        prefix={<BankOutlined style={{ color: "#94a3b8" }} />}
                        placeholder="Chọn hoặc nhập tên ngân hàng"
                        size="large"
                        style={{ borderRadius: 8 }}
                      />
                    </AutoComplete>
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="bank_bin"
                    label={<span style={{ fontWeight: 600 }}>Mã BIN</span>}
                    tooltip="Mã định danh ngân hàng (Tự động điền khi chọn ngân hàng phía trước)"
                  >
                    <Input
                      prefix={<BankOutlined style={{ color: "#94a3b8" }} />}
                      placeholder="Mã BIN"
                      size="large"
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="bank_account"
                    label={<span style={{ fontWeight: 600 }}>Số tài khoản</span>}
                    rules={[{ required: true, message: "Nhập số tài khoản" }]}
                  >
                    <Input
                      prefix={<CreditCardOutlined style={{ color: "#94a3b8" }} />}
                      placeholder="Số tài khoản ngân hàng"
                      size="large"
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="account_holder"
                    label={<span style={{ fontWeight: 600 }}>Chủ tài khoản</span>}
                    rules={[{ required: true, message: "Nhập tên chủ tài khoản" }]}
                  >
                    <Input
                      prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                      placeholder="Chủ tài khoản (viết hoa không dấu)"
                      size="large"
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="contact_info"
                label={<span style={{ fontWeight: 600 }}>Thông tin liên hệ (tùy chọn)</span>}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="VD: Số điện thoại liên lạc, thông tin bổ sung khi đối soát..."
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            </Form>
          </Col>

          {/* Cột phải: Preview QR */}
          <Col xs={24} lg={10}>
            <div style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minHeight: "360px",
              justifyContent: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <QrcodeOutlined style={{ fontSize: 20, color: "#6366f1" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", letterSpacing: 0.5 }}>MÃ QR VIETQR CỦA BẠN</span>
              </div>

              {bank?.qr_code ? (
                <>
                  <div style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: 8,
                    border: "1px solid #e2e8f0",
                    marginBottom: 20,
                  }}>
                    <Image
                      src={String(bank.qr_code)}
                      alt="VietQR"
                      width={260}
                      height={260}
                      style={{ objectFit: "contain" }}
                      preview={{ mask: "Phóng to" }}
                    />
                  </div>

                  <div style={{ width: "100%", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ color: "#64748b", fontSize: 14 }}>Ngân hàng</span>
                      <span style={{ fontWeight: 600, fontSize: 16, color: "#1e293b" }}>{bank.bank_name || "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ color: "#64748b", fontSize: 14 }}>Số tài khoản</span>
                      <span style={{ fontWeight: 700, fontSize: 18, fontFamily: "monospace", color: "#1e293b" }}>{bank.bank_account || "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontSize: 14 }}>Chủ tài khoản</span>
                      <span style={{ fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: "#1e293b" }}>{bank.account_holder || "—"}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  height: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  textAlign: "center",
                  padding: 16,
                }}>
                  Chưa có mã QR.<br />Điền thông tin tài khoản và bấm "Lưu cài đặt" để tạo QR tự động.
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </MainLayout>
  );
};

export default OwnerBank;
