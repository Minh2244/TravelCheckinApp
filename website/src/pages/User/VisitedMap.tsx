import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";

// NOTE: Chức năng "Bản đồ đã đi" đã được loại bỏ vì trùng với "Bản đồ check-in".
// File này được giữ lại ở dạng stub để tránh lỗi build nếu có import cũ.
const VisitedMap = () => {
  const navigate = useNavigate();
  return (
    <UserLayout
      title="Bản đồ đã đi"
      subtitle="Deprecated"
      activeKey="/user/visited-map"
    >
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900">Tính năng đã gỡ</h2>
        <p className="text-sm text-gray-500 mt-2">
          Bản đồ đã đi bị trùng với bản đồ check-in nên đã được bỏ.
        </p>
        <button
          type="button"
          className="mt-4 rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white hover:bg-blue-700"
          onClick={() => navigate("/user/map")}
        >
          Về bản đồ check-in
        </button>
      </section>
    </UserLayout>
  );
};

export default VisitedMap;
