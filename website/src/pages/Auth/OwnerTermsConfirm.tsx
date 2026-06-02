import { useEffect, useState } from "react";
import { Button, Card } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import authApi from "../../api/authApi";

const OwnerTermsConfirm = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("Đang xác nhận điều khoản...");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token") || "";
    if (!token) {
      setMessage("Token không hợp lệ");
      setLoading(false);
      setSuccess(false);
      return;
    }

    authApi
      .confirmOwnerTerms(token)
      .then((res) => {
        if (res?.success) {
          setMessage(
            "Xác nhận điều khoản thành công. Bạn có thể đăng nhập để tiếp tục."
          );
          setSuccess(true);
        } else {
          setMessage(res?.message || "Xác nhận điều khoản thất bại");
          setSuccess(false);
        }
      })
      .catch(() => {
        setMessage("Xác nhận điều khoản thất bại");
        setSuccess(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md" loading={loading}>
        <div className="text-center space-y-4">
          <div className="text-lg font-semibold">Xác nhận điều khoản</div>
          <div className={success ? "text-green-600" : "text-red-600"}>
            {message}
          </div>
          <Button type="primary" onClick={() => navigate("/login")}>
            Về trang đăng nhập
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default OwnerTermsConfirm;
