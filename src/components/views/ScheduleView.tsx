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
          <h2 className="text-lg font-bold text-white">Agendamentos</h2>
          <p className="text-xs text-[#FDBA74]">
            Acompanhe o status e a fila de publicações em todas as plataformas
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Novo agendamento</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              statusFilter === 'todos'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            Todos ({counts.todos})
          </button>

          <button
            onClick={() => setStatusFilter('agendado')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              statusFilter === 'agendado'
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            Agendados ({counts.agendado})
          </button>

          <button
            onClick={() => setStatusFilter('processando')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              statusFilter === 'processando'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            Processando ({counts.processando})
          </button>

          <button
            onClick={() => setStatusFilter('publicado')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              statusFilter === 'publicado'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            Publicados ({counts.publicado})
          </button>

          <button
            onClick={() => setStatusFilter('falhou')}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              statusFilter === 'falhou'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[#FDBA74] hover:text-white bg-[#151515] border border-[#27272A]'
            }`}
          >
            Falhou ({counts.falhou})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#FDBA74]" />
          <input
            type="text"
            placeholder="Buscar por título ou legenda..."
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
              Nenhuma publicação encontrada
            </p>
            <p className="text-xs text-[#FDBA74] mt-1">
              Ajuste seus filtros ou crie um novo agendamento de vídeo.
            </p>
            <button
              onClick={onOpenSchedule}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar primeiro vídeo</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0A] text-[11px] font-semibold text-[#FDBA74] uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Vídeo</th>
                  <th className="py-3.5 px-4">Plataforma</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Horário</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A] text-xs">
                {filteredPublications.map((pub) => (
                  <tr
                    key={pub.id}
                    onClick={() => onSelectPublication(pub)}
                    className="group hover:bg-[#1A1A1A] transition cursor-pointer"
                  >
                    {/* Vídeo */}
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
                          <p className="truncate font-semibold text-white group-hover:text-[#A78BFA] transition">
                            {pub.title}
                          </p>
                          <p className="truncate text-[11px] text-[#FDBA74] mt-0.5" title={pub.description}>
                            {pub.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Plataforma */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pub.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} />
                        ))}
                      </div>
                    </td>

                    {/* Data */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-white font-medium">
                        <Calendar className="h-3.5 w-3.5 text-[#F97316]" />
                        <span>{pub.scheduledDateLabel}</span>
                      </div>
                    </td>

                    {/* Horário */}
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

                    {/* Ações */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPublication(pub);
                          }}
                          className="rounded-lg border border-[#27272A] px-3 py-1 font-medium text-white hover:border-[#F97316] hover:bg-[#F97316]/10 transition"
                        >
                          Detalhes
                        </button>

                        {onDeletePublication && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remover agendamento "${pub.title}"?`)) {
                                onDeletePublication(pub.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-rose-500/10 hover:text-rose-400 transition"
                            title="Remover"
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
