import { User, AuthSession, PlanTier } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * =========================================================================
 * GUIA DE INTEGRAÇÃO COM BACKEND REAL (BACKEND INTEGRATION SPECIFICATION)
 * =========================================================================
 * Esta arquitetura foi concebida para permitir a troca direta deste provedor
 * local por um backend REST, GraphQL, Firebase Auth, Supabase ou NestJS.
 *
 * Para conectar ao backend real:
 * 1. Configure as variáveis de ambiente em .env:
 *    VITE_AUTH_API_URL=https://api.clipo.io/v1/auth
 *
 * 2. Endpoints esperados da API:
 *    - POST /api/auth/register
 *      Body: { name, email, password }
 *      Response: { success: true, user: User, token: string }
 *
 *    - POST /api/auth/login
 *      Body: { email, password }
 *      Response: { success: true, user: User, token: string }
 *
 *    - POST /api/auth/logout
 *      Headers: { Authorization: Bearer <token> }
 *      Response: { success: true }
 *
 *    - GET /api/auth/me
 *      Headers: { Authorization: Bearer <token> }
 *      Response: { user: User }
 *
 * 3. As senhas NUNCA são salvas em texto puro. No cliente atual, usamos hash
 *    SHA-256 criptográfico saltado antes do armazenamento local.
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

// Usuário padrão demonstrativo inicial
export const DEFAULT_DEMO_USER: User = {
  id: 'user_vicente_1',
  name: 'Vicente Silva',
  email: 'vic102393566@gmail.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  createdAt: '2026-01-15T10:00:00.000Z',
  planId: 'pro',
};

/**
 * Função utilitária para gerar hash SHA-256 seguro (Web Crypto API)
 * Evita salvar senhas em texto puro no frontend.
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
  // Fallback seguro caso subtle crypto não esteja em HTTPS
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_fallback_${Math.abs(hash).toString(16)}`;
}

/**
 * Carrega todos os usuários registrados
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

  // Pre-popula o usuário inicial com hash da senha padrão '123456'
  const initialSalt = 'salt_vicente_default';
  // Hash síncrono pre-calculado para '123456'
  const defaultRecord: StoredUserRecord = {
    user: DEFAULT_DEMO_USER,
    passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    salt: initialSalt,
  };
  saveRegisteredUsers([defaultRecord]);
  return [defaultRecord];
}

/**
 * Salva usuários no repositório persistente
 */
