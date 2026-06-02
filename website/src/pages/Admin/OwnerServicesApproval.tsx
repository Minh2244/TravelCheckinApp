// website/src/pages/Admin/OwnerServicesApproval.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { formatMoney } from "../../utils/formatMoney";
import { formatDateVi } from "../../utils/formatDateVi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { asRecord } from "../../utils/safe";

type AdminStatus = "pending" | "approved" | "rejected";

type OwnerOption = { value: number; label: string };

type OwnerServiceRow = {
  service_id: number;
  location_id: number;
  category_id: number | null;
  service_name: string;
  service_type: string;
  description: string | null;
  price: number;
  quantity: number;
  unit: string | null;
  status: string;
  images: unknown;
  admin_status: AdminStatus;
  admin_reviewed_by: number | null;
  admin_reviewed_at: string | null;
  admin_reject_reason: string | null;
  created_at: string;
  location_name: string;
  location_type: string;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  category_name: string | null;
  category_type: string | null;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e?.response?.data?.message || e?.message || fallback;
};

const parseImages = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      // ignore
    }
  }
  return [];
};

const renderAdminStatus = (status: AdminStatus, reason?: string | null) => {
  if (status === "approved") return <Tag color="green">Đã duyệt</Tag>;
  if (status === "rejected") {
    return (
      <Tooltip title={reason || ""}>
        <Tag color="red">Từ chối</Tag>
      </Tooltip>
    );
  }
  return <Tag color="gold">Chờ duyệt</Tag>;
};

const serviceTypeLabel = (raw: unknown) => {
  const v = String(raw || "").trim();
  if (!v) return "-";
  if (v === "food") return "Thực phẩm";
  if (v === "combo") return "Combo";
  if (v === "room") return "Phòng";
  if (v === "table") return "Bàn";
  if (v === "ticket") return "Vé";
  if (v === "other") return "Khác";
  return v;
};

