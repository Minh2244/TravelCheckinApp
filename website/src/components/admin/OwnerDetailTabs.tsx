import { useEffect, useMemo, useState } from "react";
import { Table, Tabs, Tag, message } from "antd";
import type { TabsProps } from "antd";
import type { ColumnsType } from "antd/es/table";

import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { statusToVi } from "../../utils/statusText";

type OwnerLike = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  status?: string;
  is_verified?: number;
};

type OwnerLocationRow = {
  location_id: number;
  location_name?: string;
  address?: string | null;
  province?: string | null;
  status?: string;
  created_at?: string | null;
};

type OwnerEmployeeAssignmentRow = {
  user_id: number;
  full_name: string;
  phone: string | null;
  role: string;
  location_id: number;
  location_name: string;
  position: string | null;
  assignment_status: string;
};

type OwnerServiceRow = {
  service_id: number;
  service_name: string;
  service_type: string;
  price: number | string;
  quantity: number | string | null;
  unit: string | null;
  status: string;
  admin_status: string;
  created_at?: string | null;
  location_name?: string | null;
};

type CommissionRow = {
  commission_id: number;
  due_date: string;
  status: string;
  commission_amount?: number | string;
  vat_amount?: number | string;
  total_due?: number | string;
  paid_amount?: number | string;
  payment_amount?: number | string;
};

