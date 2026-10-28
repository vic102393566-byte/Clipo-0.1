import { authService, DEFAULT_DEMO_USER } from './authService';

export interface UserNotificationPreferences {
  publishSuccess: boolean;
  publishFailure: boolean;
  storageWarning: boolean;
  weeklySummary: boolean;
  marketingNews: boolean;
}

export interface UserCustomColors {
  btnPrimary: string;
  accent: string;
  bgMain: string;
  bgCard: string;
  textPrimary: string;
  cardBorder: string;
}

export interface UserProfileSettings {
  name: string;
  email: string;
  avatarUrl: string;
  notifications: UserNotificationPreferences;
  customColors?: UserCustomColors;
  selectedTheme?: PresetThemeId;
}

export type PresetThemeId = 'clipo-original' | 'dark-red' | 'ocean-blue' | 'pink' | 'light-clean';

export interface PresetTheme {
  id: PresetThemeId;
  name: string;
  subtitle: string;
  description: string;
  isLight?: boolean;
  colors: UserCustomColors;
}

export const PRESET_THEMES: Record<PresetThemeId, PresetTheme> = {
  'clipo-original': {
    id: 'clipo-original',
    name: 'Clipo Original',
    subtitle: 'Azul e Violeta',
    description: 'A identidade icônica do Clipo com índigo moderno, violeta e fundo escuro profundo.',
    isLight: false,
    colors: {
      btnPrimary: '#6366F1',
      accent: '#8B5CF6',
      bgMain: '#0B0F17',
      bgCard: '#151515',
      textPrimary: '#F8FAFC',
      cardBorder: '#27272A',
    },
  },
  'dark-red': {
    id: 'dark-red',
    name: 'Dark Red',
    subtitle: 'Preto, Vermelho e Branco',
    description: 'Estilo noturno audacioso com carmesim vibrante, superfícies pretas e alto contraste.',
    isLight: false,
    colors: {
      btnPrimary: '#EF4444',
      accent: '#F87171',
      bgMain: '#0A0506',
      bgCard: '#160B0E',
      textPrimary: '#FFFFFF',
      cardBorder: '#3F171E',
    },
  },
  'ocean-blue': {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    subtitle: 'Azul Marinho e Ciano',
    description: 'Tons oceânicos relaxantes, ciano refrescante e contraste suave para longas sessões.',
    isLight: false,
    colors: {
      btnPrimary: '#0284C7',
      accent: '#06B6D4',
      bgMain: '#05111B',
      bgCard: '#0B2134',
      textPrimary: '#F0F9FF',
      cardBorder: '#164E63',
    },
  },
  'pink': {
    id: 'pink',
    name: 'Pink',
    subtitle: 'Magenta Neon e Rosa',
    description: 'Visual moderno e expressivo com toques de magenta, framboesa e rosa iluminado.',
    isLight: false,
    colors: {
      btnPrimary: '#EC4899',
      accent: '#F472B6',
      bgMain: '#10060E',
      bgCard: '#1F0C1B',
      textPrimary: '#FDF2F8',
      cardBorder: '#4A1D44',
    },
  },
  'light-clean': {
    id: 'light-clean',
    name: 'Light Clean',
    subtitle: 'Claro, Nítido e Sem Ofuscação',
    description: 'Tema claro otimizado com contraste perfeito, cartões brancos e leitura ultra nítida.',
    isLight: true,
    colors: {
      btnPrimary: '#4F46E5',
      accent: '#6366F1',
      bgMain: '#F8FAFC',
      bgCard: '#FFFFFF',
      textPrimary: '#0F172A',
      cardBorder: '#E2E8F0',
    },
  },
};

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
  selectedTheme: 'clipo-original',
};

/**
 * Paleta de cores oficial padrão do Clipo (Azul, Índigo e Violeta).
 */
export const DEFAULT_CLIPO_COLORS: Readonly<UserCustomColors> = Object.freeze(PRESET_THEMES['clipo-original'].colors);

/**
 * Mapeamento das 6 variáveis CSS injetadas no elemento raiz (<html>).
 */
export const CUSTOM_COLOR_CSS_VARS = {
  btnPrimary: '--user-btn-primary',
  accent: '--user-accent',
  bgMain: '--user-bg-main',
  bgCard: '--user-bg-card',
  textPrimary: '--user-text-primary',
  cardBorder: '--user-card-border',
} as const;

/**
 * Retorna uma cópia da paleta de cores padrão oficial do Clipo.
 */