const OwnerServicesApproval = () => {
  const LIST_LIMIT = 200;
  const LIST_SCROLL_Y = 680;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OwnerServiceRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<AdminStatus | undefined>(
    "pending",
  );
  const [searchText, setSearchText] = useState("");
  const [ownerFilterIds, setOwnerFilterIds] = useState<number[]>([]);
  const [serviceTypesFilter, setServiceTypesFilter] = useState<string[]>([]);

  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: LIST_LIMIT,
    total: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<OwnerServiceRow | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [excludedRowKeys, setExcludedRowKeys] = useState<number[]>([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkRejectScope, setBulkRejectScope] = useState<"ids" | "filter">(
    "ids",
  );

  const excludedSet = useMemo(
    () =>
      new Set(excludedRowKeys.map((x) => Number(x)).filter(Number.isFinite)),
    [excludedRowKeys],
  );

  const ownerOptionsOnPage = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      const id = Number(r.owner_id);
      if (!Number.isFinite(id)) continue;
      if (!map.has(id)) map.set(id, String(r.owner_name || `Owner #${id}`));
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [rows]);

  const serviceTypeOptions = useMemo(
    () => [
      { value: "food", label: "Món ăn / Nước" },
      { value: "combo", label: "Combo" },
      { value: "room", label: "Phòng" },
      { value: "table", label: "Bàn" },
      { value: "ticket", label: "Vé" },
      { value: "other", label: "Khác" },
    ],
    [],
  );

  const params = useMemo(() => {
    const p: Record<string, string | number | boolean | undefined> = {
      page: 1,
      limit: LIST_LIMIT,
    };
    if (statusFilter) p.status = statusFilter;
    if (searchText.trim()) p.search = searchText.trim();
    if (ownerFilterIds.length > 0) p.owner_ids = ownerFilterIds.join(",");
    if (serviceTypesFilter.length > 0)
      p.service_types = serviceTypesFilter.join(",");
    return p;
  }, [
    LIST_LIMIT,
    ownerFilterIds,
    searchText,
    serviceTypesFilter,
    statusFilter,
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getOwnerServices(params);
      if (res?.success) {
        setRows((res.data || []) as OwnerServiceRow[]);
        const nextTotal = Number(res.pagination?.total || 0);
        setPagination((prev) => {
          if (Number(prev.total) === nextTotal) return prev;
          return {
            ...prev,
            total: nextTotal,
          };
        });
      } else {
        message.error(res?.message || "Không thể tải danh sách dịch vụ");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi tải danh sách dịch vụ"));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    // Clear selection when filters change to avoid acting on stale selections.
    setSelectedRowKeys([]);
    setSelectAllMatching(false);
    setExcludedRowKeys([]);
  }, [ownerFilterIds, searchText, serviceTypesFilter, statusFilter]);

  const fetchOwners = useCallback(async (q: string) => {
    try {
      setOwnerLoading(true);
      const res = await adminApi.getOwners({
        search: q || undefined,
        page: 1,
        limit: 50,
      });
      if (res?.success) {
        const opts = (res.data || [])
          .map((item: unknown) => {
            const o = asRecord(item);
            const id = Number(o.user_id);
            if (!Number.isFinite(id)) return null;
            const name =
              typeof o.full_name === "string" && o.full_name.trim()
                ? o.full_name
                : `Owner #${id}`;
            const email = typeof o.email === "string" ? o.email : "";
            return {
              value: id,
              label: email ? `${name} — ${email}` : name,
            } as OwnerOption;
          })
          .filter(Boolean) as OwnerOption[];
        setOwnerOptions(opts);
      }
    } catch {
      // ignore
    } finally {
      setOwnerLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchOwners(ownerSearch.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [fetchOwners, ownerSearch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openDetail = (row: OwnerServiceRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  const handleApprove = async (row: OwnerServiceRow) => {
    Modal.confirm({
      title: "Duyệt dịch vụ",
      content: (
        <div>
          <div>
            Bạn muốn duyệt dịch vụ <b>{row.service_name}</b>?
          </div>
          <div style={{ marginTop: 8 }}>
            Loại: <b>{row.service_type}</b> — Danh mục:{" "}
            <b>{row.category_name || "-"}</b>
          </div>
        </div>
      ),
      okText: "Duyệt",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const res = await adminApi.updateOwnerServiceApproval(
            row.service_id,
            {
              status: "approved",
            },
          );
          if (res?.success) {
            message.success("Đã duyệt dịch vụ");
            void fetchData();
          } else {
            message.error(res?.message || "Không thể duyệt dịch vụ");
          }
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, "Lỗi khi duyệt dịch vụ"));
        }
      },
    });
  };

  const handleRejectOpen = (row: OwnerServiceRow) => {
    setSelectedRow(row);
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedRow) return;
    const reason = rejectReason.trim();
    if (!reason) {
      message.warning("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      const res = await adminApi.updateOwnerServiceApproval(
        selectedRow.service_id,
        {
          status: "rejected",
          reason,
        },
      );
      if (res?.success) {
        message.success("Đã từ chối dịch vụ");
        setRejectOpen(false);
        void fetchData();
      } else {
        message.error(res?.message || "Không thể từ chối dịch vụ");
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi từ chối dịch vụ"));
    }
  };

  const bulkSelectAllOnPage = () => {
    setSelectedRowKeys(rows.map((r) => r.service_id));
  };

  const bulkAddAllOnPageToSelection = () => {
    if (rows.length === 0) return;
    const pageIds = rows
      .map((r) => Number(r.service_id))
      .filter((n) => Number.isFinite(n));
    setSelectedRowKeys((prev) => {
      const next = new Set(
        prev.map((x) => Number(x)).filter((n) => Number.isFinite(n)),
      );
      for (const id of pageIds) next.add(id);
      return Array.from(next.values());
    });
  };

  const bulkRemoveAllOnPageFromSelection = () => {
    if (rows.length === 0) return;
    const pageIdSet = new Set(
      rows.map((r) => Number(r.service_id)).filter((n) => Number.isFinite(n)),
    );
    setSelectedRowKeys((prev) =>
      prev
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && !pageIdSet.has(n)),
    );
  };

  const bulkClearSelection = () => {
    setSelectedRowKeys([]);
    setSelectAllMatching(false);
    setExcludedRowKeys([]);
  };

  const bulkSelectByOwnersOnPage = (ownerIds: number[]) => {
    const set = new Set(
      ownerIds.map((x) => Number(x)).filter((n) => Number.isFinite(n)),
    );
    if (set.size === 0) return;
    setSelectedRowKeys(
      rows.filter((r) => set.has(Number(r.owner_id))).map((r) => r.service_id),
    );
  };

  const bulkSelectAllMatching = () => {
    if (Number(pagination.total || 0) === 0) {
      message.warning("Không có dữ liệu để chọn");
      return;
    }
    setSelectAllMatching(true);
    setSelectedRowKeys([]);
    setExcludedRowKeys([]);
    message.info("Đã chọn tất cả kết quả theo bộ lọc hiện tại");
  };

  const getSelectedCount = () => {
    if (selectAllMatching) {
      const count = Number(pagination.total || 0) - excludedSet.size;
      return Math.max(0, count);
    }
    return selectedRowKeys.length;
  };

  const bulkApproveSelected = () => {
    if (selectAllMatching) {
      const totalSelected = getSelectedCount();
      if (totalSelected === 0) {
        message.warning("Không có dịch vụ nào được chọn");
        return;
      }

      Modal.confirm({
        title: "Duyệt hàng loạt",
        content: `Bạn muốn duyệt ${totalSelected} dịch vụ theo bộ lọc hiện tại?`,
        okText: "Duyệt",
        cancelText: "Hủy",
        onOk: async () => {
          try {
            setBulkActionLoading(true);
            const res = await adminApi.bulkUpdateOwnerServiceApproval({
              scope: "filter",
              status: "approved",
              filter: {
                status: statusFilter,
                search: searchText.trim() || undefined,
                owner_ids:
                  ownerFilterIds.length > 0 ? ownerFilterIds : undefined,
                service_types:
                  serviceTypesFilter.length > 0
                    ? serviceTypesFilter
                    : undefined,
              },
              exclude_service_ids: excludedRowKeys,
            });
            if (res?.success) {
              message.success(
                `Đã duyệt hàng loạt (${Number(res.affected || 0)} dịch vụ)`,
              );
              setSelectAllMatching(false);
              setExcludedRowKeys([]);
              void fetchData();
            } else {
              message.error(res?.message || "Không thể duyệt hàng loạt");
            }
          } catch (error: unknown) {
            message.error(getApiErrorMessage(error, "Lỗi khi duyệt hàng loạt"));
          } finally {
            setBulkActionLoading(false);
          }
        },
      });
      return;
    }

    const ids = selectedRowKeys.filter((x) => Number.isFinite(Number(x)));
    if (ids.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 dịch vụ");
      return;
    }

    Modal.confirm({
      title: "Duyệt hàng loạt",
      content: `Bạn muốn duyệt ${ids.length} dịch vụ đã chọn?`,
      okText: "Duyệt",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setBulkActionLoading(true);
          const res = await adminApi.bulkUpdateOwnerServiceApproval({
            scope: "ids",
            status: "approved",
            service_ids: ids,
          });
          if (res?.success) {
            message.success("Đã duyệt các dịch vụ đã chọn");
          } else {
            message.error(res?.message || "Không thể duyệt hàng loạt");
            return;
          }
          setSelectedRowKeys([]);
          void fetchData();
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, "Lỗi khi duyệt hàng loạt"));
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  const bulkRejectSelectedOpen = () => {
    if (selectAllMatching) {
      const totalSelected = getSelectedCount();
      if (totalSelected === 0) {
        message.warning("Không có dịch vụ nào được chọn");
        return;
      }
      setBulkRejectScope("filter");
      setBulkRejectReason("");
      setBulkRejectOpen(true);
      return;
    }

    const ids = selectedRowKeys.filter((x) => Number.isFinite(Number(x)));
    if (ids.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 dịch vụ");
      return;
    }
    setBulkRejectScope("ids");
    setBulkRejectReason("");
    setBulkRejectOpen(true);
  };

  const bulkRejectSelectedSubmit = async () => {
    const reason = bulkRejectReason.trim();
    if (!reason) {
      message.warning("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      setBulkActionLoading(true);
      if (bulkRejectScope === "filter") {
        const res = await adminApi.bulkUpdateOwnerServiceApproval({
          scope: "filter",
          status: "rejected",
          reason,
          filter: {
            status: statusFilter,
            search: searchText.trim() || undefined,
            owner_ids: ownerFilterIds.length > 0 ? ownerFilterIds : undefined,
            service_types:
              serviceTypesFilter.length > 0 ? serviceTypesFilter : undefined,
          },
          exclude_service_ids: excludedRowKeys,
        });
        if (res?.success) {
          message.success(
            `Đã từ chối hàng loạt (${Number(res.affected || 0)} dịch vụ)`,
          );
          setBulkRejectOpen(false);
          setSelectAllMatching(false);
          setExcludedRowKeys([]);
          void fetchData();
        } else {
          message.error(res?.message || "Không thể từ chối hàng loạt");
        }
      } else {
        const ids = selectedRowKeys.filter((x) => Number.isFinite(Number(x)));
        const res = await adminApi.bulkUpdateOwnerServiceApproval({
          scope: "ids",
          status: "rejected",
          reason,
          service_ids: ids,
        });
        if (res?.success) {
          message.success("Đã từ chối các dịch vụ đã chọn");
          setBulkRejectOpen(false);
          setSelectedRowKeys([]);
          void fetchData();
        } else {
          message.error(res?.message || "Không thể từ chối hàng loạt");
        }
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, "Lỗi khi từ chối hàng loạt"));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = (row: OwnerServiceRow) => {
    Modal.confirm({
      title: "Xóa dịch vụ",
      content: (
        <div>
          Bạn có chắc muốn xóa dịch vụ <b>{row.service_name}</b>?
        </div>
      ),
      okText: "Xóa",
      okButtonProps: { danger: true },
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const res = await adminApi.deleteOwnerService(row.service_id);
          if (res?.success) {
            message.success(res?.message || "Đã xóa dịch vụ");
            void fetchData();
          } else {
            message.error(res?.message || "Không thể xóa dịch vụ");
          }
        } catch (error: unknown) {
          message.error(getApiErrorMessage(error, "Lỗi khi xóa dịch vụ"));
        }
      },
    });
  };

  const selectionOnPage = useMemo(() => {
    const pageIds = rows
      .map((r) => Number(r.service_id))
      .filter((x) => Number.isFinite(x));

    const selectedIds = pageIds.filter((id) =>
      selectAllMatching ? !excludedSet.has(id) : selectedRowKeys.includes(id),
    );

    return {
      pageIds,
      selectedIds,
      selectedCount: selectedIds.length,
      totalCount: pageIds.length,
      allSelected: pageIds.length > 0 && selectedIds.length === pageIds.length,
      someSelected:
        selectedIds.length > 0 && selectedIds.length < pageIds.length,
    };
  }, [rows, selectAllMatching, excludedSet, selectedRowKeys]);

  const toggleRowSelected = useCallback(
    (serviceId: number, checked: boolean) => {
      const id = Number(serviceId);
      if (!Number.isFinite(id)) return;

      if (selectAllMatching) {
        setExcludedRowKeys((prev) => {
          const next = new Set(
            prev.map((x) => Number(x)).filter((x) => Number.isFinite(x)),
          );
          if (checked) next.delete(id);
          else next.add(id);
          return Array.from(next.values());
        });
        return;
      }

      setSelectedRowKeys((prev) => {
        const next = new Set(
          (prev || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)),
        );
        if (checked) next.add(id);
        else next.delete(id);
        return Array.from(next.values());
      });
    },
    [selectAllMatching, setExcludedRowKeys, setSelectedRowKeys],
  );

  const toggleSelectAllOnPage = useCallback(
    (checked: boolean) => {
      const pageIds = selectionOnPage.pageIds;
      if (pageIds.length === 0) return;

      if (selectAllMatching) {
        setExcludedRowKeys((prev) => {
          const next = new Set(
            prev.map((x) => Number(x)).filter((x) => Number.isFinite(x)),
          );
          for (const id of pageIds) {
            if (checked) next.delete(id);
            else next.add(id);
          }
          return Array.from(next.values());
        });
        return;
      }

      setSelectedRowKeys((prev) => {
        const next = new Set(
          (prev || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)),
        );
        for (const id of pageIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return Array.from(next.values());
      });
    },
    [
      selectAllMatching,
      selectionOnPage.pageIds,
      setExcludedRowKeys,
      setSelectedRowKeys,
    ],
  );

  return (
    <MainLayout>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="Bộ lọc" size="small">
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Input
              placeholder="Tìm theo tên dịch vụ / địa điểm / owner / danh mục"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
              onPressEnter={() =>
                setPagination((p) => ({
                  ...p,
                  current: 1,
                }))
              }
            />

            <Select
              mode="multiple"
              style={{ width: "100%" }}
              value={ownerFilterIds.length > 0 ? ownerFilterIds : undefined}
              placeholder="Lọc theo owner"
              allowClear
              showSearch
              maxTagCount="responsive"
              filterOption={false}
              onSearch={(v) => setOwnerSearch(v)}
              notFoundContent={ownerLoading ? "Đang tải..." : null}
              options={ownerOptions}
              onChange={(v) => {
                setOwnerFilterIds((v as number[]) || []);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            />

            <Select
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
              allowClear
              placeholder="Trạng thái duyệt"
              options={[
                { value: "pending", label: "Chờ duyệt" },
                { value: "approved", label: "Đã duyệt" },
                { value: "rejected", label: "Từ chối" },
              ]}
            />

            <Select
              mode="multiple"
              style={{ width: "100%" }}
              value={
                serviceTypesFilter.length > 0 ? serviceTypesFilter : undefined
              }
              placeholder="Lọc loại dịch vụ"
              allowClear
              maxTagCount="responsive"
              options={serviceTypeOptions}
              onChange={(v) => {
                setServiceTypesFilter((v as string[]) || []);
                setPagination((p) => ({ ...p, current: 1 }));
              }}
            />

            <Button
              onClick={() => setPagination((p) => ({ ...p, current: 1 }))}
            >
              Áp dụng
            </Button>

            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Tổng kết quả: <b>{pagination.total}</b>
              </Typography.Text>
            </div>
          </Space>
        </Card>

        <Card
          title="Duyệt Dịch vụ"
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void fetchData()}
              loading={loading}
            >
              Tải lại
            </Button>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <Tooltip title="Chọn tất cả dịch vụ trên trang hiện tại">
              <Button
                onClick={bulkSelectAllOnPage}
                disabled={rows.length === 0}
              >
                Chọn hết (trang)
              </Button>
            </Tooltip>

            <Tooltip title="Thêm toàn bộ dịch vụ của trang này vào lựa chọn (tích lũy nhiều trang)">
              <Button
                onClick={bulkAddAllOnPageToSelection}
                disabled={rows.length === 0 || selectAllMatching}
              >
                + Trang này
              </Button>
            </Tooltip>

            <Tooltip title="Bỏ toàn bộ dịch vụ của trang này khỏi lựa chọn">
              <Button
                onClick={bulkRemoveAllOnPageFromSelection}
                disabled={rows.length === 0 || selectAllMatching}
              >
                - Trang này
              </Button>
            </Tooltip>

            <Tooltip title="Chọn tất cả kết quả theo bộ lọc hiện tại (mọi trang)">
              <Button
                onClick={bulkSelectAllMatching}
                disabled={pagination.total === 0}
                type={selectAllMatching ? "primary" : "default"}
              >
                Chọn hết (tất cả)
              </Button>
            </Tooltip>

            <Tooltip title="Bỏ chọn tất cả">
              <Button
                onClick={bulkClearSelection}
                disabled={selectedRowKeys.length === 0 && !selectAllMatching}
              >
                Bỏ chọn
              </Button>
            </Tooltip>

            <Select
              style={{ width: 260 }}
              allowClear
              mode="multiple"
              placeholder="Chọn theo owner (trang)"
              options={ownerOptionsOnPage}
              onChange={(v) => {
                if (Array.isArray(v)) bulkSelectByOwnersOnPage(v as number[]);
              }}
            />

            <Button
              type="primary"
              onClick={bulkApproveSelected}
              disabled={getSelectedCount() === 0 || statusFilter === "approved"}
              loading={bulkActionLoading}
            >
              {selectAllMatching ? "Duyệt tất cả" : "Duyệt đã chọn"}
            </Button>

            <Button
              danger
              onClick={bulkRejectSelectedOpen}
              disabled={getSelectedCount() === 0}
              loading={bulkActionLoading}
            >
              {selectAllMatching ? "Từ chối tất cả" : "Từ chối đã chọn"}
            </Button>

            <Tag>
              Đã chọn: <b>{getSelectedCount()}</b>
              {selectAllMatching ? ` / ${pagination.total}` : ""}
            </Tag>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <Checkbox
              checked={selectionOnPage.allSelected}
              indeterminate={selectionOnPage.someSelected}
              onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
              disabled={rows.length === 0}
            >
              Chọn tất cả (trang)
            </Checkbox>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Trang này: <b>{selectionOnPage.selectedCount}</b>/
              {selectionOnPage.totalCount}
            </Typography.Text>
          </div>

          {rows.length === 0 ? (
            <Empty description="Không có dịch vụ phù hợp" />
          ) : (
            <div
              style={{
                maxHeight: LIST_SCROLL_Y,
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                {rows.map((row) => {
                  const images = parseImages(row.images);
                  const first = images[0]
                    ? resolveBackendUrl(images[0]) || undefined
                    : undefined;
                  const id = Number(row.service_id);
                  const checked = Number.isFinite(id)
                    ? selectAllMatching
                      ? !excludedSet.has(id)
                      : selectedRowKeys.includes(id)
                    : false;

                  return (
                    <Card
                      key={row.service_id}
                      size="small"
                      bodyStyle={{ padding: 12 }}
                    >
                      <div className="flex gap-3">
                        {first ? (
                          <Image
                            src={first}
                            width={72}
                            height={72}
                            style={{ objectFit: "cover", borderRadius: 10 }}
                            preview
                          />
                        ) : (
                          <div
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 10,
                              background: "#f5f5f5",
                              flex: "0 0 auto",
                            }}
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[15px] font-semibold">
                                {row.service_name}
                              </div>
                              <div className="truncate text-xs text-gray-600">
                                {row.location_name} — {row.owner_name}
                              </div>
                            </div>

                            <Checkbox
                              checked={checked}
                              onChange={(e) =>
                                toggleRowSelected(
                                  row.service_id,
                                  e.target.checked,
                                )
                              }
                            />
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag>{serviceTypeLabel(row.service_type)}</Tag>
                            <Tag color="geekblue">
                              {row.category_name || "Chưa có danh mục"}
                            </Tag>
                            <Tag color="purple">
                              {formatMoney(Number(row.price) || 0)}
                            </Tag>
                            {renderAdminStatus(
                              row.admin_status,
                              row.admin_reject_reason,
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: 12 }}
                            >
                              Tạo:{" "}
                              {row.created_at
                                ? formatDateVi(row.created_at)
                                : "-"}
                            </Typography.Text>

                            <Space wrap size={[8, 8]}>
                              <Button
                                icon={<EyeOutlined />}
                                onClick={() => openDetail(row)}
                                size="small"
                              >
                                Xem
                              </Button>

                              {row.admin_status === "approved" ? (
                                <Button
                                  icon={
                                    <DeleteOutlined
                                      style={{ color: "#ff4d4f" }}
                                    />
                                  }
                                  danger
                                  onClick={() => handleDelete(row)}
                                  size="small"
                                >
                                  Xóa
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    icon={<CheckOutlined />}
                                    type="primary"
                                    onClick={() => handleApprove(row)}
                                    size="small"
                                  >
                                    Duyệt
                                  </Button>
                                  <Button
                                    icon={<CloseOutlined />}
                                    danger
                                    onClick={() => handleRejectOpen(row)}
                                    size="small"
                                    disabled={row.admin_status === "rejected"}
                                  >
                                    Từ chối
                                  </Button>
                                </>
                              )}
                            </Space>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </Space>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        title="Chi tiết dịch vụ"
        width={800}
      >
        {selectedRow ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Dịch vụ">
              {selectedRow.service_name}
            </Descriptions.Item>
            <Descriptions.Item label="Owner">
              {selectedRow.owner_name} — {selectedRow.owner_email}
            </Descriptions.Item>
            <Descriptions.Item label="Địa điểm">
              {selectedRow.location_name} ({selectedRow.location_type})
            </Descriptions.Item>
            <Descriptions.Item label="Loại dịch vụ">
              <Tag>{selectedRow.service_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Danh mục">
              {selectedRow.category_name || "-"} (
              {selectedRow.category_type || "-"})
            </Descriptions.Item>
            <Descriptions.Item label="Giá">
              {formatMoney(Number(selectedRow.price) || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái duyệt">
              {renderAdminStatus(
                selectedRow.admin_status,
                selectedRow.admin_reject_reason,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">
              {selectedRow.description || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Hình ảnh">
              <Space wrap>
                {parseImages(selectedRow.images).length === 0 ? (
                  <Tag>Không có</Tag>
                ) : (
                  parseImages(selectedRow.images).map((u) => (
                    <Image
                      key={u}
                      width={120}
                      height={80}
                      style={{ objectFit: "cover", borderRadius: 8 }}
                      src={resolveBackendUrl(u) || undefined}
                    />
                  ))
                )}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => void handleRejectSubmit()}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        title="Từ chối dịch vụ"
      >
        <div style={{ marginBottom: 8 }}>
          {selectedRow ? (
            <>
              Dịch vụ: <b>{selectedRow.service_name}</b>
              <div style={{ marginTop: 4, color: "#666" }}>
                Loại: <b>{selectedRow.service_type}</b> — Danh mục:{" "}
                <b>{selectedRow.category_name || "-"}</b>
              </div>
            </>
          ) : null}
        </div>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Nhập lý do từ chối (bắt buộc)"
        />
      </Modal>

      <Modal
        open={bulkRejectOpen}
        onCancel={() => setBulkRejectOpen(false)}
        onOk={() => void bulkRejectSelectedSubmit()}
        okText="Từ chối"
        okButtonProps={{ danger: true, loading: bulkActionLoading }}
        cancelText="Hủy"
        title="Từ chối hàng loạt"
      >
        <div style={{ marginBottom: 8 }}>
          Nhập lý do từ chối (áp dụng cho {getSelectedCount()} dịch vụ
          {selectAllMatching ? " theo bộ lọc hiện tại" : " đã chọn"}):
        </div>
        <Input.TextArea
          value={bulkRejectReason}
          onChange={(e) => setBulkRejectReason(e.target.value)}
          rows={4}
          placeholder="Lý do..."
        />
      </Modal>
    </MainLayout>
  );
};

export default OwnerServicesApproval;
