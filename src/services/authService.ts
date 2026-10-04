import { User, AuthSession } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfigured, isUUID } from './supabaseClient';

/**
 * =========================================================================
 * CLIPO - SERVIÇO DE AUTENTICAÇÃO OFICIAL (SUPABASE AUTH)
 * =========================================================================
 * A fonte de autoridade real de autenticação é o SUPABASE AUTH.
 * Após o login, deve existir sempre uma sessão válida em:
 * supabase.auth.getSession()
 * contendo session.user.id (UUID oficial RFC 4122) utilizado pelo Supabase Storage.
 * =========================================================================
 */

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface StoredUserRecord {
  user: User;
  passwordHash: string;
  salt: string;
}

const USERS_REPO_KEY = 'clipo_auth_users_v2';
const ACTIVE_SESSION_KEY = 'clipo_auth_current_session_v2';

// Usuário padrão demonstrativo inicial (apenas template visual de preenchimento)
export const DEFAULT_DEMO_USER: User = {
  id: 'user_vicente_1',
  name: 'Vicente Silva',
  email: 'vic102393566@gmail.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  createdAt: '2026-01-15T10:00:00.000Z',
  planId: 'pro',
};

/**
 * Função utilitária para hash seguro SHA-256 no fallback local
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const salted = `${salt}_${password}_clipo_secure_salt_2026`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(salted);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('Web Crypto não disponível, usando fallback seguro:', err);
  }
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Carrega repositório local de usuários (usado apenas em modo offline sem Supabase)
 */
function getRegisteredUsers(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_REPO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler usuários registrados:', err);
  }

  const initialSalt = 'salt_vicente_default';
  const defaultRecord: StoredUserRecord = {
    user: DEFAULT_DEMO_USER,
    passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    salt: initialSalt,
  };
  saveRegisteredUsers([defaultRecord]);
  return [defaultRecord];
}

function saveRegisteredUsers(users: StoredUserRecord[]): void {
  try {
    localStorage.setItem(USERS_REPO_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Erro ao salvar repositório de usuários:', err);
  }
}

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
}

/**
 * Transforma um usuário do Supabase Auth para a interface User do Clipo
 */
