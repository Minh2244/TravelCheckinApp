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

        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");

        console.log(
          "🔑 Access Token:",
          accessToken ? "✅ Found" : "❌ Not found",
        );
        console.log("🔑 Full hash:", hash);

        if (!accessToken) {
          throw new Error("Không nhận được access token từ Google");
        }

        console.log("📡 Fetching user info from Google API...");
        const response = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        console.log("📡 Google API Response Status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Google API Error:", errorText);
          throw new Error(`Lỗi Google API (${response.status}): ${errorText}`);
        }

        const profile = await response.json();
        console.log("👤 Google Profile RAW:", profile);

        // ⭐ FIX: Google có thể trả về 'id' thay vì 'sub'
        const userId = profile.sub || profile.id;
        const userEmail = profile.email;
        const userName = profile.name || profile.given_name || "Google User";
        const userPicture = profile.picture;

        console.log("✅ Parsed profile:", {
          userId,
          userEmail,
          userName,
          userPicture,
        });

        // ⭐ VALIDATE DỮ LIỆU
        if (!userId) {
          console.error("❌ Missing user ID. Full profile:", profile);
          throw new Error("Google không trả về user ID (sub hoặc id)");
        }
        if (!userEmail) {
          console.error("❌ Missing email. Full profile:", profile);
          throw new Error("Google không trả về email");
        }

        if (window.opener) {
          console.log("📤 Sending profile to parent window...");

          const profileData = {
            type: "GOOGLE_AUTH_SUCCESS",
            profile: {
              sub: userId, // Sử dụng userId (có thể là sub hoặc id)
              email: userEmail,
              name: userName,
              picture: userPicture || null,
            },
          };

          console.log("📤 Profile data:", profileData);

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
