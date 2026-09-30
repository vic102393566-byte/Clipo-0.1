import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  deltaText?: string;
  contextNote?: string;
  progressPercent?: number;
  progressSubtext?: string;
  progressBarColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  deltaText,
  contextNote,
  progressPercent,
  progressSubtext,
  progressBarColor = 'from-[#F97316] to-[#9333EA]',
  icon: Icon,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border border-[#27272A] bg-[#151515] p-5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-[#F97316]/50 hover:bg-[#1A1A1A]' : ''
      }`}
    >
      {/* Top row: Label & Icon */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#FDBA74]">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#27272A] bg-[#0A0A0A] text-[#FDBA74] transition group-hover:border-[#F97316]/40 group-hover:text-[#F97316]">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Main value: Tabular numerals */}
      <div className="mt-3">
        <div className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums sm:text-3xl">
          {value}
        </div>

        {/* Progress bar if storage */}
        {typeof progressPercent === 'number' && (
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#27272A]">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${progressBarColor} transition-all duration-500`}
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#FDBA74]">
              <span className="font-mono tabular-nums">{progressPercent}% do limite</span>
              <span>{progressSubtext || '35.2 GB livres'}</span>
            </div>
          </div>
        )}

        {/* Zero-Pill unboxed metadata text */}
        {(deltaText || contextNote) && typeof progressPercent !== 'number' && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#FDBA74]">
            {deltaText && (
              <span className="font-medium text-emerald-400 font-mono tabular-nums">
                {deltaText}
              </span>
            )}
            {deltaText && contextNote && <span aria-hidden="true" className="text-zinc-600">·</span>}
            {contextNote && <span className="text-[#FDBA74]">{contextNote}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
