import { useCallback, useEffect, useState } from "react";
import { Card, Table, message } from "antd";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";

type AuditLogRow = {
  log_id: number;
  created_at?: string | null;
  action?: string | null;
  details?: string | null;
};

const OwnerLogs = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditLogRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getAuditLogs(200);
      setItems((res?.data || []) as AuditLogRow[]);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải nhật ký"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MainLayout>
      <Card title="Nhật ký thao tác" loading={loading}>
        <Table
          rowKey="log_id"
          dataSource={items}
          pagination={false}
          scroll={{ y: 620 }}
          columns={[
            {
              title: "Thời gian",
              dataIndex: "created_at",
              width: 180,
              render: (v: unknown) => (v ? formatDateTimeVi(String(v)) : "-"),
            },
            { title: "Action", dataIndex: "action", width: 240 },
            { title: "Details", dataIndex: "details" },
          ]}
        />
      </Card>
    </MainLayout>
  );
};

export default OwnerLogs;
