import React, { useState, useEffect } from 'react';
import { Modal, Form, Radio, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';
import ownerApi from '../api/ownerApi';

type LocationRow = {
  location_id: number;
  location_name: string;
  status: string;
  location_type: string;
  temp_close_type?: string | null;
  temp_close_until?: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  locations: LocationRow[];
  onSuccess: () => void;
}

const OwnerTempCloseModal: React.FC<Props> = ({ open, onClose, locations, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'close' | 'open'>('close');
  const [closeType, setCloseType] = useState<'manual' | 'scheduled'>('manual');

  const handleActionTypeChange = (val: 'close' | 'open') => {
    setActionType(val);
    form.setFieldsValue({ locationIds: [] });
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
      setActionType('close');
      setCloseType('manual');
    }
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (actionType === 'close') {
        let closeUntil = null;
        if (values.closeType === 'scheduled') {
          if (!values.closeUntil) {
            message.error('Vui lòng chọn ngày giờ mở lại');
            setLoading(false);
            return;
          }
          closeUntil = values.closeUntil.format('YYYY-MM-DD HH:mm:ss');
        }

        const res = await (ownerApi as any).tempCloseLocations({
          locationIds: values.locationIds,
          closeType: values.closeType,
          closeUntil
        });
        if (res?.success) {
          message.success('Đã tạm thời đóng cửa địa điểm');
          onSuccess();
          onClose();
        } else {
          message.error(res?.message || 'Đóng cửa thất bại');
        }
      } else {
        const res = await (ownerApi as any).tempOpenLocations({
          locationIds: values.locationIds
        });
        if (res?.success) {
          message.success('Đã mở cửa địa điểm trở lại');
          onSuccess();
          onClose();
        } else {
          message.error(res?.message || 'Mở cửa thất bại');
        }
      }
    } catch (e: any) {
      if (e.errorFields) return; // Validation failed
      message.error(e?.response?.data?.message || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Đóng / Mở cửa tạm thời"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText="Xác nhận"
      cancelText="Hủy"
      width={500}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ actionType: 'close', closeType: 'manual' }}>
        <Form.Item name="actionType" label="Hành động">
          <Radio.Group onChange={(e) => handleActionTypeChange(e.target.value)} buttonStyle="solid">
            <Radio.Button value="close">Đóng cửa</Radio.Button>
            <Radio.Button value="open">Mở lại</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item 
          name="locationIds" 
          label="Chọn địa điểm"
          rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 địa điểm' }]}
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="Chọn các địa điểm"
            options={locations
              .filter(l => actionType === 'close' ? !l.temp_close_type : !!l.temp_close_type)
              .map(l => ({ label: l.location_name, value: l.location_id }))}
          />
        </Form.Item>

        {actionType === 'close' && (
          <Form.Item name="closeType" label="Loại đóng cửa">
            <Radio.Group onChange={(e) => setCloseType(e.target.value)}>
              <Radio value="manual">Đóng vô thời hạn (Tự mở lại)</Radio>
              <Radio value="scheduled">Đóng có hẹn giờ</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {actionType === 'close' && closeType === 'scheduled' && (
          <Form.Item 
            name="closeUntil" 
            label="Ngày giờ mở lại"
            rules={[{ required: true, message: 'Vui lòng chọn ngày giờ mở lại' }]}
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm" 
              className="w-full"
              disabledDate={(current) => current && current < dayjs().endOf('day').subtract(1, 'day')}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default OwnerTempCloseModal;
