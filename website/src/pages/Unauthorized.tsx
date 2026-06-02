import React from "react";
import { Result, Button } from "antd";
import { useNavigate } from "react-router-dom";

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Result
        status="403"
        title="403 - Không có quyền truy cập"
        subTitle="Xin lỗi, bạn không có quyền truy cập trang này."
        extra={
          <div className="flex gap-4 justify-center">
            <Button type="primary" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
            <Button onClick={() => navigate("/login")}>Đăng nhập lại</Button>
          </div>
        }
      />
    </div>
  );
};

export default Unauthorized;
