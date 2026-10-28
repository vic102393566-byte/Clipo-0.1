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
  Check,
  HardDrive,
} from 'lucide-react';
import { UpcomingPublications } from '../UpcomingPublications';
import { ScheduledPublication, SocialAccount } from '../../types';
import { useI18n } from '../../i18n/I18nContext';

interface DashboardViewProps {
  publications: ScheduledPublication[];
  connectedAccounts: SocialAccount[];
  videosCount?: number;
  userName?: string;
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
  videosCount = 0,
  userName,
  storageUsage,
  onOpenUpload,
  onSelectPublication,
  onDeletePublication,
  onNavigateTab,
}) => {
  const { t, language } = useI18n();
  const isEn = language === 'en-US';

  // Dynamic time-based greeting (5h-12h Bom dia, 12h-18h Boa tarde, 18h-5h Boa noite)
  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return isEn ? 'Good morning' : 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      return isEn ? 'Good afternoon' : 'Boa tarde';
    } else {
      return isEn ? 'Good evening' : 'Boa noite';
    }
  };

  const greetingText = getDynamicGreeting();
  const firstName = userName ? userName.trim().split(' ')[0] : '';

  const displayUsed = storageUsage?.usedFormatted || '0.0 GB';
  const displayLimit = storageUsage?.limitFormatted || '50.0 GB';
  const percentUsed = Math.min(100, Math.max(0, storageUsage?.percentUsed ?? 0));
  const isOverLimit = storageUsage?.isOverLimit ?? false;
  const availableGb = storageUsage?.availableBytes
    ? `${(storageUsage.availableBytes / (1024 * 1024 * 1024)).toFixed(1)} ${isEn ? 'GB free' : 'GB livres'}`
    : isEn ? '50.0 GB free' : '50,0 GB livres';

  const isCritical = isOverLimit || percentUsed >= 90;
  const isWarning = !isCritical && percentUsed >= 70;
  const isNormal = !isCritical && !isWarning;

  const storageStrokeColor = isCritical
    ? '#EF4444'
    : isWarning
    ? '#F59E0B'
    : 'var(--user-btn-primary, #6366F1)';

  const publishedPubs = publications.filter((p) => p.status === 'publicado');
  const scheduledPubs = publications.filter(
    (p) => p.status === 'agendado' || p.status === 'processando'
  );
  const nextPub = scheduledPubs[0] || null;
  const upcomingTimeline = scheduledPubs.slice(0, 3);
  const connectedCount = connectedAccounts.filter((a) => a.connected).length;

  // Smart summary based strictly on real available data
  const getSmartSummary = () => {
    if (publishedPubs.length > 0 && nextPub) {
      const pubWord = isEn
        ? publishedPubs.length === 1 ? 'post delivered' : 'posts delivered'
        : publishedPubs.length === 1 ? 'vídeo entregue' : 'vídeos entregues';
      const atWord = isEn ? 'at' : 'às';
      return `${publishedPubs.length} ${pubWord} · ${isEn ? 'Next post' : 'Próximo post'} ${nextPub.scheduledDateLabel.toLowerCase()} ${atWord} ${nextPub.scheduledTime}`;
    }

    if (publishedPubs.length > 0 && !nextPub) {
      const pubWord = isEn
        ? publishedPubs.length === 1 ? 'post delivered' : 'posts delivered'
        : publishedPubs.length === 1 ? 'vídeo entregue' : 'vídeos entregues';
      return `${publishedPubs.length} ${pubWord} · ${isEn ? 'Queue is clear for new posts' : 'Fila livre para novos agendamentos'}`;
    }

    if (nextPub) {
      const atWord = isEn ? 'at' : 'às';
      return `${isEn ? 'Next post scheduled for' : 'Próxima publicação em'} ${nextPub.scheduledDateLabel.toLowerCase()} ${atWord} ${nextPub.scheduledTime}`;
    }

    if (videosCount > 0) {
      const vidWord = isEn
        ? videosCount === 1 ? 'video ready' : 'videos ready'
        : videosCount === 1 ? 'vídeo pronto' : 'vídeos prontos';
      return `${videosCount} ${vidWord} ${isEn ? 'for trim & scheduling in library' : 'no acervo para cortes e publicação'}`;
    }

    return null;
  };

  const smartSummaryText = getSmartSummary();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. QUICK ACTIONS SECTION */}
      <section aria-label={t.dashboard.quickActions.title}>
        {/* MOBILE REFINED HERO (< 640px): Saudação destacada + Gradiente azul/índigo/violeta sutil + Resumo inteligente + Animação de entrada */}
        <div className="sm:hidden mb-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-blue-950/25 via-indigo-950/30 to-violet-950/20 p-3.5 shadow-sm shadow-indigo-950/25 backdrop-blur-sm animate-hero-enter relative overflow-hidden">
          {/* Hairline highlight superior discreto */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/35 to-transparent" />

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wider uppercase text-indigo-400">
                {greetingText}
              </p>
              <h1 className="mt-0.5 text-lg font-bold text-white tracking-tight leading-snug">
                {firstName ? `${greetingText}, ${firstName}` : greetingText}
              </h1>
            </div>

            {/* Status discreto de canais ativos com toque tátil */}
            {connectedCount > 0 ? (
              <button
                type="button"
                onClick={() => onNavigateTab('contas')}
                className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-[#0D1224]/85 px-2.5 py-1 text-[11px] text-indigo-200 hover:border-indigo-400/50 hover:text-white transition-all duration-150 cursor-pointer active:scale-95 shrink-0"
                title={t.dashboard.channels.title}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono font-bold text-white">{connectedCount}</span>
                <span className="text-indigo-300/80">{connectedCount === 1 ? (isEn ? 'channel' : 'canal') : (isEn ? 'channels' : 'canais')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('contas')}
                className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-[#0D1224]/85 px-2.5 py-1 text-[11px] text-indigo-300 hover:text-white hover:border-indigo-400 transition-all duration-150 cursor-pointer active:scale-95 shrink-0"
              >
                <span>{isEn ? '+ Connect' : '+ Conectar'}</span>
              </button>
            )}
          </div>

          {/* Resumo inteligente compacto ou estado vazio motivacional com espaçamento otimizado */}
          <div className="mt-2.5 text-xs text-slate-300/90 leading-relaxed">
            {smartSummaryText ? (
              <p className="font-normal text-slate-300">
                {smartSummaryText}
              </p>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300/90">
                <span className="truncate">{isEn ? 'Ready to create? Upload your first video.' : 'Pronto para criar? Carregue o seu primeiro vídeo.'}</span>
                <button
                  onClick={onOpenUpload}
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors ml-1 shrink-0 cursor-pointer active:scale-95 duration-150"
                >
                  {isEn ? 'Upload →' : 'Enviar →'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP HEADER (>= 640px): Título Original 100% Preservado */}
        <div className="hidden sm:flex items-center justify-between mb-3 px-1">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {t.dashboard.quickActions.title}
            </h1>
          </div>
        </div>

        {/* MOBILE VIEW (< 640px): Ações Rápidas Circulares (estilo app bancário simples), 4 colunas uniformes com feedback tátil */}
        <div className="grid grid-cols-4 gap-2 w-full sm:hidden">
          {/* Action 1: Upload Video */}
          <button
            type="button"
            onClick={onOpenUpload}
            className="group flex flex-col items-center justify-center p-1 active:scale-90 transition-all duration-150 cursor-pointer"
            aria-label={t.dashboard.quickActions.uploadVideo}
          >
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-all duration-150">
              <Upload className="h-5 w-5 stroke-[2.3]" />
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate max-w-full text-center">
              {t.common.upload}
            </span>
          </button>

          {/* Action 2: Armazenamento */}
          <button
            type="button"
            onClick={() => onNavigateTab('armazenamento')}
            className="group flex flex-col items-center justify-center p-1 active:scale-90 transition-all duration-150 cursor-pointer"
            aria-label={t.nav.storage}
          >
            <div
              className={`relative flex h-13 w-13 items-center justify-center rounded-full bg-[#18181B] border transition-all duration-150 ${
                isCritical
                  ? 'border-rose-500/70 text-rose-400'
                  : isWarning
                  ? 'border-amber-500/70 text-amber-400'
                  : 'border-[#27272A] text-slate-200 group-hover:border-indigo-500/60'
              }`}
            >
              <HardDrive className={`h-5 w-5 ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-indigo-400'}`} />
              <span className="absolute -bottom-1 -right-0.5 rounded-full bg-[#0A0A0A] border border-[#27272A] px-1 text-[9px] font-mono font-bold text-white leading-tight">
                {Math.round(percentUsed)}%
              </span>
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate max-w-full text-center">
              {t.nav.storage}
            </span>
          </button>

          {/* Action 3: Calendário */}
          <button
            type="button"
            onClick={() => onNavigateTab('calendario')}
            className="group flex flex-col items-center justify-center p-1 active:scale-90 transition-all duration-150 cursor-pointer"
            aria-label={t.nav.calendario}
          >
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-[#18181B] border border-[#27272A] text-indigo-400 group-hover:border-indigo-500/60 transition-all duration-150">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate max-w-full text-center">
              {t.nav.calendario}
            </span>
          </button>

          {/* Action 4: Plano */}
          <button
            type="button"
            onClick={() => onNavigateTab('plano')}
            className="group flex flex-col items-center justify-center p-1 active:scale-90 transition-all duration-150 cursor-pointer"
            aria-label={t.nav.plano}
          >
            <div className="flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/15 via-[#18181B] to-[#18181B] border border-indigo-500/40 text-indigo-400 group-hover:border-indigo-400 transition-all duration-150">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate max-w-full text-center">
              {t.nav.plano}
            </span>
          </button>
        </div>

        {/* DESKTOP VIEW (>= 640px): 4 Cartões Retangulares Originais 100% Preservados */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Action 1: Upload Video */}
          <div
            onClick={onOpenUpload}
            className="group relative rounded-2xl border-2 p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-[0.99]"
            style={{
              borderColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 70%, transparent)',
              background: 'linear-gradient(to bottom, color-mix(in srgb, var(--user-btn-primary, #6366F1) 15%, transparent), var(--user-bg-card, #151515) 45%, var(--user-bg-card, #151515))',
            }}
            role="button"
            tabIndex={0}
            aria-label={t.dashboard.quickActions.uploadVideo}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="h-14 w-14 rounded-full text-white flex items-center justify-center shadow-md ring-4 group-hover:scale-105 transition-all duration-200"
                style={{
                  backgroundColor: 'var(--user-btn-primary, #6366F1)',
                  boxShadow: '0 8px 16px color-mix(in srgb, var(--user-btn-primary, #6366F1) 35%, transparent)',
                  outlineColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 25%, transparent)',
                }}
              >
                <Upload className="h-6 w-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-white transition">
                {t.dashboard.quickActions.uploadVideo}
              </h2>
            </div>
          </div>

          {/* Action 2: Storage */}
          <div
            onClick={() => onNavigateTab('armazenamento')}
            className={`group relative rounded-2xl border bg-[var(--user-bg-card,#151515)] p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 active:scale-[0.99] ${
              isCritical
                ? 'border-rose-500/60 shadow-lg shadow-rose-950/20 hover:border-rose-500'
                : isWarning
                ? 'border-amber-500/50 shadow-md shadow-amber-950/20 hover:border-amber-500'
                : 'border-[var(--user-card-border,#27272A)] hover:border-[var(--user-btn-primary,#6366F1)]/60'
            }`}
            role="button"
            tabIndex={0}
            aria-label={t.nav.storage}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="relative h-14 w-14 rounded-full bg-[#0A0A0A] border border-[var(--user-card-border,#27272A)] flex items-center justify-center p-1 group-hover:border-[var(--user-card-border,#3F3F46)] transition">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#27272A" strokeWidth="3" />
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
                  <span className="font-mono text-xs font-bold text-white tabular-nums">
                    {Math.round(percentUsed)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-white transition">
                {t.nav.storage}
              </h2>
            </div>
          </div>

          {/* Action 3: Editorial Calendar */}
          <div
            onClick={() => onNavigateTab('calendario')}
            className="group relative rounded-2xl border border-[var(--user-card-border,#27272A)] bg-[var(--user-bg-card,#151515)] p-5 flex flex-col justify-between cursor-pointer hover:border-[var(--user-btn-primary,#6366F1)]/60 transition-all duration-200 active:scale-[0.99]"
            role="button"
            tabIndex={0}
            aria-label={t.nav.calendario}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="h-14 w-14 rounded-full bg-[#0A0A0A] border-2 border-[var(--user-card-border,#27272A)] flex items-center justify-center group-hover:scale-105 transition-all shadow-sm"
                style={{ color: 'var(--user-btn-primary, #6366F1)' }}
              >
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-white transition">
                {t.nav.calendario}
              </h2>
            </div>
          </div>

          {/* Action 4: Change Plan */}
          <div
            onClick={() => onNavigateTab('plano')}
            className="group relative rounded-2xl border border-[var(--user-card-border,#27272A)] bg-[var(--user-bg-card,#151515)] p-5 flex flex-col justify-between cursor-pointer hover:border-[var(--user-btn-primary,#6366F1)]/60 transition-all duration-200 active:scale-[0.99]"
            role="button"
            tabIndex={0}
            aria-label={t.nav.plano}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="h-14 w-14 rounded-full border-2 flex items-center justify-center group-hover:scale-105 transition-all shadow-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 15%, #0A0A0A)',
                  borderColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 40%, transparent)',
                  color: 'var(--user-btn-primary, #6366F1)',
                }}
              >
                <Sparkles className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4">
              <h2 className="text-base font-bold text-white transition">
                {t.nav.plano}
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CALENDAR SUMMARY SECTION */}
      {/* MOBILE COMPACT VIEW (< 640px): Reduzido drasticamente na vertical, foco apenas na próxima publicação */}
      <section
        aria-label={t.calendar.title}
        className="sm:hidden rounded-2xl border border-[#27272A] bg-[#151515] p-3.5"
      >
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#27272A]/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316]">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-xs font-bold text-white truncate">
              {isEn ? 'Next post' : 'Próxima publicação'}
            </h2>
          </div>

          <button
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FDBA74] hover:text-white transition cursor-pointer shrink-0"
          >
            <span>{t.dashboard.upcoming.viewCalendar}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {nextPub ? (
          <div
            onClick={() => onSelectPublication(nextPub)}
            className="mt-2.5 flex items-center gap-3 rounded-xl bg-[#0A0A0A] p-2 hover:border-[#F97316]/40 border border-transparent transition cursor-pointer active:scale-[0.99]"
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
              <img
                src={nextPub.thumbnail}
                alt={nextPub.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Play className="h-3.5 w-3.5 fill-white text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {nextPub.title}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-[#FDBA74]">
                <Clock className="h-3 w-3 text-[#F97316]" />
                <span>{nextPub.scheduledDateLabel}, {isEn ? 'at' : 'às'} {nextPub.scheduledTime}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 capitalize truncate">
                {nextPub.platforms.join(', ')}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#FDBA74] py-1">
            <span>{isEn ? 'No post scheduled yet' : 'Nenhuma publicação agendada'}</span>
            <button
              onClick={onOpenUpload}
              className="font-semibold text-[#F97316] hover:text-[#EA580C] cursor-pointer"
            >
              {t.dashboard.upcoming.scheduleNow}
            </button>
          </div>
        )}
      </section>

      {/* DESKTOP VIEW (>= 640px): Estrutura Completa Original 100% Preservada */}
      <section
        aria-label={t.calendar.title}
        className="hidden sm:block rounded-2xl border border-[#27272A] bg-[#151515] p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t.calendar.title}
              </h2>
              <p className="text-xs text-[#FDBA74]">
                {t.calendar.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('calendario')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#F97316] hover:text-[#F97316] transition cursor-pointer"
          >
            <span>{t.dashboard.upcoming.viewCalendar}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3 Quick Counters */}
        <div className="grid grid-cols-3 gap-2.5 py-3.5 border-b border-[#27272A]">
          {/* Delivered videos */}
          <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono text-base font-bold text-white tabular-nums">
                {publishedPubs.length} {isEn ? 'published posts' : 'vídeos entregues'}
              </span>
            </div>
          </div>

          {/* Queued videos */}
          <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono text-base font-bold text-white tabular-nums">
                {scheduledPubs.length} {isEn ? 'queued for post' : 'na fila automática'}
              </span>
            </div>
          </div>

          {/* Next post date */}
          <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-mono text-xs font-bold text-white truncate block">
                {nextPub
                  ? `${nextPub.scheduledDateLabel} ${isEn ? 'at' : 'às'} ${nextPub.scheduledTime}`
                  : t.dashboard.upcoming.emptyTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Mini Upcoming Timeline Preview */}
        <div className="pt-3.5">
          <div className="mb-2.5">
            <span className="text-xs font-semibold text-white">
              {t.dashboard.upcoming.title}
            </span>
          </div>

          {scheduledPubs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#27272A] bg-[#0A0A0A] p-4 text-center">
              <p className="text-xs text-[#FDBA74]">
                {t.dashboard.upcoming.emptyDesc}
              </p>
              <button
                onClick={onOpenUpload}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F97316] hover:text-[#EA580C] cursor-pointer"
              >
                <span>{t.dashboard.upcoming.scheduleNow}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {upcomingTimeline.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectPublication(item)}
                  className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5 hover:border-[#F97316] hover:bg-[#151515] transition cursor-pointer group"
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

      {/* 3. CONNECTED CHANNELS */}
      <section
        aria-label={t.dashboard.channels.title}
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-2.5 sm:px-4 sm:py-3"
      >
        <div className="flex items-center gap-2 text-xs text-white">
          <Share2 className="h-4 w-4 text-[#F97316]" />
          <span className="font-medium">{t.dashboard.channels.title}:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          {(() => {
            const connectedOnly = connectedAccounts.filter((account) => account.connected);
            if (connectedOnly.length === 0) {
              return null;
            }
            return connectedOnly.map((account) => (
              <div
                key={account.id}
                onClick={() => onNavigateTab('contas')}
                className="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-white hover:border-emerald-500/50 hover:bg-emerald-500/20 transition text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium capitalize">{account.platform}</span>
                <span className="font-mono text-[#FDBA74] tabular-nums text-[11px]">
                  {account.handle}
                </span>
              </div>
            ));
          })()}

          <button
            onClick={() => onNavigateTab('contas')}
            className="flex items-center gap-1 text-xs text-[#F97316] hover:text-[#EA580C] font-semibold pl-1 cursor-pointer"
          >
            <span>
              {connectedAccounts.some((a) => a.connected)
                ? t.dashboard.channels.manage
                : t.dashboard.channels.connectAccount}
            </span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </section>

      {/* 4. UPCOMING PUBLICATIONS LIST */}
      <UpcomingPublications
        publications={publications}
        onSelectPublication={onSelectPublication}
        onOpenUpload={onOpenUpload}
        onDeletePublication={onDeletePublication}
      />
    </div>
  );
};
