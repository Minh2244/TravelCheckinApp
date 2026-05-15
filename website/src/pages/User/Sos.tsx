import { useEffect, useRef, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import sosApi from "../../api/sosApi";

const Sos = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [alertId, setAlertId] = useState<number | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const handleSendSos = () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await sosApi.sendSos({
            latitude,
            longitude,
            location_text: `${latitude}, ${longitude}`,
          });
          const newAlertId = res?.data?.alert_id ?? null;
          setAlertId(newAlertId);
          setTracking(true);
          setStatus("Đã gửi tín hiệu SOS và đang chia sẻ vị trí");
        } catch {
          setError("Không thể gửi tín hiệu SOS");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Không lấy được tọa độ GPS");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await sosApi.stopSos({ alert_id: alertId });
      setTracking(false);
      setStatus("Đã dừng chia sẻ SOS");
      setAlertId(null);
    } catch {
      setError("Không thể dừng SOS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tracking) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const sendPing = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await sosApi.pingSos({
              alert_id: alertId,
              latitude,
              longitude,
              location_text: `${latitude}, ${longitude}`,
              message: "SOS ping",
            });
            if (res?.data?.alert_id) setAlertId(res.data.alert_id);
            setLastPingAt(new Date().toLocaleTimeString());
          } catch {
            // ignore ping errors
          }
        },
        () => {
          // ignore
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    };

    sendPing();
    timerRef.current = window.setInterval(sendPing, 20000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [tracking, alertId]);

  return (
    <UserLayout title="SOS" activeKey="/user/sos">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">
          Gửi tín hiệu SOS
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Khi cần hỗ trợ khẩn cấp, nhấn nút SOS để gửi yêu cầu.
        </p>

        <div className="mt-10 flex flex-col items-center gap-6">
          <button
            type="button"
            className={`h-48 w-48 rounded-full text-white text-3xl font-bold shadow-lg ${
              tracking
                ? "bg-slate-700 hover:bg-slate-800"
                : "bg-red-500 hover:bg-red-600"
            }`}
            onClick={tracking ? handleStop : handleSendSos}
            disabled={loading}
          >
            {loading ? "..." : tracking ? "DỪNG" : "SOS"}
          </button>
          {status ? <p className="text-sm text-green-600">{status}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {tracking ? (
            <p className="text-xs text-gray-500">
              Đang chia sẻ vị trí · ping mỗi 20s
              {lastPingAt ? ` · lần cuối ${lastPingAt}` : ""}
            </p>
          ) : null}
          <div className="space-y-2 text-sm text-gray-600 text-center">
            <p>Tín hiệu sẽ được gửi đến trung tâm hỗ trợ.</p>
            <p>Hãy đảm bảo bạn bật định vị để xử lý nhanh hơn.</p>
            <p>Hệ thống sẽ ghi nhận vị trí GPS hiện tại.</p>
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default Sos;
