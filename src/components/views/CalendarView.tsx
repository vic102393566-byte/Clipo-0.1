import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Share2,
  Filter
} from 'lucide-react';
import { ScheduledPublication, PublicationStatus } from '../../types';
import { StatusBadge, PlatformBadge } from '../StatusBadge';

interface CalendarViewProps {
  publications: ScheduledPublication[];
  onOpenSchedule: () => void;
  onSelectPublication: (pub: ScheduledPublication) => void;
  onBack?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  publications,
  onOpenSchedule,
  onSelectPublication,
  onBack,
}) => {
  // Current view month: September 2026 (Year 2026, Month Index 8 = September)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 is September
  const [selectedDay, setSelectedDay] = useState<number>(23); // 23 is today
  const [statusFilter, setStatusFilter] = useState<'todos' | PublicationStatus>('todos');

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Days calculation for current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group publications by ISO day string
  const getPubsForDay = (day: number) => {
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

    return publications.filter((p) => {
      const matchesDate =
        p.dateISO === dateStr ||
        (p.scheduledDateLabel && p.scheduledDateLabel.includes(String(day))) ||
        (day === 23 && p.scheduledDateLabel.includes('Hoje')) ||
        (day === 24 && p.scheduledDateLabel.includes('Amanhã'));

      const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
      return matchesDate && matchesStatus;
    });
  };

  const selectedDayPubs = getPubsForDay(selectedDay);

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Button */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDBA74] hover:text-white transition py-1.5 px-3 -ml-1 rounded-xl hover:bg-[#151515] border border-transparent hover:border-[#27272A] cursor-pointer group"
            title="Voltar para a tela anterior"
          >
            <span className="text-base font-bold leading-none transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Voltar</span>
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Calendário de Publicações</h2>
          <p className="text-xs text-[#FDBA74]">
            Visão mensal de lançamentos distribuídos por canais e status
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 rounded-xl border border-[#27272A] bg-[#151515] p-1">
            <button
              onClick={handlePrevMonth}
              className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#1E1E1E] hover:text-white transition"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-white min-w-[130px] text-center font-mono">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#1E1E1E] hover:text-white transition"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onOpenSchedule}
            className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Agendar data</span>
          </button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[#FDBA74] text-[11px] font-medium mr-1">Filtrar por:</span>
        <button
          onClick={() => setStatusFilter('todos')}
          className={`rounded-lg px-2.5 py-1 font-medium transition ${
            statusFilter === 'todos'
              ? 'bg-[#F97316] text-white'
              : 'bg-[#151515] text-[#FDBA74] hover:text-white border border-[#27272A]'
          }`}
        >
          Todos os status
        </button>
        <button
          onClick={() => setStatusFilter('agendado')}
          className={`rounded-lg px-2.5 py-1 font-medium transition ${
            statusFilter === 'agendado'
              ? 'bg-[#F97316] text-white'
              : 'bg-[#151515] text-[#FDBA74] hover:text-white border border-[#27272A]'
          }`}
        >
          Agendados
        </button>
        <button
          onClick={() => setStatusFilter('processando')}
          className={`rounded-lg px-2.5 py-1 font-medium transition ${
            statusFilter === 'processando'
              ? 'bg-amber-600 text-white'
              : 'bg-[#151515] text-[#FDBA74] hover:text-white border border-[#27272A]'
          }`}
        >
          Processando
        </button>
        <button
          onClick={() => setStatusFilter('publicado')}
          className={`rounded-lg px-2.5 py-1 font-medium transition ${
            statusFilter === 'publicado'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#151515] text-[#FDBA74] hover:text-white border border-[#27272A]'
          }`}
        >
          Publicados
        </button>
        <button
          onClick={() => setStatusFilter('falhou')}
          className={`rounded-lg px-2.5 py-1 font-medium transition ${
            statusFilter === 'falhou'
              ? 'bg-rose-600 text-white'
              : 'bg-[#151515] text-[#FDBA74] hover:text-white border border-[#27272A]'
          }`}
        >
          Falhou
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 columns on large screens) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#27272A] bg-[#151515] p-4 sm:p-5 shadow-xl">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 border-b border-[#27272A] pb-3 text-center text-xs font-semibold text-[#FDBA74]">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Days grid */}
          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty padding before day 1 */}
            {Array.from({ length: firstDayWeekday }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[85px] rounded-xl border border-transparent p-1.5 opacity-20"
              />
            ))}

            {daysArray.map((day) => {
              const dayPubs = getPubsForDay(day);
              const isToday = currentYear === 2026 && currentMonth === 8 && day === 23;
              const isSelected = selectedDay === day;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[92px] rounded-xl border p-2 transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#F97316] bg-[#F97316]/15 shadow-inner ring-1 ring-[#F97316]/50'
                      : isToday
                      ? 'border-[#F97316]/60 bg-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#0A0A0A]/50 hover:border-[#3F3F46] hover:bg-[#1A1A1A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isToday
                          ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316] font-bold text-white'
                          : isSelected
                          ? 'font-bold text-white'
                          : 'text-[#FDBA74]'
                      }`}
                    >
                      {day}
                    </span>
                    {dayPubs.length > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F97316]/20 px-1 font-mono text-[10px] font-bold text-white border border-[#F97316]/40">
                        {dayPubs.length}
                      </span>
                    )}
                  </div>

                  {/* Publications preview tags in day tile */}
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayPubs.slice(0, 2).map((pub) => {
                      let tagBg = 'bg-[#F97316]/20 text-white border-[#F97316]/30';
                      if (pub.status === 'publicado') tagBg = 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
                      if (pub.status === 'processando') tagBg = 'bg-amber-500/20 text-amber-200 border-amber-500/30';
                      if (pub.status === 'falhou') tagBg = 'bg-rose-500/20 text-rose-200 border-rose-500/30';

                      return (
                        <div
                          key={pub.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPublication(pub);
                          }}
                          className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium transition hover:brightness-125 ${tagBg}`}
                          title={`${pub.scheduledTime} - ${pub.title}`}
                        >
                          <span className="font-mono tabular-nums">{pub.scheduledTime}</span> · {pub.title}
                        </div>
                      );
                    })}
                    {dayPubs.length > 2 && (
                      <div className="text-[10px] font-mono text-[#FDBA74] pl-1">
                        +{dayPubs.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Drawer / Sidebar (1 column) */}
        <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div>
                <span className="text-[11px] font-medium text-[#FDBA74] uppercase tracking-wider">
                  Programação do dia
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedDay} de {monthNames[currentMonth]} {currentYear}
                </h3>
              </div>
              <span className="rounded-full bg-[#F97316]/20 border border-[#F97316]/40 px-2.5 py-0.5 font-mono text-xs font-semibold text-white">
                {selectedDayPubs.length} {selectedDayPubs.length === 1 ? 'vídeo' : 'vídeos'}
              </span>
            </div>

            {/* List of items scheduled for the selected day */}
            <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {selectedDayPubs.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarIcon className="mx-auto h-8 w-8 text-[#FDBA74] mb-2" />
                  <p className="text-xs font-semibold text-white">
                    Nenhum vídeo agendado para o dia {selectedDay}
                  </p>
                  <p className="text-[11px] text-[#FDBA74] mt-1">
                    Programe uma publicação para manter a consistência do canal.
                  </p>
                  <button
                    onClick={onOpenSchedule}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#EA580C] transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Agendar para este dia</span>
                  </button>
                </div>
              ) : (
                selectedDayPubs.map((pub) => (
                  <div
                    key={pub.id}
                    onClick={() => onSelectPublication(pub)}
                    className="group rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 transition hover:border-[#F97316]/50 hover:bg-[#1A1A1A] cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={pub.thumbnail}
                        alt={pub.title}
                        className="h-12 w-12 rounded-lg object-cover bg-black shrink-0 border border-[#27272A]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-[#F97316] tabular-nums">
                            {pub.scheduledTime}
                          </span>
                          <StatusBadge status={pub.status} showIcon={false} />
                        </div>
                        <p className="truncate text-xs font-semibold text-white mt-0.5 group-hover:text-[#A78BFA] transition">
                          {pub.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {pub.platforms.map((p) => (
                            <PlatformBadge key={p} platform={p} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {pub.description && (
                      <p className="mt-2 text-[11px] text-[#FDBA74] line-clamp-2 border-t border-[#27272A] pt-2">
                        {pub.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Schedule Footer */}
          <div className="mt-4 border-t border-[#27272A] pt-3">
            <button
              onClick={onOpenSchedule}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2 text-xs font-medium text-white hover:border-[#F97316] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Agendar nova publicação</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
