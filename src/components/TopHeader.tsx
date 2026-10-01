import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Globe, Upload, Settings, Check, ChevronDown } from 'lucide-react';
import { TabType } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { Language } from '../i18n/types';

interface TopHeaderProps {
  activeTab: TabType;
  isOpenSidebar: boolean;
  onToggleSidebar: () => void;
  onOpenUpload: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onNavigateTab?: (tab: TabType) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  isOpenSidebar,
  onToggleSidebar,
  onOpenUpload,
  searchQuery,
  setSearchQuery,
  onNavigateTab,
}) => {
  const { language, setLanguage, t } = useI18n();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    if (isLangMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangMenuOpen]);

  const currentTabInfo = t.header.tabs[activeTab] || t.header.tabs.dashboard;

  const handleSelectLanguage = (newLang: Language) => {
    setLanguage(newLang);
    setIsLangMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-[#27272A] bg-[#0A0A0A]/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Zone 1: Three dots toggle (⋯) + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className={`flex items-center justify-center rounded-xl border p-2.5 transition-all duration-200 active:scale-95 ${
            isOpenSidebar
              ? 'border-[#F97316] bg-[#F97316]/20 text-[#F97316] shadow-sm shadow-[#F97316]/20'
              : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:border-[#F97316]/60 hover:bg-[#1E1E1E] hover:text-white'
          }`}
          title={isOpenSidebar ? 'Fechar menu (⋯)' : 'Menu (⋯)'}
          aria-label="Menu"
          aria-expanded={isOpenSidebar}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
          {currentTabInfo.title}
        </h1>
      </div>

      {/* Zone 3: Actions (Language Selector with Globe 🌐 + Settings + Upload CTA) */}
      <div className="flex items-center gap-2.5">
        {/* Language Selector Dropdown replacing the Bell */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setIsLangMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition ${
              isLangMenuOpen
                ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:border-[#3F3F46] hover:bg-[#1E1E1E] hover:text-white'
            }`}
            title={t.header.selectLanguage}
            aria-label={t.header.selectLanguage}
            aria-expanded={isLangMenuOpen}
          >
            <Globe className="h-4 w-4 text-[#F97316]" />
            <span className="font-semibold text-[11px] tracking-wider uppercase text-white">
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </span>
            <ChevronDown className="h-3 w-3 text-[#FDBA74] opacity-75" />
          </button>

          {isLangMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#27272A] bg-[#151515] p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-[#FDBA74] uppercase border-b border-[#27272A] mb-1">
                {t.header.language}
              </div>

              <button
                onClick={() => handleSelectLanguage('pt-BR')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  language === 'pt-BR'
                    ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                    : 'text-slate-300 hover:bg-[#202020] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇧🇷</span>
                  <span>{t.header.portuguese}</span>
                </span>
                {language === 'pt-BR' && <Check className="h-3.5 w-3.5" />}
              </button>

              <button
                onClick={() => handleSelectLanguage('en-US')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  language === 'en-US'
                    ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                    : 'text-slate-300 hover:bg-[#202020] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇺🇸</span>
                  <span>{t.header.english}</span>
                </span>
                {language === 'en-US' && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('configuracoes')}
            className={`rounded-xl border p-2.5 transition ${
              activeTab === 'configuracoes'
                ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:border-[#3F3F46] hover:bg-[#1E1E1E] hover:text-white'
            }`}
            title={t.header.settings}
            aria-label={t.header.settings}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 rounded-xl bg-[#F97316] px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/25 transition hover:bg-[#EA580C] active:scale-[0.98] whitespace-nowrap cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">{t.header.uploadVideo}</span>
          <span className="sm:hidden">{t.common.upload}</span>
        </button>
      </div>
    </header>
  );
};
