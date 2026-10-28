import React, { useState } from 'react';
import {
  Clock,
  Play,
  Calendar,
  MoreVertical,
  ExternalLink,
  Trash2,
  Edit2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { ScheduledPublication, SocialPlatform } from '../types';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';

interface UpcomingPublicationsProps {
  publications: ScheduledPublication[];
  onSelectPublication: (pub: ScheduledPublication) => void;
  onOpenUpload: () => void;
  onDeletePublication: (id: string) => void;
}

export const UpcomingPublications: React.FC<UpcomingPublicationsProps> = ({
  publications,
  onSelectPublication,
  onOpenUpload,
  onDeletePublication,
}) => {
  const { t, language } = useI18n();
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialPlatform>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = publications.filter((item) => {
    if (platformFilter === 'all') return true;
    return item.platforms.includes(platformFilter);
  });

  const getPlatformBadge = (platform: SocialPlatform) => {
    switch (platform) {
      case 'tiktok':
        return (
          <span key="tiktok" className="text-slate-300 font-medium hover:text-white transition">
            TikTok
          </span>
        );
      case 'instagram':
        return (
          <span key="instagram" className="text-pink-400 font-medium hover:text-pink-300 transition">
            Reels
          </span>
        );
      case 'youtube':
        return (
          <span key="youtube" className="text-red-400 font-medium hover:text-red-300 transition">
            Shorts
          </span>
        );
      case 'linkedin':
        return (
          <span key="linkedin" className="text-sky-400 font-medium hover:text-sky-300 transition">
            LinkedIn
          </span>
        );
    }
  };

  const isEn = language === 'en-US';

  return (
    <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-3.5 sm:p-6">
      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#27272A] pb-3 sm:pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-lg font-semibold text-white">
              {t.dashboard.upcoming.title}
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#FDBA74]">
              ({filtered.length} {isEn ? 'scheduled' : 'agendadas'})
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#FDBA74]">
            {t.dashboard.upcoming.subtitle}
          </p>
        </div>

        {/* Interactive Segmented Filter Controls */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[#27272A] bg-[#0A0A0A] p-1 no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-1">
          <button
            onClick={() => setPlatformFilter('all')}
            className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition whitespace-nowrap ${
              platformFilter === 'all'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white'
            }`}
          >
            {t.dashboard.upcoming.filterAll}
          </button>
          <button
            onClick={() => setPlatformFilter('tiktok')}
            className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition whitespace-nowrap ${
              platformFilter === 'tiktok'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white'
            }`}
          >
            TikTok
          </button>
          <button
            onClick={() => setPlatformFilter('instagram')}
            className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition whitespace-nowrap ${
              platformFilter === 'instagram'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white'
            }`}
          >
            Instagram Reels
          </button>
          <button
            onClick={() => setPlatformFilter('youtube')}
            className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition whitespace-nowrap ${
              platformFilter === 'youtube'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white'
            }`}
          >
            YouTube Shorts
          </button>
          <button
            onClick={() => setPlatformFilter('linkedin')}
            className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium transition whitespace-nowrap ${
              platformFilter === 'linkedin'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white'
            }`}
          >
            LinkedIn
          </button>
        </div>
      </div>

      {/* Publications List */}
      <div className="mt-2 sm:mt-4 divide-y divide-[#27272A]/70">
        {filtered.length === 0 ? (
          <div className="py-8 sm:py-12 text-center">
            <Clock className="mx-auto h-7 w-7 sm:h-8 sm:w-8 text-[#FDBA74] mb-2" />
            <p className="text-xs sm:text-sm font-medium text-white">
              {t.dashboard.upcoming.emptyTitle}
            </p>
            <p className="text-xs text-[#FDBA74] mt-1 max-w-sm mx-auto">
              {t.dashboard.upcoming.emptyDesc}
            </p>
            <button
              onClick={onOpenUpload}
              className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition cursor-pointer"
            >
              {t.dashboard.upcoming.scheduleNow}
            </button>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-2.5 py-2.5 sm:py-3.5 transition hover:bg-[#1A1A1A] rounded-xl px-1 sm:px-2"
            >
              {/* Left: Thumbnail & Details */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* 9:16 Thumbnail Container */}
                <div
                  onClick={() => onSelectPublication(item)}
                  className="relative h-14 w-10 sm:h-18 sm:w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[#27272A] bg-black group-hover:border-[#F97316] transition"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 text-white fill-white" />
                  </div>
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 py-0.2 font-mono text-[8px] sm:text-[9px] tabular-nums text-white">
                    {item.duration}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    onClick={() => onSelectPublication(item)}
                    className="cursor-pointer font-semibold text-white text-xs sm:text-sm hover:text-[#F97316] transition truncate max-w-full"
                    title={item.title}
                  >
                    {item.title}
                  </h3>

                  {/* Desktop-only description */}
                  <p className="hidden sm:block mt-0.5 text-xs text-[#FDBA74] line-clamp-1">
                    {item.description || (isEn ? 'No caption provided' : 'Sem legenda definida')}
                  </p>

                  {/* Essential Metadata: Data/Hora e Rede Social no Mobile */}
                  <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2 text-[11px] sm:text-xs">
                    <span className="flex items-center gap-1 font-mono text-[#FDBA74] font-medium shrink-0">
                      <Clock className="h-3 w-3 text-[#F97316]" />
                      <span>{item.scheduledDateLabel}, {item.scheduledTime}</span>
                    </span>
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className="flex items-center gap-1 font-medium text-slate-300 truncate">
                      {item.platforms.map((p, idx) => (
                        <React.Fragment key={p}>
                          {idx > 0 && <span className="text-zinc-600">/</span>}
                          {getPlatformBadge(p)}
                        </React.Fragment>
                      ))}
                    </span>
                    <span aria-hidden="true" className="hidden sm:inline text-zinc-600">·</span>
                    <span className="hidden sm:inline font-mono tabular-nums text-[#FDBA74]">{item.fileSize}</span>
                    <span aria-hidden="true" className="hidden sm:inline text-zinc-600">·</span>
                    <span className="hidden sm:inline">
                      <StatusBadge status={item.status} />
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Desktop-only text label */}
                <div className="hidden sm:block text-right pr-2">
                  <div className="text-[11px] text-[#FDBA74]">
                    {isEn ? 'Simultaneous Direct Post' : 'Disparo simultâneo'}
                  </div>
                </div>

                {/* Desktop Details Button */}
                <button
                  onClick={() => onSelectPublication(item)}
                  className="hidden sm:inline-flex rounded-lg border border-[#27272A] px-2.5 py-1.5 text-xs font-medium text-white hover:border-[#F97316] hover:bg-[#F97316]/10 transition cursor-pointer"
                >
                  {t.common.details}
                </button>

                {/* Options Menu Button (3 dots) */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                    className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg p-1 text-[#FDBA74] hover:bg-[#1E1E1E] hover:text-white transition cursor-pointer active:scale-95"
                    aria-label="Opções"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpenId === item.id && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-[#27272A] bg-[#151515] p-1.5 shadow-xl">
                      <button
                        onClick={() => {
                          onSelectPublication(item);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white hover:bg-[#1E1E1E] cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>{t.common.details}</span>
                      </button>
                      <button
                        onClick={() => {
                          onSelectPublication(item);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#F97316] hover:bg-[#F97316]/20 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{isEn ? 'Publish now' : 'Publicar agora'}</span>
                      </button>
                      <div className="my-1 border-t border-[#27272A]" />
                      <button
                        onClick={() => {
                          onDeletePublication(item.id);
                          setMenuOpenId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t.common.delete}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
