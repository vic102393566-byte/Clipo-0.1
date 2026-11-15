import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Bell,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
  ShieldAlert,
  Loader2,
  KeyRound,
  Globe,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  RotateCcw,
  Sparkles,
  BellRing,
  Send,
} from 'lucide-react';
import {
  UserProfileSettings,
  UserCustomColors,
  DEFAULT_CLIPO_COLORS,
  getDefaultCustomColors,
  sanitizeCustomColors,
  normalizeHexColor,
  isValidHexColor,
  getStoredUserProfile,
  saveStoredUserProfile,
  saveCustomPassword,
  verifyUserPassword,
  resetUserAccountData,
  PRESET_THEMES,
  PresetThemeId,
  PresetTheme,
} from '../../services/userSettingsService';
import { useI18n } from '../../i18n/I18nContext';
import { useTheme } from '../../theme/ThemeContext';
import { Language } from '../../i18n/types';
import {
  getPushStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  syncPushPreferences,
  sendTestPushNotification,
  showBrowserNotificationFallback,
  PushStatusInfo,
} from '../../services/pushNotificationService';

interface SettingsViewProps {
  userId?: string;
  onLogout?: () => void;
  onProfileUpdated?: (profile: UserProfileSettings) => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userId = 'default_user',
  onLogout,
  onProfileUpdated,
  onBack,
}) => {
  const { t, language, setLanguage } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isEn = language === 'en-US';

  // Load persisted user profile
  const [profile, setProfile] = useState<UserProfileSettings>(() => getStoredUserProfile());

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Status feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Preset Theme State
  const [selectedThemeId, setSelectedThemeId] = useState<PresetThemeId>(() => {
    return profile.selectedTheme || 'clipo-original';
  });
  const [customColors, setCustomColors] = useState<UserCustomColors>(() => {
    const tId = profile.selectedTheme || 'clipo-original';
    return PRESET_THEMES[tId]?.colors || getDefaultCustomColors();
  });
  const [appearanceMsg, setAppearanceMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  // Switch chosen preset theme
  const handleSelectPresetTheme = (themeId: PresetThemeId) => {
    setSelectedThemeId(themeId);
    const themeData = PRESET_THEMES[themeId];
    setCustomColors(themeData.colors);
  };

  // Save selected preset theme to profile and notify parent app
  const handleSaveAppearance = () => {
    setIsSavingAppearance(true);
    setAppearanceMsg(null);
    try {
      const themeData = PRESET_THEMES[selectedThemeId];
      const sanitized = sanitizeCustomColors(themeData.colors);
      const updatedProfile: UserProfileSettings = {
        ...profile,
        selectedTheme: selectedThemeId,
        customColors: sanitized,
      };

      setProfile(updatedProfile);
      saveStoredUserProfile(updatedProfile);
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }

      // Sincroniza com ThemeContext
      if (themeData.isLight) {
        setTheme('light');
      } else {
        setTheme('dark');
      }

      setAppearanceMsg({
        type: 'success',
        text: isEn ? `Theme "${themeData.name}" applied and saved successfully!` : `Tema "${themeData.name}" aplicado e guardado com sucesso!`,
      });
      setTimeout(() => setAppearanceMsg(null), 3500);
    } catch {
      setAppearanceMsg({
        type: 'info',
        text: isEn ? 'Failed to save theme settings.' : 'Erro ao guardar configurações do tema.',
      });
    } finally {
      setIsSavingAppearance(false);
    }
  };

  // Reset theme back to Clipo official default theme (Clipo Original)
  const handleResetAppearance = () => {
    const original = PRESET_THEMES['clipo-original'];
    setSelectedThemeId('clipo-original');
    setCustomColors(original.colors);
    setAppearanceMsg(null);

    const updatedProfile: UserProfileSettings = {
      ...profile,
      selectedTheme: 'clipo-original',
      customColors: original.colors,
    };

    setProfile(updatedProfile);
    saveStoredUserProfile(updatedProfile);
    if (onProfileUpdated) {
      onProfileUpdated(updatedProfile);
    }

    setTheme('dark');

    setAppearanceMsg({
      type: 'info',
      text: isEn ? 'Theme reset to Clipo Original.' : 'Tema restaurado para Clipo Original.',
    });
    setTimeout(() => setAppearanceMsg(null), 3500);
  };

  // Modals for sensitive actions
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Hidden avatar file input
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar image selection & conversion to Base64
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage(isEn ? 'Please select a valid image file (PNG, JPG, WebP).' : 'Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(isEn ? 'Image size cannot exceed 5MB.' : 'A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        setProfile((prev) => ({ ...prev, avatarUrl: base64Url }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Web Push Notification State
  const [pushStatus, setPushStatus] = useState<PushStatusInfo>({
    supported: true,
    permission: 'default',
    subscribed: false,
    backendSubscriptionCount: 0,
    notifyOnSuccess: true,
    notifyOnFailure: true,
  });
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushStatus(userId).then((status) => {
      if (!cancelled) {
        setPushStatus(status);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleEnablePush = async () => {
    setIsUpdatingPush(true);
    setPushFeedback(null);
    const res = await subscribeToPushNotifications(userId, {
      notifyOnSuccess: profile.notifications.publishSuccess,
      notifyOnFailure: profile.notifications.publishFailure,
    });
    const updatedStatus = await getPushStatus(userId);
    setPushStatus(updatedStatus);
    setIsUpdatingPush(false);

    if (res.success) {
      setPushFeedback({
        type: 'success',
        text: isEn
          ? 'Browser Push notifications enabled! You will be alerted whenever a scheduled post succeeds.'
          : 'Notificações Push ativadas! Você receberá alertas sempre que um agendamento for publicado com sucesso.',
      });
    } else {
      setPushFeedback({
        type: 'error',
        text: res.error || (isEn ? 'Could not activate Push notifications.' : 'Não foi possível ativar as notificações Push.'),
      });
    }
  };

  const handleDisablePush = async () => {
    setIsUpdatingPush(true);
    setPushFeedback(null);
    await unsubscribeFromPushNotifications(userId);
    const updatedStatus = await getPushStatus(userId);
    setPushStatus(updatedStatus);
    setIsUpdatingPush(false);
    setPushFeedback({
      type: 'success',
      text: isEn ? 'Push notifications disabled for this browser.' : 'Notificações Push desativadas neste navegador.',
    });
  };

  const handleTestPush = async () => {
    setIsSendingTestPush(true);
    setPushFeedback(null);
    const res = await sendTestPushNotification(userId);
    if (pushStatus.permission === 'granted' && (res.deliveredCount ?? 0) === 0) {
      showBrowserNotificationFallback(
        'Clipo — Notificação Push Ativa',
        isEn
          ? 'You will receive alerts whenever a scheduled post succeeds.'
          : 'Você receberá alertas automáticos assim que um agendamento for publicado.'
      );
    }
    setIsSendingTestPush(false);
    setPushFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message || res.error || (isEn ? 'Test notification dispatched.' : 'Notificação de teste enviada.'),
    });
  };

  // Toggle notification item and sync to server Push preferences
  const handleToggleNotification = (key: keyof UserProfileSettings['notifications']) => {
    setProfile((prev) => {
      const nextNotifications = {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      };
      const updated = {
        ...prev,
        notifications: nextNotifications,
      };
      saveStoredUserProfile(updated, userId);
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      if (key === 'publishSuccess' || key === 'publishFailure') {
        syncPushPreferences(userId, {
          notifyOnSuccess: nextNotifications.publishSuccess,
          notifyOnFailure: nextNotifications.publishFailure,
        });
      }
      return updated;
    });
  };

  // Save all profile and security changes
  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    if (!profile.name.trim()) {
      setErrorMessage(isEn ? 'Full name cannot be empty.' : 'O nome do usuário não pode ficar vazio.');
      return;
    }

    if (!profile.email.trim()) {
      setErrorMessage(isEn ? 'Email cannot be empty.' : 'O e-mail de acesso não pode ficar vazio.');
      return;
    }

    setIsSaving(true);

    try {
      if (newPassword.trim() || confirmPassword.trim() || currentPassword.trim()) {
        if (!verifyUserPassword(currentPassword)) {
          setIsSaving(false);
          setErrorMessage(isEn ? 'Current password does not match.' : 'A senha atual informada está incorreta.');
          return;
        }

        if (newPassword.length < 6) {
          setIsSaving(false);
          setErrorMessage(isEn ? 'New password must have at least 6 characters.' : 'A nova senha deve possuir pelo menos 6 dígitos.');
          return;
        }

        if (newPassword !== confirmPassword) {
          setIsSaving(false);
          setErrorMessage(isEn ? 'New password and confirmation do not match.' : 'A nova senha e a confirmação não conferem.');
          return;
        }

        saveCustomPassword(newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      saveStoredUserProfile(profile);
      if (onProfileUpdated) {
        onProfileUpdated(profile);
      }

      setIsSaving(false);
      setSaveSuccessMsg(t.settings.profile.savedSuccess);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch {
      setIsSaving(false);
      setErrorMessage(isEn ? 'Failed to save settings. Please try again.' : 'Erro ao salvar configurações. Tente novamente.');
    }
  };

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleConfirmDeleteAccount = () => {
    const requiredWord = isEn ? 'DELETE' : 'EXCLUIR';
    if (deleteConfirmationText.trim().toUpperCase() !== requiredWord && deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR') {
      return;
    }

    resetUserAccountData();
    setIsDeleteModalOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Back Navigation Button */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDBA74] hover:text-white transition py-1.5 px-3 -ml-1 rounded-xl hover:bg-[#151515] border border-transparent hover:border-[#27272A] cursor-pointer group"
            title={t.common.back}
          >
            <span className="text-base font-bold leading-none transition-transform group-hover:-translate-x-0.5">←</span>
            <span>{t.common.back}</span>
          </button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{t.settings.title}</h2>
          <p className="text-xs text-[#FDBA74] mt-0.5">{t.settings.subtitle}</p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.common.saving}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>{t.common.save}</span>
            </>
          )}
        </button>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 font-semibold cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="flex items-start justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 font-semibold ml-2 cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      )}

      {/* 1. Interface Language Selector Card */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#F97316]" />
            <span>{t.settings.preferences.language}</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            {t.settings.preferences.languageDesc}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setLanguage('pt-BR')}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer ${
              language === 'pt-BR'
                ? 'border-[#F97316] bg-[#F97316]/15 text-white font-semibold shadow-sm'
                : 'border-[#27272A] bg-[#0A0A0A] text-slate-300 hover:border-[#3F3F46]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇧🇷</span>
              <div className="text-left">
                <p className="font-semibold text-white">Português (Brasil)</p>
                <p className="text-[11px] text-[#FDBA74]">Idioma padrão da plataforma</p>
              </div>
            </div>
            {language === 'pt-BR' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316] text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setLanguage('en-US')}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer ${
              language === 'en-US'
                ? 'border-[#F97316] bg-[#F97316]/15 text-white font-semibold shadow-sm'
                : 'border-[#27272A] bg-[#0A0A0A] text-slate-300 hover:border-[#3F3F46]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🇺🇸</span>
              <div className="text-left">
                <p className="font-semibold text-white">English (US)</p>
                <p className="text-[11px] text-[#FDBA74]">Standard SaaS & content terminology</p>
              </div>
            </div>
            {language === 'en-US' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316] text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Interface Appearance / Theme Selector Card (Claro, Escuro, Sistema) */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Moon className="h-4 w-4 text-[#F97316]" />
            <span>{t.header.theme}</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            {isEn
              ? 'Choose between dark mode, light mode, or automatic system appearance.'
              : 'Escolha entre os modos escuro, claro ou acompanhamento automático do sistema.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Option 1: Escuro / Dark */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer active:scale-[0.98] ${
              theme === 'dark'
                ? 'border-[var(--user-btn-primary,#4F46E5)] bg-[var(--user-btn-primary,#4F46E5)]/10 text-slate-900 dark:text-white font-semibold shadow-sm'
                : 'border-[#27272A] bg-[#0A0A0A] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#3F3F46]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#18181B] text-[var(--user-btn-primary,#4F46E5)]">
                <Moon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white">{t.header.themeDark}</p>
                <p className="text-[11px] text-slate-500 dark:text-[#FDBA74]">
                  {isEn ? 'High-contrast dark palette' : 'Visual escuro clássico'}
                </p>
              </div>
            </div>
            {theme === 'dark' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--user-btn-primary,#4F46E5)] text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Option 2: Claro / Light */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer active:scale-[0.98] ${
              theme === 'light'
                ? 'border-[var(--user-btn-primary,#4F46E5)] bg-[var(--user-btn-primary,#4F46E5)]/10 text-slate-900 dark:text-white font-semibold shadow-sm'
                : 'border-[#27272A] bg-[#0A0A0A] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#3F3F46]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-[#18181B] text-amber-500">
                <Sun className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white">{t.header.themeLight}</p>
                <p className="text-[11px] text-slate-500 dark:text-[#FDBA74]">
                  {isEn ? 'Clean light canvas & cards' : 'Interface com fundo claro'}
                </p>
              </div>
            </div>
            {theme === 'light' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--user-btn-primary,#4F46E5)] text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Option 3: Sistema / System */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition cursor-pointer active:scale-[0.98] ${
              theme === 'system'
                ? 'border-[var(--user-btn-primary,#4F46E5)] bg-[var(--user-btn-primary,#4F46E5)]/10 text-slate-900 dark:text-white font-semibold shadow-sm'
                : 'border-[#27272A] bg-[#0A0A0A] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-[#3F3F46]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#18181B] text-[var(--user-btn-primary,#4F46E5)]">
                <Monitor className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {isEn ? 'System' : 'Sistema'}
                  {theme === 'system' && (
                    <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      ({resolvedTheme === 'dark' ? (isEn ? 'Dark' : 'Escuro') : (isEn ? 'Light' : 'Claro')})
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#FDBA74]">
                  {isEn ? 'Syncs with your device theme' : 'Sincroniza com o seu dispositivo'}
                </p>
              </div>
            </div>
            {theme === 'system' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--user-btn-primary,#4F46E5)] text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Personalizar Aparência Card */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-6">
        <div className="border-b border-[#27272A] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#F97316]" />
                <span>{isEn ? 'Customize Appearance' : 'Personalizar aparência'}</span>
              </h3>
              <p className="text-xs text-[#FDBA74] mt-1">
                {isEn
                  ? 'Define your individual interface colors. Changes preview in real-time below and only apply when saved.'
                  : 'Personalize as cores da sua própria interface. As alterações são pré-visualizadas abaixo em tempo real e só afetam o sistema após guardar.'}
              </p>
            </div>

            {profile.customColors && (
              <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span>{isEn ? 'Custom Colors Active' : 'Cores personalizadas ativas'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback message for appearance actions */}
        {appearanceMsg && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs transition animate-in fade-in ${
              appearanceMsg.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{appearanceMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setAppearanceMsg(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer ml-2"
            >
              {t.common.close}
            </button>
          </div>
        )}

        {/* 5 Preset Themes Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {isEn ? 'Select a Preset Theme' : 'Selecione um Tema Pré-definido'}
            </h4>
            <span className="text-[11px] text-[#FDBA74]">
              {isEn ? '5 Curated color styles' : '5 Estilos visuais balanceados'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(Object.values(PRESET_THEMES) as PresetTheme[]).map((thm) => {
              const isSelected = selectedThemeId === thm.id;
              const isCurrentlyActiveInProfile = (profile.selectedTheme || 'clipo-original') === thm.id;

              return (
                <button
                  type="button"
                  key={thm.id}
                  onClick={() => handleSelectPresetTheme(thm.id)}
                  className={`group relative text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? 'border-[#F97316] bg-[#F97316]/10 shadow-lg shadow-[#F97316]/10 ring-1 ring-[#F97316]'
                      : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#3F3F46] hover:bg-[#121212]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white group-hover:text-[#F97316] transition-colors">
                          {thm.name}
                        </span>
                        {isCurrentlyActiveInProfile && (
                          <span className="text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {isEn ? 'Current' : 'Atual'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-[#FDBA74] mt-0.5">
                        {thm.subtitle}
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                        isSelected
                          ? 'border-[#F97316] bg-[#F97316] text-white'
                          : 'border-[#3F3F46] bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {thm.description}
                  </p>

                  {/* Visual Palette Preview Swatches */}
                  <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {isEn ? 'Palette' : 'Paleta'}
                    </span>
                    <div className="flex items-center -space-x-1.5">
                      <span
                        className="inline-block h-5 w-5 rounded-full border-2 border-[#151515] shadow-sm"
                        style={{ backgroundColor: thm.colors.bgMain }}
                        title={`Fundo: ${thm.colors.bgMain}`}
                      />
                      <span
                        className="inline-block h-5 w-5 rounded-full border-2 border-[#151515] shadow-sm"
                        style={{ backgroundColor: thm.colors.bgCard }}
                        title={`Cartão: ${thm.colors.bgCard}`}
                      />
                      <span
                        className="inline-block h-5 w-5 rounded-full border-2 border-[#151515] shadow-sm"
                        style={{ backgroundColor: thm.colors.btnPrimary }}
                        title={`Botão: ${thm.colors.btnPrimary}`}
                      />
                      <span
                        className="inline-block h-5 w-5 rounded-full border-2 border-[#151515] shadow-sm"
                        style={{ backgroundColor: thm.colors.accent }}
                        title={`Destaque: ${thm.colors.accent}`}
                      />
                      <span
                        className="inline-block h-5 w-5 rounded-full border-2 border-[#151515] shadow-sm"
                        style={{ backgroundColor: thm.colors.cardBorder }}
                        title={`Borda: ${thm.colors.cardBorder}`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Isolated Live Preview */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>{isEn ? 'Live Preview (Isolated)' : 'Pré-visualização em tempo real (Isolada)'}</span>
            </h4>
            <span className="text-[11px] text-[#FDBA74]">
              {isEn ? 'Isolated to container • Not yet applied globally' : 'Isolado ao contentor • Não aplicado globalmente'}
            </span>
          </div>

          <div
            className="rounded-xl p-4 sm:p-6 border transition-all duration-200 overflow-hidden shadow-inner"
            style={{
              backgroundColor: isValidHexColor(customColors.bgMain)
                ? normalizeHexColor(customColors.bgMain)!
                : DEFAULT_CLIPO_COLORS.bgMain,
              borderColor: '#27272A',
            }}
          >
            {/* Inner Card Demonstration */}
            <div
              className="rounded-xl p-4 sm:p-5 border-2 transition-all duration-200 space-y-4 max-w-md mx-auto shadow-lg"
              style={{
                backgroundColor: isValidHexColor(customColors.bgCard)
                  ? normalizeHexColor(customColors.bgCard)!
                  : DEFAULT_CLIPO_COLORS.bgCard,
                borderColor: isValidHexColor(customColors.cardBorder)
                  ? normalizeHexColor(customColors.cardBorder)!
                  : DEFAULT_CLIPO_COLORS.cardBorder,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: isValidHexColor(customColors.accent)
                          ? normalizeHexColor(customColors.accent)!
                          : DEFAULT_CLIPO_COLORS.accent,
                      }}
                    />
                    <p
                      className="text-xs font-medium opacity-80"
                      style={{
                        color: isValidHexColor(customColors.textPrimary)
                          ? normalizeHexColor(customColors.textPrimary)!
                          : DEFAULT_CLIPO_COLORS.textPrimary,
                      }}
                    >
                      {isEn ? 'Card & Metrics' : 'Cartão de Métricas'}
                    </p>
                  </div>
                  <h4
                    className="text-lg font-bold mt-1"
                    style={{
                      color: isValidHexColor(customColors.textPrimary)
                        ? normalizeHexColor(customColors.textPrimary)!
                        : DEFAULT_CLIPO_COLORS.textPrimary,
                    }}
                  >
                    {isEn ? '12.4 GB / 50 GB Used' : '12,4 GB / 50 GB Utilizados'}
                  </h4>
                </div>

                {/* Accent Tag / Badge */}
                <span
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0"
                  style={{
                    backgroundColor: `${isValidHexColor(customColors.accent) ? normalizeHexColor(customColors.accent)! : DEFAULT_CLIPO_COLORS.accent}25`,
                    color: isValidHexColor(customColors.accent)
                      ? normalizeHexColor(customColors.accent)!
                      : DEFAULT_CLIPO_COLORS.accent,
                    borderColor: `${isValidHexColor(customColors.accent) ? normalizeHexColor(customColors.accent)! : DEFAULT_CLIPO_COLORS.accent}50`,
                  }}
                >
                  {isEn ? 'Accent Highlight' : 'Elemento de Destaque'}
                </span>
              </div>

              {/* Progress bar demonstration with accent */}
              <div className="w-full h-2 rounded-full overflow-hidden bg-black/40">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: '45%',
                    backgroundColor: isValidHexColor(customColors.accent)
                      ? normalizeHexColor(customColors.accent)!
                      : DEFAULT_CLIPO_COLORS.accent,
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <span
                  className="text-xs opacity-75 font-medium"
                  style={{
                    color: isValidHexColor(customColors.textPrimary)
                      ? normalizeHexColor(customColors.textPrimary)!
                      : DEFAULT_CLIPO_COLORS.textPrimary,
                  }}
                >
                  {isEn ? 'Typography high contrast sample' : 'Amostra de leitura e tipografia'}
                </span>

                {/* Primary Action Button */}
                <button
                  type="button"
                  tabIndex={-1}
                  className="px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition shrink-0 cursor-default"
                  style={{
                    backgroundColor: isValidHexColor(customColors.btnPrimary)
                      ? normalizeHexColor(customColors.btnPrimary)!
                      : DEFAULT_CLIPO_COLORS.btnPrimary,
                    color: '#FFFFFF',
                  }}
                >
                  {isEn ? 'Primary Button' : 'Botão Principal'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Action Buttons (Guardar tema / Restaurar Clipo Original) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#27272A]">
          <button
            type="button"
            onClick={handleResetAppearance}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-[#3F3F46] transition active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isEn ? 'Reset to Clipo Original' : 'Restaurar Clipo Original'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAppearance}
            disabled={isSavingAppearance}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isSavingAppearance ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.common.saving}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isEn ? 'Save Theme' : 'Guardar tema'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Profile Information & Avatar */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-6">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <User className="h-4 w-4 text-[#F97316]" />
            <span>{t.settings.tabs.profile}</span>
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with edit overlay */}
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-[#F97316]/30 transition group-hover:opacity-80"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 text-white">
              <Camera className="h-6 w-6 text-[#F97316]" />
              <span className="text-[10px] font-semibold mt-1">{t.common.edit}</span>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition cursor-pointer"
            >
              {isEn ? 'Change avatar photo' : 'Trocar foto de perfil'}
            </button>
            <p className="text-[11px] text-[#FDBA74] mt-1">
              {t.settings.profile.avatarHelp}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* User name */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              {t.settings.profile.name}
            </label>
            <div className="relative mt-1.5">
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Ex: Vicente Silva"
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              {t.settings.profile.email}
            </label>
            <div className="relative mt-1.5">
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Password Change */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#F97316]" />
              <span>{isEn ? 'Change Password' : 'Alteração de Senha'}</span>
            </h3>
            <p className="text-xs text-[#FDBA74] mt-1">
              {isEn ? 'Update your password to keep your account safe' : 'Atualize sua senha de acesso para manter sua conta protegida'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1.5 text-xs text-[#FDBA74] hover:text-white transition cursor-pointer"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showPasswords ? (isEn ? 'Hide' : 'Ocultar') : (isEn ? 'Show' : 'Visualizar')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              {isEn ? 'Current password' : 'Senha atual'}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              {isEn ? 'New password' : 'Nova senha'}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={isEn ? 'Min. 6 characters' : 'Mínimo 6 dígitos'}
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              {isEn ? 'Confirm new password' : 'Confirmar nova senha'}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={isEn ? 'Repeat new password' : 'Repita a nova senha'}
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* 4. Notification Preferences & Web Push Controls */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#27272A] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--user-btn-primary,#6366F1)]" />
              <span>{isEn ? 'Push Notifications & Alerts' : 'Notificações Push e Alertas'}</span>
            </h3>
            <p className="text-xs text-[#FDBA74] mt-1">
              {isEn
                ? 'Receive instant browser Push notifications when scheduled posts succeed across social APIs'
                : 'Receba notificações Push no navegador assim que um agendamento for publicado nas redes sociais'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {pushStatus.subscribed && pushStatus.permission === 'granted' ? (
              <button
                type="button"
                onClick={handleDisablePush}
                disabled={isUpdatingPush}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              >
                {isUpdatingPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 text-emerald-400" />}
                <span>{isEn ? 'Disable Browser Push' : 'Desativar Push'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isUpdatingPush || !pushStatus.supported}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition active:scale-[0.98] cursor-pointer disabled:opacity-50 keep-white"
                style={{ backgroundColor: 'var(--user-btn-primary, #6366F1)' }}
              >
                {isUpdatingPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                <span>{isEn ? 'Enable Push Notifications' : 'Ativar Notificações Push'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTestPush}
              disabled={isSendingTestPush}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-white hover:border-[var(--user-btn-primary,#6366F1)]/50 transition cursor-pointer disabled:opacity-50"
            >
              {isSendingTestPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>{isEn ? 'Send Test Push' : 'Testar Notificação'}</span>
            </button>
          </div>
        </div>

        {/* Browser Push Status Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              {isEn ? 'Browser Push status:' : 'Status do Push no navegador:'}
            </span>
            <span className="text-[#FDBA74]">
              {!pushStatus.supported
                ? (isEn ? 'Not supported in this browser' : 'Não suportado neste navegador')
                : pushStatus.permission === 'denied'
                ? (isEn ? 'Blocked by browser settings' : 'Bloqueado nas permissões do navegador')
                : pushStatus.subscribed && pushStatus.permission === 'granted'
                ? (isEn ? 'Active & subscribed via Service Worker' : 'Ativo e inscrito via Service Worker')
                : (isEn ? 'Ready to activate' : 'Pronto para ativar')}
            </span>
          </div>
          {pushStatus.backendSubscriptionCount > 0 && (
            <span className="font-mono text-[11px] tabular-nums text-emerald-400">
              {pushStatus.backendSubscriptionCount} {isEn ? 'active device(s)' : 'dispositivo(s) ativo(s)'}
            </span>
          )}
        </div>

        {pushFeedback && (
          <div
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
              pushFeedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            <span>{pushFeedback.text}</span>
            <button
              type="button"
              onClick={() => setPushFeedback(null)}
              className="text-xs font-semibold opacity-80 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="divide-y divide-[#27272A] text-xs">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">{isEn ? 'Publication successful' : 'Publicação realizada com sucesso'}</p>
              <p className="text-[#FDBA74] text-[11px]">
                {isEn
                  ? 'Send Push notification when a scheduled post is published to TikTok, YouTube, Instagram, or LinkedIn'
                  : 'Enviar notificação Push quando um agendamento for publicado no TikTok, YouTube, Instagram ou LinkedIn'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('publishSuccess')}
              aria-label={isEn ? 'Toggle publication success notification' : 'Alternar notificação de sucesso'}
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.publishSuccess ? 'bg-[var(--user-btn-primary,#6366F1)]' : 'bg-[#27272A]'
              }`}
              style={
                profile.notifications.publishSuccess
                  ? { backgroundColor: 'var(--user-btn-primary, #6366F1)' }
                  : undefined
              }
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  profile.notifications.publishSuccess ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">{isEn ? 'Publishing errors and failures' : 'Falhas e erros de publicação'}</p>
              <p className="text-[#FDBA74] text-[11px]">
                {isEn ? 'Immediate alert if a post fails due to expired tokens or network error' : 'Receber aviso imediato se algum agendamento falhar por token expirado ou erro de API'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('publishFailure')}
              aria-label={isEn ? 'Toggle publication failure notification' : 'Alternar notificação de falha'}
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.publishFailure ? 'bg-[var(--user-btn-primary,#6366F1)]' : 'bg-[#27272A]'
              }`}
              style={
                profile.notifications.publishFailure
                  ? { backgroundColor: 'var(--user-btn-primary, #6366F1)' }
                  : undefined
              }
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  profile.notifications.publishFailure ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">{isEn ? 'Storage quota warning' : 'Alerta de limite de armazenamento'}</p>
              <p className="text-[#FDBA74] text-[11px]">
                {isEn ? 'Notify when cloud storage exceeds 80% and 95% capacity' : 'Avisar quando o uso atingir 80% e 95% da cota contratada do plano'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('storageWarning')}
              aria-label={isEn ? 'Toggle storage warning notification' : 'Alternar alerta de armazenamento'}
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.storageWarning ? 'bg-[var(--user-btn-primary,#6366F1)]' : 'bg-[#27272A]'
              }`}
              style={
                profile.notifications.storageWarning
                  ? { backgroundColor: 'var(--user-btn-primary, #6366F1)' }
                  : undefined
              }
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  profile.notifications.storageWarning ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Sensitive Actions: Logout and Delete Account */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>{t.settings.tabs.danger}</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            {isEn ? 'Manage active session or permanently close account' : 'Opções para encerrar sua sessão atual ou deletar permanentemente seu perfil'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          {/* Sign Out */}
          <div className="w-full sm:w-auto">
            <p className="text-xs font-semibold text-white">{t.nav.logout}</p>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-[#FDBA74]" />
              <span>{t.nav.logout}</span>
            </button>
          </div>

          {/* Delete Account */}
          <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 border-[#27272A] pt-3 sm:pt-0">
            <p className="text-xs font-semibold text-rose-400">{t.settings.danger.deleteAccount}</p>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmationText('');
                setIsDeleteModalOpen(true);
              }}
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>{t.settings.danger.deleteAccount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Confirm Logout */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsLogoutModalOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#27272A] bg-[#151515] p-6 shadow-2xl z-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A0A0A] border border-[#27272A] text-white">
              <LogOut className="h-6 w-6 text-[#F97316]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              {isEn ? 'Sign out of your account?' : 'Deseja sair da sua conta?'}
            </h3>
            <p className="mt-2 text-xs text-[#FDBA74]">
              {isEn ? 'You will need to sign in again to access your content.' : 'Você precisará fazer login novamente para acessar seus vídeos e publicações agendadas.'}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-[#FDBA74] hover:text-white transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition shadow-lg shadow-[#F97316]/30 cursor-pointer"
              >
                {isEn ? 'Sign Out' : 'Confirmar saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Account Deletion */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm"
            onClick={() => setIsDeleteModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#151515] p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-rose-300">
                  {t.settings.danger.title}
                </h3>
                <p className="text-xs text-[#FDBA74]">{isEn ? 'Permanent action' : 'Ação irreversível'}</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-[#FDBA74] leading-relaxed">
              {t.settings.danger.desc}
            </p>

            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
              <label className="block text-xs font-medium text-white">
                {isEn
                  ? <>To confirm, type <span className="font-bold text-rose-400 font-mono">DELETE</span> below:</>
                  : <>Para confirmar, digite <span className="font-bold text-rose-400 font-mono">EXCLUIR</span> no campo abaixo:</>}
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={isEn ? 'DELETE' : 'EXCLUIR'}
                className="mt-2 w-full rounded-lg border border-rose-500/30 bg-[#0A0A0A] px-3 py-2 text-xs font-mono text-white placeholder-[#71717A] focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-[#FDBA74] hover:text-white transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={
                  deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR' &&
                  deleteConfirmationText.trim().toUpperCase() !== 'DELETE'
                }
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {t.settings.danger.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
