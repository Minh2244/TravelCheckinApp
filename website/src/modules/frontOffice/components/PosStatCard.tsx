import type { ReactNode } from "react";
import { FiTrendingUp, FiCheckCircle, FiStar, FiActivity } from "react-icons/fi";

type Tone = "slate" | "emerald" | "amber" | "sky" | "indigo" | "rose";

type Props = {
  label: string;
  value: ReactNode;
  tone?: Tone;
  subLabel?: string;
  icon?: ReactNode;
};

const toneConfig: Record<Tone, { bg: string; text: string; iconBg: string }> = {
  slate: {
    bg: "bg-gradient-to-br from-slate-500 to-slate-600",
    text: "text-white",
    iconBg: "bg-slate-400/30",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-400 to-emerald-500",
    text: "text-white",
    iconBg: "bg-emerald-600/30",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    text: "text-white",
    iconBg: "bg-orange-600/30",
  },
  sky: {
    bg: "bg-gradient-to-br from-blue-400 to-blue-500",
    text: "text-white",
    iconBg: "bg-blue-600/30",
  },
  indigo: {
    bg: "bg-gradient-to-br from-indigo-400 to-indigo-500",
    text: "text-white",
    iconBg: "bg-indigo-600/30",
  },
  rose: {
    bg: "bg-gradient-to-br from-rose-400 to-rose-500",
    text: "text-white",
    iconBg: "bg-rose-600/30",
  },
};

const defaultIcon: Record<Tone, ReactNode> = {
  slate: <FiActivity />,
  emerald: <FiCheckCircle />,
  amber: <FiStar />,
  sky: <FiTrendingUp />,
  indigo: <FiTrendingUp />,
  rose: <FiActivity />,
};

const PosStatCard = ({ label, value, tone = "slate", subLabel, icon }: Props) => {
  const config = toneConfig[tone];
  const IconRender = icon || defaultIcon[tone];

  return (
    <div className={`relative overflow-hidden rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${config.bg} ${config.text}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold opacity-90 uppercase tracking-wide">
          {label}
        </div>
        <div className={`p-2 rounded-lg ${config.iconBg}`}>
          <div className="text-white text-lg">
            {IconRender}
          </div>
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight">
        {value}
      </div>
      {subLabel ? (
        <div className="mt-1 text-xs opacity-80">{subLabel}</div>
      ) : null}
    </div>
  );
};

export default PosStatCard;
