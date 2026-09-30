import React from 'react';
import { MoreHorizontal, Bell, Upload, Settings } from 'lucide-react';
import { TabType } from '../types';

interface TopHeaderProps {
  activeTab: TabType;
  isOpenSidebar: boolean;
  onToggleSidebar: () => void;
  onOpenUpload: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onNavigateTab?: (tab: TabType) => void;
}

const tabTitles: Record<TabType, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Visão geral e desempenho de publicações',
  },
  videos: {
    title: 'Meus vídeos',
    subtitle: 'Biblioteca de clipes e mídias brutas prontas para corte',
  },
  agendamentos: {
    title: 'Agendamentos',
    subtitle: 'Fila de publicação automatizada por canal',
  },
  calendario: {
    title: 'Calendário editorial',
    subtitle: 'Programação semanal e mensal de conteúdos',
  },
  contas: {
    title: 'Contas conectadas',
    subtitle: 'Redes sociais ativas para distribuição simultânea',
  },
  armazenamento: {
    title: 'Armazenamento',
    subtitle: 'Capacidade do plano e gerenciamento de arquivos',
  },
  plano: {
    title: 'Meu Plano',
    subtitle: 'Plano Pro Creator ativo · Renovação em 18 de Outubro',
  },
  configuracoes: {
    title: 'Configurações',
    subtitle: 'Preferências da conta, integrações e automações',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  isOpenSidebar,
  onToggleSidebar,
  onOpenUpload,
  searchQuery,
  setSearchQuery,
  onNavigateTab,
}) => {
  const currentTabInfo = tabTitles[activeTab] || tabTitles.dashboard;

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-[#27272A] bg-[#0A0A0A]/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Zone 1: Three dots toggle (⋯) + Breadcrumb / Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className={`flex items-center justify-center rounded-xl border p-2.5 transition-all duration-200 active:scale-95 ${
            isOpenSidebar
              ? 'border-[#F97316] bg-[#F97316]/20 text-[#F97316] shadow-sm shadow-[#F97316]/20'
              : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:border-[#F97316]/60 hover:bg-[#1E1E1E] hover:text-white'
          }`}
          title={isOpenSidebar ? 'Fechar menu secundário (⋯)' : 'Menu secundário (⋯)'}
          aria-label="Alternar menu secundário"
          aria-expanded={isOpenSidebar}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
          {currentTabInfo.title}
        </h1>
      </div>

      {/* Zone 3: Actions (Notifications + Settings + Enviar vídeo CTA) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => {}}
          className="relative rounded-xl border border-[#27272A] bg-[#151515] p-2.5 text-[#FDBA74] transition hover:border-[#3F3F46] hover:bg-[#1E1E1E] hover:text-white"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#F97316] ring-2 ring-[#0A0A0A]" />
        </button>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('configuracoes')}
            className={`rounded-xl border p-2.5 transition ${
              activeTab === 'configuracoes'
                ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:border-[#3F3F46] hover:bg-[#1E1E1E] hover:text-white'
            }`}
            title="Configurações da conta"
            aria-label="Configurações da conta"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 rounded-xl bg-[#F97316] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/25 transition hover:bg-[#EA580C] active:scale-[0.98] whitespace-nowrap"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar vídeo</span>
          <span className="sm:hidden">Enviar</span>
        </button>
      </div>
    </header>
  );
};
