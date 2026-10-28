import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  ArrowLeft,
  Globe,
  Upload,
  Check,
  ChevronDown,
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
  onGoBack?: () => void;
  canGoBack?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  isOpenSidebar,
  onToggleSidebar,
  onOpenUpload,
  searchQuery,
  setSearchQuery,
  onNavigateTab,
  onGoBack,
  canGoBack = false,
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

  // Determine if we should show the back button on mobile (secondary pages or when history exists)
  const showMobileBack = activeTab !== 'dashboard' || canGoBack;

  return (
    <header className="sticky top-0 z-30 flex h-16 sm:h-18 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0F17]/90 px-3.5 sm:px-6 backdrop-blur-md transition-colors duration-200">
      {/* Zone 1: Navigation Control (Desktop Drawer Toggle / Mobile Back Button) + Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Desktop Drawer Toggle (Always visible on desktop >= 768px) */}
        <button
          onClick={onToggleSidebar}
          className={`hidden md:flex items-center justify-center rounded-xl border p-2.5 transition-all duration-200 active:scale-95 ${
            isOpenSidebar
              ? 'shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
          }`}
          style={isOpenSidebar ? {
            borderColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 50%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
            color: 'var(--user-btn-primary, #6366F1)',
          } : undefined}
          title={isOpenSidebar ? 'Fechar menu (⋯)' : 'Menu (⋯)'}
          aria-label="Menu"
          aria-expanded={isOpenSidebar}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        {/* Mobile Navigation Button (< 768px): Back Arrow on secondary pages, or Drawer Toggle on Dashboard */}
        {showMobileBack ? (
          <button
            onClick={onGoBack}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-[var(--user-btn-primary,#6366F1)]/50 hover:text-[var(--user-btn-primary,#6366F1)] transition-all active:scale-90 shadow-sm"
            title={t.common.back}
            aria-label={t.common.back}
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.3]" />
          </button>
        ) : (
          <button
            onClick={onToggleSidebar}
            className={`md:hidden flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-90 ${
              isOpenSidebar
                ? ''
                : 'border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300'
            }`}
            style={isOpenSidebar ? {
              borderColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 50%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
              color: 'var(--user-btn-primary, #6366F1)',
            } : undefined}
            title="Menu"
            aria-label="Menu"
            aria-expanded={isOpenSidebar}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}

        <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
          {currentTabInfo.title}
        </h1>
      </div>

      {/* Zone 2: Actions (Language Selector + Settings + Upload CTA) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Language Selector Dropdown with Globe 🌐 (Icon only on mobile, with label on desktop) */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setIsLangMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-xl border p-2 sm:p-2.5 text-xs font-medium transition active:scale-95 ${
              isLangMenuOpen
                ? 'shadow-sm'
                : 'border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
            }`}
            style={isLangMenuOpen ? {
              borderColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 50%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
              color: 'var(--user-btn-primary, #6366F1)',
            } : undefined}
            title={t.header.selectLanguage}
            aria-label={t.header.selectLanguage}
            aria-expanded={isLangMenuOpen}
          >
            <Globe className="h-4 w-4 text-[var(--user-btn-primary,#6366F1)]" />
            <span className="hidden sm:inline font-semibold text-[11px] tracking-wider uppercase text-slate-800 dark:text-white">
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </span>
            <ChevronDown className="hidden sm:inline h-3 w-3 text-slate-400 dark:text-slate-500" />
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
                    ? 'font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
                style={language === 'pt-BR' ? {
                  backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
                  color: 'var(--user-btn-primary, #6366F1)',
                } : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇧🇷</span>
                  <span>{t.header.portuguese}</span>
                </span>
                {language === 'pt-BR' && <Check className="h-3.5 w-3.5 text-[var(--user-btn-primary,#6366F1)]" />}
              </button>

              <button
                onClick={() => handleSelectLanguage('en-US')}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                  language === 'en-US'
                    ? 'font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
                style={language === 'en-US' ? {
                  backgroundColor: 'color-mix(in srgb, var(--user-btn-primary, #6366F1) 12%, transparent)',
                  color: 'var(--user-btn-primary, #6366F1)',
                } : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">🇺🇸</span>
                  <span>{t.header.english}</span>
                </span>
                {language === 'en-US' && <Check className="h-3.5 w-3.5 text-[var(--user-btn-primary,#6366F1)]" />}
              </button>
            </div>
          )}
        </div>

        {/* Upload CTA (Compact icon on mobile, full label on desktop) */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 rounded-xl p-2 sm:px-3.5 sm:py-2 text-xs font-semibold text-white shadow-md transition active:scale-[0.96] whitespace-nowrap cursor-pointer hover:opacity-95"
          style={{
            backgroundColor: 'var(--user-btn-primary, #6366F1)',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--user-btn-primary, #6366F1) 25%, transparent)',
          }}
          title={t.header.uploadVideo}
          aria-label={t.header.uploadVideo}
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">{t.header.uploadVideo}</span>
        </button>
      </div>
    </header>
  );
};
