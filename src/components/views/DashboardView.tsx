import React from 'react';
import {
  Upload,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Share2,
  Play,
  ArrowUpRight,
  Film,
  Zap,
  AlertTriangle,
  ChevronRight,
  Layers,
  Check
} from 'lucide-react';
import { UpcomingPublications } from '../UpcomingPublications';
import { ScheduledPublication, SocialAccount } from '../../types';

interface DashboardViewProps {
  publications: ScheduledPublication[];
  connectedAccounts: SocialAccount[];
  videosCount?: number;
  storageUsage?: {
    totalUsedBytes?: number;
    totalLimitBytes?: number;
    usedFormatted?: string;
    limitFormatted?: string;
    percentUsed?: number;
    availableBytes?: number;
    isOverLimit?: boolean;
  };
  onOpenUpload: () => void;
  onSelectPublication: (pub: ScheduledPublication) => void;
  onDeletePublication: (id: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  publications,
  connectedAccounts,
  videosCount = 148,
  storageUsage,
  onOpenUpload,
  onSelectPublication,
  onDeletePublication,
  onNavigateTab,
}) => {
  const displayUsed = storageUsage?.usedFormatted || '0,0 GB';
  const displayLimit = storageUsage?.limitFormatted || '50,0 GB';
  const percentUsed = Math.min(100, Math.max(0, storageUsage?.percentUsed ?? 0));
  const isOverLimit = storageUsage?.isOverLimit ?? false;
  const availableGb = storageUsage?.availableBytes
    ? `${(storageUsage.availableBytes / (1024 * 1024 * 1024)).toFixed(1)} GB livres`
    : '50,0 GB livres';

  // Storage status styling logic (Requirement 2)
  const isCritical = isOverLimit || percentUsed >= 90;
  const isWarning = !isCritical && percentUsed >= 70;
  const isNormal = !isCritical && !isWarning;

  const storageStrokeColor = isCritical
    ? '#EF4444' // Rose / Alert
    : isWarning
    ? '#F59E0B' // Amber / Attention
    : '#F97316'; // Calm orange / Clipo brand

  // Calendar metrics & upcoming items (Requirement 3)
  const publishedPubs = publications.filter((p) => p.status === 'publicado');
  const scheduledPubs = publications.filter(
    (p) => p.status === 'agendado' || p.status === 'processando'
  );
  const nextPub = scheduledPubs[0] || null;
  const upcomingTimeline = scheduledPubs.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* 1. SEÇÃO DE AÇÕES PRINCIPAIS (Requirement 1 & Requirement 6) */}
      <section aria-label="Ações principais do Clipo">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Ações Rápidas
            </h1>
          </div>
        </div>

        {/* 4 Main Action Items - Mobile Carousel with peeking card + Desktop 4-col Grid */}
        <div className="flex overflow-x-auto no-scrollbar gap-3 pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 snap-x">
          {/* Ação 1: Upload de Vídeo (Mais destacada) */}
          <div
            onClick={onOpenUpload}
            className="group relative snap-start shrink-0 w-[215px] sm:w-auto rounded-2xl border-2 border-[#F97316]/70 bg-gradient-to-b from-[#F97316]/15 via-[#151515] to-[#151515] p-3.5 sm:p-5 flex flex-col justify-between cursor-pointer shadow-lg shadow-[#F97316]/10 hover:border-[#F97316] hover:shadow-xl hover:shadow-[#F97316]/20 transition-all duration-200 active:scale-[0.99]"
            role="button"
            tabIndex={0}
            aria-label="Upload de novo vídeo"
          >
            <div className="flex items-start justify-between gap-2">
              {/* Circular prominent icon */}
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[#F97316] text-white flex items-center justify-center shadow-md shadow-[#F97316]/40 ring-4 ring-[#F97316]/25 group-hover:scale-105 group-hover:bg-[#EA580C] group-hover:ring-[#F97316]/40 transition-all duration-200">
                <Upload className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-[#F97316] transition">
                Upload de vídeo
              </h2>
            </div>
          </div>

          {/* Ação 2: Armazenamento (Com indicador dinâmico normal/atenção/alerta) */}
          <div
            onClick={() => onNavigateTab('armazenamento')}
            className={`group relative snap-start shrink-0 w-[215px] sm:w-auto rounded-2xl border bg-[#151515] p-3.5 sm:p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:bg-[#1A1A1A] active:scale-[0.99] ${
              isCritical
                ? 'border-rose-500/60 shadow-lg shadow-rose-950/20 hover:border-rose-500'
                : isWarning
                ? 'border-amber-500/50 shadow-md shadow-amber-950/20 hover:border-amber-500'
                : 'border-[#27272A] hover:border-[#F97316]/60'
            }`}
            role="button"
            tabIndex={0}
            aria-label="Ver detalhes de armazenamento"
          >
            <div className="flex items-start justify-between gap-2">
              {/* Circular gauge with SVG progress meter */}
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center p-1 group-hover:border-[#3F3F46] transition">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background track circle */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#27272A"
                    strokeWidth="3"
                  />
                  {/* Progress stroke */}
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={storageStrokeColor}
                    strokeWidth="3.2"
                    strokeDasharray={`${percentUsed}, 100`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-[11px] sm:text-xs font-bold text-white tabular-nums">
                    {Math.round(percentUsed)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-[#F97316] transition">
                Armazenamento
              </h2>
            </div>
          </div>

          {/* Ação 3: Calendário Editorial (Acesso aos agendamentos e datas) */}
          <div
            onClick={() => onNavigateTab('calendario')}
            className="group relative snap-start shrink-0 w-[215px] sm:w-auto rounded-2xl border border-[#27272A] bg-[#151515] p-3.5 sm:p-5 flex flex-col justify-between cursor-pointer hover:border-[#F97316]/60 hover:bg-[#1A1A1A] transition-all duration-200 active:scale-[0.99]"
            role="button"
            tabIndex={0}
            aria-label="Abrir calendário de publicações"
          >
            <div className="flex items-start justify-between gap-2">
              {/* Circular calendar icon */}
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[#0A0A0A] border-2 border-[#27272A] text-[#F97316] flex items-center justify-center group-hover:border-[#F97316] group-hover:scale-105 transition-all shadow-sm">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-[#F97316] transition">
                Calendário
              </h2>
            </div>
          </div>

          {/* Ação 4: Mudar Plano */}
          <div
            onClick={() => onNavigateTab('plano')}
            className="group relative snap-start shrink-0 w-[215px] sm:w-auto rounded-2xl border border-[#27272A] bg-[#151515] p-3.5 sm:p-5 flex flex-col justify-between cursor-pointer hover:border-[#F97316]/60 hover:bg-[#1A1A1A] transition-all duration-200 active:scale-[0.99]"
            role="button"
            tabIndex={0}
            aria-label="Gerenciar e mudar plano"
          >
            <div className="flex items-start justify-between gap-2">
              {/* Circular tier icon */}
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-[#F97316]/20 via-[#0A0A0A] to-[#151515] border-2 border-[#F97316]/40 text-[#F97316] flex items-center justify-center group-hover:border-[#F97316] group-hover:scale-105 transition-all shadow-sm">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <h2 className="text-sm sm:text-base font-bold text-white group-hover:text-[#F97316] transition">
                Mudar plano
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RESUMO COMPACTO DO CALENDÁRIO (Requirement 3) */}
      <section
        aria-label="Resumo do Calendário"
        className="rounded-2xl border border-[#27272A] bg-[#151515] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Resumo do Calendário Editorial
              </h2>
              <p className="text-xs text-[#FDBA74]">
                Acompanhe postagens concluídas, fila ativa e próximas datas
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#F97316] hover:text-[#F97316] transition"
          >
            <span>Abrir calendário completo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3 Quick Indicator Counters (Publicados, Agendados, Próxima Data) - Mobile Carousel with peeking card */}
        <div className="flex overflow-x-auto no-scrollbar gap-2.5 py-3.5 border-b border-[#27272A] -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 snap-x">
          {/* 1: Vídeos já publicados */}
          <div className="snap-start shrink-0 min-w-[210px] sm:min-w-0 flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {publishedPubs.length} vídeos entregues
              </span>
            </div>
          </div>

          {/* 2: Vídeos agendados na fila */}
          <div className="snap-start shrink-0 min-w-[210px] sm:min-w-0 flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {scheduledPubs.length} na fila automática
              </span>
            </div>
          </div>

          {/* 3: Próxima data de publicação */}
          <div className="snap-start shrink-0 min-w-[210px] sm:min-w-0 flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-white truncate block">
                {nextPub
                  ? `${nextPub.scheduledDateLabel} às ${nextPub.scheduledTime}`
                  : 'Nenhum agendamento pendente'}
              </span>
            </div>
          </div>
        </div>

        {/* Mini Upcoming Timeline Preview (Next 3 items) with horizontal scroll on mobile */}
        <div className="pt-3.5">
          <div className="mb-2.5">
            <span className="text-xs font-semibold text-white">
              Próximos vídeos programados
            </span>
          </div>

          {scheduledPubs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#27272A] bg-[#0A0A0A] p-4 text-center">
              <p className="text-xs text-[#FDBA74]">
                Nenhum vídeo agendado no momento.
              </p>
              <button
                onClick={onOpenUpload}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F97316] hover:text-[#EA580C]"
              >
                <span>Fazer upload e agendar publicação</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex overflow-x-auto no-scrollbar gap-3 pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 snap-x">
              {upcomingTimeline.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectPublication(item)}
                  className="snap-start shrink-0 min-w-[220px] sm:min-w-0 flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5 hover:border-[#F97316] hover:bg-[#151515] transition cursor-pointer group"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-semibold text-white group-hover:text-[#F97316] transition"
                      title={item.title}
                    >
                      {item.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-[#FDBA74]">
                      <span>{item.scheduledDateLabel}</span>
                      <span>·</span>
                      <span>{item.scheduledTime}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#FDBA74]/70 capitalize truncate">
                      {item.platforms.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. CANAIS CONECTADOS PARA DISTRIBUIÇÃO */}
      <section
        aria-label="Canais conectados"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#27272A] bg-[#151515] px-4 py-3"
      >
        <div className="flex items-center gap-2 text-xs text-white">
          <Share2 className="h-4 w-4 text-[#F97316]" />
          <span className="font-medium">Canais conectados para distribuição:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(() => {
            const connectedOnly = connectedAccounts.filter((account) => account.connected);
            if (connectedOnly.length === 0) {
              return null;
            }
            return connectedOnly.map((account) => (
              <div
                key={account.id}
                onClick={() => onNavigateTab('contas')}
                className="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-white hover:border-emerald-500/50 hover:bg-emerald-500/20 transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium capitalize">{account.platform}</span>
                <span className="font-mono text-[#FDBA74] tabular-nums">
                  {account.handle}
                </span>
              </div>
            ));
          })()}

          <button
            onClick={() => onNavigateTab('contas')}
            className="flex items-center gap-1 text-xs text-[#F97316] hover:text-[#EA580C] font-semibold pl-1 cursor-pointer"
          >
            <span>{connectedAccounts.some((a) => a.connected) ? 'Gerenciar contas' : 'Conectar contas'}</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* 4. LISTA OPERACIONAL DAS PRÓXIMAS PUBLICAÇÕES */}
      <UpcomingPublications
        publications={publications}
        onSelectPublication={onSelectPublication}
        onOpenUpload={onOpenUpload}
        onDeletePublication={onDeletePublication}
      />
    </div>
  );
};
