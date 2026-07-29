import type { ReactNode } from "react";
import { FiTrendingUp, FiCheckCircle, FiStar, FiActivity } from "react-icons/fi";

type Tone = "slate" | "emerald" | "amber" | "sky" | "indigo" | "rose" | "violet" | "cyan";

type Props = {
  label: string;
  value: ReactNode;
  tone?: Tone;
  subLabel?: string;
  icon?: ReactNode;
  size?: "default" | "small";
};

const toneConfig: Record<Tone, { bg: string; text: string; iconBg: string; iconColor: string }> = {
  slate: {
    bg: "bg-gradient-to-br from-slate-500 to-slate-700 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-400 to-emerald-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-400 to-amber-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  sky: {
    bg: "bg-gradient-to-br from-sky-400 to-blue-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  indigo: {
    bg: "bg-gradient-to-br from-indigo-400 to-purple-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  rose: {
    bg: "bg-gradient-to-br from-rose-400 to-red-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-400 to-fuchsia-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  cyan: {
    bg: "bg-gradient-to-br from-cyan-400 to-teal-600 border-none shadow-md",
    text: "text-white",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
};

const defaultIcon: Record<Tone, ReactNode> = {
  slate: <FiActivity />,
  emerald: <FiCheckCircle />,
  amber: <FiStar />,
  sky: <FiTrendingUp />,
  indigo: <FiTrendingUp />,
  rose: <FiActivity />,
  violet: <FiStar />,
  cyan: <FiActivity />,
};

const PosStatCard = ({ label, value, tone = "slate", subLabel, icon, size = "default" }: Props) => {
  const config = toneConfig[tone];
  const IconRender = icon || defaultIcon[tone];
  const isSmall = size === "small";

  return (
    <div className={`relative overflow-hidden rounded-2xl ${isSmall ? 'p-3' : 'p-5'} shadow-sm hover:shadow-md transition-all duration-300 ${config.bg} ${config.text}`}>
      <div className={`flex items-center justify-between ${isSmall ? 'mb-1' : 'mb-3'}`}>
        <div className={`${isSmall ? 'text-xs' : 'text-sm'} font-semibold opacity-80 uppercase tracking-wide truncate pr-2`}>
          {label}
        </div>
        <div className={`${isSmall ? 'p-1.5' : 'p-2.5'} rounded-xl ${config.iconBg} flex-shrink-0`}>
          <div className={`${isSmall ? 'text-base' : 'text-xl'} ${config.iconColor}`}>
            {IconRender}
          </div>
        </div>
      </div>
      <div className={`${isSmall ? 'text-xl' : 'text-3xl'} font-bold tracking-tight`}>
        {value}
      </div>
      {subLabel ? (
        <div className={`mt-1 ${isSmall ? 'text-xs' : 'text-sm'} opacity-60 font-medium`}>{subLabel}</div>
      ) : null}
    </div>
  );
};

export default PosStatCard;
