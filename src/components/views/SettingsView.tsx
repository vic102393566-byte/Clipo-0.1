import React, { useState, useRef } from 'react';
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
  Check
} from 'lucide-react';
import {
  UserProfileSettings,
  getStoredUserProfile,
  saveStoredUserProfile,
  saveCustomPassword,
  verifyUserPassword,
  resetUserAccountData
} from '../../services/userSettingsService';
import { useI18n } from '../../i18n/I18nContext';
import { Language } from '../../i18n/types';

interface SettingsViewProps {
  onLogout?: () => void;
  onProfileUpdated?: (profile: UserProfileSettings) => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onLogout,
  onProfileUpdated,
  onBack,
}) => {
  const { t, language, setLanguage } = useI18n();
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

  // Toggle notification item
  const handleToggleNotification = (key: keyof UserProfileSettings['notifications']) => {
    setProfile((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
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

      {/* 2. Profile Information & Avatar */}
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

      {/* 4. Notification Preferences */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F97316]" />
            <span>{isEn ? 'Notification Alerts' : 'Preferências de Notificações'}</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            {isEn ? 'Select events for automated system alerts' : 'Escolha os canais e eventos em que deseja receber avisos automáticos'}
          </p>
        </div>

        <div className="divide-y divide-[#27272A] text-xs">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">{isEn ? 'Publication successful' : 'Publicação realizada com sucesso'}</p>
              <p className="text-[#FDBA74] text-[11px]">
                {isEn ? 'Notify when a scheduled video is published to TikTok or other platforms' : 'Notificar quando um vídeo agendado for disparado no TikTok ou redes conectadas'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('publishSuccess')}
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.publishSuccess ? 'bg-[#F97316]' : 'bg-[#27272A]'
              }`}
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
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.publishFailure ? 'bg-[#F97316]' : 'bg-[#27272A]'
              }`}
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
              className={`h-5 w-9 rounded-full p-0.5 transition cursor-pointer ${
                profile.notifications.storageWarning ? 'bg-[#F97316]' : 'bg-[#27272A]'
              }`}
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
