import type { ReactNode } from "react";

type Tone = "slate" | "emerald" | "amber" | "sky";

type Props = {
  label: string;
  value: ReactNode;
  tone?: Tone;
  subLabel?: string;
};

const toneClass: Record<Tone, string> = {
  slate: "fo-stat-slate",
  emerald: "fo-stat-emerald",
  amber: "fo-stat-amber",
  sky: "fo-stat-sky",
};

const PosStatCard = ({ label, value, tone = "slate", subLabel }: Props) => {
  return (
    <div className={`fo-stat ${toneClass[tone]}`.trim()}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </div>
      {subLabel ? (
        <div className="mt-1 text-xs text-slate-500">{subLabel}</div>
      ) : null}
    </div>
  );
};

export default PosStatCard;
