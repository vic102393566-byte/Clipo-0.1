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
  PlusCircle,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { TabType } from '../types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenUpload: () => void;
  onLogout?: () => void;
  storageUsage?: {
    usedFormatted: string;
    limitFormatted: string;
    percentUsed: number;
  };
  activePlanTier?: string;
  userProfile?: {
    name: string;
    email: string;
    avatarUrl: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  onOpenUpload,
  onLogout,
  storageUsage,
  activePlanTier = 'Pro',
  userProfile,
}) => {
  const displayUsed = storageUsage?.usedFormatted || '2.4 GB';
  const displayLimit = storageUsage?.limitFormatted || '50 GB';
  const displayPercent = storageUsage?.percentUsed ?? 4.8;
  const userName = userProfile?.name || 'Vicente Silva';
  const userEmail = userProfile?.email || 'vic102393566@gmail.com';
  const userAvatar = userProfile?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'videos', label: 'Meus vídeos', icon: Film },
    { id: 'agendamentos', label: 'Agendamentos', icon: Clock },
    { id: 'calendario', label: 'Calendário', icon: CalendarDays },
    { id: 'contas', label: 'Contas conectadas', icon: Share2 },
    { id: 'armazenamento', label: 'Armazenamento', icon: HardDrive },
    { id: 'plano', label: 'Meu plano', icon: Sparkles },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop for outside click dismissal on both desktop and mobile */}
      <div
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar container - completely hidden by default, slides in as secondary menu */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 sm:w-80 flex-col border-r border-[#27272A] bg-[#151515] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        aria-label="Menu secundário de navegação"
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between border-b border-[#27272A] px-6">
          <div className="flex items-center gap-3">
            {/* Clipo Geometric Icon */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] via-[#EA580C] to-purple-800 shadow-lg shadow-[#F97316]/20">
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
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-white">clipo</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]"></span>
              </div>
              <span className="text-[11px] font-medium text-[#FDBA74]">Video Automation</span>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition"
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
            className="group flex w-full items-center justify-between rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5 text-left transition hover:border-[#3F3F46] hover:bg-[#1E1E1E]"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-zinc-800 to-zinc-700 text-xs font-semibold text-white">
                VS
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-medium text-white">Vicente Studio</p>
                <p className="text-[11px] text-[#FDBA74]">Plano Pro · 4 canais</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#FDBA74] group-hover:text-white" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="mb-2 px-3 text-[11px] font-medium tracking-wider text-[#FDBA74] uppercase">
            Navegação
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#F97316]/15 text-white shadow-sm'
                      : 'text-[#FDBA74] hover:bg-[#1E1E1E] hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#F97316]" />
                  )}
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#F97316]' : 'text-[#FDBA74] group-hover:text-white'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>

                  {item.id === 'agendamentos' && (
                    <span className="ml-auto font-mono text-xs tabular-nums text-[#F97316]">
                      24
                    </span>
                  )}

                  {item.id === 'contas' && (
                    <span className="ml-auto font-mono text-xs tabular-nums text-[#FDBA74]">
                      4
                    </span>
                  )}
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 px-4 text-xs font-semibold text-white shadow-md shadow-[#F97316]/25 transition hover:bg-[#EA580C] active:scale-[0.99]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Enviar novo vídeo</span>
            </button>
          </div>
        </div>

        {/* Storage Widget & User Footer */}
        <div className="border-t border-[#27272A] p-4 space-y-4 bg-[#0A0A0A]/50">
          {/* Storage Bar */}
          <div
            onClick={() => {
              setActiveTab('armazenamento');
              setIsOpen(false);
            }}
            className="cursor-pointer rounded-xl border border-[#27272A] bg-[#151515] p-3 transition hover:border-[#3F3F46] hover:bg-[#1A1A1A]"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-medium">Armazenamento</span>
              <span className="font-mono text-[#FDBA74] tabular-nums">
                {displayUsed} / {displayLimit}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#27272A]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  displayPercent > 90
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-[#F97316] to-[#9333EA]'
                }`}
                style={{ width: `${Math.min(displayPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#FDBA74]">
              <span className="font-mono tabular-nums">{displayPercent}% utilizado</span>
              <span className="flex items-center gap-0.5 text-[#F97316] hover:text-[#A78BFA]">
                Gerenciar
              </span>
            </div>
          </div>

          {/* User profile */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={userAvatar}
                alt={userName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover ring-1 ring-[#27272A]"
              />
              <div className="truncate">
                <p className="truncate text-xs font-semibold text-white">{userName}</p>
                <p className="truncate text-[11px] text-[#FDBA74]">{userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setActiveTab('configuracoes');
                  setIsOpen(false);
                }}
                className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#1E1E1E] hover:text-white"
                title="Configurações de conta"
              >
                <Settings className="h-4 w-4" />
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    setIsOpen(false);
                  }}
                  className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Sair da conta"
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
