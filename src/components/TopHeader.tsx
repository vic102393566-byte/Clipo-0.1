import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Globe,
  Upload,
  Settings,
  Check,
  ChevronDown
} from 'lucide-react';
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
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0F17]/90 px-4 sm:px-6 backdrop-blur-md transition-colors duration-200">
      {/* Zone 1: Three dots toggle (⋯) + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className={`flex items-center justify-center rounded-xl border p-2.5 transition-all duration-200 active:scale-95 ${
            isOpenSidebar
              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-500/10'
              : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-300'
          }`}
          title={isOpenSidebar ? 'Fechar menu (⋯)' : 'Menu (⋯)'}
          aria-label="Menu"
          aria-expanded={isOpenSidebar}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
          {currentTabInfo.title}
        </h1>
      </div>

      {/* Zone 3: Actions (Theme Selector + Language Selector + Settings + Upload CTA) */}
      <div className="flex items-center gap-2 sm:gap-2.5">
     
  

        {/* Language Selector Dropdown with Globe 🌐 */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => {
              setIsLangMenuOpen((prev) => !prev);
             
            }}
            className={`flex items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition ${
              isLangMenuOpen
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
            }`}
            title={t.header.selectLanguage}
            aria-label={t.header.selectLanguage}
            aria-expanded={isLangMenuOpen}
          >
            <Globe className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <span className="font-semibold text-[11px] tracking-wider uppercase text-slate-800 dark:text-white">
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
          </button>

          {isLangMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A29] p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800/80 mb-1">
                {t.header.language}
              </div>

              <button
                onClick={() => handleSelectLanguage('pt-BR')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  language === 'pt-BR'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇧🇷</span>
                  <span>{t.header.portuguese}</span>
                </span>
                {language === 'pt-BR' && <Check className="h-3.5 w-3.5 text-indigo-500" />}
              </button>

              <button
                onClick={() => handleSelectLanguage('en-US')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  language === 'en-US'
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇺🇸</span>
                  <span>{t.header.english}</span>
                </span>
                {language === 'en-US' && <Check className="h-3.5 w-3.5 text-indigo-500" />}
              </button>
            </div>
          )}
        </div>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('configuracoes')}
            className={`rounded-xl border p-2.5 transition ${
              activeTab === 'configuracoes'
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
            }`}
            title={t.header.settings}
            aria-label={t.header.settings}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition active:scale-[0.98] whitespace-nowrap cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">{t.header.uploadVideo}</span>
          <span className="sm:hidden">{t.common.upload}</span>
        </button>
      </div>
    </header>
  );
};
