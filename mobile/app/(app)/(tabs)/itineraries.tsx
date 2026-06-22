import { ScreenShell } from "../../../src/components/screen-shell";
import { PlaceholderPanel } from "../../../src/components/placeholder-panel";

export default function ItinerariesScreen() {
  return (
    <ScreenShell
      title="Lịch trình"
      subtitle="Điểm vào đã có để phase sau ghép editor và lịch trình thật."
      framed={false}
    >
      <PlaceholderPanel
        title="Cụm lịch trình"
        description="Từ Home bạn đã điều hướng được tới đây. Giai đoạn sau mình sẽ gắn danh sách lịch trình, tạo mới và chi tiết từng ngày."
      />
    </ScreenShell>
  );
}
