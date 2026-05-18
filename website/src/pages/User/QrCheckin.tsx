import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import locationApi from "../../api/locationApi";
import type { Location } from "../../types/location.types";
import { getErrorMessage } from "../../utils/safe";
import { parseLocationIdFromQr } from "../../utils/parseLocationIdFromQr";
import {
  extractOpenClose,
  isWithinOpeningHours,
} from "../../utils/openingHours";

type Feedback = { type: "success" | "error"; message: string };

const QrCheckin = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [scanning, setScanning] = useState(true);
  const [rawText, setRawText] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);

  const [locInfo, setLocInfo] = useState<Location | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const parsedLocationId = useMemo(() => {
    if (rawText) return parseLocationIdFromQr(rawText);
    return parseLocationIdFromQr(manualId);
  }, [manualId, rawText]);

  useEffect(() => {
    const run = async () => {
      setLocInfo(null);
      const id = parsedLocationId;
      if (!id) return;

      setLocLoading(true);
      try {
        const res = await locationApi.getLocationById(id, "web");
        setLocInfo(res.data);
      } catch {
        setLocInfo(null);
      } finally {
        setLocLoading(false);
      }
    };
    void run();
  }, [parsedLocationId]);

  const openClose = useMemo(() => {
    return extractOpenClose(locInfo?.opening_hours ?? null, new Date());
  }, [locInfo?.opening_hours]);

  const isOpenNow = useMemo(() => {
    return isWithinOpeningHours(locInfo?.opening_hours ?? null, new Date());
  }, [locInfo?.opening_hours]);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    const start = async () => {
      if (!videoRef.current) return;
      setFeedback(null);
      setScanning(true);

      try {
        const reader = readerRef.current;
        if (!reader) return;

        controlsRef.current?.stop();
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              const text = result.getText();
              setRawText(text);
              setScanning(false);
              controlsRef.current?.stop();
              controlsRef.current = null;
            } else if (err) {
              // ignore decode misses
            }
          },
        );
      } catch (error) {
        console.error(error);
        setScanning(false);
        setFeedback({
          type: "error",
          message:
            "Không mở được camera. Hãy cấp quyền hoặc nhập location_id thủ công.",
        });
      }
    };

    start();

    return () => {
      try {
        controlsRef.current?.stop();
        controlsRef.current = null;
      } catch {
        // ignore
      }
    };
  }, []);

  const handleRescan = async () => {
    setRawText(null);
    setFeedback(null);
    setSafetyWarning(null);
    setScanning(true);

    try {
      if (!videoRef.current) return;
      controlsRef.current?.stop();
      controlsRef.current = null;
      const reader = readerRef.current;
      if (!reader) return;

      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText();
            setRawText(text);
            setScanning(false);
            controlsRef.current?.stop();
            controlsRef.current = null;
          } else if (err) {
            // ignore decode misses
          }
        },
      );
    } catch (error) {
      console.error(error);
      setScanning(false);
      setFeedback({
        type: "error",
        message:
          "Không mở được camera. Hãy cấp quyền hoặc nhập location_id thủ công.",
      });
    }
  };

  const handleCheckin = async () => {
    if (!parsedLocationId) {
      setFeedback({
        type: "error",
        message: "Không xác định được location_id.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setSafetyWarning(null);
    try {
      const coords = await new Promise<{
        latitude: number;
        longitude: number;
      } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
        );
      });

      const resp = await userApi.createCheckin({
        location_id: parsedLocationId,
        checkin_latitude: coords?.latitude ?? null,
        checkin_longitude: coords?.longitude ?? null,
        notes: notes.trim() ? notes.trim() : null,
      });

      if (!resp.success) {
        setFeedback({
          type: "error",
          message: resp.message ?? "Check-in thất bại",
        });
        return;
      }

      if (resp.data?.safety_warning && resp.data?.safety_message) {
        setSafetyWarning(resp.data.safety_message);
      }
      setFeedback({ type: "success", message: "Check-in thành công!" });
      navigate(`/user/location/${parsedLocationId}`);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "Check-in thất bại"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserLayout
      title="QR check-in"
      subtitle="Check-in nhanh"
      activeKey="/user/qr-checkin"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.6fr] gap-6">
        <section className="user-section p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 font-heading">Quét QR</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hỗ trợ mã dạng: số ID, "location:123", URL có /location/123,
                hoặc ?location_id=123
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
              onClick={handleRescan}
            >
              Quét lại
            </button>
          </div>

          <div className="mt-4 relative overflow-hidden rounded-3xl border-2 border-teal-400/40 bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl shadow-teal-500/10">
            <video
              ref={videoRef}
              className="h-[420px] w-full object-cover"
              muted
              playsInline
            />
            {/* Scanner overlay corners */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-4 w-12 h-12 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />
            </div>
            {/* Scan line animation */}
            {scanning ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-50/50 to-white p-4 shadow-sm">
            <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Kết quả</p>
            <p className="mt-1 text-sm text-gray-900 break-all">
              {rawText ? rawText : scanning ? "Đang quét..." : "Chưa có"}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-gray-500">location_id: </span>
              <span className="font-semibold text-gray-900">
                {parsedLocationId ?? "-"}
              </span>
            </p>
          </div>

          {feedback ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
          {safetyWarning ? (
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {safetyWarning}
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="user-section p-6">
            <h3 className="text-base font-semibold text-gray-900 font-heading">
              Check-in theo ID
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Nếu camera không hoạt động, nhập location_id thủ công.
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Mẹo: bật định vị để check-in chính xác hơn.
            </p>

            <div className="mt-4 space-y-3">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Ví dụ: 12"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                rows={3}
              />
              <button
                type="button"
                className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors duration-200 shadow-lg shadow-teal-500/25"
                onClick={handleCheckin}
                disabled={
                  submitting || !parsedLocationId || (!locLoading && !isOpenNow)
                }
              >
                {submitting ? "Đang check-in..." : "Check-in ngay"}
              </button>

              {!locLoading && parsedLocationId && !isOpenNow ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Đang đóng cửa
                  {openClose ? ` (${openClose.open} - ${openClose.close})` : ""}
                  .
                </div>
              ) : null}
              <button
                type="button"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors duration-200"
                onClick={() => navigate("/user/map")}
              >
                Về bản đồ check-in
              </button>
            </div>
          </div>

          <div className="user-section p-6">
            <h3 className="text-base font-semibold text-gray-900 font-heading">Gợi ý</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>- QR nên chứa `location_id` hoặc link chi tiết địa điểm.</li>
              <li>- Nếu check-in bị chặn, có thể do chống spam.</li>
            </ul>
          </div>
        </aside>
      </div>
    </UserLayout>
  );
};

export default QrCheckin;
