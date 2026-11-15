import React from 'react';
import {
  LayoutDashboard,
  Film,
  Clock,
  CalendarDays,
  Share2,
  HardDrive,
  Sparkles,
  Settings,
  ChevronDown,
  X,
  LogOut,
  PlusCircle,
} from 'lucide-react';
import { TabType } from '../types';
import { StorageUsageData } from '../services/storageService';
import { UserProfileSettings } from '../services/userSettingsService';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenUpload: () => void;
  onLogout?: () => void;
  storageUsage?: StorageUsageData;
  activePlanTier?: string;
  userProfile?: UserProfileSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  onOpenUpload,
  onLogout,
  storageUsage,
  activePlanTier = 'PRO',
  userProfile,
}) => {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const displayUsed = storageUsage?.usedFormatted || '2.4 GB';
  const displayLimit = storageUsage?.limitFormatted || '50 GB';
  const displayPercent = storageUsage?.percentUsed ?? 4.8;
  const userName = userProfile?.name || 'Vicente Silva';
  const userEmail = userProfile?.email || 'vic102393566@gmail.com';
  const userAvatar = userProfile?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
  
  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'videos', label: t.nav.videos, icon: Film },
    { id: 'agendamentos', label: t.nav.agendamentos, icon: Clock },
    { id: 'calendario', label: t.nav.calendario, icon: CalendarDays },
    { id: 'contas', label: t.nav.contas, icon: Share2 },
    { id: 'armazenamento', label: t.nav.armazenamento, icon: HardDrive },
    { id: 'plano', label: t.nav.plano, icon: Sparkles },
    { id: 'configuracoes', label: t.nav.configuracoes, icon: Settings },
  ];

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop for outside click dismissal on both desktop and mobile */}
      <div
        className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isLight ? 'bg-slate-900/40' : 'bg-black/60 dark:bg-black/80'
        } ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar container - slides in as drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 sm:w-80 flex-col border-r shadow-2xl transition-transform duration-300 ease-in-out ${
          isLight
            ? 'border-slate-200 bg-white text-slate-900'
            : 'border-slate-200 dark:border-[var(--user-card-border,#1E293B)] bg-white dark:bg-[var(--user-bg-card,#0D1322)]'
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        aria-label="Menu de navegação"
      >
        {/* Brand Header */}
        <div
          className={`flex h-18 items-center justify-between border-b px-6 ${
            isLight ? 'border-slate-200 bg-white' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Clipo Geometric Icon */}
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg transition-colors keep-white"
              style={{
                backgroundColor: isLight ? '#4F46E5' : 'var(--user-btn-primary, #6366F1)',
                boxShadow: isLight
                  ? '0 8px 16px rgba(79, 70, 229, 0.25)'
                  : '0 8px 16px color-mix(in srgb, var(--user-btn-primary, #6366F1) 30%, transparent)',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path
                  d="M4 8C4 5.79086 5.79086 4 8 4H16C18.2091 4 20 5.79086 20 8V16C20 18.2091 18.2091 20 16 20H8C5.79086 20 4 18.2091 4 16V8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M10 9L15 12L10 15V9Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xl font-bold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'
                }`}
              >
                clipo
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: isLight ? '#4F46E5' : 'var(--user-btn-primary, #6366F1)' }}
              />
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className={`rounded-lg p-1.5 transition cursor-pointer ${
              isLight
                ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 border border-transparent hover:border-slate-200'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="px-4 py-3">
          <button
            onClick={() => {
              setActiveTab('configuracoes');
              setIsOpen(false);
            }}
            className={`group flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition cursor-pointer ${
              isLight
                ? 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-slate-100'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131A29] hover:border-[var(--user-btn-primary,#6366F1)]/50 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white keep-white"
                style={{ backgroundColor: isLight ? '#4F46E5' : 'var(--user-btn-primary, #6366F1)' }}
              >
                VS
              </div>
              <div className="truncate">
                <p
                  className={`truncate text-xs font-semibold ${
                    isLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {userName}
                </p>
                <p
                  className={`text-[11px] font-medium ${
                    isLight ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {activePlanTier} · 4 {t.nav.activeChannelsCount}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-colors ${
                isLight
                  ? 'text-slate-600 group-hover:text-slate-900'
                  : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white'
              }`}
            />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div
            className={`mb-2 px-3 text-[11px] font-semibold tracking-wider uppercase ${
              isLight ? 'text-slate-600' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {t.nav.navigation}
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  data-active={isActive ? 'true' : 'false'}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? isLight
                        ? 'font-semibold border border-indigo-200 bg-indigo-50 text-indigo-800 shadow-xs'
                        : 'font-semibold shadow-sm'
                      : isLight
                      ? 'border border-transparent text-slate-800 hover:bg-slate-100 hover:text-slate-950 hover:border-slate-200'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={
                    isActive && !isLight
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
                          color: 'var(--user-btn-primary, #6366F1)',
                        }
                      : undefined
                  }
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                      style={{
                        backgroundColor: isLight ? '#4F46E5' : 'var(--user-btn-primary, #6366F1)',
                      }}
                    />
                  )}
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? isLight
                          ? 'text-indigo-700'
                          : ''
                        : isLight
                        ? 'text-slate-600 group-hover:text-slate-900'
                        : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
                    }`}
                    style={
                      isActive && !isLight
                        ? { color: 'var(--user-btn-primary, #6366F1)' }
                        : undefined
                    }
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick upload button inside sidebar for ease of reach */}
          <div className="mt-6 px-1">
            <button
              onClick={() => {
                onOpenUpload();
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold text-white shadow-md transition active:scale-[0.99] cursor-pointer hover:opacity-95 keep-white"
              style={{
                backgroundColor: isLight ? '#4F46E5' : 'var(--user-btn-primary, #6366F1)',
                boxShadow: isLight
                  ? '0 4px 12px rgba(79, 70, 229, 0.25)'
                  : '0 4px 12px color-mix(in srgb, var(--user-btn-primary, #6366F1) 25%, transparent)',
              }}
            >
              <PlusCircle className="h-4 w-4 text-white" />
              <span className="text-white">{t.nav.uploadNewVideo}</span>
            </button>
          </div>
        </div>

        {/* Storage Widget & User Footer */}
        <div
          className={`border-t p-4 space-y-4 ${
            isLight
              ? 'border-slate-200 bg-slate-50'
              : 'border-slate-200 dark:border-[var(--user-card-border,#1E293B)] bg-slate-50/50 dark:bg-[var(--user-bg-main,#0B0F17)]/70'
          }`}
        >
          {/* Storage Bar */}
          <div
            onClick={() => {
              setActiveTab('armazenamento');
              setIsOpen(false);
            }}
            className={`cursor-pointer rounded-xl border p-3 transition hover:shadow-sm ${
              isLight
                ? 'border-slate-200 bg-white hover:border-slate-300'
                : 'border-slate-200 dark:border-[var(--user-card-border,#1E293B)] bg-white dark:bg-[var(--user-bg-card,#131A29)] hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-semibold ${
                  isLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'
                }`}
              >
                {t.nav.storage}
              </span>
              <span
                className={`font-mono tabular-nums ${
                  isLight ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {displayUsed} / {displayLimit}
              </span>
            </div>
            <div
              className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                isLight ? 'bg-slate-200' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(displayPercent, 100)}%`,
                  background: displayPercent > 90
                    ? 'linear-gradient(to right, #F43F5E, #F59E0B)'
                    : isLight
                    ? 'linear-gradient(to right, #4F46E5, #6366F1)'
                    : 'linear-gradient(to right, var(--user-btn-primary, #6366F1), var(--user-accent, #8B5CF6))',
                }}
              />
            </div>
          </div>

          {/* User profile */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={userAvatar}
                alt={userName}
                referrerPolicy="no-referrer"
                className={`h-9 w-9 rounded-full object-cover ring-1 ${
                  isLight ? 'ring-slate-300' : 'ring-slate-200 dark:ring-slate-800'
                }`}
              />
              <div className="truncate">
                <p
                  className={`truncate text-xs font-semibold ${
                    isLight ? 'text-slate-900' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {userName}
                </p>
                <p
                  className={`truncate text-[11px] ${
                    isLight ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {userEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setActiveTab('configuracoes');
                  setIsOpen(false);
                }}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  isLight
                    ? 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-950 border border-transparent hover:border-slate-300'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white'
                }`}
                title={t.header.settings}
              >
                <Settings className="h-4 w-4" />
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    setIsOpen(false);
                  }}
                  className={`rounded-lg p-1.5 transition cursor-pointer ${
                    isLight
                      ? 'text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-200'
                      : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-500'
                  }`}
                  title={t.nav.logout}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
