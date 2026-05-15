import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../layouts/MainLayout";
import ownerApi from "../../api/ownerApi";
import { asRecord, getErrorMessage } from "../../utils/safe";
import { locationTypeToVi } from "../../utils/locationTypeText";
import { formatMoney } from "../../utils/formatMoney";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

const FRONT_OFFICE_STORAGE_KEY = "tc_front_office_location_id";

type RoomRow = {
  room_id: number;
  service_id?: number | null;
  area_id: number | null;
  area_name?: string | null;
  floor_number: number;
  room_number: string;
  status: string;
  price?: number | string | null;
  images?: unknown;
  category_id?: number | null;
  category_name?: string | null;
  category_sort_order?: number | null;
  pos_x?: number | null;
  pos_y?: number | null;
};

const normalizeImages = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
    } catch {
      // ignore
    }
  }
  return [];
};

type AreaRow = {
  area_id: number;
  area_name: string;
  sort_order?: number | null;
};

type TableRow = {
  table_id: number;
  area_id: number | null;
  table_name: string;
  shape: "square" | "round";
  status: string;
  order_id?: number | null;
  final_amount?: number | string | null;
  pos_x?: number | null;
  pos_y?: number | null;
};

type ServiceCategoryRow = {
  category_id: number;
  category_name: string;
  sort_order?: number | null;
};

type TouristTicketServiceRow = {
  service_id: number;
  service_name: string;
  price: number;
};

const roomTag = (s: string) => {
  const status = String(s || "");
  const color =
    status === "vacant"
      ? "green"
      : status === "occupied"
        ? "red"
        : status === "reserved"
          ? "orange"
          : status === "cleaning"
            ? "default"
            : "default";

  const label =
    status === "vacant"
      ? "Trống"
      : status === "occupied"
        ? "Đang ở"
        : status === "reserved"
          ? "Đã đặt"
          : status === "cleaning"
            ? "Dọn dẹp"
            : status
              ? status
              : "-";

  return <Tag color={color}>{label}</Tag>;
};

const tableTag = (s: string) => {
  const status = String(s || "");
  const color =
    status === "free" ? "default" : status === "occupied" ? "blue" : "orange";
  const label =
    status === "free"
      ? "Trống"
      : status === "occupied"
        ? "Có khách"
        : status === "reserved"
          ? "Đã đặt trước"
          : status
            ? status
            : "-";
  return <Tag color={color}>{label}</Tag>;
};