export function getDefaultCustomColors(): UserCustomColors {
  return { ...DEFAULT_CLIPO_COLORS };
}

/**
 * Valida estritamente se uma cor é um código hexadecimal seguro.
 * Aceita #RGB (3 dígitos) ou #RRGGBB (6 dígitos).
 * Rejeita qualquer string que contenha injeções CSS, funções (ex: url, rgb) ou caracteres especiais.
 */
export function isValidHexColor(color: unknown): color is string {
  if (typeof color !== 'string') return false;
  const trimmed = color.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
}

/**
 * Normaliza uma cor hexadecimal para o formato canônico #RRGGBB em letras maiúsculas.
 * Converte cores shorthand #RGB para #RRGGBB (ex: #FFF -> #FFFFFF).
 * Retorna null se a cor não for válida.
 */
export function normalizeHexColor(color: unknown): string | null {
  if (!isValidHexColor(color)) return null;
  const clean = color.trim().toUpperCase();
  if (clean.length === 4) {
    // #RGB -> #RRGGBB
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

/**
 * Sanitiza um objeto de cores personalizado, garantindo que todas as 5 chaves
 * possuem cores hexadecimais válidas. Para chaves ausentes ou inválidas,
 * utiliza os valores da paleta padrão do Clipo.
 */
export function sanitizeCustomColors(colors: Partial<UserCustomColors> | null | undefined): UserCustomColors {
  const defaults = getDefaultCustomColors();
  if (!colors || typeof colors !== 'object') {
    return defaults;
  }
  return {
    btnPrimary: normalizeHexColor(colors.btnPrimary) || defaults.btnPrimary,
    accent: normalizeHexColor(colors.accent) || defaults.accent,
    bgMain: normalizeHexColor(colors.bgMain) || defaults.bgMain,
    bgCard: normalizeHexColor(colors.bgCard) || defaults.bgCard,
    textPrimary: normalizeHexColor(colors.textPrimary) || defaults.textPrimary,
    cardBorder: normalizeHexColor(colors.cardBorder) || defaults.cardBorder,
  };
}

/**
 * Cores oficiais do Modo Claro do Clipo (Contraste máximo, fundos brancos/claros e leitura ultra nítida).
 */
export const LIGHT_MODE_COLORS: Readonly<UserCustomColors> = Object.freeze({
  btnPrimary: '#4F46E5',
  accent: '#6366F1',
  bgMain: '#F8FAFC',
  bgCard: '#FFFFFF',
  textPrimary: '#0F172A',
  cardBorder: '#E2E8F0',
});

/**
 * Aplica as cores personalizadas como variáveis CSS no elemento raiz (<html>).
 * Quando o modo Claro estiver ativo, tem PRIORIDADE ABSOLUTA sobre as cores personalizadas,
 * garantindo fundo claro, cartões brancos e textos escuros sem apagar as preferências do utilizador.
 * Ao regressar ao modo Escuro, a paleta personalizada guardada é restaurada imediatamente.
 */
export function applyCustomThemeColors(
  colors: Partial<UserCustomColors>,
  themeId?: PresetThemeId,
  resolvedMode?: 'light' | 'dark'
): UserCustomColors {
  const sanitized = sanitizeCustomColors(colors);
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;
    const rootStyle = root.style;

    // Detetar se o modo Claro deve ter prioridade
    let isLight = false;
    if (resolvedMode) {
      isLight = resolvedMode === 'light';
    } else {
      const storedPref = localStorage.getItem('clipo_theme_preference');
      if (storedPref === 'light') {
        isLight = true;
      } else if (storedPref === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
        isLight = true;
      } else if (themeId === 'light-clean' && (!storedPref || storedPref === 'system')) {
        isLight = true;
      } else {
        isLight = root.classList.contains('light') && !root.classList.contains('dark');
      }
    }

    if (isLight) {
      // Modo Claro: Prioridade sobre a paleta personalizada
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.btnPrimary, LIGHT_MODE_COLORS.btnPrimary);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.accent, LIGHT_MODE_COLORS.accent);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.bgMain, LIGHT_MODE_COLORS.bgMain);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.bgCard, LIGHT_MODE_COLORS.bgCard);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.textPrimary, LIGHT_MODE_COLORS.textPrimary);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.cardBorder, LIGHT_MODE_COLORS.cardBorder);

      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme-mode', 'light');
      root.setAttribute('data-has-custom-colors', 'true');
    } else {
      // Modo Escuro: Restaura a paleta personalizada selecionada pelo utilizador
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.btnPrimary, sanitized.btnPrimary);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.accent, sanitized.accent);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.bgMain, sanitized.bgMain);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.bgCard, sanitized.bgCard);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.textPrimary, sanitized.textPrimary);
      rootStyle.setProperty(CUSTOM_COLOR_CSS_VARS.cardBorder, sanitized.cardBorder);

      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme-mode', 'dark');
      root.setAttribute('data-has-custom-colors', 'true');
    }

    // Identificação do tema no DOM
    let effectiveThemeId = themeId;
    if (!effectiveThemeId) {
      if (sanitized.bgMain === PRESET_THEMES['light-clean'].colors.bgMain) {
        effectiveThemeId = 'light-clean';
      } else if (sanitized.btnPrimary === PRESET_THEMES['dark-red'].colors.btnPrimary) {
        effectiveThemeId = 'dark-red';
      } else if (sanitized.btnPrimary === PRESET_THEMES['ocean-blue'].colors.btnPrimary) {
        effectiveThemeId = 'ocean-blue';
      } else if (sanitized.btnPrimary === PRESET_THEMES['pink'].colors.btnPrimary) {
        effectiveThemeId = 'pink';
      } else {
        effectiveThemeId = 'clipo-original';
      }
    }

    root.setAttribute('data-preset-theme', effectiveThemeId);
  }
  return sanitized;
}

