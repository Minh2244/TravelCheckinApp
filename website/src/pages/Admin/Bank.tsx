import { useCallback, useEffect, useState } from "react";
import { Button, Card, Divider, Form, Image, Input, message } from "antd";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { asRecord, getErrorMessage } from "../../utils/safe";

type AdminBankDto = {
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  bank_bin: string | null;
  contact_info: string | null;
  qr_code: string | null;
};

const AdminBank = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState<AdminBankDto | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAdminBank();
      const data = (res?.data || null) as AdminBankDto | null;
      setBank(data);
      form.setFieldsValue({
        bank_name: data?.bank_name ?? "",
        bank_account: data?.bank_account ?? "",
        bank_holder: data?.bank_holder ?? "",
        bank_bin: data?.bank_bin ?? "",
        contact_info: data?.contact_info ?? "",
      });
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải ngân hàng admin"));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    try {
      const values = (await form.validateFields()) as {
        bank_name: string;
        bank_account: string;
        bank_holder: string;
        bank_bin?: string;
        contact_info?: string;
      };

      setSaving(true);
      await adminApi.updateAdminBank(values);
      message.success("Đã cập nhật ngân hàng admin");
      await load();
    } catch (err: unknown) {
      const record = asRecord(err);
      if (Array.isArray(record.errorFields)) return;
      message.error(getErrorMessage(err, "Lỗi cập nhật ngân hàng admin"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <Card
        title="Ngân hàng Admin"
        loading={loading}
        extra={
          <Button type="primary" onClick={onSave} loading={saving}>
            Lưu
          </Button>
        }
      >
        <div className="text-sm text-gray-600 mb-3">
          Owner sẽ chuyển hoa hồng/VAT về tài khoản này.
        </div>

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
            name="bank_holder"
            label="Chủ tài khoản"
            rules={[{ required: true, message: "Nhập tên chủ tài khoản" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="contact_info" label="Thông tin liên hệ (tùy chọn)">
            <Input.TextArea
              rows={3}
              placeholder="VD: Zalo/SĐT hỗ trợ đối soát"
            />
          </Form.Item>
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
                  preview={{ mask: "Phóng to" }}
                />
              </div>

              <div className="text-sm text-gray-700">
                <div>
                  <strong>Ngân hàng:</strong> {bank.bank_name || "-"}
                </div>
                <div>
                  <strong>Số TK:</strong> {bank.bank_account || "-"}
                </div>
                <div>
                  <strong>Chủ TK:</strong> {bank.bank_holder || "-"}
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

export default AdminBank;