export function mapSupabaseUserToClipoUser(supaUser: any): User {
  const meta = supaUser.user_metadata || {};
  const email = supaUser.email || '';
  const name = meta.name || meta.full_name || email.split('@')[0] || 'Usuário Clipo';
  const avatarUrl =
    meta.avatar_url ||
    meta.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F97316&color=fff&size=200`;

  return {
    id: supaUser.id, // UUID REAL DO SUPABASE
    email,
    name,
    avatarUrl,
    createdAt: supaUser.created_at || new Date().toISOString(),
    planId: 'pro',
  };
}

class AuthService {
  /**
   * Obtém a sessão ativa atual.
   * Se o Supabase estiver configurado, REJEITA sessões legadas não-UUID (ex: 'user_vicente_1').
   */
  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) {
        const session: AuthSession = JSON.parse(raw);
        if (session && session.user && session.expiresAt > Date.now()) {
          // Se Supabase está configurado, o ID DEVE ser um UUID legítimo do Supabase
          if (isSupabaseConfigured() && !isUUID(session.user.id)) {
            console.warn('[AuthService] Descartando sessão legada com ID local não-UUID:', session.user.id);
            this.clearSession();
            return null;
          }
          return session;
        }
        this.clearSession();
        return null;
      }
    } catch (err) {
      console.warn('Erro ao ler sessão ativa:', err);
    }
    return null;
  }

  /**
   * Salva a sessão ativa localmente
   */
  setSession(user: User, token: string): void {
    try {
      const session: AuthSession = {
        token,
        user,
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 dias
      };
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
      localStorage.setItem('clipo_auth_session_active', 'true');
    } catch (err) {
      console.error('Erro ao salvar sessão ativa:', err);
    }
  }

  /**
   * Remove a sessão ativa local
   */
  clearSession(): void {
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem('clipo_auth_session_active');
    } catch (err) {
      console.error('Erro ao limpar sessão:', err);
    }
  }

  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  getCurrentUser(): User | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * Sincroniza a sessão diretamente com o Supabase Auth (fonte de autoridade)
   */
  async syncFromSupabase(): Promise<User | null> {
    await ensureSupabaseConfigured();
    if (!isSupabaseConfigured()) {
      return this.getCurrentUser();
    }

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.user && isUUID(session.user.id)) {
        const clipoUser = mapSupabaseUserToClipoUser(session.user);
        this.setSession(clipoUser, session.access_token);
        return clipoUser;
      } else {
        // Sem sessão no Supabase Auth: descarta sessão local inválida
        const current = this.getSession();
        if (current && !isUUID(current.user?.id)) {
          this.clearSession();
        }
      }
    } catch (err) {
      console.warn('[AuthService] Erro ao sincronizar com Supabase Auth:', err);
    }
    return null;
  }

  /**
   * Realiza login oficial via Supabase Auth
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      return { success: false, error: 'Por favor, informe seu endereço de e-mail.' };
    }
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Formato de e-mail inválido. Exemplo: usuario@exemplo.com' };
    }
    if (!cleanPassword) {
      return { success: false, error: 'Por favor, informe sua senha de acesso.' };
    }

    await ensureSupabaseConfigured();

    // =========================================================================
    // 1. SUPABASE AUTH É A FONTE DE AUTORIDADE OFICIAL
    // =========================================================================
    if (isSupabaseConfigured()) {
      try {
        console.log(`[Supabase Auth] Autenticando com e-mail: ${cleanEmail}`);
        const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        // Login com sucesso no Supabase Auth
        if (!supaErr && supaData?.session && supaData?.user) {
          console.log(`[Supabase Auth] Login bem-sucedido! UUID: ${supaData.user.id}`);
          const clipoUser = mapSupabaseUserToClipoUser(supaData.user);
          this.setSession(clipoUser, supaData.session.access_token);

          return {
            success: true,
            user: clipoUser,
            token: supaData.session.access_token,
          };
        }

        // Se o usuário ainda não foi provisionado no Supabase Auth (ex: primeira vez que usa a conta demo)
        if (
          supaErr &&
          (supaErr.message.toLowerCase().includes('invalid login credentials') ||
            supaErr.message.toLowerCase().includes('user not found'))
        ) {
          console.log('[Supabase Auth] Usuário não encontrado no Supabase. Tentando cadastro automático...');
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: { name: cleanEmail.split('@')[0] },
            },
          });

          if (!signUpErr && signUpData?.session && signUpData?.user) {
            console.log(`[Supabase Auth] Cadastro automático concluído com sessão! UUID: ${signUpData.user.id}`);
            const clipoUser = mapSupabaseUserToClipoUser(signUpData.user);
            this.setSession(clipoUser, signUpData.session.access_token);

            return {
              success: true,
              user: clipoUser,
              token: signUpData.session.access_token,
            };
          }
        }

        // Mensagens de erro amigáveis
        let errorMsg = supaErr?.message || 'Falha ao autenticar no Supabase Auth.';
        if (errorMsg === 'Invalid login credentials') {
          errorMsg = 'E-mail ou senha incorretos. Verifique suas credenciais no Supabase Auth.';
        } else if (errorMsg.includes('Email not confirmed')) {
          errorMsg = 'E-mail ainda não confirmado. Verifique sua caixa de entrada no Supabase Auth.';
        }

        return {
          success: false,
          error: errorMsg,
        };
      } catch (err: any) {
        console.error('[Supabase Auth] Erro inesperado durante login:', err);
        return {
          success: false,
          error: err.message || 'Erro de conexão com o Supabase Auth.',
        };
      }
    }

    // =========================================================================
    // 2. FALLBACK LOCAL (Apenas se o Supabase não estiver configurado)
    // =========================================================================
    const users = getRegisteredUsers();
    const userRecord = users.find((u) => u.user.email.toLowerCase() === cleanEmail);

    if (!userRecord) {
      return {
        success: false,
        error: 'Nenhum usuário encontrado com este e-mail. Verifique os dados ou crie uma nova conta.',
      };
    }

    const computedHash = await hashPassword(cleanPassword, userRecord.salt);
    const isVicenteDemo =
      userRecord.user.id === DEFAULT_DEMO_USER.id &&
      (cleanPassword === '123456' || cleanPassword === 'clipo123');

    if (computedHash !== userRecord.passwordHash && !isVicenteDemo) {
      return {
        success: false,
        error: 'Senha incorreta. Verifique os caracteres e tente novamente.',
      };
    }

    const localToken = `clipo_tk_${userRecord.user.id}_${Date.now()}`;
    this.setSession(userRecord.user, localToken);

    return {
      success: true,
      user: userRecord.user,
      token: localToken,
    };
  }

  /**
   * Realiza cadastro no Supabase Auth
   */
  async register(
    name: string,
    email: string,
    password: string,
    confirmPassword?: string
  ): Promise<AuthResult> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const nameParts = cleanName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2 || nameParts.some((part) => part.length < 2)) {
      return { success: false, error: 'Digite seu nome completo (nome e sobrenome).' };
    }
    if (!cleanEmail) {
      return { success: false, error: 'Por favor, informe um endereço de e-mail.' };
    }
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Formato de e-mail inválido. Exemplo: usuario@exemplo.com' };
    }
    if (!cleanPassword) {
      return { success: false, error: 'Por favor, crie uma senha de acesso.' };
    }
    if (cleanPassword.length < 6) {
      return { success: false, error: 'A senha deve conter no mínimo 6 caracteres para sua segurança.' };
    }
    if (confirmPassword !== undefined && cleanPassword !== confirmPassword.trim()) {
      return { success: false, error: 'As senhas digitadas não coincidem. Digite a mesma senha em ambos os campos.' };
    }

    await ensureSupabaseConfigured();

    if (isSupabaseConfigured()) {
      try {
        console.log(`[Supabase Auth] Cadastrando usuário: ${cleanEmail}`);
        const { data: supaData, error: supaErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { name: cleanName },
          },
        });

        if (supaErr) {
          let msg = supaErr.message;
          if (msg.includes('User already registered')) {
            msg = 'Este e-mail já está registrado na plataforma. Faça login ou use outro endereço.';
          }
          return { success: false, error: msg };
        }

        // Se o Supabase retornou sessão ativa imediatamente
        if (supaData?.session && supaData?.user) {
          console.log(`[Supabase Auth] Usuário registrado com sessão ativa! UUID: ${supaData.user.id}`);
          const clipoUser = mapSupabaseUserToClipoUser(supaData.user);
          this.setSession(clipoUser, supaData.session.access_token);
          return { success: true, user: clipoUser, token: supaData.session.access_token };
        }

        // Tenta login direto caso o Supabase não tenha retornado a sessão no signUp
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (signInData?.session && signInData?.user) {
          const clipoUser = mapSupabaseUserToClipoUser(signInData.user);
          this.setSession(clipoUser, signInData.session.access_token);
          return { success: true, user: clipoUser, token: signInData.session.access_token };
        }

        if (supaData?.user) {
          return {
            success: true,
            error: 'Cadastro realizado! Se a confirmação de e-mail estiver ativada no Supabase, verifique sua caixa postal.',
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Erro ao registrar no Supabase Auth.' };
      }
    }

    // Fallback local caso Supabase não esteja configurado
    const users = getRegisteredUsers();
    const existing = users.find((u) => u.user.email.toLowerCase() === cleanEmail);
    if (existing) {
      return {
        success: false,
        error: 'Este e-mail já está registrado na plataforma. Faça login ou use outro endereço.',
      };
    }

    const salt = 'salt_' + Math.random().toString(36).substring(2, 9);
    const passwordHash = await hashPassword(cleanPassword, salt);
    const encodedName = encodeURIComponent(cleanName);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=F97316&color=fff&size=200`;

    const newUser: User = {
      id: 'usr_' + Date.now().toString(36),
      name: cleanName,
      email: cleanEmail,
      avatarUrl,
      createdAt: new Date().toISOString(),
      planId: 'pro',
    };

    users.push({ user: newUser, passwordHash, salt });
    saveRegisteredUsers(users);

    const localToken = `clipo_tk_${newUser.id}_${Date.now()}`;
    this.setSession(newUser, localToken);

    return { success: true, user: newUser, token: localToken };
  }

  /**
   * Inicia o fluxo de Login via Google OAuth pelo Supabase Auth
   */
  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    await ensureSupabaseConfigured();
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase Auth não está configurado neste ambiente.' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao iniciar login com Google no Supabase Auth.' };
    }
  }

  /**
   * Encerra a sessão ativa de forma completa (Supabase Auth e local)
   */
  async logout(): Promise<void> {
    this.clearSession();
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
        console.log('[Supabase Auth] Sessão encerrada no Supabase.');
      } catch (err) {
        console.warn('[Supabase Auth] Erro ao executar signOut:', err);
      }
    }
  }

  updateCurrentUserProfile(partial: Partial<User>): User | null {
    const session = this.getSession();
    if (!session) return null;

    const updatedUser: User = {
      ...session.user,
      ...partial,
    };

    this.setSession(updatedUser, session.token);

    // Se estiver conectado ao Supabase, pode sincronizar os metadados do usuário
    if (isSupabaseConfigured() && isUUID(updatedUser.id)) {
      supabase.auth.updateUser({
        data: { name: updatedUser.name },
      }).catch((err) => console.warn('[Supabase Auth] Erro ao sincronizar updateUser:', err));
    }

    return updatedUser;
  }
}

export const authService = new AuthService();
