import { Layout, Button, Image } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import OwnerChatManager from "../components/OwnerChatManager";

const { Header, Content } = Layout;

type Props = {
  title: string;
  subtitle?: string;
  locationName?: string | null;
  locationImageUrl?: string | null;
  locationId?: number | null;
  onBack?: () => void;
  extra?: ReactNode;
  children: ReactNode;
};

const FrontOfficeLayout = ({
  title,
  subtitle,
  locationName,
  locationImageUrl,
  locationId,
  onBack,
  extra,
  children,
}: Props) => {
  return (
    <Layout className="min-h-screen">
      <Header
        className="flex items-center justify-between gap-3 border-b border-slate-100 !h-auto !leading-normal py-3 px-4 sm:px-6"
        style={{ background: "#fff" }}
      >
        <div className="flex items-center gap-3">
          {locationImageUrl ? (
            <Image
              src={locationImageUrl}
              width={44}
              height={44}
              style={{ objectFit: "cover", borderRadius: 10 }}
              preview
            />
          ) : null}
          {onBack ? (
            <Button icon={<ArrowLeftOutlined />} onClick={onBack} className="rounded-xl" />
          ) : null}
          <div className="flex flex-col justify-center">
            <div className="font-bold text-gray-900 text-lg leading-tight">{title}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {subtitle
                ? subtitle
                : locationName
                  ? `Đang làm việc: ${locationName}`
                  : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">{extra}</div>
      </Header>
      <Content className="p-4 md:p-6 fo-shell">
        <div className="fo-surface">{children}</div>
      </Content>

      {/* Quản lý các khung chat nổi tự động bật lên khi có khách nhắn cho Owner */}
      <OwnerChatManager locationId={locationId} />
    </Layout>
  );
};

export default FrontOfficeLayout;