const statusColor = (status: string) => {
  if (status === "active") return "green";
  if (status === "locked") return "red";
  if (status === "pending") return "orange";
  return "default";
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const toNumberOrZero = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

export type OwnerDetailTabsProps = {
  owner: OwnerLike;
  infoExtra?: React.ReactNode;
  extraTabs?: TabsProps["items"];
};

export default function OwnerDetailTabs({
  owner,
  infoExtra,
  extraTabs,
}: OwnerDetailTabsProps) {
  const ownerId = owner.user_id;

  const extraTabItems = (extraTabs ?? []) as Exclude<
    TabsProps["items"],
    undefined
  >;

  const [activeKey, setActiveKey] = useState("info");

  const [ownerLocations, setOwnerLocations] = useState<OwnerLocationRow[]>([]);
  const [ownerLocationsLoading, setOwnerLocationsLoading] = useState(false);

  const [ownerEmployees, setOwnerEmployees] = useState<
    OwnerEmployeeAssignmentRow[]
  >([]);
  const [ownerEmployeesLoading, setOwnerEmployeesLoading] = useState(false);

  const [ownerServices, setOwnerServices] = useState<OwnerServiceRow[]>([]);
  const [ownerServicesLoading, setOwnerServicesLoading] = useState(false);
  const [ownerServicesPagination, setOwnerServicesPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [ownerPaidCommissions, setOwnerPaidCommissions] = useState<
    CommissionRow[]
  >([]);
  const [ownerPaidCommissionsLoading, setOwnerPaidCommissionsLoading] =
    useState(false);
  const [ownerPaidCommissionsPagination, setOwnerPaidCommissionsPagination] =
    useState({
      current: 1,
      pageSize: 10,
      total: 0,
    });

  const fetchOwnerLocations = async (id: number) => {
    try {
      setOwnerLocationsLoading(true);
      const resp = await adminApi.getOwnerLocations(id);
      if (resp?.success) {
        setOwnerLocations((resp.data || []) as OwnerLocationRow[]);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách địa điểm"));
    } finally {
      setOwnerLocationsLoading(false);
    }
  };

  const fetchOwnerEmployees = async (id: number) => {
    try {
      setOwnerEmployeesLoading(true);
      const resp = await adminApi.getOwnerEmployees(id);
      if (resp?.success) {
        setOwnerEmployees((resp.data || []) as OwnerEmployeeAssignmentRow[]);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách employees"));
    } finally {
      setOwnerEmployeesLoading(false);
    }
  };

  const fetchOwnerServices = async (
    id: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setOwnerServicesLoading(true);
      const resp = await adminApi.getOwnerServices({
        owner_ids: String(id),
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setOwnerServices((resp.data || []) as OwnerServiceRow[]);
        setOwnerServicesPagination((p) => ({
          ...p,
          current: resp.pagination?.page ?? page,
          pageSize: resp.pagination?.limit ?? pageSize,
          total: resp.pagination?.total ?? 0,
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi tải danh sách dịch vụ"));
    } finally {
      setOwnerServicesLoading(false);
    }
  };

  const fetchOwnerPaidCommissions = async (
    id: number,
    page: number,
    pageSize: number,
  ) => {
    try {
      setOwnerPaidCommissionsLoading(true);
      const resp = await adminApi.getCommissions({
        owner_id: id,
        status: "paid",
        page,
        limit: pageSize,
      });
      if (resp?.success) {
        setOwnerPaidCommissions((resp.data || []) as CommissionRow[]);
        setOwnerPaidCommissionsPagination((p) => ({
          ...p,
          current: resp.pagination?.page ?? page,
          pageSize: resp.pagination?.limit ?? pageSize,
          total: resp.pagination?.total ?? 0,
        }));
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error, "Lỗi tải danh sách hoa hồng đã chi trả"),
      );
    } finally {
      setOwnerPaidCommissionsLoading(false);
    }
  };

  useEffect(() => {
    setActiveKey("info");
    setOwnerLocations([]);
    setOwnerEmployees([]);
    setOwnerServices([]);
    setOwnerPaidCommissions([]);

    setOwnerServicesPagination((p) => ({ ...p, current: 1, total: 0 }));
    setOwnerPaidCommissionsPagination((p) => ({ ...p, current: 1, total: 0 }));

    fetchOwnerLocations(ownerId);
    fetchOwnerEmployees(ownerId);
    fetchOwnerServices(ownerId, 1, ownerServicesPagination.pageSize);
    fetchOwnerPaidCommissions(
      ownerId,
      1,
      ownerPaidCommissionsPagination.pageSize,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const locationColumns = useMemo(() => {
    return [
      {
        title: "ID",
        dataIndex: "location_id",
        key: "location_id",
        width: 80,
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        key: "location_name",
        render: (v: string | undefined) => v || "-",
      },
      {
        title: "Tỉnh",
        dataIndex: "province",
        key: "province",
        width: 160,
        render: (v: string | null | undefined) => v || "-",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (v: string | undefined) => (
          <Tag color={statusColor(String(v || ""))}>{statusToVi(v || "-")}</Tag>
        ),
      },
    ] as ColumnsType<OwnerLocationRow>;
  }, []);

  const serviceColumns = useMemo(() => {
    return [
      {
        title: "ID",
        dataIndex: "service_id",
        key: "service_id",
        width: 80,
      },
      {
        title: "Dịch vụ",
        dataIndex: "service_name",
        key: "service_name",
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        key: "location_name",
        width: 200,
        render: (v: string | null | undefined) => v || "-",
      },
      {
        title: "Loại",
        dataIndex: "service_type",
        key: "service_type",
        width: 120,
        render: (v: string) => v || "-",
      },
      {
        title: "Giá",
        dataIndex: "price",
        key: "price",
        width: 140,
        align: "right",
        render: (v: number | string) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatMoney(toNumberOrZero(v))}
          </span>
        ),
      },
      {
        title: "Đơn vị",
        dataIndex: "unit",
        key: "unit",
        width: 120,
        render: (v: string | null) => v || "-",
      },
      {
        title: "Duyệt",
        dataIndex: "admin_status",
        key: "admin_status",
        width: 120,
        render: (v: string) => <Tag>{statusToVi(v)}</Tag>,
      },
    ] as ColumnsType<OwnerServiceRow>;
  }, []);

  const commissionsColumns = useMemo(() => {
    return [
      {
        title: "Mã",
        dataIndex: "commission_id",
        key: "commission_id",
        width: 90,
      },
      {
        title: "Ngày",
        dataIndex: "due_date",
        key: "due_date",
        width: 140,
        render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
      },
      {
        title: "Tổng phải thu",
        dataIndex: "total_due",
        key: "total_due",
        width: 160,
        align: "right",
        render: (v: number | string) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatMoney(toNumberOrZero(v))}
          </span>
        ),
      },
      {
        title: "Đã trả",
        dataIndex: "paid_amount",
        key: "paid_amount",
        width: 140,
        align: "right",
        render: (v: number | string) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatMoney(toNumberOrZero(v))}
          </span>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (v: string) => <Tag>{statusToVi(v)}</Tag>,
      },
    ] as ColumnsType<CommissionRow>;
  }, []);

  const employeeColumns = useMemo(() => {
    return [
      {
        title: "Họ tên",
        dataIndex: "full_name",
        key: "full_name",
      },
      {
        title: "SĐT",
        dataIndex: "phone",
        key: "phone",
        width: 130,
        render: (v: string | null) => v || "-",
      },
      {
        title: "Vai trò",
        dataIndex: "role",
        key: "role",
        width: 120,
        render: (v: string) => v || "-",
      },
      {
        title: "Địa điểm",
        dataIndex: "location_name",
        key: "location_name",
      },
      {
        title: "Chức vụ",
        dataIndex: "position",
        key: "position",
        width: 140,
        render: (v: string | null) => v || "-",
      },
      {
        title: "Trạng thái",
        dataIndex: "assignment_status",
        key: "assignment_status",
        width: 140,
        render: (v: string) => <Tag>{statusToVi(v)}</Tag>,
      },
    ] as ColumnsType<OwnerEmployeeAssignmentRow>;
  }, []);

  const items: TabsProps["items"] = [
    {
      key: "info",
      label: "Thông tin",
      children: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Họ tên:</strong> {owner.full_name}
            </div>
            <div>
              <strong>Email:</strong> {owner.email}
            </div>
            <div>
              <strong>Số điện thoại:</strong> {owner.phone || "-"}
            </div>
            <div>
              <strong>Trạng thái:</strong>{" "}
              <Tag color={statusColor(String(owner.status || ""))}>
                {statusToVi(String(owner.status || "-"))}
              </Tag>
            </div>
            <div>
              <strong>Vai trò:</strong> owner
            </div>
            {typeof owner.is_verified === "number" ? (
              <div>
                <strong>Xác thực:</strong>{" "}
                <Tag color={owner.is_verified ? "green" : "default"}>
                  {owner.is_verified ? "Đã xác thực" : "Chưa"}
                </Tag>
              </div>
            ) : null}
          </div>

          {infoExtra ? <div>{infoExtra}</div> : null}
        </div>
      ),
    },
    {
      key: "owner_locations",
      label: "Địa điểm đăng kí",
      children: (
        <Table
          size="small"
          rowKey="location_id"
          loading={ownerLocationsLoading}
          dataSource={ownerLocations}
          columns={locationColumns}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `Tổng ${total} địa điểm`,
          }}
        />
      ),
    },
    {
      key: "owner_services",
      label: "Dịch vụ đăng kí",
      children: (
        <Table
          size="small"
          rowKey="service_id"
          loading={ownerServicesLoading}
          dataSource={ownerServices}
          columns={serviceColumns}
          pagination={{
            current: ownerServicesPagination.current,
            pageSize: ownerServicesPagination.pageSize,
            total: ownerServicesPagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} dịch vụ`,
            onChange: (page, pageSize) => {
              fetchOwnerServices(
                ownerId,
                page,
                pageSize || ownerServicesPagination.pageSize,
              );
            },
          }}
        />
      ),
    },
    {
      key: "owner_commissions_paid",
      label: "Hoa hồng đã chi trả",
      children: (
        <Table
          size="small"
          rowKey="commission_id"
          loading={ownerPaidCommissionsLoading}
          dataSource={ownerPaidCommissions}
          columns={commissionsColumns}
          pagination={{
            current: ownerPaidCommissionsPagination.current,
            pageSize: ownerPaidCommissionsPagination.pageSize,
            total: ownerPaidCommissionsPagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} dòng`,
            onChange: (page, pageSize) => {
              fetchOwnerPaidCommissions(
                ownerId,
                page,
                pageSize || ownerPaidCommissionsPagination.pageSize,
              );
            },
          }}
        />
      ),
    },
    {
      key: "owner_employees",
      label: "Danh sách Employees",
      children: (
        <Table
          size="small"
          rowKey={(row) => `${row.user_id}-${row.location_id}`}
          loading={ownerEmployeesLoading}
          dataSource={ownerEmployees}
          columns={employeeColumns}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `Tổng ${total} dòng`,
          }}
        />
      ),
    },
    ...extraTabItems,
  ];

  return (
    <Tabs
      activeKey={activeKey}
      onChange={(k) => setActiveKey(k)}
      items={items}
    />
  );
}
