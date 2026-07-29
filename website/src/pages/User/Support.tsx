import SupportCenter from "../../components/SupportCenter";
import UserLayout from "../../layouts/UserLayout";

export default function UserSupport() {
  return (
    <UserLayout title="Trung tâm hỗ trợ" activeKey="">
      <SupportCenter backPath="/user/profile" />
    </UserLayout>
  );
}
