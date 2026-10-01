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
  ArrowRight
} from 'lucide-react';
import { authService, DEFAULT_DEMO_USER } from '../../services/authService';
import { User } from '../../types';

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
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

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
      setErrorMessage('Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (!loginPassword.trim()) {
      setErrorMessage('Por favor, informe sua senha de acesso.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(loginEmail, loginPassword);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Ocorreu um erro ao processar a autenticação. Tente novamente.');
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!registerName.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    if (!registerEmail.trim()) {
      setErrorMessage('Por favor, informe seu e-mail de cadastro.');
      return;
    }

    if (!registerPassword.trim()) {
      setErrorMessage('Por favor, crie uma senha de acesso.');
      return;
    }

    if (registerPassword.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage('As senhas não coincidem. Digite a mesma senha nos dois campos.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.register(
        registerName,
        registerEmail,
        registerPassword,
        registerConfirmPassword
      );
      setIsLoading(false);

      if (result.success && result.user) {
        setSuccessMessage('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => {
          onLoginSuccess(result.user!);
        }, 400);
      } else {
        setErrorMessage(result.error || 'Não foi possível concluir o cadastro. Verifique os dados.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Ocorreu um erro inesperado ao criar a conta. Tente novamente.');
    }
  };

  // 1-Click quick fill for demo account
  const handleQuickFillDemo = () => {
    setLoginEmail(DEFAULT_DEMO_USER.email);
    setLoginPassword('123456');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col items-center justify-center p-4 sm:p-6 text-white selection:bg-[#F97316]/30 selection:text-white">
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
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta no Clipo'}
          </h1>
          <p className="text-xs text-[#FDBA74]">
            {mode === 'login'
              ? 'Gerencie seus cortes automáticos e agendamentos de vídeos'
              : 'Automatize cortes verticais e publicações em múltiplos canais'}
          </p>
        </div>

        {/* Auth Container Card */}
        <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode Tabs Switcher */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#0A0A0A] p-1 border border-[#27272A]">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'login'
                  ? 'bg-[#1E1E1E] text-white shadow-sm border border-[#27272A]'
                  : 'text-[#FDBA74] hover:text-white'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
                mode === 'register'
                  ? 'bg-[#1E1E1E] text-white shadow-sm border border-[#27272A]'
                  : 'text-[#FDBA74] hover:text-white'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Cadastrar</span>
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
                  E-mail
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Mail className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="seu.email@exemplo.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-white">
                    Senha
                  </label>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-10 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition"
                    aria-label={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
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
                      <span>Autenticando...</span>
                    </span>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Entrar no Clipo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick switch to register */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#FDBA74]">
                  Não tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="font-semibold text-[#F97316] hover:text-[#EA580C] transition"
                  >
                    Cadastre-se grátis
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* FORM: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Name field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  Nome completo
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <UserIcon className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(e) => {
                      setRegisterName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Seu nome ou canal"
                    autoComplete="name"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                </div>
              </div>

              {/* E-mail field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  E-mail
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Mail className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => {
                      setRegisterEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="seu.email@exemplo.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-3.5 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => {
                      setRegisterPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Crie uma senha segura"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-10 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition"
                    aria-label={showRegisterPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white">
                  Confirmar senha
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <CheckCircle2 className="h-4 w-4 text-[#FDBA74]" />
                  </div>
                  <input
                    type={showRegisterConfirm ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(e) => {
                      setRegisterConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Repita sua senha"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] py-2.5 pl-10 pr-10 text-xs text-white placeholder-[#71717A] transition focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterConfirm(!showRegisterConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#FDBA74] hover:text-white transition"
                    aria-label={showRegisterConfirm ? 'Ocultar senha' : 'Exibir senha'}
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
                      <span>Criando sua conta...</span>
                    </span>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Criar minha conta</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick switch to login */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#FDBA74]">
                  Já possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="font-semibold text-[#F97316] hover:text-[#EA580C] transition"
                  >
                    Fazer login
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
                  Acesso de Demonstração
                </span>
                <button
                  type="button"
                  onClick={handleQuickFillDemo}
                  className="text-[11px] font-medium text-[#F97316] hover:text-[#EA580C] transition flex items-center gap-1"
                >
                  <span>Preencher dados</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 rounded-xl bg-[#0A0A0A] border border-[#27272A] p-3 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-white">
                  <span className="text-[#FDBA74]">E-mail:</span>
                  <span className="font-mono text-white font-medium">{DEFAULT_DEMO_USER.email}</span>
                </div>
                <div className="flex items-center justify-between text-white">
                  <span className="text-[#FDBA74]">Senha:</span>
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
              Termos de Serviço
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
              Política de Privacidade
            </a>
          </div>
          <p>© 2026 Clipo · Automação e publicação inteligente</p>
        </div>
      </div>
    </div>
  );
};
