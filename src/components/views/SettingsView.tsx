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
  KeyRound
} from 'lucide-react';
import {
  UserProfileSettings,
  getStoredUserProfile,
  saveStoredUserProfile,
  saveCustomPassword,
  verifyUserPassword,
  resetUserAccountData
} from '../../services/userSettingsService';

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
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('A imagem deve ter no máximo 5MB.');
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

    // Validate name and email
    if (!profile.name.trim()) {
      setErrorMessage('O nome do usuário não pode ficar vazio.');
      return;
    }

    if (!profile.email.trim() || !profile.email.includes('@')) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    // Validate password fields if user attempted to change password
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setErrorMessage('Por favor, digite sua senha atual para autorizar a alteração.');
        return;
      }
      if (!verifyUserPassword(currentPassword)) {
        setErrorMessage('A senha atual digitada está incorreta. Verifique e tente novamente.');
        return;
      }
      if (newPassword.length < 6) {
        setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('A confirmação da nova senha não confere com a nova senha digitada.');
        return;
      }

      // Persist password
      saveCustomPassword(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    setIsSaving(true);

    setTimeout(() => {
      // Save profile to localStorage
      saveStoredUserProfile(profile);
      if (onProfileUpdated) {
        onProfileUpdated(profile);
      }

      setIsSaving(false);
      setSaveSuccessMsg('Alterações salvas e sincronizadas com sucesso!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }, 400);
  };

  // Confirm logout
  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  // Confirm account deletion
  const handleConfirmDeleteAccount = () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR') {
      setErrorMessage('Para confirmar a exclusão definitiva, digite EXCLUIR.');
      return;
    }

    resetUserAccountData();
    setIsDeleteModalOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
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

      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Configurações de Conta</h2>
          <p className="text-xs text-[#FDBA74]">
            Gerencie seu perfil de usuário, credenciais de acesso e preferências de alertas
          </p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Salvar alterações</span>
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
            className="text-emerald-400 hover:text-emerald-200 font-semibold"
          >
            Fechar
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
            className="text-rose-400 hover:text-rose-200 font-semibold ml-2"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Profile Information & Avatar */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-6">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <User className="h-4 w-4 text-[#F97316]" />
            <span>Dados Pessoais & Foto de Perfil</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            Essas informações identificam você no Clipo e nas comunicações automáticas
          </p>
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
              <span className="text-[10px] font-semibold mt-1">Alterar</span>
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
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition"
            >
              Trocar foto de perfil
            </button>
            <p className="text-[11px] text-[#FDBA74]">
              Formatos recomendados: JPG, PNG ou WebP. Máximo de 5 MB.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Nome do usuário */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              Nome do usuário
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

          {/* E-mail */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              E-mail da conta
            </label>
            <div className="relative mt-1.5">
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="seu.email@exemplo.com"
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Password Change */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#F97316]" />
              <span>Alteração de Senha</span>
            </h3>
            <p className="text-xs text-[#FDBA74] mt-1">
              Atualize sua senha de acesso para manter sua conta protegida
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1.5 text-xs text-[#FDBA74] hover:text-white transition"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showPasswords ? 'Ocultar' : 'Visualizar'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              Senha atual
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
              Nova senha
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 dígitos"
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              Confirmar nova senha
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* 3. Notification Preferences */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F97316]" />
            <span>Preferências de Notificações</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            Escolha os canais e eventos em que deseja receber avisos automáticos
          </p>
        </div>

        <div className="divide-y divide-[#27272A] text-xs">
          {/* Notification item 1 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">Publicação realizada com sucesso</p>
              <p className="text-[#FDBA74] text-[11px]">
                Notificar quando um vídeo agendado for disparado no TikTok ou redes conectadas
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('publishSuccess')}
              className={`h-5 w-9 rounded-full p-0.5 transition ${
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

          {/* Notification item 2 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">Falhas e erros de publicação</p>
              <p className="text-[#FDBA74] text-[11px]">
                Receber aviso imediato se algum agendamento falhar por token expirado ou erro de API
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('publishFailure')}
              className={`h-5 w-9 rounded-full p-0.5 transition ${
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

          {/* Notification item 3 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">Alerta de limite de armazenamento</p>
              <p className="text-[#FDBA74] text-[11px]">
                Avisar quando o uso atingir 80% e 95% da cota contratada do plano
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('storageWarning')}
              className={`h-5 w-9 rounded-full p-0.5 transition ${
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

          {/* Notification item 4 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-white">Relatório de métricas semanal</p>
              <p className="text-[#FDBA74] text-[11px]">
                Resumo dos cortes mais assistidos, engajamento e novos seguidores
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleNotification('weeklySummary')}
              className={`h-5 w-9 rounded-full p-0.5 transition ${
                profile.notifications.weeklySummary ? 'bg-[#F97316]' : 'bg-[#27272A]'
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  profile.notifications.weeklySummary ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Sensitive Actions: Sair da conta e Excluir conta */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-4">
        <div className="border-b border-[#27272A] pb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>Sessão e Gestão da Conta</span>
          </h3>
          <p className="text-xs text-[#FDBA74] mt-1">
            Opções para encerrar sua sessão atual ou deletar permanentemente seu perfil
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          {/* Botão Sair da Conta */}
          <div className="w-full sm:w-auto">
            <p className="text-xs font-semibold text-white">Sair da conta</p>
            <p className="text-[11px] text-[#FDBA74]">
              Desconecta a sessão atual com segurança no navegador
            </p>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#151515] transition active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4 text-[#FDBA74]" />
              <span>Sair da conta</span>
            </button>
          </div>

          {/* Opção Excluir Conta */}
          <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 border-[#27272A] pt-3 sm:pt-0">
            <p className="text-xs font-semibold text-rose-400">Excluir conta definitivamente</p>
            <p className="text-[11px] text-[#FDBA74]">
              Remove todos os vídeos, agendamentos e contas vinculadas
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmationText('');
                setIsDeleteModalOpen(true);
              }}
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition active:scale-[0.98]"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>Excluir conta</span>
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
            <h3 className="mt-4 text-base font-semibold text-white">Deseja sair da sua conta?</h3>
            <p className="mt-2 text-xs text-[#FDBA74]">
              Você precisará fazer login novamente para acessar seus vídeos e publicações agendadas.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-[#FDBA74] hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition shadow-lg shadow-[#F97316]/30"
              >
                Confirmar saída
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
                <h3 className="text-base font-semibold text-rose-300">Excluir conta permanentemente</h3>
                <p className="text-xs text-[#FDBA74]">Ação irreversível</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-[#FDBA74] leading-relaxed">
              Ao confirmar a exclusão, todos os seus vídeos salvos no Clipo, o histórico de publicações, as contas conectadas e suas preferências serão removidos para sempre.
            </p>

            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
              <label className="block text-xs font-medium text-white">
                Para confirmar, digite <span className="font-bold text-rose-400 font-mono">EXCLUIR</span> no campo abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="EXCLUIR"
                className="mt-2 w-full rounded-lg border border-rose-500/30 bg-[#0A0A0A] px-3 py-2 text-xs font-mono text-white placeholder-[#71717A] focus:border-rose-400 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-[#FDBA74] hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR'}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
