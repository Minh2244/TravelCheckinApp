import { useCallback, useEffect, useRef, useState } from "react";
import { resolveBackendUrl } from "../../../utils/resolveBackendUrl";

type SyncState = "idle" | "connected" | "disconnected";

type Params = {
  locationId: number | null;
  onSync: () => void;
};

const POLL_MS = 30000;
const MIN_SYNC_GAP_MS = 1500;

const useTouristTicketSync = ({ locationId, onSync }: Params) => {
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
    if (!locationId) return;

    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setSseState("disconnected");
      return;
    }

    const url = resolveBackendUrl(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    if (!url) {
      setSseState("disconnected");
      return;
    }

    let closed = false;
    const es = new EventSource(url);

    es.onopen = () => {
      if (closed) return;
      setSseState("connected");
    };

    es.onerror = () => {
      if (closed) return;
      setSseState("disconnected");
    };

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as {
          type?: string;
          location_id?: number;
        };
        if (data?.type !== "tourist_updated") return;
        if (Number(data.location_id) !== Number(locationId)) return;
        triggerSync();
      } catch {
        // ignore
      }
    };

    return () => {
      closed = true;
      es.close();
    };
  }, [locationId, triggerSync]);

  useEffect(() => {
    if (!locationId) return;
    if (sseState === "connected") return;

    const tick = () => {
      if (document.hidden) return;
      triggerSync();
    };

    const id = window.setInterval(tick, POLL_MS);
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
