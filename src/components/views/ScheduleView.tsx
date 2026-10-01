import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { ScheduledPublication, PublicationStatus, SocialPlatform } from '../../types';
import { StatusBadge, PlatformBadge } from '../StatusBadge';
import { useI18n } from '../../i18n/I18nContext';

interface ScheduleViewProps {
  publications: ScheduledPublication[];
  onOpenSchedule: () => void;
  onSelectPublication: (pub: ScheduledPublication) => void;
  onDeletePublication?: (id: string) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  publications,
  onOpenSchedule,
  onSelectPublication,
  onDeletePublication,
}) => {
  const { t, language } = useI18n();
  const isEn = language === 'en-US';

  const [statusFilter, setStatusFilter] = useState<'todos' | PublicationStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtered publications
  const filteredPublications = publications.filter((pub) => {
    const matchesStatus = statusFilter === 'todos' || pub.status === statusFilter;
    const matchesSearch =
      pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pub.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Count by status
  const counts = {
    todos: publications.length,
    agendado: publications.filter((p) => p.status === 'agendado').length,
    processando: publications.filter((p) => p.status === 'processando').length,
    publicado: publications.filter((p) => p.status === 'publicado').length,
    falhou: publications.filter((p) => p.status === 'falhou').length,
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{t.schedule.title}</h2>
          <p className="text-xs text-[#FDBA74]">
            {t.schedule.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t.schedule.newSchedule}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            {t.common.all} ({counts.todos})
          </button>

          <button
            onClick={() => setStatusFilter('agendado')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'agendado'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            {t.schedule.status.scheduled} ({counts.agendado})
          </button>

          <button
            onClick={() => setStatusFilter('processando')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'processando'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            {isEn ? 'Processing' : 'Processando'} ({counts.processando})
          </button>

          <button
            onClick={() => setStatusFilter('publicado')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'publicado'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            {t.schedule.status.published} ({counts.publicado})
          </button>

          <button
            onClick={() => setStatusFilter('falhou')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'falhou'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            {t.schedule.status.failed} ({counts.falhou})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#FDBA74]" />
          <input
            type="text"
            placeholder={isEn ? 'Search by title or caption...' : 'Buscar por título ou legenda...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[#27272A] bg-[#151515] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none"
          />
        </div>
      </div>

      {/* Main Table / Schedule List */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] overflow-hidden shadow-xl">
        {filteredPublications.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="mx-auto h-9 w-9 text-[#FDBA74] mb-2" />
            <p className="text-sm font-medium text-white">
              {t.schedule.emptyTitle}
            </p>
            <p className="text-xs text-[#FDBA74] mt-1">
              {t.schedule.emptyDesc}
            </p>
            <button
              onClick={onOpenSchedule}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.schedule.scheduleFirst}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0A] text-[11px] font-semibold text-[#FDBA74] uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">{t.schedule.table.video}</th>
                  <th className="py-3.5 px-4">{t.schedule.table.platforms}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Date' : 'Data'}</th>
                  <th className="py-3.5 px-4">{isEn ? 'Time' : 'Horário'}</th>
                  <th className="py-3.5 px-4">{t.schedule.table.status}</th>
                  <th className="py-3.5 px-4 text-right">{t.schedule.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A] text-xs">
                {filteredPublications.map((pub) => (
                  <tr
                    key={pub.id}
                    onClick={() => onSelectPublication(pub)}
                    className="group hover:bg-[#1A1A1A] transition cursor-pointer"
                  >
                    {/* Video */}
                    <td className="py-4 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black border border-[#27272A]">
                          <img
                            src={pub.thumbnail}
                            alt={pub.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.2 font-mono text-[9px] text-white">
                            {pub.duration}
                          </span>
                        </div>
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <p className="truncate font-semibold text-white group-hover:text-[#F97316] transition">
                            {pub.title}
                          </p>
                          <p className="truncate text-[11px] text-[#FDBA74] mt-0.5" title={pub.description}>
                            {pub.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Platforms */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pub.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} />
                        ))}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <Calendar className="h-3.5 w-3.5 text-[#F97316]" />
                        <span>{pub.scheduledDateLabel}</span>
                      </div>
                    </td>

                    {/* Time */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-white tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[#F97316]" />
                        <span>{pub.scheduledTime}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <StatusBadge status={pub.status} />
                      {pub.errorMessage && pub.status === 'falhou' && (
                        <p className="mt-1 text-[10px] text-rose-400 max-w-[140px] truncate" title={pub.errorMessage}>
                          {pub.errorMessage}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPublication(pub);
                          }}
                          className="rounded-lg border border-[#27272A] px-3 py-1 font-medium text-white hover:border-[#F97316] hover:bg-[#F97316]/10 transition cursor-pointer"
                        >
                          {t.common.details}
                        </button>

                        {onDeletePublication && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(isEn ? `Cancel schedule "${pub.title}"?` : `Remover agendamento "${pub.title}"?`)) {
                                onDeletePublication(pub.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
                            title={t.common.delete}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
