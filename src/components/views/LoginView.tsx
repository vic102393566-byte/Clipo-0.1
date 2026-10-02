import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  User as UserIcon,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Globe,
  Check
} from 'lucide-react';
import { authService, DEFAULT_DEMO_USER } from '../../services/authService';
import { User } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { Language } from '../../i18n/types';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
  onNavigate?: (path: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  initialMode = 'login',
  onNavigate,
}) => {
  const { t, language, setLanguage } = useI18n();
  const isEn = language === 'en-US';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Switch between Login and Register
  const handleSwitchMode = (targetMode: 'login' | 'register') => {
    setMode(targetMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginEmail.trim()) {
      setErrorMessage(isEn ? 'Please enter your email address.' : 'Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (!loginPassword.trim()) {
      setErrorMessage(isEn ? 'Please enter your password.' : 'Por favor, informe sua senha de acesso.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(loginEmail, loginPassword);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || (isEn ? 'Invalid credentials. Please check your email and password.' : 'Credenciais inválidas. Verifique seu e-mail e senha.'));
      }
    } catch {
      setIsLoading(false);
      setErrorMessage(isEn ? 'An error occurred during authentication. Please try again.' : 'Ocorreu um erro ao processar a autenticação. Tente novamente.');
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = registerName.trim();
    const nameParts = cleanName.split(/\s+/).filter(Boolean);

    if (nameParts.length < 2 || nameParts.some((part) => part.length < 2)) {
      setErrorMessage('Digite seu nome completo (nome e sobrenome).');
      return;
    }

    if (!registerEmail.trim()) {
      setErrorMessage(isEn ? 'Please enter your email address.' : 'Por favor, informe seu e-mail.');
      return;
    }

    if (!registerPassword.trim() || registerPassword.length < 6) {
      setErrorMessage(isEn ? 'Password must be at least 6 characters long.' : 'A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage(isEn ? 'The passwords entered do not match.' : 'As senhas digitadas não conferem.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.register(cleanName, registerEmail, registerPassword);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || (isEn ? 'Could not create account with provided information.' : 'Não foi possível criar a conta com as informações fornecidas.'));
      }
    } catch {
      setIsLoading(false);
      setErrorMessage(isEn ? 'An unexpected error occurred while creating your account.' : 'Ocorreu um erro inesperado ao criar a conta. Tente novamente.');
    }
  };

  // 1-Click quick fill for demo account
  const handleQuickFillDemo = () => {
    setLoginEmail(DEFAULT_DEMO_USER.email);
    setLoginPassword('123456');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center p-4 sm:p-6 text-white selection:bg-[#F97316]/30 selection:text-white relative">
      {/* Top right language selector */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#151515] px-3 py-1.5 text-xs text-[#FDBA74] hover:border-[#F97316] hover:text-white transition cursor-pointer"
            title={t.header.selectLanguage}
          >
            <Globe className="h-3.5 w-3.5 text-[#F97316]" />
            <span className="font-semibold text-[11px] tracking-wider uppercase">
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </span>
          </button>

          {isLangMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[#27272A] bg-[#151515] p-1.5 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setLanguage('pt-BR');
                  setIsLangMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  language === 'pt-BR'
                    ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                    : 'text-slate-300 hover:bg-[#202020] hover:text-white'
                }`}
              >
                <span>🇧🇷 Português</span>
                {language === 'pt-BR' && <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('en-US');
                  setIsLangMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  language === 'en-US'
                    ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                    : 'text-slate-300 hover:bg-[#202020] hover:text-white'
                }`}
              >
                <span>🇺🇸 English</span>
                {language === 'en-US' && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Background subtle radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[#F97316]/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-[#EA580C]/10 rounded-full blur-[110px]" />
      </div>

      <div className="relative w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] shadow-xl shadow-[#F97316]/25">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path
                  d="M4 8C4 5.79086 5.79086 4 8 4H16C18.2091 4 20 5.79086 20 8V16C20 18.2091 18.2091 20 16 20H8C5.79086 20 4 18.2091 4 16V8Z"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M10 9L15 12L10 15V9Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-white">clipo</span>
                <span className="h-2 w-2 rounded-full bg-[#F97316]"></span>
              </div>
              <span className="text-[11px] font-medium text-[#FDBA74]">Video Automation Studio</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white pt-3">
            {mode === 'login' ? t.login.loginTitle : t.login.registerTitle}
          </h1>
          <p className="text-xs text-[#FDBA74]">
            {mode === 'login' ? t.login.loginSubtitle : t.login.registerSubtitle}
          </p>
        </div>

        {/* Auth Container Card */}
        <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode Tabs Switcher */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#0A0A0A] p-1 border border-[#27272A]">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#1E1E1E] text-white shadow-sm border border-[#27272A]'
                  : 'text-[#FDBA74] hover:text-white'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{isEn ? 'Sign In' : 'Entrar'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#1E1E1E] text-white shadow-sm border border-[#27272A]'
                  : 'text-[#FDBA74] hover:text-white'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{isEn ? 'Register' : 'Cadastrar'}</span>
            </button>
          </div>

          {/* Feedback message: Error */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Feedback message: Success */}
          {successMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* FORM: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* E-mail field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.emailLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={t.login.emailPlaceholder}
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.passwordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-10 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition cursor-pointer"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] py-3 px-4 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/25 transition hover:bg-[#EA580C] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t.login.loggingIn}</span>
                    </span>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>{t.login.loginBtn}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick switch to register */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#FDBA74]">
                  {t.login.noAccount}{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="font-semibold text-[#F97316] hover:text-[#EA580C] transition cursor-pointer"
                  >
                    {t.login.createAccountLink}
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* FORM: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Name field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.nameLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder={t.login.namePlaceholder}
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Email field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.emailLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder={t.login.emailPlaceholder}
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.passwordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-10 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition cursor-pointer"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  {t.login.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#FDBA74]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showRegisterConfirm ? 'text' : 'password'}
                    required
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] pl-10 pr-10 py-2.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirm(!showRegisterConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition cursor-pointer"
                    aria-label={showRegisterConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] py-3 px-4 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/25 transition hover:bg-[#EA580C] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t.login.registering}</span>
                    </span>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>{t.login.registerBtn}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick switch to login */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#FDBA74]">
                  {t.login.hasAccount}{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="font-semibold text-[#F97316] hover:text-[#EA580C] transition cursor-pointer"
                  >
                    {t.login.loginLink}
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Quick Access Helper for demo account (only in Login mode) */}
          {mode === 'login' && (
            <div className="mt-6 pt-5 border-t border-[#27272A]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#FDBA74] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#F97316]" />
                  {t.login.demoAccess}
                </span>
                <button
                  type="button"
                  onClick={handleQuickFillDemo}
                  className="text-[11px] font-medium text-[#F97316] hover:text-[#EA580C] transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{t.login.fillDemoData}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 rounded-xl bg-[#0A0A0A] border border-[#27272A] p-3 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-white">
                  <span className="text-[#FDBA74]">{isEn ? 'Email:' : 'E-mail:'}</span>
                  <span className="font-mono text-white font-medium">{DEFAULT_DEMO_USER.email}</span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span className="text-[#FDBA74]">{isEn ? 'Password:' : 'Senha:'}</span>
                  <span className="font-mono text-white font-medium">123456</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-[#FDBA74] space-y-2">
          <div className="flex items-center justify-center gap-3 text-xs">
            <a
              href="/termos"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('/termos');
                }
              }}
              className="text-[#FDBA74] hover:text-white transition underline underline-offset-4"
            >
              {t.login.termsLink}
            </a>
            <span className="text-[#27272A]">·</span>
            <a
              href="/privacidade"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('/privacidade');
                }
              }}
              className="text-[#FDBA74] hover:text-white transition underline underline-offset-4"
            >
              {t.login.privacyLink}
            </a>
          </div>
          <p>{t.login.copyright}</p>
        </div>
      </div>
    </div>
  );
};
