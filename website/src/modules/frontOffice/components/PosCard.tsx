import { Card } from "antd";
import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  extra?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

const PosCard = ({ title, extra, className, bodyClassName, children }: Props) => {
  return (
    <Card
      title={title}
      extra={extra}
      className={`fo-card ${className ?? ""}`.trim()}
      styles={{
        body: {
          padding: 16,
        },
      }}
    >
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
};

export default PosCard;
