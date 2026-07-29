import { useEffect, useState } from "react";
import { Spin, Result, Button } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

const GoogleCallback = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");

  useEffect(() => {
    const processGoogleCallback = async () => {
      try {
        console.log("🔄 Processing Google callback...");
        console.log("📍 Full URL:", window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get("error");

        if (errorParam) {
          console.error("❌ Google OAuth error:", errorParam);

          let userMessage = "Đăng nhập Google thất bại";
          let details = "";

          switch (errorParam) {
            case "access_denied":
              userMessage = "Bạn đã từ chối quyền truy cập";
              break;
            case "redirect_uri_mismatch":
              userMessage = "Redirect URI không khớp";
              details = "Kiểm tra cấu hình Google Console.";
              break;
            default:
              userMessage = `Lỗi: ${errorParam}`;
          }

          setErrorMessage(userMessage);
          setErrorDetails(details);
          setStatus("error");

          if (window.opener) {
            window.opener.postMessage(
              { type: "GOOGLE_AUTH_ERROR", error: userMessage },
              window.location.origin,
            );
          }
          return;
        }

        const code = urlParams.get("code");
        const state = urlParams.get("state");

        console.log("🔑 Authorization Code:", code ? "✅ Found" : "❌ Not found");

        if (!code) {
          throw new Error("Không nhận được authorization code từ Google");
        }

        if (window.opener) {
          console.log("📤 Sending code to parent window...");

          const profileData = {
            type: "GOOGLE_AUTH_SUCCESS",
            state,
            code,
          };

          console.log("📤 Auth data:", profileData);

          window.opener.postMessage(profileData, window.location.origin);

          setStatus("success");
          setTimeout(() => {
            console.log("✅ Closing popup window...");
            window.close();
          }, 1000);
        } else {
          throw new Error("Không tìm thấy cửa sổ chính. Vui lòng thử lại.");
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error("Unknown error");

        console.error("❌ GoogleCallback Error:", err);
        console.error("❌ Error stack:", error.stack);

        const errorMsg = error.message || "Đã xảy ra lỗi khi xử lý đăng nhập";
        setErrorMessage(errorMsg);
        setErrorDetails("Vui lòng thử lại hoặc liên hệ hỗ trợ.");
        setStatus("error");

        if (window.opener) {
          window.opener.postMessage(
            { type: "GOOGLE_AUTH_ERROR", error: errorMsg },
            window.location.origin,
          );
        }
      }
    };

    processGoogleCallback();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <p className="mt-6 text-xl font-semibold text-gray-700">
            Đang xử lý đăng nhập Google...
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Vui lòng đợi trong giây lát
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-500 to-blue-600">
        <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-bold text-green-600">
            Đăng nhập thành công!
          </p>
          <p className="mt-2 text-sm text-gray-500">Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Result
        status="error"
        title="Đăng nhập Google thất bại"
        subTitle={
          <div className="space-y-2">
            <p className="text-lg font-semibold text-red-600">{errorMessage}</p>
            {errorDetails && (
              <p className="text-sm text-gray-600">{errorDetails}</p>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Mẹo: Hãy mở Console (F12) để xem chi tiết lỗi
            </p>
          </div>
        }
        extra={[
          <Button key="close" type="primary" onClick={() => window.close()}>
            Đóng cửa sổ
          </Button>,
          <Button
            key="retry"
            onClick={() => {
              window.close();
              if (window.opener) {
                window.opener.focus();
              }
            }}
          >
            Thử lại
          </Button>,
        ]}
      />
    </div>
  );
};

export default GoogleCallback;
