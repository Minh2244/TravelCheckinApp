import { useCallback, useEffect, useState } from "react";
import { Card, Form, Input, Button, message, Divider, Image } from "antd";
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

  return (
    <MainLayout>
      <Card title="Thiết lập ngân hàng" loading={loading}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="bank_name"
            label="Ngân hàng"
            rules={[{ required: true, message: "Nhập tên ngân hàng" }]}
          >
            <Input placeholder="VD: Vietcombank" />
          </Form.Item>
          <Form.Item
            name="bank_account"
            label="Số tài khoản"
            rules={[{ required: true, message: "Nhập số tài khoản" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="bank_bin"
            label="Mã BIN (tùy chọn)"
            tooltip="Một số ngân hàng cần mã BIN để tạo QR VietQR. Ví dụ Vietcombank: 970436"
          >
            <Input placeholder="VD: 970436" />
          </Form.Item>
          <Form.Item
            name="account_holder"
            label="Chủ tài khoản"
            rules={[{ required: true, message: "Nhập tên chủ tài khoản" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="contact_info" label="Thông tin liên hệ (tùy chọn)">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Button type="primary" onClick={onSave} loading={saving}>
            Lưu
          </Button>
        </Form>

        <Divider />

        <div>
          <div className="font-medium">Mã QR chuyển khoản</div>
          <div className="text-xs text-gray-500 mb-3">
            Sau khi lưu thông tin ngân hàng, hệ thống sẽ tạo QR.
          </div>
          {bank?.qr_code ? (
            <div className="flex flex-wrap items-start gap-6">
              <div className="rounded-lg border p-3 bg-white">
                <Image
                  src={String(bank.qr_code)}
                  alt="VietQR"
                  width={220}
                  height={220}
                  style={{ objectFit: "contain" }}
                  preview={{
                    mask: "Phóng to",
                  }}
                />
              </div>
              <div className="text-sm text-gray-700">
                <div>
                  <strong>Ngân hàng:</strong> {bank.bank_name}
                </div>
                <div>
                  <strong>Số TK:</strong> {bank.bank_account}
                </div>
                <div>
                  <strong>Chủ TK:</strong> {bank.account_holder}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Bấm vào mã QR để phóng to.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Chưa có QR. Hãy nhập thông tin và bấm Lưu.
            </div>
          )}
        </div>
      </Card>
    </MainLayout>
  );
};

export default OwnerBank;
