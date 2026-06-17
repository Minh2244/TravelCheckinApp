import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Input,
  Modal,
  Space,
  Typography,
  Upload,
  message,
} from "antd";
import {
  SaveOutlined,
  PercentageOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import MainLayout from "../../layouts/MainLayout";
import adminApi from "../../api/adminApi";
import { asRecord } from "../../utils/safe";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";

type SystemSettings = Record<string, string | null | undefined>;

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(false);

  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [backgroundTab, setBackgroundTab] = useState<"url" | "upload">("url");
  const [backgroundTarget, setBackgroundTarget] = useState<"login">("login");
  const [backgroundUrlInput, setBackgroundUrlInput] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    null,
  );
  const [backgroundSaving, setBackgroundSaving] = useState(false);

  // States for Image Cropping & Zooming
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const getRenderSize = () => {
    if (!imageSize) return { width: 0, height: 0 };
    const s0 = Math.max(480 / imageSize.width, 270 / imageSize.height);
    return {
      width: imageSize.width * s0 * zoom,
      height: imageSize.height * s0 * zoom,
    };
  };
  const renderSize = getRenderSize();

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setImageSize({ width: w, height: h });

    const s0 = Math.max(480 / w, 270 / h);
    const initialWidth = w * s0;
    const initialHeight = h * s0;

    setPosition({
      x: (480 - initialWidth) / 2,
      y: (270 - initialHeight) / 2,
    });
    setZoom(1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSize) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageSize) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    const limitX = 480 - renderSize.width;
    const limitY = 270 - renderSize.height;

    setPosition({
      x: Math.max(limitX, Math.min(0, newX)),
      y: Math.max(limitY, Math.min(0, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSize || e.touches.length === 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !imageSize || e.touches.length === 0) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;

    const limitX = 480 - renderSize.width;
    const limitY = 270 - renderSize.height;

    setPosition({
      x: Math.max(limitX, Math.min(0, newX)),
      y: Math.max(limitY, Math.min(0, newY)),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (newZoom: number) => {
    if (!imageSize) return;

    const W_c = 480;
    const H_c = 270;
    const C_x = W_c / 2;
    const C_y = H_c / 2;

    const px = (C_x - position.x) / zoom;
    const py = (C_y - position.y) / zoom;

    const s0 = Math.max(W_c / imageSize.width, H_c / imageSize.height);
    const newW = imageSize.width * s0 * newZoom;
    const newH = imageSize.height * s0 * newZoom;

    const newX = C_x - px * newZoom;
    const newY = C_y - py * newZoom;

    const limitX = W_c - newW;
    const limitY = H_c - newH;

    setPosition({
      x: Math.max(limitX, Math.min(0, newX)),
      y: Math.max(limitY, Math.min(0, newY)),
    });
    setZoom(newZoom);
  };

  const cropImage = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!backgroundPreview || !imageSize) {
        reject(new Error("No preview or size"));
        return;
      }
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot get context"));
          return;
        }

        const s0 = Math.max(480 / img.naturalWidth, 270 / img.naturalHeight);
        const currentScale = s0 * zoom;

        const sx = -position.x / currentScale;
        const sy = -position.y / currentScale;
        const sw = 480 / currentScale;
        const sh = 270 / currentScale;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1920, 1080);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("toBlob fail"));
          },
          "image/jpeg",
          0.9,
        );
      };
      img.onerror = () => reject(new Error("load error"));
      img.src = backgroundPreview;
    });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSystemSettings();
      if (response.success) {
        setSettings(response.data || {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await adminApi.updateSystemSettings(settings);
      if (response.success) {
        message.success("Cập nhật cài đặt thành công");
        window.dispatchEvent(new CustomEvent("tc-settings-updated"));
      }
    } catch {
      message.error("Lỗi cập nhật cài đặt");
    }
  };

  const clearBackgroundPreview = () => {
    setBackgroundPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const openBackgroundModal = async (target: "login") => {
    const current = settings.login_background_url || "";
    setBackgroundTarget(target);
    setBackgroundTab("url");
    setBackgroundUrlInput("");
    setBackgroundFile(null);
    clearBackgroundPreview();
    setBackgroundPreview(current ? resolveBackendUrl(current) : null);
    setBackgroundModalOpen(true);
  };

  const handlePreviewUrl = (value: string) => {
    setBackgroundUrlInput(value);
    setBackgroundFile(null);
    const trimmed = value.trim();
    if (!trimmed) {
      clearBackgroundPreview();
      return;
    }
    clearBackgroundPreview();
    setBackgroundPreview(resolveBackendUrl(trimmed) || trimmed);
  };

  const handleApplyBackground = async () => {
    try {
      setBackgroundSaving(true);
      if (backgroundTab === "url") {
        const url = backgroundUrlInput.trim();
        if (!/^https?:\/\//i.test(url)) {
          message.error("URL phải bắt đầu bằng http/https");
          return;
        }
        const resp = await adminApi.setBackgroundUrl(backgroundTarget, url);
        if (resp?.success) {
          message.success("Đã đổi ảnh nền");
        } else {
          message.error(resp?.message || "Lưu ảnh nền thất bại");
          return;
        }
      } else {
        if (!backgroundFile) {
          message.error("Vui lòng chọn ảnh trước khi Save");
          return;
        }

        let fileToUpload = backgroundFile;

        // Crop if we have image natural size loaded
        if (imageSize) {
          try {
            const blob = await cropImage();
            fileToUpload = new File([blob], backgroundFile.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
          } catch (cropErr) {
            console.error("Lỗi cắt ảnh:", cropErr);
            message.warning("Không thể cắt ảnh tự động. Sẽ tải lên file gốc.");
          }
        }

        const resp = await adminApi.uploadBackgroundImage(
          backgroundTarget,
          fileToUpload,
        );
        if (resp?.success) {
          message.success("Đã upload ảnh nền");
        } else {
          message.error(resp?.message || "Upload ảnh nền thất bại");
          return;
        }
      }

      setBackgroundUrlInput("");
      setBackgroundFile(null);
      clearBackgroundPreview();
      setBackgroundModalOpen(false);
      await fetchSettings();
      window.dispatchEvent(new CustomEvent("tc-settings-updated"));
    } catch {
      message.error("Lưu ảnh nền thất bại");
    } finally {
      setBackgroundSaving(false);
    }
  };

  const handleDeleteBackground = async (_target: "login") => {
    try {
      await adminApi.updateSystemSettings({ login_background_url: null });
      message.success("Đã xóa ảnh nền");
      clearBackgroundPreview();
      await fetchSettings();
      window.dispatchEvent(new CustomEvent("tc-settings-updated"));
    } catch {
      message.error("Xóa ảnh nền thất bại");
    }
  };

  const extractUploadFile = (info: unknown): File | null => {
    const root = asRecord(info);
    const file = asRecord(root.file);
    const fileList = Array.isArray(root.fileList) ? root.fileList : [];
    const first = asRecord(fileList[0]);

    const candidate =
      file.originFileObj ?? first.originFileObj ?? (root.file as unknown);

    if (!candidate) return null;

    // In browsers, File extends Blob
    if (typeof candidate !== "object") return null;
    const maybeFile = candidate as { size?: unknown; type?: unknown };
    const isBlobLike =
      typeof maybeFile.size === "number" && typeof maybeFile.type === "string";

    return isBlobLike ? (candidate as File) : null;
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cài đặt Hệ thống</h2>
        <p className="text-gray-500">
          Cấu hình tỷ lệ hoa hồng mặc định và ảnh nền màn hình đăng nhập hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cột trái: Cấu hình Hoa hồng */}
        <div className="lg:col-span-1">
          <Card
            title={
              <Space>
                <PercentageOutlined style={{ color: "#6366f1" }} />
                <span>Cấu hình hoa hồng</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              border: "1px solid #f1f5f9",
            }}
          >
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">
                % hoa hồng mặc định
              </label>
              <Input
                type="number"
                prefix={<PercentageOutlined style={{ color: "#94a3b8" }} />}
                value={settings.default_commission_rate || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_commission_rate: e.target.value,
                  })
                }
                placeholder="2.5"
                size="large"
                style={{ borderRadius: 8 }}
              />
              <div className="mt-2 text-xs text-gray-400 flex items-start gap-1">
                <InfoCircleOutlined style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Áp dụng tự động cho các địa điểm đăng ký mới trước khi được Admin duyệt tỷ lệ riêng.
                </span>
              </div>
            </div>

            <Divider className="my-4" />

            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSettings}
              loading={loading}
              size="large"
              block
              style={{
                borderRadius: 8,
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                border: "none",
                boxShadow: "0 4px 10px rgba(99,102,241,0.2)",
              }}
            >
              Lưu Cài đặt
            </Button>
          </Card>
        </div>

        {/* Cột phải: Cấu hình Ảnh nền đăng nhập */}
        <div className="lg:col-span-2">
          <Card
            title={
              <Space>
                <PictureOutlined style={{ color: "#6366f1" }} />
                <span>Ảnh nền đăng nhập</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              border: "1px solid #f1f5f9",
              minHeight: "100%",
            }}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => openBackgroundModal("login")}
                style={{ borderRadius: 8 }}
              >
                Đổi ảnh nền
              </Button>
              {settings.login_background_url && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteBackground("login")}
                  style={{ borderRadius: 8 }}
                >
                  Xóa ảnh hiện tại
                </Button>
              )}
              <span className="text-xs text-gray-500">
                Nhập URL hoặc Upload file ảnh mới. Nhớ bấm <strong>Lưu Cài đặt</strong> ở cột bên để hoàn tất.
              </span>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: 12,
                padding: 16,
                border: "1px dashed #e2e8f0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280,
              }}
            >
              {settings.login_background_url ? (
                <div style={{ width: "100%", textAlign: "center" }}>
                  <img
                    src={resolveBackendUrl(settings.login_background_url) || undefined}
                    alt="Login background preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <div className="mt-2 text-xs text-gray-400">
                    Đường dẫn ảnh: {settings.login_background_url}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#94a3b8", textAlign: "center" }}>
                  <PictureOutlined style={{ fontSize: 40, marginBottom: 12, color: "#cbd5e1" }} />
                  <div className="text-sm font-semibold">Chưa có ảnh nền đăng nhập</div>
                  <div className="text-xs mt-1">Ảnh nền mặc định (gradient xanh dương - tím) đang được sử dụng.</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="Đổi ảnh nền (Đăng nhập)"
        open={backgroundModalOpen}
        onCancel={() => {
          setBackgroundModalOpen(false);
          setBackgroundFile(null);
          setBackgroundUrlInput("");
          clearBackgroundPreview();
        }}
        footer={null}
        width={920}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
          {[
            { key: "url", title: "Nhập URL" },
            { key: "upload", title: "Upload ảnh" },
          ].map((item) => (
            <Card
              key={item.key}
              onClick={() => setBackgroundTab(item.key as typeof backgroundTab)}
              className={`cursor-pointer border ${
                backgroundTab === item.key
                  ? "border-blue-500 bg-blue-50/10"
                  : "border-gray-200"
              }`}
              style={{ borderRadius: 12 }}
            >
              <Typography.Text strong>{item.title}</Typography.Text>
              <div className="text-xs text-gray-500 mt-1">
                Bấm để mở tùy chọn
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-2">
          {backgroundTab === "url" && (
            <div className="rounded-lg border p-4 bg-white shadow-sm">
              <div className="text-sm font-semibold mb-2 text-gray-700">Nhập URL ảnh nền</div>
              <Input
                value={backgroundUrlInput}
                onChange={(e) => handlePreviewUrl(e.target.value)}
                placeholder="https://..."
                size="large"
                style={{ borderRadius: 8, marginBottom: 16 }}
              />
              
              {backgroundPreview && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                    Xem trước giao diện đăng nhập thực tế
                  </div>
                  <div
                    style={{
                      position: "relative",
                      width: 480,
                      height: 270,
                      overflow: "hidden",
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#f8fafc",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      margin: "0 auto",
                    }}
                  >
                    <img
                      src={backgroundPreview}
                      alt="Mock Background URL"
                      style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                      }}
                    />
                    
                    {/* Overlay centered mock login card */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 150,
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          borderRadius: 8,
                          padding: "16px 12px",
                          boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
                          textAlign: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#4f46e5", marginBottom: 8 }}>
                          Đăng Nhập
                        </div>
                        <div style={{ height: 8, background: "#e2e8f0", borderRadius: 2, marginBottom: 6 }} />
                        <div style={{ height: 8, background: "#e2e8f0", borderRadius: 2, marginBottom: 8 }} />
                        <div style={{ height: 16, background: "#4f46e5", borderRadius: 3, fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                          Đăng nhập
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  type="primary"
                  onClick={handleApplyBackground}
                  loading={backgroundSaving}
                  style={{ borderRadius: 8 }}
                >
                  Lưu URL
                </Button>
                <Button
                  onClick={() => setBackgroundModalOpen(false)}
                  style={{ borderRadius: 8 }}
                >
                  Hủy bỏ
                </Button>
              </div>
            </div>
          )}

          {backgroundTab === "upload" && (
            <div className="rounded-lg border p-4 bg-white shadow-sm">
              <div className="text-sm font-semibold mb-3 text-gray-700">Tải lên & Điều chỉnh ảnh nền</div>
              <div className="flex items-center gap-3 mb-4">
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={(info) => {
                    const file = extractUploadFile(info);
                    if (file) {
                      clearBackgroundPreview();
                      const preview = URL.createObjectURL(file);
                      setBackgroundFile(file);
                      setBackgroundPreview(preview);
                      setBackgroundUrlInput("");
                      setImageSize(null); // Force image onload handler
                    } else {
                      message.error("Không đọc được file ảnh. Vui lòng chọn lại.");
                    }
                  }}
                >
                  <Button type="primary" icon={<UploadOutlined />}>
                    Chọn ảnh mới từ thiết bị
                  </Button>
                </Upload>
                <span className="text-xs text-gray-400">Hỗ trợ JPG/PNG/WebP, tối đa 50MB.</span>
              </div>

              {backgroundPreview ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Cột trái: Crop Tool */}
                  <div className="md:col-span-7">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Cắt & Căn chỉnh ảnh (Kéo thả ảnh)
                    </div>
                    <div
                      style={{
                        position: "relative",
                        width: 480,
                        height: 270,
                        overflow: "hidden",
                        cursor: isDragging ? "grabbing" : "grab",
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        backgroundColor: "#f8fafc",
                        userSelect: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <img
                        src={backgroundPreview}
                        alt="Crop Area"
                        onLoad={handleImageLoad}
                        style={{
                          position: "absolute",
                          left: position.x,
                          top: position.y,
                          width: renderSize.width || "auto",
                          height: renderSize.height || "auto",
                          maxWidth: "none",
                          pointerEvents: "none",
                        }}
                      />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Phóng to / Thu nhỏ</span>
                        <span>{Math.round(zoom * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">1x</span>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.01"
                          value={zoom}
                          onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                          style={{ flex: 1, accentColor: "#6366f1", height: 6, borderRadius: 3 }}
                        />
                        <span className="text-xs text-gray-400">3x</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      💡 Mẹo: Kéo thả ảnh trực tiếp trong khung để điều chỉnh vùng hiển thị.
                    </div>
                  </div>

                  {/* Cột phải: Live Mockup Login Preview */}
                  <div className="md:col-span-5">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      Xem trước giao diện ngoài thực tế
                    </div>
                    <div
                      style={{
                        position: "relative",
                        width: 320,
                        height: 180,
                        overflow: "hidden",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#f8fafc",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      }}
                    >
                      <img
                        src={backgroundPreview}
                        alt="Mock Background"
                        style={{
                          position: "absolute",
                          left: position.x * (320 / 480),
                          top: position.y * (320 / 480),
                          width: renderSize.width * (320 / 480),
                          height: renderSize.height * (320 / 480),
                          maxWidth: "none",
                          pointerEvents: "none",
                        }}
                      />
                      
                      {/* Mock Login Overlay Card */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: "rgba(0,0,0,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 130,
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            borderRadius: 8,
                            padding: "12px 10px",
                            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
                            textAlign: "center",
                            transform: "scale(0.85)",
                            pointerEvents: "none",
                          }}
                        >
                          <div style={{ fontSize: 9, fontWeight: 800, color: "#4f46e5", marginBottom: 6 }}>
                            Đăng Nhập
                          </div>
                          <div style={{ height: 6, background: "#e2e8f0", borderRadius: 2, marginBottom: 4 }} />
                          <div style={{ height: 6, background: "#e2e8f0", borderRadius: 2, marginBottom: 6 }} />
                          <div style={{ height: 10, background: "#4f46e5", borderRadius: 2, fontSize: 5, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                            Đăng nhập
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-3">
                      Khung này mô phỏng tỉ lệ và vị trí của Form đăng nhập đè lên ảnh nền ngoài trang chủ đăng nhập.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #cbd5e1", borderRadius: 8, color: "#94a3b8" }}>
                  Chưa có ảnh. Vui lòng chọn một ảnh để bắt đầu.
                </div>
              )}

              <Divider className="my-4" />

              <div className="flex gap-2">
                <Button
                  type="primary"
                  onClick={handleApplyBackground}
                  loading={backgroundSaving}
                  disabled={!backgroundFile}
                  style={{ borderRadius: 8 }}
                >
                  Áp dụng ảnh đã cắt
                </Button>
                <Button
                  onClick={() => setBackgroundModalOpen(false)}
                  style={{ borderRadius: 8 }}
                >
                  Hủy bỏ
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
};

export default Settings;
