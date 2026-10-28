import React from 'react';
import {
  LayoutDashboard,
  Film,
  Plus,
  Clock,
  Menu,
} from 'lucide-react';
import { TabType } from '../types';
import { useI18n } from '../i18n/I18nContext';

interface MobileBottomNavProps {
  activeTab: TabType;
  onNavigateTab: (tab: TabType) => void;
  onOpenUpload: () => void;
  onOpenMore: () => void;
  isSidebarOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigateTab,
  onOpenUpload,
  onOpenMore,
  isSidebarOpen,
}) => {
  const { t } = useI18n();

  const isMoreActive =
    isSidebarOpen ||
    ['calendario', 'contas', 'armazenamento', 'plano', 'configuracoes'].includes(activeTab);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 dark:border-[var(--user-card-border,#1E293B)] bg-white/95 dark:bg-[var(--user-bg-card,#0D1322)]/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.45)] transition-colors duration-200"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      aria-label="Navegação mobile"
    >
      <div className="flex items-center justify-around px-2 pt-1.5 h-14">
        {/* 1. Início (Dashboard) */}
        <button
          type="button"
          onClick={() => onNavigateTab('dashboard')}
          className={`group relative flex flex-1 flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 ${
            activeTab === 'dashboard'
              ? 'text-[var(--user-btn-primary,#6366F1)]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label={t.nav.home}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <div className="relative">
            <LayoutDashboard
              className={`h-5 w-5 transition-transform duration-200 ${
                activeTab === 'dashboard' ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
              }`}
            />
            {activeTab === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[var(--user-btn-primary,#6366F1)]" />
            )}
          </div>
          <span
            className={`mt-1 text-[10px] tracking-tight leading-none ${
              activeTab === 'dashboard' ? 'font-bold' : 'font-medium'
            }`}
          >
            {t.nav.home}
          </span>
        </button>

        {/* 2. Meus Vídeos */}
        <button
          type="button"
          onClick={() => onNavigateTab('videos')}
          className={`group relative flex flex-1 flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 ${
            activeTab === 'videos'
              ? 'text-[var(--user-btn-primary,#6366F1)]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label={t.nav.videos}
          aria-current={activeTab === 'videos' ? 'page' : undefined}
        >
          <div className="relative">
            <Film
              className={`h-5 w-5 transition-transform duration-200 ${
                activeTab === 'videos' ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
              }`}
            />
            {activeTab === 'videos' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[var(--user-btn-primary,#6366F1)]" />
            )}
          </div>
          <span
            className={`mt-1 text-[10px] tracking-tight leading-none ${
              activeTab === 'videos' ? 'font-bold' : 'font-medium'
            }`}
          >
            {t.nav.videos}
          </span>
        </button>

        {/* 3. Upload (Botão Central Destacado) */}
        <div className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onOpenUpload}
            className="flex h-12 w-12 -mt-4 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white dark:ring-[#0D1322] active:scale-90 transition-transform duration-150 cursor-pointer"
            style={{
              backgroundColor: 'var(--user-btn-primary, #6366F1)',
              boxShadow: '0 8px 16px color-mix(in srgb, var(--user-btn-primary, #6366F1) 40%, transparent)',
            }}
            aria-label={t.header.uploadVideo}
            title={t.header.uploadVideo}
          >
            <Plus className="h-6 w-6 stroke-[2.6]" />
          </button>
        </div>

        {/* 4. Agendamentos */}
        <button
          type="button"
          onClick={() => onNavigateTab('agendamentos')}
          className={`group relative flex flex-1 flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 ${
            activeTab === 'agendamentos'
              ? 'text-[var(--user-btn-primary,#6366F1)]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label={t.nav.agendamentos}
          aria-current={activeTab === 'agendamentos' ? 'page' : undefined}
        >
          <div className="relative">
            <Clock
              className={`h-5 w-5 transition-transform duration-200 ${
                activeTab === 'agendamentos' ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
              }`}
            />
            {activeTab === 'agendamentos' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[var(--user-btn-primary,#6366F1)]" />
            )}
          </div>
          <span
            className={`mt-1 text-[10px] tracking-tight leading-none ${
              activeTab === 'agendamentos' ? 'font-bold' : 'font-medium'
            }`}
          >
            {t.nav.agendamentos}
          </span>
        </button>

        {/* 5. Mais (Acesso a Calendário, Contas, Armazenamento, Plano, Configurações) */}
        <button
          type="button"
          onClick={onOpenMore}
          className={`group relative flex flex-1 flex-col items-center justify-center min-h-[48px] py-1 transition-all active:scale-95 ${
            isMoreActive
              ? 'text-[var(--user-btn-primary,#6366F1)]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label={t.nav.more}
          aria-expanded={isSidebarOpen}
        >
          <div className="relative">
            <Menu
              className={`h-5 w-5 transition-transform duration-200 ${
                isMoreActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
              }`}
            />
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[var(--user-btn-primary,#6366F1)]" />
            )}
          </div>
          <span
            className={`mt-1 text-[10px] tracking-tight leading-none ${
              isMoreActive ? 'font-bold' : 'font-medium'
            }`}
          >
            {t.nav.more}
          </span>
        </button>
      </div>
    </nav>
  );
};