/**
 * Remove todas as variáveis CSS personalizadas do elemento raiz, restaurando os padrões nativos do Clipo.
 */
export function clearCustomThemeColors(): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;
    const rootStyle = root.style;
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.btnPrimary);
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.accent);
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.bgMain);
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.bgCard);
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.textPrimary);
    rootStyle.removeProperty(CUSTOM_COLOR_CSS_VARS.cardBorder);
    root.removeAttribute('data-has-custom-colors');
    root.removeAttribute('data-preset-theme');
    root.removeAttribute('data-theme-mode');
  }
}

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
      const parsedTheme = (parsed.selectedTheme && PRESET_THEMES[parsed.selectedTheme as PresetThemeId])
        ? (parsed.selectedTheme as PresetThemeId)
        : (parsed.customColors?.bgMain === PRESET_THEMES['light-clean'].colors.bgMain ? 'light-clean' : 'clipo-original');

      return {
        ...DEFAULT_USER_PROFILE,
        name: currentUser?.name || DEFAULT_USER_PROFILE.name,
        email: currentUser?.email || DEFAULT_USER_PROFILE.email,
        avatarUrl: currentUser?.avatarUrl || DEFAULT_USER_PROFILE.avatarUrl,
        ...parsed,
        selectedTheme: parsedTheme,
        notifications: {
          ...DEFAULT_USER_PROFILE.notifications,
          ...(parsed.notifications || {}),
        },
        customColors: parsed.customColors
          ? sanitizeCustomColors(parsed.customColors)
          : PRESET_THEMES[parsedTheme].colors,
      };
    }

    // Se for usuário demo, tenta recuperar chave legada
    if (effectiveId === DEFAULT_DEMO_USER.id) {
      const legacy = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        const parsedTheme = (parsed.selectedTheme && PRESET_THEMES[parsed.selectedTheme as PresetThemeId])
          ? (parsed.selectedTheme as PresetThemeId)
          : 'clipo-original';

        return {
          ...DEFAULT_USER_PROFILE,
          ...parsed,
          selectedTheme: parsedTheme,
          notifications: {
            ...DEFAULT_USER_PROFILE.notifications,
            ...(parsed.notifications || {}),
          },
          customColors: parsed.customColors
            ? sanitizeCustomColors(parsed.customColors)
            : PRESET_THEMES[parsedTheme].colors,
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
        selectedTheme: 'clipo-original',
        customColors: PRESET_THEMES['clipo-original'].colors,
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

    // Preserva e sanitiza os campos do perfil
    const sanitizedProfile: UserProfileSettings = {
      ...profile,
      selectedTheme: profile.selectedTheme || 'clipo-original',
      customColors: profile.customColors ? sanitizeCustomColors(profile.customColors) : undefined,
    };

    localStorage.setItem(scopedKey, JSON.stringify(sanitizedProfile));

    if (effectiveId === DEFAULT_DEMO_USER.id) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizedProfile));
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
    clearCustomThemeColors();
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(AUTH_PASSWORD_HASH_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('clipo_stored_videos_v1');
    localStorage.removeItem('clipo_user_plan');
  } catch (err) {
    console.error('Erro ao limpar dados do usuário:', err);
  }
}
