import React, { useState, useCallback, useEffect } from "react";
import { Card, Button, message, Upload, Input } from "antd";
import { UploadOutlined, BgColorsOutlined, SaveOutlined, PictureOutlined } from "@ant-design/icons";
import Cropper from "react-easy-crop";

import adminApi from "../../api/adminApi";

interface AppThemeSettingsProps {
  currentBackground?: string;
  currentPrimaryColor?: string;
  currentSecondaryColor?: string;
  currentTextColor?: string;
}

const AppThemeSettings: React.FC<AppThemeSettingsProps> = ({
  currentBackground,
  currentPrimaryColor,
  currentSecondaryColor,
  currentTextColor,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const resolveUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3000/api";
    const origin = apiBase.replace(/\/api\/?$/, "");
    return `${origin}${url.startsWith("/") ? url : "/" + url}`;
  };

  const [previewImage, setPreviewImage] = useState<string | null>(resolveUrl(currentBackground));
  const [primaryColor, setPrimaryColor] = useState<string>(currentPrimaryColor || "#14b8a6");
  const [secondaryColor, setSecondaryColor] = useState<string>(currentSecondaryColor || "#f0fdf4");
  const [textColor, setTextColor] = useState<string>(currentTextColor || "#ffffff");
  
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentBackground) setPreviewImage(resolveUrl(currentBackground));
    if (currentPrimaryColor) setPrimaryColor(currentPrimaryColor);
    if (currentSecondaryColor) setSecondaryColor(currentSecondaryColor);
    if (currentTextColor) setTextColor(currentTextColor);
  }, [currentBackground, currentPrimaryColor, currentSecondaryColor, currentTextColor]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUploadChange = (info: any) => {
    if (info.file.status === "uploading") return;
    const file = info.file.originFileObj;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));
    
    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return "";
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );
    return canvas.toDataURL("image/jpeg");
  };

  const extractColors = (imgDataUrl: string): Promise<{ primary: string; secondary: string; textCol: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const SAMPLE_W = 100;
        const SAMPLE_H = 75;
        canvas.width = SAMPLE_W;
        canvas.height = SAMPLE_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ primary: "#14b8a6", secondary: "#f0fdf4", textCol: "#ffffff" });
          return;
        }

        // Fill white first so transparent pixels don't skew to black
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, SAMPLE_W, SAMPLE_H);
        ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);

        const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

        // Use k-means-lite: find most dominant hue by sampling all pixels
        // Simple approach: bucket pixels by hue, find largest bucket
        const buckets: number[] = new Array(36).fill(0); // 36 buckets of 10° each
        const bucketR: number[] = new Array(36).fill(0);
        const bucketG: number[] = new Array(36).fill(0);
        const bucketB: number[] = new Array(36).fill(0);

        for (let i = 0; i < data.length; i += 4) {
          const ri = data[i], gi = data[i + 1], bi = data[i + 2];
          // Skip near-white and near-black pixels (boring)
          const max = Math.max(ri, gi, bi);
          const min = Math.min(ri, gi, bi);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const lightness = (max + min) / 2 / 255;
          if (saturation < 0.15 || lightness < 0.1 || lightness > 0.92) continue;

          // Compute hue
          let h = 0;
          const d = max - min;
          if (d === 0) { h = 0; }
          else if (max === ri) { h = ((gi - bi) / d + 6) % 6; }
          else if (max === gi) { h = (bi - ri) / d + 2; }
          else { h = (ri - gi) / d + 4; }
          h = Math.floor(h * 60 / 10); // which 10° bucket
          buckets[h]++;
          bucketR[h] += ri;
          bucketG[h] += gi;
          bucketB[h] += bi;
        }

        const maxBucket = buckets.indexOf(Math.max(...buckets));
        let r: number, g: number, b: number;

        if (buckets[maxBucket] === 0) {
          // Fallback: plain average
          let tr = 0, tg = 0, tb = 0, cnt = 0;
          for (let i = 0; i < data.length; i += 4) {
            tr += data[i]; tg += data[i + 1]; tb += data[i + 2]; cnt++;
          }
          r = Math.round(tr / cnt);
          g = Math.round(tg / cnt);
          b = Math.round(tb / cnt);
        } else {
          r = Math.round(bucketR[maxBucket] / buckets[maxBucket]);
          g = Math.round(bucketG[maxBucket] / buckets[maxBucket]);
          b = Math.round(bucketB[maxBucket] / buckets[maxBucket]);
        }

        const toHex = (v: number) => v.toString(16).padStart(2, "0");
        const primary = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

        // Light version: 15% of primary blended with white
        const secR = Math.round(r * 0.15 + 255 * 0.85);
        const secG = Math.round(g * 0.15 + 255 * 0.85);
        const secB = Math.round(b * 0.15 + 255 * 0.85);
        const secondary = `#${toHex(secR)}${toHex(secG)}${toHex(secB)}`;

        const brightness = Math.round((r * 299 + g * 587 + b * 114) / 1000);
        const textCol = brightness > 140 ? "#000000" : "#ffffff";

        resolve({ primary, secondary, textCol });
      };

      img.onerror = () => resolve({ primary: "#14b8a6", secondary: "#f0fdf4", textCol: "#ffffff" });
      img.src = imgDataUrl;
    });
  };


  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      setPreviewImage(croppedImage);
      
      const colors = await extractColors(croppedImage);
      setPrimaryColor(colors.primary);
      setSecondaryColor(colors.secondary);
      setTextColor(colors.textCol);
      
      setImageSrc(null);
      message.success("Trích xuất màu tự động thành công!");
    } catch (e) {
      console.error(e);
      message.error("Lỗi khi cắt ảnh");
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!previewImage) {
      message.warning("Vui lòng chọn ảnh nền trước khi lưu");
      return;
    }
    setLoading(true);
    try {
      let fileToUpload: File | null = null;
      if (previewImage.startsWith("data:image")) {
        const res = await fetch(previewImage);
        const blob = await res.blob();
        fileToUpload = new File([blob], "app_background.jpg", { type: "image/jpeg" });
      }

      if (fileToUpload) {
        await adminApi.uploadAppTheme(fileToUpload, primaryColor, secondaryColor, textColor);
        message.success("Lưu Giao diện Ứng dụng thành công! Mobile App sẽ thay đổi ngay lập tức.");
        window.dispatchEvent(new CustomEvent("tc-settings-updated"));
      } else {
        await adminApi.updateSystemSettings({
          app_primary_color: primaryColor,
          app_secondary_color: secondaryColor,
          app_text_color: textColor,
        });
        message.success("Cập nhật màu sắc thành công!");
      }
    } catch (error) {
      console.error(error);
      message.error("Có lỗi xảy ra khi lưu Theme");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <div className="flex items-center gap-2 text-emerald-700">
          <BgColorsOutlined className="text-xl" />
          <span>Tùy biến Giao diện Mobile App (Custom Theme)</span>
        </div>
      }
      className="shadow-sm border-gray-100 mt-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="flex flex-col gap-6">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <PictureOutlined /> 1. Tải lên Ảnh nền (Header Background)
            </h3>
            
            {imageSrc ? (
              <div className="relative h-[300px] w-full bg-black rounded-lg overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
                <div className="absolute bottom-4 left-0 w-full flex justify-center gap-2">
                  <Button onClick={() => setImageSrc(null)}>Hủy</Button>
                  <Button type="primary" onClick={handleApplyCrop} loading={processing}>
                    Cắt ảnh & Lấy màu (Auto)
                  </Button>
                </div>
              </div>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={({ onSuccess }) => setTimeout(() => onSuccess && onSuccess("ok"), 0)}
                onChange={handleUploadChange}
              >
                <Button icon={<UploadOutlined />} size="large">
                  Chọn ảnh từ máy...
                </Button>
              </Upload>
            )}
            <p className="text-gray-500 text-xs mt-2">
              Khuyên dùng ảnh phong cảnh, đồi núi, biển... Tỉ lệ 4:3. Hệ thống sẽ tự động trích xuất mã màu phù hợp với ảnh.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BgColorsOutlined /> 2. Tinh chỉnh Màu sắc (Tùy chọn)
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              Màu sắc dưới đây đã được bóc tách tự động từ ảnh nền. Bạn có thể tự chỉnh sửa lại nếu chưa ưng ý.
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Chủ Đạo</label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="color"
                    value={primaryColor.startsWith("rgb") ? "#14b8a6" : primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer flex-shrink-0"
                  />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} size="small" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nền Nhạt</label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="color"
                    value={secondaryColor.startsWith("#") ? secondaryColor.slice(0, 7) : "#f0fdf4"}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer flex-shrink-0"
                  />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} size="small" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Màu Chữ</label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer flex-shrink-0"
                  />
                  <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} size="small" />
                </div>
              </div>
            </div>
          </div>
          
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            loading={loading}
            onClick={handleSaveTheme}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500"
          >
            Lưu Giao Diện & Đồng bộ Mobile Real-time
          </Button>
        </div>

        <div className="flex justify-center items-center bg-gray-100 rounded-xl p-4 border border-dashed border-gray-300">
          <div className="relative w-[320px] h-[650px] bg-white rounded-[40px] shadow-2xl border-[8px] border-gray-800 overflow-hidden flex flex-col">
            <div 
              className="w-full h-[180px] relative pt-8 px-5"
              style={{
                backgroundColor: primaryColor,
              }}
            >
              {previewImage && (
                <div 
                  className="absolute inset-0"
                  style={{ backgroundImage: `url(${previewImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              )}
              {previewImage && <div className="absolute inset-0 bg-black/15" />}

              <div className="relative z-10 w-2/3">
                <div className="text-[26px] font-extrabold leading-tight" style={{ color: textColor }}>Chào buổi tối,<br/>Quản trị viên</div>
                <div className="text-xs mt-1" style={{ color: textColor, opacity: 0.9 }}>Thứ Ba, 14 tháng 7</div>
              </div>
              
              <div className="absolute top-8 right-5 bg-white/95 rounded-2xl px-3 py-2 shadow-sm flex items-center gap-2 z-10 border border-white/50">
                <span className="text-xl leading-none">☀️</span>
                <div>
                  <div className="text-xs font-bold text-gray-800">28°C</div>
                  <div className="text-[10px] text-gray-500">Đà Nẵng</div>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white -mt-10 px-5 pt-6 pb-2 relative z-10 rounded-t-[32px]">
              <div style={{ backgroundColor: secondaryColor, borderRadius: 24, padding: 16, margin: '0 -4px' }}>
                <div className="flex justify-between items-center mb-5">
                  <div className="font-extrabold text-gray-800 text-lg">Tiện ích du lịch</div>
                  <div className="text-xs font-bold text-gray-400">8 mục &gt;</div>
                </div>

                <div className="grid grid-cols-4 gap-y-5 gap-x-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div 
                        className="w-[50px] h-[50px] rounded-2xl flex items-center justify-center border"
                        style={{ 
                          backgroundColor: i === 7 ? "#fee2e2" : "#ffffff",
                          borderColor: i === 7 ? "#fecaca" : "rgba(0,0,0,0.03)"
                        }}
                      >
                        <div 
                          className="w-5 h-5 rounded bg-current opacity-80" 
                          style={{ color: i === 7 ? "#ef4444" : primaryColor }}
                        />
                      </div>
                      <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AppThemeSettings;
