import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { resolveBackendUrl } from "../lib/url";

type StatusChangedData = {
  type?: string;
  action?: string;
  status?: string;
  table_id?: number | string;
  target_id?: number | string;
  location_id?: number | string;
};

type OnTableConflict = (tableId: number) => void;
type OnStatusChanged = (data: StatusChangedData) => void;

/**
 * Socket.IO hook for real-time booking status updates.
 * Joins a location's public room and listens for table/status changes.
 */
export function useBookingRealtime(
  locationId: number | undefined,
  opts?: {
    onTableConflict?: OnTableConflict;
    onStatusChanged?: OnStatusChanged;
    enabled?: boolean;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (opts?.enabled === false) return;
    if (!locationId || !Number.isFinite(locationId)) return;

    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socket = io(backendUrl);
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit("join_location_public", { locationId });
    };

    if (socket.connected) {
      joinRoom();
    }
    socket.on("connect", joinRoom);

    socket.on("public_status_changed", (data: StatusChangedData) => {
      optsRef.current?.onStatusChanged?.(data);

      // Auto-detect table conflict
      if (
        data?.type === "table" &&
        (data?.action === "table_reserved" || data?.status === "reserved")
      ) {
        const targetTableId = Number(data.table_id || data.target_id);
        if (targetTableId > 0) {
          optsRef.current?.onTableConflict?.(targetTableId);
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [locationId, opts?.enabled]);

  const joinRoom = useCallback((id: number) => {
    socketRef.current?.emit("join_location_public", { locationId: id });
  }, []);

  return { joinRoom, socket: socketRef };
}
