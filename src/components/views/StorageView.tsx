import React from 'react';
import { HardDrive, Trash2, ArrowUpRight, ShieldCheck, Film, FileAudio, Image as ImageIcon } from 'lucide-react';

interface StorageViewProps {
  onUpgradeClick: () => void;
  storageUsage?: {
    totalUsedBytes: number;
    totalLimitBytes: number;
    usedFormatted: string;
    limitFormatted: string;
    percentUsed: number;
    availableBytes: number;
  };
  planTier?: string;
}

export const StorageView: React.FC<StorageViewProps> = ({
  onUpgradeClick,
  storageUsage,
  planTier = 'Pro',
}) => {
  const displayUsed = storageUsage?.usedFormatted || '0,0 GB';
  const displayLimit = storageUsage?.limitFormatted || '50,0 GB';
  const displayPercent = storageUsage?.percentUsed ?? 0;
  const availableGb = storageUsage
    ? (storageUsage.availableBytes / (1024 * 1024 * 1024)).toFixed(1)
    : '50,0';
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Armazenamento em nuvem</h2>
        </div>

        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition shadow-md shadow-[#F97316]/30"
        >
          <span>Fazer upgrade de plano</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Gauge Card */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-medium text-[#FDBA74]">Total utilizado</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-white tabular-nums">
                {displayUsed}
              </span>
              <span className="font-mono text-sm text-[#FDBA74] tabular-nums">
                / {displayLimit} ({displayPercent}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>{availableGb} GB disponíveis no Plano {planTier}</span>
          </div>
        </div>

        {/* Multi-segmented visual bar */}
        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#0A0A0A] border border-[#27272A] flex">
            <div className="h-full bg-[#F97316]" style={{ width: '16.8%' }} title="Vídeos brutos (8.4 GB)" />
            <div className="h-full bg-[#9333EA]" style={{ width: '8.4%' }} title="Cortes renderizados (4.2 GB)" />
            <div className="h-full bg-[#3B82F6]" style={{ width: '2.4%' }} title="Áudio e legendas (1.2 GB)" />
            <div className="h-full bg-amber-400" style={{ width: '2.0%' }} title="Miniaturas (1.0 GB)" />
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />
              <p className="text-white font-medium">Vídeos brutos</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9333EA]" />
              <p className="text-white font-medium">Cortes 9:16</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
              <p className="text-white font-medium">Áudio & Legendas</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <p className="text-white font-medium">Miniaturas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cleanup recommendation */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Limpeza inteligente recomendada</h3>
        </div>
        <button
          onClick={() => alert('Limpeza de cache realizada! 2.4 GB liberados.')}
          className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition whitespace-nowrap"
        >
          Liberar 2.4 GB agora
        </button>
      </div>
    </div>
  );
};