export default function OwnerLocationOpsConfig() {
  const navigate = useNavigate();
  const params = useParams();
  const locationId = Number(params.locationId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [locationName, setLocationName] = useState<string>("");
  const [locationType, setLocationType] = useState<string>("");
  const [posContext, setPosContext] = useState<unknown>(null);

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [roomCategories, setRoomCategories] = useState<ServiceCategoryRow[]>(
    [],
  );
  const [mapArea, setMapArea] = useState<string>("all");
  const [roomMapArea, setRoomMapArea] = useState<string>("all");
  const [roomMapCategory, setRoomMapCategory] = useState<string>("all");

  const [tableMultiSelect, setTableMultiSelect] = useState(false);
  const [tableListArea, setTableListArea] = useState<string>("all");
  const [tableMapAreas, setTableMapAreas] = useState<number[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);

  const [roomMultiSelect, setRoomMultiSelect] = useState(false);
  const [roomMapAreas, setRoomMapAreas] = useState<number[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);

  const roomMapRef = useRef<HTMLDivElement | null>(null);
  const roomDragRef = useRef<{
    roomId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [roomPositions, setRoomPositions] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const roomPositionsRef = useRef<Record<number, { x: number; y: number }>>({});

  const mapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    tableId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [positions, setPositions] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const positionsRef = useRef<Record<number, { x: number; y: number }>>({});

  const [roomForm] = Form.useForm();
  const [areaForm] = Form.useForm();
  const [tableForm] = Form.useForm();
  const [editAreaForm] = Form.useForm();
  const [editTableForm] = Form.useForm();
  const [editRoomForm] = Form.useForm();
  const [roomCategoryForm] = Form.useForm();
  const [editRoomCategoryForm] = Form.useForm();

  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaRow | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);

  const [roomCategoryModalOpen, setRoomCategoryModalOpen] = useState(false);
  const [editingRoomCategory, setEditingRoomCategory] =
    useState<ServiceCategoryRow | null>(null);

  const [quickTableOpen, setQuickTableOpen] = useState(false);
  const [quickRoomOpen, setQuickRoomOpen] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickTableForm] = Form.useForm();
  const [quickRoomForm] = Form.useForm();

  const loadContext = useCallback(async () => {
    if (!Number.isFinite(locationId)) {
      message.error("locationId không hợp lệ");
      navigate("/owner/locations");
      return;
    }

    setLoading(true);
    try {
      const res = await ownerApi.getFrontOfficeContext({
        location_id: locationId,
      });
      const data = asRecord(asRecord(res).data);
      const loc = asRecord(data.location);
      setLocationName(String(loc.location_name || ""));
      setLocationType(String(loc.location_type || ""));
      setPosContext(data.pos ?? null);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải context địa điểm"));
    } finally {
      setLoading(false);
    }
  }, [locationId, navigate]);

  const loadHotelRooms = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    try {
      const res = await ownerApi.getHotelRooms({
        location_id: locationId,
        floor: "all",
      });
      setRooms(
        (res?.data || [])
          .map((item: unknown): RoomRow => {
            const r = asRecord(item);
            return {
              room_id: Number(r.room_id),
              service_id: r.service_id == null ? null : Number(r.service_id),
              area_id: r.area_id == null ? null : Number(r.area_id),
              area_name: r.area_name == null ? null : String(r.area_name || ""),
              floor_number: Number(r.floor_number),
              room_number: String(r.room_number || ""),
              status: String(r.status || ""),
              price: r.price == null ? null : (r.price as any),
              images: r.images,
              category_id: r.category_id == null ? null : Number(r.category_id),
              category_name:
                r.category_name == null ? null : String(r.category_name || ""),
              category_sort_order:
                r.category_sort_order == null
                  ? null
                  : Number(r.category_sort_order),
              pos_x: r.pos_x == null ? null : Number(r.pos_x),
              pos_y: r.pos_y == null ? null : Number(r.pos_y),
            };
          })
          .filter(
            (r: RoomRow) =>
              Number.isFinite(r.room_id) &&
              Number.isFinite(r.floor_number) &&
              Boolean(r.room_number) &&
              r.service_id != null &&
              Number.isFinite(Number(r.service_id)),
          ),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh sách phòng"));
    }
  }, [locationId]);

  const loadAreasOnly = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    try {
      const aRes = await ownerApi.getPosAreas({ location_id: locationId });
      setAreas(
        (aRes?.data || [])
          .map((item: unknown): AreaRow => {
            const r = asRecord(item);
            return {
              area_id: Number(r.area_id),
              area_name: String(r.area_name || ""),
              sort_order:
                r.sort_order == null ? null : Number(r.sort_order || 0),
            };
          })
          .filter((a: AreaRow) => Number.isFinite(a.area_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh sách khu"));
    }
  }, [locationId]);

  const loadRoomCategories = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    try {
      const res = await ownerApi.getServiceCategories(locationId, {
        type: "room",
      });
      setRoomCategories(
        (res?.data || [])
          .map((item: unknown): ServiceCategoryRow => {
            const r = asRecord(item);
            return {
              category_id: Number(r.category_id),
              category_name: String(r.category_name || ""),
              sort_order:
                r.sort_order == null ? null : Number(r.sort_order || 0),
            };
          })
          .filter((c: ServiceCategoryRow) => Number.isFinite(c.category_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải danh mục phòng"));
    }
  }, [locationId]);

  const onCreateRoomCategory = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    const v = (await roomCategoryForm.validateFields()) as Record<
      string,
      unknown
    >;
    setSaving(true);
    try {
      const name = String(v.category_name || "").trim();
      const sort = Math.max(0, Number(v.sort_order || 0));
      await ownerApi.createServiceCategory(locationId, {
        category_type: "room",
        category_name: name,
        sort_order: sort,
      });
      message.success("Đã tạo danh mục");
      roomCategoryForm.resetFields();
      await loadRoomCategories();
      await loadHotelRooms();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tạo danh mục"));
    } finally {
      setSaving(false);
    }
  }, [loadHotelRooms, loadRoomCategories, locationId, roomCategoryForm]);

  const openEditRoomCategory = useCallback(
    (row: ServiceCategoryRow) => {
      setEditingRoomCategory(row);
      editRoomCategoryForm.setFieldsValue({
        category_name: String(row.category_name || "").trim(),
        sort_order: row.sort_order == null ? 0 : Number(row.sort_order || 0),
      });
      setRoomCategoryModalOpen(true);
    },
    [editRoomCategoryForm],
  );

  const saveRoomCategory = useCallback(async () => {
    if (!editingRoomCategory) return;
    const v = (await editRoomCategoryForm.validateFields()) as Record<
      string,
      unknown
    >;
    setSaving(true);
    try {
      const name = String(v.category_name || "").trim();
      const sort = Math.max(0, Number(v.sort_order || 0));
      await ownerApi.updateServiceCategory(
        Number(editingRoomCategory.category_id),
        {
          category_name: name,
          sort_order: sort,
        },
      );
      message.success("Đã cập nhật danh mục");
      setRoomCategoryModalOpen(false);
      await loadRoomCategories();
      await loadHotelRooms();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi cập nhật danh mục"));
    } finally {
      setSaving(false);
    }
  }, [
    editRoomCategoryForm,
    editingRoomCategory,
    loadHotelRooms,
    loadRoomCategories,
  ]);

  const onDeleteRoomCategory = useCallback(
    async (categoryId: number) => {
      if (!Number.isFinite(Number(categoryId))) return;
      setSaving(true);
      try {
        const res = await ownerApi.deleteServiceCategory(Number(categoryId));
        message.success(res?.message || "Đã xóa danh mục");
        await loadRoomCategories();
        await loadHotelRooms();
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi xóa danh mục"));
      } finally {
        setSaving(false);
      }
    },
    [loadHotelRooms, loadRoomCategories],
  );

  const loadPos = useCallback(async () => {
    if (!Number.isFinite(locationId)) return;
    try {
      const [aRes, tRes] = await Promise.all([
        ownerApi.getPosAreas({ location_id: locationId }),
        ownerApi.getPosTables({ location_id: locationId, area_id: "all" }),
      ]);
      setAreas(
        (aRes?.data || [])
          .map((item: unknown): AreaRow => {
            const r = asRecord(item);
            return {
              area_id: Number(r.area_id),
              area_name: String(r.area_name || ""),
              sort_order:
                r.sort_order == null ? null : Number(r.sort_order || 0),
            };
          })
          .filter((a: AreaRow) => Number.isFinite(a.area_id)),
      );
      setTables(
        (tRes?.data || [])
          .map((item: unknown): TableRow => {
            const r = asRecord(item);
            return {
              table_id: Number(r.table_id),
              area_id: r.area_id == null ? null : Number(r.area_id),
              table_name: String(r.table_name || ""),
              shape: String(r.shape) === "round" ? "round" : "square",
              status: String(r.status || ""),
              order_id: r.order_id == null ? null : Number(r.order_id),
              final_amount:
                (r.final_amount as number | string | null | undefined) ?? null,
              pos_x: r.pos_x == null ? null : Number(r.pos_x),
              pos_y: r.pos_y == null ? null : Number(r.pos_y),
            };
          })
          .filter((t: TableRow) => Number.isFinite(t.table_id)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tải dữ liệu POS"));
    }
  }, [locationId]);

  const mapAreaOptions = useMemo(() => {
    const all = [{ label: "Tất cả", value: "all" }];
    const a = (areas || []).map((x) => ({
      label: String(x.area_name || `#${x.area_id}`),
      value: String(x.area_id),
    }));
    return [...all, ...a];
  }, [areas]);

  const tableListAreaOptions = mapAreaOptions;

  const roomCategoryFilterOptions = useMemo(() => {
    const all = [{ label: "Tất cả", value: "all" }];
    const sorted = [...(roomCategories || [])].sort((a, b) => {
      const sa = Number(a.sort_order ?? 0);
      const sb = Number(b.sort_order ?? 0);
      if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb)
        return sa - sb;
      return String(a.category_name || "").localeCompare(
        String(b.category_name || ""),
        "vi",
        { sensitivity: "base" },
      );
    });
    const opts = sorted
      .map((c) => ({
        label: String(c.category_name || `#${c.category_id}`),
        value: String(c.category_id),
      }))
      .filter((o) => o.value && o.value !== "NaN");
    return [...all, ...opts];
  }, [roomCategories]);

  const roomsForMap = useMemo(() => {
    const sorted = [...(rooms || [])].sort((a, b) => {
      const fa = Number(a.floor_number);
      const fb = Number(b.floor_number);
      if (Number.isFinite(fa) && Number.isFinite(fb) && fa !== fb)
        return fa - fb;
      return String(a.room_number || "").localeCompare(
        String(b.room_number || ""),
        "vi",
        {
          numeric: true,
          sensitivity: "base",
        },
      );
    });

    const withCategory =
      roomMapCategory === "all"
        ? sorted
        : (() => {
            const id = Number(roomMapCategory);
            if (!Number.isFinite(id)) return sorted;
            return sorted.filter((r) => Number(r.category_id) === id);
          })();

    if (roomMultiSelect) {
      if ((roomMapAreas || []).length === 0) return sorted;
      const set = new Set(roomMapAreas);
      return withCategory.filter((r) => {
        const id = r.area_id == null ? -1 : Number(r.area_id);
        return set.has(id);
      });
    }

    if (roomMapArea === "all") return withCategory;
    const id = Number(roomMapArea);
    if (!Number.isFinite(id)) return withCategory;
    return withCategory.filter((r) => Number(r.area_id) === id);
  }, [rooms, roomMapArea, roomMapAreas, roomMapCategory, roomMultiSelect]);

  const tablesForMap = useMemo(() => {
    const sorted = [...(tables || [])].sort((a, b) =>
      String(a.table_name || "").localeCompare(
        String(b.table_name || ""),
        "vi",
        {
          numeric: true,
          sensitivity: "base",
        },
      ),
    );

    if (tableMultiSelect) {
      if ((tableMapAreas || []).length === 0) return sorted;
      const set = new Set(tableMapAreas);
      return sorted.filter((t) => {
        const id = t.area_id == null ? -1 : Number(t.area_id);
        return set.has(id);
      });
    }

    if (mapArea === "all") return sorted;
    const id = Number(mapArea);
    if (!Number.isFinite(id)) return sorted;
    return sorted.filter((t) => Number(t.area_id) === id);
  }, [tables, mapArea, tableMapAreas, tableMultiSelect]);

  useEffect(() => {
    // Seed positions with either saved pos_x/pos_y or an auto-layout
    const next: Record<number, { x: number; y: number }> = {};
    const tableW = 120;
    const tableH = 78;
    const gap = 14;
    const columns = 6;

    for (let i = 0; i < tablesForMap.length; i++) {
      const t = tablesForMap[i];
      const id = Number(t.table_id);
      if (!Number.isFinite(id)) continue;

      const px = Number(t.pos_x);
      const py = Number(t.pos_y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        next[id] = { x: Math.round(px), y: Math.round(py) };
        continue;
      }

      const col = i % columns;
      const row = Math.floor(i / columns);
      next[id] = { x: 12 + col * (tableW + gap), y: 12 + row * (tableH + gap) };
    }

    setPositions(next);
  }, [tablesForMap]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    // Seed room positions with either saved pos_x/pos_y or an auto-layout
    const next: Record<number, { x: number; y: number }> = {};
    const cardW = 150;
    const cardH = 86;
    const gap = 14;
    const columns = 6;

    for (let i = 0; i < roomsForMap.length; i++) {
      const r = roomsForMap[i];
      const id = Number(r.room_id);
      if (!Number.isFinite(id)) continue;

      const px = Number(r.pos_x);
      const py = Number(r.pos_y);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        next[id] = { x: Math.round(px), y: Math.round(py) };
        continue;
      }

      const col = i % columns;
      const row = Math.floor(i / columns);
      next[id] = { x: 12 + col * (cardW + gap), y: 12 + row * (cardH + gap) };
    }

    setRoomPositions(next);
  }, [roomsForMap]);

  useEffect(() => {
    roomPositionsRef.current = roomPositions;
  }, [roomPositions]);

  const persistPosition = useCallback(
    async (tableId: number, x: number, y: number) => {
      try {
        await ownerApi.updatePosTablePosition(tableId, {
          pos_x: Math.round(x),
          pos_y: Math.round(y),
        });
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi lưu vị trí bàn"));
      }
    },
    [],
  );

  const persistRoomPosition = useCallback(
    async (roomId: number, x: number, y: number) => {
      try {
        await ownerApi.updateHotelRoomPosition(roomId, {
          pos_x: Math.round(x),
          pos_y: Math.round(y),
        });
      } catch (err: unknown) {
        message.error(getErrorMessage(err, "Lỗi lưu vị trí phòng"));
      }
    },
    [],
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    const el = mapRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const rawX = e.clientX - rect.left - d.offsetX;
    const rawY = e.clientY - rect.top - d.offsetY;

    const maxX = Math.max(0, rect.width - 140);
    const maxY = Math.max(0, rect.height - 90);
    const x = Math.max(0, Math.min(maxX, rawX));
    const y = Math.max(0, Math.min(maxY, rawY));

    setPositions((prev) => ({ ...prev, [d.tableId]: { x, y } }));
  }, []);

  const onRoomPointerMove = useCallback((e: PointerEvent) => {
    const d = roomDragRef.current;
    const el = roomMapRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const rawX = e.clientX - rect.left - d.offsetX;
    const rawY = e.clientY - rect.top - d.offsetY;

    const maxX = Math.max(0, rect.width - 170);
    const maxY = Math.max(0, rect.height - 100);
    const x = Math.max(0, Math.min(maxX, rawX));
    const y = Math.max(0, Math.min(maxY, rawY));

    setRoomPositions((prev) => ({ ...prev, [d.roomId]: { x, y } }));
  }, []);

  const onPointerUp = useCallback(async () => {
    const d = dragRef.current;
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("blur", onPointerUp);
    if (!d) return;

    const p = positionsRef.current[d.tableId];
    if (!p) return;
    await persistPosition(d.tableId, p.x, p.y);
  }, [onPointerMove, persistPosition]);

  const onRoomPointerUp = useCallback(async () => {
    const d = roomDragRef.current;
    roomDragRef.current = null;
    window.removeEventListener("pointermove", onRoomPointerMove);
    window.removeEventListener("pointerup", onRoomPointerUp);
    window.removeEventListener("pointercancel", onRoomPointerUp);
    window.removeEventListener("blur", onRoomPointerUp);
    if (!d) return;

    const p = roomPositionsRef.current[d.roomId];
    if (!p) return;
    await persistRoomPosition(d.roomId, p.x, p.y);
  }, [onRoomPointerMove, persistRoomPosition]);

  const startDrag = (e: React.PointerEvent, t: TableRow) => {
    const el = mapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = Number(t.table_id);
    const current = positions[id] || { x: 0, y: 0 };
    dragRef.current = {
      tableId: id,
      offsetX: e.clientX - rect.left - current.x,
      offsetY: e.clientY - rect.top - current.y,
    };
    try {
      // Helps ensure we receive pointerup even if pointer leaves the element
      (
        e.currentTarget as unknown as {
          setPointerCapture?: (id: number) => void;
        }
      )?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onPointerUp);
  };

  const startRoomDrag = (e: React.PointerEvent, r: RoomRow) => {
    const el = roomMapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = Number(r.room_id);
    const current = roomPositions[id] || { x: 0, y: 0 };
    roomDragRef.current = {
      roomId: id,
      offsetX: e.clientX - rect.left - current.x,
      offsetY: e.clientY - rect.top - current.y,
    };
    try {
      (
        e.currentTarget as unknown as {
          setPointerCapture?: (id: number) => void;
        }
      )?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    window.addEventListener("pointermove", onRoomPointerMove);
    window.addEventListener("pointerup", onRoomPointerUp);
    window.addEventListener("pointercancel", onRoomPointerUp);
    window.addEventListener("blur", onRoomPointerUp);
  };

  useEffect(() => {
    return () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);

      roomDragRef.current = null;
      window.removeEventListener("pointermove", onRoomPointerMove);
      window.removeEventListener("pointerup", onRoomPointerUp);
      window.removeEventListener("pointercancel", onRoomPointerUp);
      window.removeEventListener("blur", onRoomPointerUp);
    };
  }, [onPointerMove, onPointerUp, onRoomPointerMove, onRoomPointerUp]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!locationType) return;
    if (locationType === "hotel" || locationType === "resort") {
      void loadAreasOnly();
      void loadRoomCategories();
      void loadHotelRooms();
    }
    if (locationType === "restaurant" || locationType === "cafe") {
      void loadPos();
    }
  }, [
    loadAreasOnly,
    loadHotelRooms,
    loadPos,
    loadRoomCategories,
    locationType,
  ]);

  const touristTicketServices = useMemo((): TouristTicketServiceRow[] => {
    const items = asRecord(posContext).ticket_services;
    const arr = Array.isArray(items) ? items : [];
    return arr
      .map((item: unknown): TouristTicketServiceRow => {
        const r = asRecord(item);
        return {
          service_id: Number(r.service_id),
          service_name: String(r.service_name || ""),
          price: Number(r.price || 0),
        };
      })
      .filter(
        (s: TouristTicketServiceRow) =>
          Number.isFinite(s.service_id) && Boolean(s.service_name),
      );
  }, [posContext]);

  const areaOptions = useMemo(
    () =>
      (areas || []).map((a) => ({
        value: Number(a.area_id),
        label: String(a.area_name || `#${a.area_id}`),
      })),
    [areas],
  );

  const roomAreaOptions = useMemo(
    () => [{ value: -1, label: "(Không khu)" }, ...areaOptions],
    [areaOptions],
  );

  const roomCategoryOptions = useMemo(
    () =>
      (roomCategories || []).map((c) => ({
        value: Number(c.category_id),
        label: String(c.category_name || `#${c.category_id}`),
      })),
    [roomCategories],
  );

  const roomCategoryById = useMemo(() => {
    const map: Record<number, ServiceCategoryRow> = {};
    for (const c of roomCategories || []) {
      const id = Number(c.category_id);
      if (!Number.isFinite(id)) continue;
      map[id] = c;
    }
    return map;
  }, [roomCategories]);

  const tableAreaOptions = roomAreaOptions;

  const filteredTableList = useMemo(() => {
    if (tableListArea === "all") return tables;
    const areaId = Number(tableListArea);
    if (!Number.isFinite(areaId)) return tables;
    return tables.filter((table) => Number(table.area_id) === areaId);
  }, [tableListArea, tables]);

  const selectedTableIdSet = useMemo(
    () =>
      new Set(
        (selectedTableIds || [])
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x)),
      ),
    [selectedTableIds],
  );

  const selectTablesByAreas = useCallback(
    (areaIds: number[] | null) => {
      const set = new Set(
        (areaIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)),
      );
      const ids = (tables || [])
        .filter((t) => {
          if (!areaIds || set.size === 0) return true;
          const id = t.area_id == null ? -1 : Number(t.area_id);
          return set.has(id);
        })
        .map((t) => Number(t.table_id))
        .filter((x) => Number.isFinite(x));
      setSelectedTableIds(ids);
    },
    [tables],
  );

  const toggleTableSelected = useCallback((tableId: number) => {
    const id = Number(tableId);
    if (!Number.isFinite(id)) return;
    setSelectedTableIds((prev) => {
      const set = new Set((prev || []).map((x) => Number(x)));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }, []);

  const bulkDeleteSelectedTables = useCallback(async () => {
    const ids = (selectedTableIds || [])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x));
    if (ids.length === 0) {
      message.warning("Chưa chọn bàn nào");
      return;
    }

    const deletableSet = new Set(
      (tables || [])
        .filter((t) => String(t.status) === "free" && t.order_id == null)
        .map((t) => Number(t.table_id))
        .filter((x) => Number.isFinite(x)),
    );
    const deletable = ids.filter((id) => deletableSet.has(id));
    const skipped = ids.length - deletable.length;
    if (deletable.length === 0) {
      message.warning("Chỉ xóa được bàn đang trống và không có order mở");
      return;
    }

    setSaving(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const id of deletable) {
        try {
          await ownerApi.deletePosTable(id);
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) message.success(`Đã xóa ${ok} bàn`);
      if (skipped > 0) message.info(`Bỏ qua ${skipped} bàn không đủ điều kiện`);
      if (fail > 0) message.error(`Có ${fail} bàn xóa lỗi`);
      setSelectedTableIds([]);
      await loadPos();
    } finally {
      setSaving(false);
    }
  }, [loadPos, selectedTableIds, tables]);

  const selectedRoomIdSet = useMemo(
    () =>
      new Set(
        (selectedRoomIds || [])
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x)),
      ),
    [selectedRoomIds],
  );

  const selectRoomsByAreas = useCallback(
    (areaIds: number[] | null) => {
      const set = new Set(
        (areaIds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)),
      );
      const ids = (rooms || [])
        .filter((r) => {
          if (!areaIds || set.size === 0) return true;
          const id = r.area_id == null ? -1 : Number(r.area_id);
          return set.has(id);
        })
        .map((r) => Number(r.room_id))
        .filter((x) => Number.isFinite(x));
      setSelectedRoomIds(ids);
    },
    [rooms],
  );

  const toggleRoomSelected = useCallback((roomId: number) => {
    const id = Number(roomId);
    if (!Number.isFinite(id)) return;
    setSelectedRoomIds((prev) => {
      const set = new Set((prev || []).map((x) => Number(x)));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }, []);

  const bulkDeleteSelectedRooms = useCallback(async () => {
    const ids = (selectedRoomIds || [])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x));
    if (ids.length === 0) {
      message.warning("Chưa chọn phòng nào");
      return;
    }

    const vacantSet = new Set(
      (rooms || [])
        .filter((r) => String(r.status) === "vacant")
        .map((r) => Number(r.room_id))
        .filter((x) => Number.isFinite(x)),
    );
    const deletable = ids.filter((id) => vacantSet.has(id));
    const skipped = ids.length - deletable.length;

    if (deletable.length === 0) {
      message.warning("Chỉ xóa được phòng đang trống (vacant)");
      return;
    }

    setSaving(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const id of deletable) {
        try {
          const row = (rooms || []).find((r) => Number(r.room_id) === id);
          const serviceId =
            row?.service_id == null ? null : Number(row.service_id);
          if (Number.isFinite(serviceId)) {
            await ownerApi.deleteService(Number(serviceId));
          }
          await ownerApi.deleteHotelRoom(id);
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok > 0) message.success(`Đã xóa ${ok} phòng`);
      if (skipped > 0) message.info(`Bỏ qua ${skipped} phòng không trống`);
      if (fail > 0) message.error(`Có ${fail} phòng xóa lỗi`);
      setSelectedRoomIds([]);
      await loadHotelRooms();
    } finally {
      setSaving(false);
    }
  }, [loadHotelRooms, rooms, selectedRoomIds]);

  const areaNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const a of areas || []) {
      const id = Number(a.area_id);
      if (!Number.isFinite(id)) continue;
      const name = String(a.area_name || "").trim();
      if (name) map[id] = name;
    }
    return map;
  }, [areas]);

  const reloadAfterAreaChange = useCallback(async () => {
    if (locationType === "restaurant" || locationType === "cafe") {
      await loadPos();
      return;
    }
    await loadAreasOnly();
  }, [loadAreasOnly, loadPos, locationType]);

  const onCreateRoom = async () => {
    const v = (await roomForm.validateFields()) as Record<string, unknown>;
    setSaving(true);
    try {
      const categoryId = Number(v.category_id);
      const name = String(v.room_number || "").trim();
      const price = Number(v.price);

      if (!Number.isFinite(categoryId)) {
        message.warning("Chọn danh mục phòng");
        return;
      }
      if (!name) {
        message.warning("Nhập tên/số phòng");
        return;
      }
      if (!Number.isFinite(price)) {
        message.warning("Nhập giá phòng");
        return;
      }

      const category = roomCategoryById[categoryId];
      const floorNumber = Number(category?.sort_order);

      const svcRes = await ownerApi.createService(locationId, {
        category_id: categoryId,
        service_name: name,
        service_type: "room",
        price,
        quantity: 1,
        unit: "Phòng",
        status: "available",
      });

      const serviceId = Number(asRecord(asRecord(svcRes).data).service_id);
      if (!Number.isFinite(serviceId)) {
        throw new Error("Không tạo được dịch vụ phòng");
      }

      await ownerApi.createHotelRoom({
        location_id: locationId,
        service_id: serviceId,
        area_id: typeof v.area_id === "number" ? Number(v.area_id) : null,
        floor_number: Number.isFinite(floorNumber) ? floorNumber : 0,
        room_number: name,
      });

      message.success("Đã tạo phòng (đồng bộ Dịch vụ)");
      roomForm.resetFields(["room_number", "price"]);
      await loadHotelRooms();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tạo phòng"));
    } finally {
      setSaving(false);
    }
  };

  const onCreateArea = async () => {
    const v = (await areaForm.validateFields()) as Record<string, unknown>;
    setSaving(true);
    try {
      await ownerApi.createPosArea({
        location_id: locationId,
        area_name: String(v.area_name || "").trim(),
        sort_order: Math.max(1, Number(v.sort_order || 1)),
      });
      message.success("Đã tạo khu");
      areaForm.resetFields();
      await reloadAfterAreaChange();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tạo khu"));
    } finally {
      setSaving(false);
    }
  };

  const onCreateTable = async () => {
    const v = (await tableForm.validateFields()) as Record<string, unknown>;
    setSaving(true);
    try {
      await ownerApi.createPosTable({
        location_id: locationId,
        area_id: typeof v.area_id === "number" ? Number(v.area_id) : null,
        table_name: String(v.table_name || "").trim(),
        shape: String(v.shape) === "round" ? "round" : "square",
      });
      message.success("Đã tạo bàn");
      tableForm.resetFields(["table_name"]);
      await loadPos();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi tạo bàn"));
    } finally {
      setSaving(false);
    }
  };

  const openQuickCreateTables = () => {
    quickTableForm.resetFields();
    setQuickTableOpen(true);
  };

  const openQuickCreateRooms = () => {
    quickRoomForm.resetFields();
    setQuickRoomOpen(true);
  };

  const createTablesQuick = async () => {
    const v = (await quickTableForm.validateFields()) as Record<
      string,
      unknown
    >;
    const base = String(v.base_name || "").trim();
    const fromNumber = Number(v.from_number);
    const toNumber = Number(v.to_number);
    const shape = String(v.shape) === "round" ? "round" : "square";
    const areaId = typeof v.area_id === "number" ? Number(v.area_id) : null;
    const autoLayout = Boolean(v.auto_layout);

    if (!base) {
      message.error("Vui lòng nhập tên bàn");
      return;
    }
    if (!Number.isFinite(fromNumber) || fromNumber <= 0) {
      message.error("Số bắt đầu không hợp lệ");
      return;
    }
    if (!Number.isFinite(toNumber) || toNumber < fromNumber) {
      message.error("Số kết thúc không hợp lệ");
      return;
    }

    const quantity = toNumber - fromNumber + 1;
    if (quantity > 200) {
      message.error("Số lượng tối đa 200");
      return;
    }

    const existingCount = (tables || []).filter((t) =>
      areaId == null ? t.area_id == null : Number(t.area_id) === areaId,
    ).length;
    const tableW = 120;
    const tableH = 78;
    const gap = 14;
    const columns = 6;

    setQuickCreating(true);
    try {
      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (let n = fromNumber; n <= toNumber; n++) {
        const tableName = `${base}${base.endsWith(" ") ? "" : " "}${n}`;
        try {
          const res = await ownerApi.createPosTable({
            location_id: locationId,
            area_id: areaId,
            table_name: tableName,
            shape,
          });

          const tableId = Number((res as any)?.data?.table_id);
          if (autoLayout && Number.isFinite(tableId)) {
            const idx = existingCount + created;
            const col = idx % columns;
            const row = Math.floor(idx / columns);
            const x = 12 + col * (tableW + gap);
            const y = 12 + row * (tableH + gap);
            await ownerApi.updatePosTablePosition(tableId, {
              pos_x: x,
              pos_y: y,
            });
          }

          created++;
        } catch (err: unknown) {
          const msg = getErrorMessage(err, "Lỗi tạo bàn");
          if (String(msg).toLowerCase().includes("tồn tại")) {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      if (created > 0) message.success(`Đã tạo ${created}/${quantity} bàn`);
      if (skipped > 0) message.warning(`Bỏ qua ${skipped} bàn bị trùng tên`);
      if (failed > 0) message.error(`Có ${failed} bàn tạo lỗi`);

      setQuickTableOpen(false);
      await loadPos();
    } finally {
      setQuickCreating(false);
    }
  };

  const createRoomsQuick = async () => {
    const v = (await quickRoomForm.validateFields()) as Record<string, unknown>;
    const categoryId = Number(v.category_id);
    const price = Number(v.price);
    const prefix = String(v.prefix || "");
    const fromNumber = Number(v.from_number);
    const toNumber = Number(v.to_number);
    const autoLayout = Boolean(v.auto_layout);

    if (!Number.isFinite(categoryId)) {
      message.error("Chọn danh mục phòng");
      return;
    }
    if (!Number.isFinite(price)) {
      message.error("Nhập giá phòng");
      return;
    }
    if (!Number.isFinite(fromNumber) || fromNumber <= 0) {
      message.error("Số bắt đầu không hợp lệ");
      return;
    }
    if (!Number.isFinite(toNumber) || toNumber < fromNumber) {
      message.error("Số kết thúc không hợp lệ");
      return;
    }

    const quantity = toNumber - fromNumber + 1;
    if (quantity > 200) {
      message.error("Số lượng tối đa 200");
      return;
    }

    const existingCount = (rooms || []).length;
    const cardW = 150;
    const cardH = 86;
    const gap = 14;
    const columns = 6;

    const category = roomCategoryById[categoryId];
    const floorNumber = Number(category?.sort_order);

    setQuickCreating(true);
    try {
      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (let n = fromNumber; n <= toNumber; n++) {
        const roomNumber = prefix ? `${prefix}${n}` : String(n);
        let createdServiceId: number | null = null;
        try {
          const svcRes = await ownerApi.createService(locationId, {
            category_id: categoryId,
            service_name: roomNumber,
            service_type: "room",
            price,
            quantity: 1,
            unit: "Phòng",
            status: "available",
          });

          createdServiceId = Number(asRecord(asRecord(svcRes).data).service_id);
          if (!Number.isFinite(createdServiceId)) {
            throw new Error("Không tạo được dịch vụ phòng");
          }

          const res = await ownerApi.createHotelRoom({
            location_id: locationId,
            service_id: createdServiceId,
            area_id: null,
            floor_number: Number.isFinite(floorNumber) ? floorNumber : 0,
            room_number: roomNumber,
          });

          const roomId = Number((res as any)?.data?.room_id);
          if (autoLayout && Number.isFinite(roomId)) {
            const idx = existingCount + created;
            const col = idx % columns;
            const row = Math.floor(idx / columns);
            const x = 12 + col * (cardW + gap);
            const y = 12 + row * (cardH + gap);
            await ownerApi.updateHotelRoomPosition(roomId, {
              pos_x: x,
              pos_y: y,
            });
          }

          created++;
        } catch (err: unknown) {
          const msg = getErrorMessage(err, "Lỗi tạo phòng");
          if (Number.isFinite(createdServiceId)) {
            try {
              await ownerApi.deleteService(Number(createdServiceId));
            } catch {
              // best-effort cleanup
            }
          }
          if (String(msg).toLowerCase().includes("tồn tại")) {
            skipped++;
          } else {
            failed++;
          }
        }
      }

      if (created > 0) message.success(`Đã tạo ${created}/${quantity} phòng`);
      if (skipped > 0) message.warning(`Bỏ qua ${skipped} phòng bị trùng`);
      if (failed > 0) message.error(`Có ${failed} phòng tạo lỗi`);

      setQuickRoomOpen(false);
      await loadHotelRooms();
    } finally {
      setQuickCreating(false);
    }
  };

  const onDeleteTable = async (tableId: number) => {
    setSaving(true);
    try {
      const res = await ownerApi.deletePosTable(tableId);
      message.success(res?.message || "Đã xóa bàn");
      await loadPos();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi xóa bàn"));
    } finally {
      setSaving(false);
    }
  };

  const openEditArea = (row: AreaRow) => {
    setEditingArea(row);
    editAreaForm.setFieldsValue({
      area_name: row.area_name,
      sort_order: row.sort_order ?? 1,
    });
    setAreaModalOpen(true);
  };

  const saveArea = async () => {
    const v = (await editAreaForm.validateFields()) as Record<string, unknown>;
    if (!editingArea) return;
    setSaving(true);
    try {
      await ownerApi.updatePosArea(Number(editingArea.area_id), {
        area_name: String(v.area_name || "").trim(),
        sort_order: Math.max(1, Number(v.sort_order || 1)),
      });
      message.success("Đã cập nhật khu");
      setAreaModalOpen(false);
      await reloadAfterAreaChange();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi cập nhật khu"));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteArea = async (areaId: number) => {
    setSaving(true);
    try {
      const res = await ownerApi.deletePosArea(areaId);
      message.success(res?.message || "Đã xóa khu");
      if (String(mapArea) === String(areaId)) setMapArea("all");
      if (String(roomMapArea) === String(areaId)) setRoomMapArea("all");
      await reloadAfterAreaChange();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi xóa khu"));
    } finally {
      setSaving(false);
    }
  };

  const openEditTable = (row: TableRow) => {
    setEditingTable(row);
    editTableForm.setFieldsValue({
      area_id:
        typeof row.area_id === "number"
          ? row.area_id
          : row.area_id
            ? Number(row.area_id)
            : null,
      table_name: row.table_name,
      shape: row.shape || "square",
    });
    setTableModalOpen(true);
  };

  const saveTable = async () => {
    const v = (await editTableForm.validateFields()) as Record<string, unknown>;
    if (!editingTable) return;
    setSaving(true);
    try {
      await ownerApi.updatePosTable(Number(editingTable.table_id), {
        area_id: typeof v.area_id === "number" ? Number(v.area_id) : null,
        table_name: String(v.table_name || "").trim(),
        shape: String(v.shape) === "round" ? "round" : "square",
      });
      message.success("Đã cập nhật bàn");
      setTableModalOpen(false);
      await loadPos();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi cập nhật bàn"));
    } finally {
      setSaving(false);
    }
  };

  const openEditRoom = (row: RoomRow) => {
    setEditingRoom(row);
    editRoomForm.setFieldsValue({
      area_id: typeof row.area_id === "number" ? row.area_id : null,
      room_number: row.room_number,
      category_id:
        typeof row.category_id === "number" ? Number(row.category_id) : null,
      price: row.price == null ? null : Number(row.price),
    });
    setRoomModalOpen(true);
  };

  const saveRoom = async () => {
    const v = (await editRoomForm.validateFields()) as Record<string, unknown>;
    if (!editingRoom) return;
    setSaving(true);
    try {
      const serviceId =
        editingRoom.service_id == null ? null : Number(editingRoom.service_id);
      if (!Number.isFinite(Number(serviceId))) {
        message.error(
          "Phòng chưa liên kết dịch vụ. Vui lòng tạo phòng từ Dịch vụ.",
        );
        return;
      }

      const categoryId = Number(v.category_id);
      const name = String(v.room_number || "").trim();
      const price = Number(v.price);
      if (!Number.isFinite(categoryId)) {
        message.warning("Chọn danh mục phòng");
        return;
      }
      if (!name) {
        message.warning("Nhập tên/số phòng");
        return;
      }
      if (!Number.isFinite(price)) {
        message.warning("Nhập giá phòng");
        return;
      }

      const category = roomCategoryById[categoryId];
      const floorNumber = Number(category?.sort_order);

      await ownerApi.updateService(Number(serviceId), {
        category_id: categoryId,
        service_name: name,
        price,
      });

      await ownerApi.updateHotelRoom(Number(editingRoom.room_id), {
        area_id: typeof v.area_id === "number" ? Number(v.area_id) : null,
        floor_number: Number.isFinite(floorNumber) ? floorNumber : 0,
        room_number: name,
      });
      message.success("Đã cập nhật phòng");
      setRoomModalOpen(false);
      await loadHotelRooms();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi cập nhật phòng"));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteRoom = async (row: RoomRow) => {
    const roomId = Number(row.room_id);
    const serviceId = row.service_id == null ? null : Number(row.service_id);
    setSaving(true);
    try {
      if (Number.isFinite(serviceId)) {
        const sRes = await ownerApi.deleteService(Number(serviceId));
        message.success(sRes?.message || "Đã xóa/ngừng dịch vụ phòng");
      }
      const res = await ownerApi.deleteHotelRoom(roomId);
      message.success(res?.message || "Đã xóa phòng khỏi sơ đồ");
      await loadHotelRooms();
    } catch (err: unknown) {
      message.error(getErrorMessage(err, "Lỗi xóa phòng"));
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = locationTypeToVi(locationType);

  return (
    <MainLayout>
      <Card
        title={`Cấu hình sơ đồ vận hành • ${locationName || ""}`}
        extra={
          <Space>
            <Tag>{typeLabel}</Tag>
            <Button onClick={() => navigate("/owner/locations")}>
              Quay lại
            </Button>
          </Space>
        }
        loading={loading}
      >
        {(locationType === "hotel" || locationType === "resort") && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card
              title="Sơ đồ phòng (kéo thả để sắp xếp)"
              size="small"
              extra={
                <Space>
                  <Checkbox
                    checked={roomMultiSelect}
                    onChange={(e) => {
                      const next = Boolean(e.target.checked);
                      setRoomMultiSelect(next);
                      if (!next) {
                        setRoomMapAreas([]);
                        setSelectedRoomIds([]);
                      }
                    }}
                  >
                    Đa chọn
                  </Checkbox>

                  <Segmented
                    options={roomCategoryFilterOptions}
                    value={roomMapCategory}
                    onChange={(v) => setRoomMapCategory(String(v))}
                  />

                  {roomMultiSelect ? (
                    <Select
                      mode="multiple"
                      allowClear
                      style={{ minWidth: 260 }}
                      placeholder="Chọn khu (sơ đồ) (để trống = tất cả)"
                      options={roomAreaOptions}
                      value={roomMapAreas}
                      onChange={(v) =>
                        setRoomMapAreas((v || []).map((x) => Number(x)))
                      }
                    />
                  ) : null}

                  {roomMultiSelect && (
                    <Space>
                      <Button
                        onClick={() =>
                          selectRoomsByAreas(
                            (roomMapAreas || []).length ? roomMapAreas : null,
                          )
                        }
                        disabled={saving || rooms.length === 0}
                      >
                        Chọn hết
                      </Button>
                      <Button
                        onClick={() => setSelectedRoomIds([])}
                        disabled={saving || selectedRoomIds.length === 0}
                      >
                        Bỏ chọn
                      </Button>
                      <Popconfirm
                        title={`Xóa ${selectedRoomIds.length} phòng đã chọn?`}
                        description="Chỉ xóa được phòng đang trống (vacant)."
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={bulkDeleteSelectedRooms}
                        disabled={saving || selectedRoomIds.length === 0}
                      >
                        <Button
                          danger
                          disabled={saving || selectedRoomIds.length === 0}
                        >
                          Xóa đã chọn
                        </Button>
                      </Popconfirm>
                    </Space>
                  )}
                  <Button onClick={loadHotelRooms}>Tải lại</Button>
                </Space>
              }
            >
              <div className="text-xs text-gray-500 mb-2">
                Kéo thả phòng để set vị trí (pos_x/pos_y). Vị trí được lưu vào
                DB để Front-office hiển thị đúng sơ đồ.
              </div>
              <div
                ref={roomMapRef}
                style={{
                  position: "relative",
                  width: "100%",
                  height: 520,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fafafa",
                  overflow: "hidden",
                }}
              >
                {roomsForMap.map((r) => {
                  const id = Number(r.room_id);
                  const p = roomPositions[id] || { x: 0, y: 0 };
                  const canDrag =
                    !roomMultiSelect && String(r.status) === "vacant";
                  const categoryLabel = r.category_name
                    ? String(r.category_name)
                    : typeof r.category_id === "number" &&
                        Number.isFinite(r.category_id)
                      ? `#${r.category_id}`
                      : "";
                  const areaLabel = r.area_name
                    ? String(r.area_name)
                    : typeof r.area_id === "number" &&
                        Number.isFinite(r.area_id)
                      ? areaNameById[r.area_id] || `#${r.area_id}`
                      : "";
                  const isSelected = selectedRoomIdSet.has(id);
                  return (
                    <div
                      key={r.room_id}
                      onPointerDown={
                        canDrag ? (e) => startRoomDrag(e, r) : undefined
                      }
                      onClick={() => {
                        if (!roomMultiSelect) return;
                        toggleRoomSelected(id);
                      }}
                      style={{
                        position: "absolute",
                        left: p.x,
                        top: p.y,
                        width: 160,
                        height: 90,
                        border: isSelected
                          ? "2px solid #1677ff"
                          : "1px solid #d1d5db",
                        borderRadius: 14,
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: 10,
                        cursor: canDrag ? "grab" : "not-allowed",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        userSelect: "none",
                        opacity: canDrag ? 1 : 0.72,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{r.room_number}</div>
                        {roomTag(String(r.status))}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {(categoryLabel ? `${categoryLabel} • ` : "") +
                          (areaLabel ? `${areaLabel} • ` : "") +
                          `Tầng: ${r.floor_number}`}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {r.price == null || r.price === ""
                          ? "-"
                          : formatMoney(Number(r.price))}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {roomMultiSelect
                          ? isSelected
                            ? "Đã chọn"
                            : "Bấm để chọn"
                          : canDrag
                            ? `x:${Math.round(p.x)} y:${Math.round(p.y)}`
                            : "Chỉ kéo được phòng trống"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Divider style={{ margin: 0 }} />

            <Card title="Tạo danh mục phòng" size="small">
              <Form
                form={roomCategoryForm}
                layout="inline"
                initialValues={{ sort_order: 1 }}
              >
                <Form.Item
                  name="category_name"
                  label="Tên danh mục"
                  rules={[{ required: true, message: "Nhập tên danh mục" }]}
                >
                  <Input
                    style={{ width: 260 }}
                    placeholder="Ví dụ: Tầng trệt"
                  />
                </Form.Item>
                <Form.Item name="sort_order" label="Thứ tự">
                  <InputNumber min={0} style={{ width: 120 }} />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={onCreateRoomCategory}
                    loading={saving}
                  >
                    Tạo
                  </Button>
                </Form.Item>
              </Form>
              <div className="text-xs text-gray-500 mt-2">
                Danh mục ở đây dùng chung với mục <b>Dịch vụ</b> (Admin duyệt).
              </div>
            </Card>

            <Card
              title={`Danh sách danh mục (${roomCategories.length})`}
              size="small"
              extra={<Button onClick={loadRoomCategories}>Tải lại</Button>}
            >
              <Table<ServiceCategoryRow>
                rowKey="category_id"
                dataSource={roomCategories}
                pagination={{ pageSize: 10 }}
                sticky
                scroll={{ y: 300 }}
                columns={[
                  { title: "Tên danh mục", dataIndex: "category_name" },
                  {
                    title: "Thứ tự",
                    dataIndex: "sort_order",
                    width: 120,
                    align: "right",
                    sorter: (a, b) =>
                      Number(a.sort_order || 0) - Number(b.sort_order || 0),
                  },
                  {
                    title: "Hành động",
                    key: "actions",
                    width: 220,
                    render: (_: unknown, r: ServiceCategoryRow) => (
                      <Space>
                        <Button
                          size="small"
                          onClick={() => openEditRoomCategory(r)}
                        >
                          Sửa
                        </Button>
                        <Popconfirm
                          title="Xóa danh mục này?"
                          description="Chỉ xóa được khi danh mục chưa có dịch vụ."
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() =>
                            onDeleteRoomCategory(Number(r.category_id))
                          }
                        >
                          <Button size="small" danger>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="Tạo phòng" size="small">
              <Form
                form={roomForm}
                layout="inline"
                initialValues={{
                  category_id:
                    roomCategories?.[0]?.category_id != null
                      ? Number(roomCategories[0].category_id)
                      : undefined,
                }}
              >
                <Form.Item name="area_id" label="Khu (sơ đồ)">
                  <Select
                    allowClear
                    placeholder="(Tuỳ chọn)"
                    style={{ width: 220 }}
                    options={areaOptions}
                  />
                </Form.Item>
                <Form.Item
                  name="category_id"
                  label="Danh mục"
                  rules={[{ required: true, message: "Chọn danh mục" }]}
                >
                  <Select
                    style={{ width: 220 }}
                    options={roomCategoryOptions}
                    placeholder="Chọn danh mục phòng"
                  />
                </Form.Item>
                <Form.Item
                  name="room_number"
                  label="Tên/Số phòng"
                  rules={[{ required: true, message: "Nhập tên/số phòng" }]}
                >
                  <Input
                    style={{ width: 220 }}
                    placeholder="Ví dụ: Phòng 101"
                  />
                </Form.Item>
                <Form.Item
                  name="price"
                  label="Giá"
                  rules={[{ required: true, message: "Nhập giá" }]}
                >
                  <InputNumber min={0} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={onCreateRoom}
                    loading={saving || quickCreating}
                  >
                    Tạo
                  </Button>
                </Form.Item>
                <Form.Item>
                  <Button
                    onClick={openQuickCreateRooms}
                    disabled={saving || quickCreating}
                  >
                    Tạo nhanh
                  </Button>
                </Form.Item>
              </Form>
              <div className="text-xs text-gray-500 mt-2">
                Phòng khách sạn lấy thông tin từ mục <b>Dịch vụ</b> (danh mục +
                giá). Sơ đồ chỉ dùng để gán khu/vị trí kéo thả.
              </div>
            </Card>

            <Card
              title={`Danh sách phòng (${rooms.length})`}
              size="small"
              extra={
                <Space>
                  {roomMultiSelect && (
                    <div className="text-xs text-gray-600">
                      Đã chọn: <b>{selectedRoomIds.length}</b>
                    </div>
                  )}
                  <Button onClick={loadHotelRooms}>Tải lại</Button>
                </Space>
              }
            >
              <Table
                rowKey="room_id"
                dataSource={rooms}
                pagination={{ pageSize: 20 }}
                sticky
                scroll={{ y: 420 }}
                rowSelection={
                  roomMultiSelect
                    ? {
                        selectedRowKeys: selectedRoomIds,
                        preserveSelectedRowKeys: true,
                        onChange: (keys) =>
                          setSelectedRoomIds(
                            (keys || [])
                              .map((x) => Number(x))
                              .filter((x) => Number.isFinite(x)),
                          ),
                      }
                    : undefined
                }
                columns={[
                  {
                    title: "Ảnh",
                    dataIndex: "images",
                    width: 80,
                    render: (_: unknown, row: RoomRow) => {
                      const img = normalizeImages(row.images)?.[0] || "";
                      if (!img) return "-";
                      const src = resolveBackendUrl(img) || img;
                      return (
                        <img
                          src={src}
                          alt={row.room_number || "Room"}
                          className="w-10 h-10 object-cover rounded border bg-white"
                        />
                      );
                    },
                  },
                  {
                    title: "Danh mục",
                    dataIndex: "category_name",
                    width: 200,
                    render: (_: unknown, row: RoomRow) => {
                      if (row.category_name) return String(row.category_name);
                      const id = row.category_id;
                      if (typeof id === "number" && Number.isFinite(id)) {
                        return `#${id}`;
                      }
                      return "-";
                    },
                  },
                  {
                    title: "Khu (sơ đồ)",
                    dataIndex: "area_id",
                    width: 200,
                    render: (_: unknown, row: RoomRow) => {
                      if (row.area_name) return String(row.area_name);
                      const id = row.area_id;
                      if (typeof id === "number" && Number.isFinite(id)) {
                        return areaNameById[id] || `#${id}`;
                      }
                      return "-";
                    },
                  },
                  { title: "Tầng", dataIndex: "floor_number", width: 90 },
                  { title: "Phòng", dataIndex: "room_number" },
                  {
                    title: "Giá",
                    dataIndex: "price",
                    width: 140,
                    render: (v: unknown) =>
                      v == null || v === "" ? "-" : formatMoney(Number(v)),
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 140,
                    render: (s: string) => roomTag(String(s)),
                  },
                  {
                    title: "Hành động",
                    key: "actions",
                    width: 220,
                    render: (_: unknown, row: RoomRow) => {
                      const roomId = Number(row.room_id);
                      const disabled =
                        saving ||
                        !Number.isFinite(roomId) ||
                        String(row.status) !== "vacant";
                      const reason =
                        String(row.status) !== "vacant"
                          ? "Chỉ xóa được phòng đang trống"
                          : "";

                      return (
                        <Space>
                          <Button
                            size="small"
                            onClick={() => openEditRoom(row)}
                            disabled={saving || !Number.isFinite(roomId)}
                          >
                            Sửa
                          </Button>
                          <Popconfirm
                            title="Xóa phòng này?"
                            description={
                              reason || "Phòng sẽ bị xóa khỏi sơ đồ."
                            }
                            okText="Xóa"
                            cancelText="Hủy"
                            onConfirm={() => onDeleteRoom(row)}
                            disabled={disabled}
                          >
                            <Button size="small" danger disabled={disabled}>
                              Xóa
                            </Button>
                          </Popconfirm>
                        </Space>
                      );
                    },
                  },
                ]}
              />
            </Card>
          </Space>
        )}

        {(locationType === "restaurant" || locationType === "cafe") && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card
              title="Sơ đồ bàn"
              size="small"
              extra={
                <Space>
                  <Checkbox
                    checked={tableMultiSelect}
                    onChange={(e) => {
                      const next = Boolean(e.target.checked);
                      setTableMultiSelect(next);
                      if (!next) {
                        setTableMapAreas([]);
                        setSelectedTableIds([]);
                      }
                    }}
                  >
                    Đa chọn
                  </Checkbox>

                  {!tableMultiSelect ? (
                    <Segmented
                      options={mapAreaOptions}
                      value={mapArea}
                      onChange={(v) => setMapArea(String(v))}
                    />
                  ) : (
                    <Select
                      mode="multiple"
                      allowClear
                      style={{ minWidth: 260 }}
                      placeholder="Chọn khu (để trống = tất cả)"
                      options={tableAreaOptions}
                      value={tableMapAreas}
                      onChange={(v) =>
                        setTableMapAreas((v || []).map((x) => Number(x)))
                      }
                    />
                  )}

                  {tableMultiSelect && (
                    <Space>
                      <Button
                        onClick={() =>
                          selectTablesByAreas(
                            (tableMapAreas || []).length ? tableMapAreas : null,
                          )
                        }
                        disabled={saving || tables.length === 0}
                      >
                        Chọn hết
                      </Button>
                      <Button
                        onClick={() => setSelectedTableIds([])}
                        disabled={saving || selectedTableIds.length === 0}
                      >
                        Bỏ chọn
                      </Button>
                      <Popconfirm
                        title={`Xóa ${selectedTableIds.length} bàn đã chọn?`}
                        description="Chỉ xóa bàn trống và không có order mở."
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={bulkDeleteSelectedTables}
                        disabled={saving || selectedTableIds.length === 0}
                      >
                        <Button
                          danger
                          disabled={saving || selectedTableIds.length === 0}
                        >
                          Xóa đã chọn
                        </Button>
                      </Popconfirm>
                    </Space>
                  )}
                  <Button onClick={loadPos}>Tải lại</Button>
                </Space>
              }
            >
              <div className="text-xs text-gray-500 mb-2">
                Kéo thả bàn để sắp xếp thứ tự hiển thị trên Front-office.
              </div>
              <div
                ref={mapRef}
                className="relative w-full h-[520px] rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden"
              >
                <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(59,130,246,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
                {tablesForMap.map((t) => {
                  const id = Number(t.table_id);
                  const p = positions[id] || { x: 0, y: 0 };
                  const isRound = String(t.shape) === "round";
                  const isSelected = selectedTableIdSet.has(id);
                  return (
                    <div
                      key={t.table_id}
                      onPointerDown={
                        tableMultiSelect ? undefined : (e) => startDrag(e, t)
                      }
                      onClick={() => {
                        if (!tableMultiSelect) return;
                        toggleTableSelected(id);
                      }}
                      style={{
                        position: "absolute",
                        left: p.x,
                        top: p.y,
                        width: 130,
                        height: 80,
                        border: isSelected
                          ? "2px solid #1677ff"
                          : "1px solid #d1d5db",
                        borderRadius: isRound ? 999 : 14,
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: 10,
                        cursor: tableMultiSelect ? "pointer" : "grab",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        userSelect: "none",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{t.table_name}</div>
                        {tableTag(String(t.status))}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {tableMultiSelect
                          ? isSelected
                            ? "Đã chọn"
                            : "Bấm để chọn"
                          : "Kéo để sắp xếp"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Divider style={{ margin: 0 }} />

            <Card title="Tạo khu" size="small">
              <Form
                form={areaForm}
                layout="inline"
                initialValues={{ sort_order: 1 }}
              >
                <Form.Item
                  name="area_name"
                  label="Tên khu"
                  rules={[{ required: true, message: "Nhập tên khu" }]}
                >
                  <Input style={{ width: 220 }} placeholder="Ví dụ: Tầng 1" />
                </Form.Item>
                <Form.Item name="sort_order" label="Thứ tự">
                  <InputNumber min={1} style={{ width: 120 }} />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={onCreateArea}
                    loading={saving}
                  >
                    Tạo
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Card
              title={`Danh sách khu (${areas.length})`}
              size="small"
              extra={<Button onClick={loadPos}>Tải lại</Button>}
            >
              <Table<AreaRow>
                rowKey="area_id"
                dataSource={areas}
                pagination={{ pageSize: 20 }}
                sticky
                scroll={{ y: 300 }}
                columns={[
                  { title: "Khu", dataIndex: "area_name" },
                  { title: "Thứ tự", dataIndex: "sort_order", width: 120 },
                  {
                    title: "Hành động",
                    width: 180,
                    render: (_: unknown, r: AreaRow) => (
                      <Space>
                        <Button
                          size="small"
                          onClick={() => openEditArea(r)}
                          disabled={saving}
                        >
                          Sửa
                        </Button>
                        <Popconfirm
                          title="Xóa khu này?"
                          description="Các bàn thuộc khu sẽ được chuyển sang khu = NULL."
                          okText="Xóa"
                          cancelText="Hủy"
                          onConfirm={() => onDeleteArea(Number(r.area_id))}
                          disabled={saving}
                        >
                          <Button size="small" danger disabled={saving}>
                            Xóa
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>

            <Card title="Tạo bàn" size="small">
              <Form
                form={tableForm}
                layout="inline"
                initialValues={{
                  area_id: areaOptions?.[0]?.value ?? undefined,
                  shape: "square",
                }}
              >
                <Form.Item name="area_id" label="Khu">
                  <Select
                    allowClear
                    style={{ width: 220 }}
                    options={areaOptions}
                    placeholder="(không chọn)"
                  />
                </Form.Item>
                <Form.Item
                  name="table_name"
                  label="Tên bàn"
                  rules={[{ required: true, message: "Nhập tên bàn" }]}
                >
                  <Input style={{ width: 220 }} placeholder="Ví dụ: B1" />
                </Form.Item>
                <Form.Item name="shape" label="Hình">
                  <Select
                    style={{ width: 140 }}
                    options={[
                      { value: "square", label: "Vuông" },
                      { value: "round", label: "Tròn" },
                    ]}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={onCreateTable}
                    loading={saving || quickCreating}
                  >
                    Tạo
                  </Button>
                </Form.Item>
                <Form.Item>
                  <Button
                    onClick={openQuickCreateTables}
                    disabled={saving || quickCreating}
                  >
                    Tạo nhanh
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Card
              title={`Danh sách bàn (${filteredTableList.length}/${tables.length})`}
              size="small"
              extra={
                <Space wrap>
                  <Segmented
                    options={tableListAreaOptions}
                    value={tableListArea}
                    onChange={(value) => setTableListArea(String(value))}
                  />
                  {tableMultiSelect && (
                    <div className="text-xs text-gray-600">
                      Đã chọn: <b>{selectedTableIds.length}</b>
                    </div>
                  )}
                  <Button onClick={loadPos}>Tải lại</Button>
                </Space>
              }
            >
              <Table<TableRow>
                rowKey="table_id"
                dataSource={filteredTableList}
                pagination={{ pageSize: 20 }}
                sticky
                scroll={{ y: 420 }}
                rowSelection={
                  tableMultiSelect
                    ? {
                        selectedRowKeys: selectedTableIds,
                        preserveSelectedRowKeys: true,
                        onChange: (keys) =>
                          setSelectedTableIds(
                            (keys || [])
                              .map((x) => Number(x))
                              .filter((x) => Number.isFinite(x)),
                          ),
                      }
                    : undefined
                }
                columns={[
                  {
                    title: "Bàn",
                    dataIndex: "table_name",
                    sorter: (a, b) =>
                      String(a.table_name || "").localeCompare(
                        String(b.table_name || ""),
                        "vi",
                        { numeric: true, sensitivity: "base" },
                      ),
                  },
                  {
                    title: "Khu",
                    dataIndex: "area_id",
                    render: (v: unknown) => {
                      const id = Number(v);
                      const a = (areas || []).find(
                        (x) => Number(x.area_id) === id,
                      );
                      return a ? String(a.area_name) : v ? `#${v}` : "-";
                    },
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    width: 140,
                    render: (s: string) => tableTag(String(s)),
                  },
                  {
                    title: "Hành động",
                    key: "actions",
                    width: 200,
                    render: (_: unknown, r: TableRow) => {
                      const tableId = Number(r.table_id);
                      const hasOpenOrder = r.order_id != null;
                      const disabled =
                        saving ||
                        !Number.isFinite(tableId) ||
                        String(r.status) !== "free" ||
                        hasOpenOrder;
                      const reason = hasOpenOrder
                        ? "Bàn đang có order mở"
                        : String(r.status) !== "free"
                          ? "Chỉ xóa được bàn đang trống"
                          : "";

                      return (
                        <Space>
                          <Button
                            size="small"
                            onClick={() => openEditTable(r)}
                            disabled={saving || !Number.isFinite(tableId)}
                          >
                            Sửa
                          </Button>
                          <Popconfirm
                            title="Xóa bàn này?"
                            description={
                              reason ||
                              "Bàn sẽ bị xóa khỏi sơ đồ. Các order cũ (nếu có) sẽ được giữ lại (table_id sẽ NULL)."
                            }
                            okText="Xóa"
                            cancelText="Hủy"
                            onConfirm={() => onDeleteTable(tableId)}
                            disabled={disabled}
                          >
                            <Button danger size="small" disabled={disabled}>
                              Xóa
                            </Button>
                          </Popconfirm>
                        </Space>
                      );
                    },
                  },
                ]}
              />
            </Card>
          </Space>
        )}

        {locationType === "tourist" && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Card title="Cấu hình vận hành (Du lịch)">
              <Space direction="vertical" style={{ width: "100%" }}>
                <div className="text-sm text-gray-700">
                  Vé Tourist dùng <b>Dịch vụ</b> dạng <b>ticket</b>. Nhân viên
                  sẽ <b>quét vé</b> tại cổng và hệ thống tự đổi trạng thái vé
                  sang <b>Đã sử dụng</b>.
                </div>
                <Space wrap>
                  <Button
                    type="primary"
                    onClick={() => {
                      if (Number.isFinite(locationId)) {
                        try {
                          localStorage.setItem(
                            FRONT_OFFICE_STORAGE_KEY,
                            String(locationId),
                          );
                        } catch {
                          // ignore
                        }
                      }
                      navigate("/owner/front-office");
                    }}
                  >
                    Mở Front-office (Quét/Bán vé)
                  </Button>
                  <Button onClick={() => navigate("/owner/services")}>
                    Quản lý dịch vụ vé
                  </Button>
                  <Button onClick={() => navigate("/owner/employees")}>
                    Quản lý nhân viên
                  </Button>
                  <Button onClick={() => navigate("/owner/logs")}>
                    Xem nhật ký
                  </Button>
                </Space>
                <div className="text-xs text-gray-500">
                  Gợi ý: tạo nhân viên và cấp quyền <b>can_scan</b> để soát vé.
                </div>
              </Space>
            </Card>

            <Card title="Danh sách loại vé (service_type = ticket)">
              <Table
                rowKey="service_id"
                dataSource={touristTicketServices}
                pagination={false}
                locale={{ emptyText: "Chưa có dịch vụ vé" }}
                columns={[
                  {
                    title: "Tên vé",
                    dataIndex: "service_name",
                  },
                  {
                    title: "Giá",
                    dataIndex: "price",
                    width: 160,
                    render: (v: unknown) => formatMoney(Number(v || 0)),
                  },
                ]}
              />
              <div className="text-xs text-gray-500 mt-2">
                Nếu bạn vừa tạo dịch vụ vé, hãy bấm “Tải lại” ở trang này hoặc
                Front-office để cập nhật danh sách.
              </div>
            </Card>
          </Space>
        )}

        <Modal
          title="Cập nhật khu"
          open={areaModalOpen}
          onCancel={() => setAreaModalOpen(false)}
          onOk={saveArea}
          confirmLoading={saving}
          okText="Lưu"
        >
          <Form form={editAreaForm} layout="vertical">
            <Form.Item
              name="area_name"
              label="Tên khu"
              rules={[{ required: true, message: "Nhập tên khu" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="sort_order" label="Thứ tự" initialValue={1}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={
            editingTable
              ? `Cập nhật bàn ${editingTable.table_name}`
              : "Cập nhật bàn"
          }
          open={tableModalOpen}
          onCancel={() => setTableModalOpen(false)}
          onOk={saveTable}
          confirmLoading={saving}
          okText="Lưu"
        >
          <Form form={editTableForm} layout="vertical">
            <Form.Item name="area_id" label="Khu">
              <Select
                allowClear
                options={areaOptions}
                placeholder="(không chọn)"
              />
            </Form.Item>
            <Form.Item
              name="table_name"
              label="Tên bàn"
              rules={[{ required: true, message: "Nhập tên bàn" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="shape" label="Hình" initialValue="square">
              <Select
                options={[
                  { value: "square", label: "Vuông" },
                  { value: "round", label: "Tròn" },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={
            editingRoom
              ? `Cập nhật phòng ${editingRoom.room_number}`
              : "Cập nhật phòng"
          }
          open={roomModalOpen}
          onCancel={() => setRoomModalOpen(false)}
          onOk={saveRoom}
          confirmLoading={saving}
          okText="Lưu"
        >
          <Form form={editRoomForm} layout="vertical">
            <Form.Item name="area_id" label="Khu (sơ đồ)">
              <Select
                allowClear
                options={areaOptions}
                placeholder="(không chọn)"
              />
            </Form.Item>
            <Form.Item
              name="category_id"
              label="Danh mục"
              rules={[{ required: true, message: "Chọn danh mục" }]}
            >
              <Select
                options={roomCategoryOptions}
                placeholder="Chọn danh mục"
              />
            </Form.Item>
            <Form.Item
              name="room_number"
              label="Tên/Số phòng"
              rules={[{ required: true, message: "Nhập tên/số phòng" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="price"
              label="Giá"
              rules={[{ required: true, message: "Nhập giá" }]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={
            editingRoomCategory
              ? `Cập nhật danh mục ${editingRoomCategory.category_name}`
              : "Cập nhật danh mục"
          }
          open={roomCategoryModalOpen}
          onCancel={() => setRoomCategoryModalOpen(false)}
          onOk={saveRoomCategory}
          confirmLoading={saving}
          okText="Lưu"
          cancelText="Hủy"
        >
          <Form form={editRoomCategoryForm} layout="vertical">
            <Form.Item
              name="category_name"
              label="Tên danh mục"
              rules={[{ required: true, message: "Nhập tên danh mục" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="sort_order" label="Thứ tự">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Tạo nhanh bàn"
          open={quickTableOpen}
          onCancel={() => setQuickTableOpen(false)}
          onOk={createTablesQuick}
          confirmLoading={quickCreating}
          okText="Tạo"
          cancelText="Hủy"
        >
          <Form form={quickTableForm} layout="vertical">
            <Form.Item name="area_id" label="Khu">
              <Select
                allowClear
                options={areaOptions}
                placeholder="(không chọn)"
              />
            </Form.Item>

            <Space style={{ width: "100%" }} size="middle" align="start">
              <Form.Item
                name="base_name"
                label="Tên bàn"
                rules={[{ required: true, message: "Nhập tên bàn" }]}
                style={{ flex: 1 }}
              >
                <Input placeholder="Ví dụ: Bàn" />
              </Form.Item>
              <Form.Item
                name="from_number"
                label="Từ số"
                rules={[{ required: true, message: "Nhập số bắt đầu" }]}
              >
                <InputNumber min={1} style={{ width: 140 }} />
              </Form.Item>
              <Form.Item
                name="to_number"
                label="Đến số"
                rules={[{ required: true, message: "Nhập số kết thúc" }]}
              >
                <InputNumber min={1} style={{ width: 140 }} />
              </Form.Item>
            </Space>

            <Space style={{ width: "100%" }} size="middle" align="start">
              <Form.Item name="shape" label="Hình" style={{ width: 220 }}>
                <Select
                  options={[
                    { value: "square", label: "Vuông" },
                    { value: "round", label: "Tròn" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="auto_layout" valuePropName="checked" label=" ">
                <Checkbox>Lưu vị trí tự sắp xếp</Checkbox>
              </Form.Item>
            </Space>

            <div className="text-xs text-gray-500">
              Tạo theo dạng: <b>Tên</b> + khoảng trắng + số. Ví dụ: Bàn + 1..10
              → Bàn 1..Bàn 10.
            </div>
          </Form>
        </Modal>

        <Modal
          title="Tạo nhanh phòng"
          open={quickRoomOpen}
          onCancel={() => setQuickRoomOpen(false)}
          onOk={createRoomsQuick}
          confirmLoading={quickCreating}
          okText="Tạo"
          cancelText="Hủy"
        >
          <Form form={quickRoomForm} layout="vertical">
            <Form.Item
              name="category_id"
              label="Danh mục"
              rules={[{ required: true, message: "Chọn danh mục" }]}
            >
              <Select
                options={roomCategoryOptions}
                placeholder="Chọn danh mục"
              />
            </Form.Item>
            <Form.Item
              name="price"
              label="Giá"
              rules={[{ required: true, message: "Nhập giá" }]}
            >
              <InputNumber min={0} style={{ width: 200 }} />
            </Form.Item>

            <Space style={{ width: "100%" }} size="middle" align="start">
              <Form.Item
                name="prefix"
                label="Prefix (tuỳ chọn)"
                style={{ flex: 1 }}
              >
                <Input placeholder="Ví dụ: P (để trống nếu dùng số phòng)" />
              </Form.Item>
              <Form.Item
                name="from_number"
                label="Từ số"
                rules={[{ required: true, message: "Nhập số bắt đầu" }]}
              >
                <InputNumber min={1} style={{ width: 160 }} />
              </Form.Item>
              <Form.Item
                name="to_number"
                label="Đến số"
                rules={[{ required: true, message: "Nhập số kết thúc" }]}
              >
                <InputNumber min={1} style={{ width: 160 }} />
              </Form.Item>
            </Space>

            <div className="text-xs text-gray-500">
              Nếu có prefix: Prefix + số (ví dụ P + 101..110 → P101..P110). Nếu
              prefix trống: dùng số phòng (101..110).
            </div>

            <Form.Item
              name="auto_layout"
              valuePropName="checked"
              style={{ marginTop: 12 }}
            >
              <Checkbox>Lưu vị trí tự sắp xếp</Checkbox>
            </Form.Item>
          </Form>
        </Modal>

        {!locationType && (
          <div className="text-sm text-gray-500">Đang tải loại địa điểm...</div>
        )}

        {locationType &&
          !["hotel", "resort", "restaurant", "cafe", "tourist"].includes(
            locationType,
          ) && (
            <div className="text-sm text-gray-600">
              Loại địa điểm này chưa có sơ đồ vận hành riêng. Front-office sẽ
              dùng màn hình fallback (check-in/bookings).
            </div>
          )}
      </Card>
    </MainLayout>
  );
}