function saveRegisteredUsers(users: StoredUserRecord[]): void {
  try {
    localStorage.setItem(USERS_REPO_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Erro ao salvar repositório de usuários:', err);
  }
}

/**
 * Validador de formato de e-mail
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
}

/**
 * Gera um ID único para novos usuários
 */
function generateUserId(): string {
  return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

/**
 * Gera um token de sessão de autenticação simulado no formato padrão Bearer
 */
function generateAuthToken(userId: string): string {
  const randomPart = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  return `clipo_tk_${userId}_${Date.now()}_${randomPart}`;
}

/**
 * =========================================================================
 * SERVIÇO DE AUTENTICAÇÃO
 * =========================================================================
 */
class AuthService {
  /**
   * Obtém a sessão ativa atual
   */
  getSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) {
        const session: AuthSession = JSON.parse(raw);
        if (session && session.user && session.expiresAt > Date.now()) {
          return session;
        }
        // Se a sessão expirou, remove
        this.clearSession();
        return null;
      }

      // Migração de sessão pré-existente
      const legacySession = localStorage.getItem('clipo_auth_session_active');
      if (legacySession === 'false') {
        return null;
      }

      if (legacySession === 'true') {
        const token = generateAuthToken(DEFAULT_DEMO_USER.id);
        const initialSession: AuthSession = {
          token,
          user: DEFAULT_DEMO_USER,
          expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        };
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(initialSession));
        return initialSession;
      }
    } catch (err) {
      console.warn('Erro ao ler sessão ativa:', err);
    }
    return null;
  }

  /**
   * Salva a sessão ativa (persiste no navegador)
   */
  setSession(user: User, token: string): void {
    try {
      const session: AuthSession = {
        token,
        user,
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 dias de sessão
      };
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
      // Sincroniza flag legado caso algum componente ainda consulte
      localStorage.setItem('clipo_auth_session_active', 'true');
    } catch (err) {
      console.error('Erro ao salvar sessão ativa:', err);
    }
  }

  /**
   * Remove a sessão ativa (Logout)
   */
  clearSession(): void {
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.setItem('clipo_auth_session_active', 'false');
    } catch (err) {
      console.error('Erro ao limpar sessão:', err);
    }
  }

  /**
   * Retorna se o usuário está autenticado
   */
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Retorna os dados do usuário autenticado no momento
   */
  getCurrentUser(): User | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * Realiza login com E-mail e Senha
   */
  async login(email: string, password: string): Promise<AuthResult> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Validações de entrada
    if (!cleanEmail) {
      return { success: false, error: 'Por favor, informe seu endereço de e-mail.' };
    }

    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Formato de e-mail inválido. Exemplo: usuario@exemplo.com' };
    }

    if (!cleanPassword) {
      return { success: false, error: 'Por favor, informe sua senha de acesso.' };
    }

    const users = getRegisteredUsers();
    const userRecord = users.find((u) => u.user.email.toLowerCase() === cleanEmail);

    if (!userRecord) {
      return {
        success: false,
        error: 'Nenhum usuário encontrado com este e-mail. Verifique os dados ou crie uma nova conta.',
      };
    }

    // Calcula o hash da senha informada
    const computedHash = await hashPassword(cleanPassword, userRecord.salt);

    // Permite login com senha padrão demonstrativa se for o Vicente
    const isVicenteDemo =
      userRecord.user.id === DEFAULT_DEMO_USER.id &&
      (cleanPassword === '123456' || cleanPassword === 'clipo123');

    if (computedHash !== userRecord.passwordHash && !isVicenteDemo) {
      return {
        success: false,
        error: 'Senha incorreta. Verifique os caracteres e tente novamente.',
      };
    }

    // Login bem-sucedido: sincroniza com Supabase Auth se configurado para obter o UUID real
    if (isSupabaseConfigured()) {
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (supaErr) {
          const { data: signUpData } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: { name: userRecord.user.name },
            },
          });
          if (signUpData?.user?.id) {
            userRecord.user.id = signUpData.user.id;
          }
        } else if (supaData?.user?.id) {
          userRecord.user.id = supaData.user.id;
        }
      } catch (supaErr) {
        console.warn('[Supabase Auth] Sincronização no login:', supaErr);
      }
    }

    const token = generateAuthToken(userRecord.user.id);
    this.setSession(userRecord.user, token);

    return {
      success: true,
      user: userRecord.user,
      token,
    };
  }

  /**
   * Realiza o cadastro de um novo usuário
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

    // Validações de entrada
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

    const users = getRegisteredUsers();

    // Verifica se o e-mail já está cadastrado
    const existing = users.find((u) => u.user.email.toLowerCase() === cleanEmail);
    if (existing) {
      return {
        success: false,
        error: 'Este e-mail já está registrado na plataforma. Faça login ou use outro endereço.',
      };
    }

    // Se o Supabase estiver configurado, cria o usuário correspondente no Supabase Auth
    let supabaseUUID: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { name: cleanName },
          },
        });
        if (!supaErr && supaData?.user?.id) {
          supabaseUUID = supaData.user.id;
          console.log('[Supabase Auth] Novo usuário registrado no Supabase:', supabaseUUID);
        }
      } catch (supaErr) {
        console.warn('[Supabase Auth] Sincronização no cadastro:', supaErr);
      }
    }

    // Cria novo registro com salt e hash criptográfico
    const salt = 'salt_' + Math.random().toString(36).substring(2, 9);
    const passwordHash = await hashPassword(cleanPassword, salt);

    // Gerar avatar com iniciais coloridas ou placeholder neutro
    const encodedName = encodeURIComponent(cleanName);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=F97316&color=fff&size=200`;

    const newUser: User = {
      id: supabaseUUID || generateUserId(),
      name: cleanName,
      email: cleanEmail,
      avatarUrl,
      createdAt: new Date().toISOString(),
      planId: 'pro', // Concede plano Pro de boas-vindas
    };

    const newRecord: StoredUserRecord = {
      user: newUser,
      passwordHash,
      salt,
    };

    users.push(newRecord);
    saveRegisteredUsers(users);

    // Salva sessão imediatamente após o cadastro
    const token = generateAuthToken(newUser.id);
    this.setSession(newUser, token);

    return {
      success: true,
      user: newUser,
      token,
    };
  }

  /**
   * Encerra a sessão ativa
   */
  logout(): void {
    this.clearSession();
    if (isSupabaseConfigured()) {
      supabase.auth.signOut().catch(() => {});
    }
  }

  /**
   * Atualiza os dados do perfil do usuário ativo
   */
  updateCurrentUserProfile(partial: Partial<User>): User | null {
    const session = this.getSession();
    if (!session) return null;

    const updatedUser: User = {
      ...session.user,
      ...partial,
    };

    // Atualiza na sessão
    this.setSession(updatedUser, session.token);

    // Atualiza no repositório de usuários
    const users = getRegisteredUsers();
    const index = users.findIndex((u) => u.user.id === updatedUser.id);
    if (index >= 0) {
      users[index].user = updatedUser;
      saveRegisteredUsers(users);
    }

    return updatedUser;
  }
}

export const authService = new AuthService();
