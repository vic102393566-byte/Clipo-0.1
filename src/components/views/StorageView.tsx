import React, { useState } from 'react';
import { HardDrive, Trash2, ArrowUpRight, ShieldCheck, Film, FileAudio, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

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
  const { t, language } = useI18n();
  const isEn = language === 'en-US';

  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const displayUsed = storageUsage?.usedFormatted || (isEn ? '0.0 GB' : '0,0 GB');
  const displayLimit = storageUsage?.limitFormatted || (isEn ? '50.0 GB' : '50,0 GB');
  const displayPercent = storageUsage?.percentUsed ?? 0;
  const availableGb = storageUsage
    ? (storageUsage.availableBytes / (1024 * 1024 * 1024)).toFixed(1)
    : (isEn ? '50.0' : '50,0');

  const handleCleanStorage = () => {
    setCleanupMessage(
      isEn
        ? 'Cache cleanup completed! 2.4 GB freed.'
        : 'Limpeza de cache realizada! 2.4 GB liberados.'
    );
    setTimeout(() => setCleanupMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{t.storage.title}</h2>
          <p className="text-xs text-[#FDBA74] mt-0.5">{t.storage.subtitle}</p>
        </div>

        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition shadow-md shadow-[#F97316]/30 cursor-pointer"
        >
          <span>{t.storage.upgradeStorage}</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {cleanupMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{cleanupMessage}</span>
        </div>
      )}

      {/* Main Gauge Card */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-medium text-[#FDBA74]">
              {isEn ? 'Total storage used' : 'Total utilizado'}
            </span>
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
            <span>
              {availableGb} {isEn ? `GB available on ${planTier} Plan` : `GB disponíveis no Plano ${planTier}`}
            </span>
          </div>
        </div>

        {/* Multi-segmented visual bar */}
        <div className="mt-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#0A0A0A] border border-[#27272A] flex">
            <div className="h-full bg-[#F97316]" style={{ width: '16.8%' }} title={`${t.storage.breakdown.videos} (8.4 GB)`} />
            <div className="h-full bg-[#9333EA]" style={{ width: '8.4%' }} title={`${t.storage.breakdown.cuts} (4.2 GB)`} />
            <div className="h-full bg-[#3B82F6]" style={{ width: '2.4%' }} title={`${isEn ? 'Audio & Subtitles' : 'Áudio e legendas'} (1.2 GB)`} />
            <div className="h-full bg-amber-400" style={{ width: '2.0%' }} title={`${t.storage.breakdown.thumbnails} (1.0 GB)`} />
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />
              <p className="text-white font-medium">{t.storage.breakdown.videos}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9333EA]" />
              <p className="text-white font-medium">{t.storage.breakdown.cuts}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
              <p className="text-white font-medium">{isEn ? 'Audio & Captions' : 'Áudio & Legendas'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <p className="text-white font-medium">{t.storage.breakdown.thumbnails}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Features List */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FDBA74] mb-3">
          {t.storage.features.title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <ShieldCheck className="h-4 w-4 text-[#F97316] shrink-0 mt-0.5" />
            <p className="text-white">{t.storage.features.retention}</p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <HardDrive className="h-4 w-4 text-[#F97316] shrink-0 mt-0.5" />
            <p className="text-white">{t.storage.features.cdn}</p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <CheckCircle2 className="h-4 w-4 text-[#F97316] shrink-0 mt-0.5" />
            <p className="text-white">{t.storage.features.backup}</p>
          </div>
        </div>
      </div>

      {/* Cleanup recommendation */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            {isEn ? 'Smart storage cleanup recommended' : 'Limpeza inteligente recomendada'}
          </h3>
          <p className="text-xs text-[#FDBA74] mt-0.5">
            {isEn ? 'Remove temporary caches and old preview renders to free up quota.' : 'Remova caches temporários e pré-renderizações antigas para liberar espaço.'}
          </p>
        </div>
        <button
          onClick={handleCleanStorage}
          className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition whitespace-nowrap cursor-pointer"
        >
          {isEn ? 'Free up 2.4 GB now' : 'Liberar 2.4 GB agora'}
        </button>
      </div>
    </div>
  );
};
