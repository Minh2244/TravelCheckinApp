import React, { useEffect } from "react";
import { Spin } from "antd";

const FacebookCallback: React.FC = () => {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    if (accessToken) {
      fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      )
        .then((res) => res.json())
        .then((profile) => {
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "FACEBOOK_AUTH_SUCCESS",
                profile,
              },
              window.location.origin
            );
            window.close();
          }
        })
        .catch((error) => {
          console.error("Facebook auth error:", error);
          window.close();
        });
    } else {
      window.close();
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spin size="large" tip="Đang xử lý đăng nhập Facebook..." />
    </div>
  );
};

export default FacebookCallback;
