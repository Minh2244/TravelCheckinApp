import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../../../contexts/SocketContext";

type SyncState = "idle" | "connected" | "disconnected";

type Params = {
  locationId: number | null;
  onSync: () => void;
};

const MIN_SYNC_GAP_MS = 1500;

const useTouristTicketSync = ({ locationId, onSync }: Params) => {
  const socket = useSocket();
  const [sseState, setSseState] = useState<SyncState>("idle");
  const onSyncRef = useRef(onSync);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const triggerSync = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncRef.current < MIN_SYNC_GAP_MS) return;
    lastSyncRef.current = now;
    onSyncRef.current();
  }, []);

  useEffect(() => {
    if (!locationId || !socket) {
      setSseState("disconnected");
      return;
    }

    setSseState("connected");

    const handleEvent = (data: any) => {
      try {
        if (data?.type !== "tourist_updated") return;
        if (Number(data.location_id) !== Number(locationId)) return;
        triggerSync();
      } catch {
        // ignore
      }
    };

    socket.on("realtime_event", handleEvent);

    return () => {
      socket.off("realtime_event", handleEvent);
    };
  }, [locationId, triggerSync, socket]);

  useEffect(() => {
    if (!locationId) return;

    const tick = () => {
      if (document.hidden) return;
      triggerSync();
    };

    // Use 4 seconds polling fallback when SSE is not connected, and 10 seconds silent backup when connected.
    const intervalMs = sseState === "connected" ? 10000 : 4000;
    const id = window.setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (!document.hidden) triggerSync();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locationId, sseState, triggerSync]);

  return { sseState };
};

export default useTouristTicketSync;
