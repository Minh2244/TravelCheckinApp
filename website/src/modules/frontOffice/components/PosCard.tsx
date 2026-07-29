import { Card } from "antd";
import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  extra?: ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
  children: ReactNode;
};

const PosCard = ({ title, extra, className, bodyClassName, bodyStyle, children }: Props) => {
  return (
    <Card
      title={title}
      extra={extra}
      className={`fo-card ${className ?? ""}`.trim()}
      styles={{
        body: {
          padding: 16,
          ...bodyStyle,
        },
      }}
    >
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
};

export default PosCard;
