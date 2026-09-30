import { authService, DEFAULT_DEMO_USER } from './authService';

export interface UserNotificationPreferences {
  publishSuccess: boolean;
  publishFailure: boolean;
  storageWarning: boolean;
  weeklySummary: boolean;
  marketingNews: boolean;
}

export interface UserProfileSettings {
  name: string;
  email: string;
  avatarUrl: string;
  notifications: UserNotificationPreferences;
}

const SETTINGS_STORAGE_KEY = 'clipo_user_settings_v1';
const AUTH_PASSWORD_HASH_KEY = 'clipo_user_pwd_configured';
const AUTH_SESSION_KEY = 'clipo_auth_session_active';

export const DEFAULT_USER_PROFILE: UserProfileSettings = {
  name: 'Vicente Silva',
  email: 'vic102393566@gmail.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  notifications: {
    publishSuccess: true,
    publishFailure: true,
    storageWarning: true,
    weeklySummary: false,
    marketingNews: false,
  },
};

// Check if user is currently authenticated
export function isUserLoggedIn(): boolean {
  return authService.isAuthenticated();
}

// Set user authentication session state
export function setUserSession(active: boolean): void {
  if (!active) {
    authService.logout();
  }
}

// Terminate user session (Logout)
export function logoutUser(): void {
  authService.logout();
}

// Retrieve persisted user profile settings (user-scoped)
export function getStoredUserProfile(userId?: string): UserProfileSettings {
  try {
    const currentUser = authService.getCurrentUser();
    const effectiveId = userId || currentUser?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = `clipo_u_${effectiveId}_settings`;

    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_USER_PROFILE,
        name: currentUser?.name || DEFAULT_USER_PROFILE.name,
        email: currentUser?.email || DEFAULT_USER_PROFILE.email,
        avatarUrl: currentUser?.avatarUrl || DEFAULT_USER_PROFILE.avatarUrl,
        ...parsed,
        notifications: {
          ...DEFAULT_USER_PROFILE.notifications,
          ...(parsed.notifications || {}),
        },
      };
    }

    // Se for usuário demo, tenta recuperar chave legada
    if (effectiveId === DEFAULT_DEMO_USER.id) {
      const legacy = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        return {
          ...DEFAULT_USER_PROFILE,
          ...parsed,
          notifications: {
            ...DEFAULT_USER_PROFILE.notifications,
            ...(parsed.notifications || {}),
          },
        };
      }
    }

    // Usuário novo autenticado: cria perfil padrão com seus dados
    if (currentUser) {
      return {
        name: currentUser.name,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        notifications: DEFAULT_USER_PROFILE.notifications,
      };
    }
  } catch (err) {
    console.warn('Erro ao carregar perfil do usuário do localStorage:', err);
  }
  return DEFAULT_USER_PROFILE;
}

// Persist user profile settings (user-scoped)
export function saveStoredUserProfile(profile: UserProfileSettings, userId?: string): void {
  try {
    const currentUser = authService.getCurrentUser();
    const effectiveId = userId || currentUser?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = `clipo_u_${effectiveId}_settings`;

    localStorage.setItem(scopedKey, JSON.stringify(profile));

    if (effectiveId === DEFAULT_DEMO_USER.id) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(profile));
    }

    // Sincroniza dados no authService
    authService.updateCurrentUserProfile({
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    });
  } catch (err) {
    console.error('Erro ao salvar perfil do usuário:', err);
  }
}

// Check if custom password has been saved
export function hasCustomPassword(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTH_PASSWORD_HASH_KEY));
  } catch {
    return false;
  }
}

// Persist simulated hashed password
export function saveCustomPassword(password: string): void {
  try {
    // Store simple obfuscated tag
    localStorage.setItem(AUTH_PASSWORD_HASH_KEY, btoa(`pwd_${password}_salt`));
  } catch (err) {
    console.error('Erro ao salvar senha:', err);
  }
}

// Verify if input password matches stored password or initial default password
export function verifyUserPassword(password: string): boolean {
  try {
    const stored = localStorage.getItem(AUTH_PASSWORD_HASH_KEY);
    if (stored) {
      const decoded = atob(stored);
      return decoded === `pwd_${password}_salt`;
    }
    // Default initial accepted passwords when no custom password has been saved
    return (
      password === '123456' ||
      password === 'clipo123' ||
      password === 'admin123' ||
      password === 'clipo'
    );
  } catch {
    return password === '123456';
  }
}

// Verify user email against current profile email or default user email
export function verifyUserEmail(email: string): boolean {
  const profile = getStoredUserProfile();
  const currentEmail = (profile.email || DEFAULT_USER_PROFILE.email).trim().toLowerCase();
  const inputEmail = email.trim().toLowerCase();
  return inputEmail === currentEmail || inputEmail === DEFAULT_USER_PROFILE.email.toLowerCase();
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

// Perform login with email and password
export function loginUser(email: string, password: string): LoginResult {
  const cleanEmail = email.trim();
  const cleanPassword = password.trim();

  if (!cleanEmail) {
    return { success: false, error: 'Por favor, digite seu endereço de e-mail.' };
  }

  if (!cleanPassword) {
    return { success: false, error: 'Por favor, informe sua senha.' };
  }

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Por favor, insira um formato de e-mail válido.' };
  }

  // Check email
  if (!verifyUserEmail(cleanEmail)) {
    return {
      success: false,
      error: 'E-mail incorreto ou não cadastrado na plataforma.',
    };
  }

  // Check password
  if (!verifyUserPassword(cleanPassword)) {
    return {
      success: false,
      error: 'Senha incorreta. Verifique os caracteres e tente novamente.',
    };
  }

  // Authentication successful: activate session
  setUserSession(true);
  return { success: true };
}

// Reset/Delete user account and all persistent data
export function resetUserAccountData(): void {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(AUTH_PASSWORD_HASH_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('clipo_stored_videos_v1');
    localStorage.removeItem('clipo_user_plan');
  } catch (err) {
    console.error('Erro ao limpar dados do usuário:', err);
  }
}
