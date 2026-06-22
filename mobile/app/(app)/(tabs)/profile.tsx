import { useRouter } from "expo-router";

import { ScreenShell } from "../../../src/components/screen-shell";
import { PlaceholderPanel } from "../../../src/components/placeholder-panel";
import { useAuthStore } from "../../../src/modules/auth/store";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <ScreenShell
      title="Hồ sơ"
      framed={false}
    >
      <PlaceholderPanel
        title={user?.full_name ?? "Tài khoản người dùng"}
        description={`Email: ${user?.email ?? "Chưa có"}\nVai trò: ${user?.role ?? "user"}\nPhiên hiện tại sẽ yêu cầu đăng nhập lại khi bạn mở app lần sau.`}
        actionLabel="Đăng xuất"
        onAction={async () => {
          await signOut();
          router.replace("/sign-in");
        }}
      />
    </ScreenShell>
  );
}
