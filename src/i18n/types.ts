export type Language = 'pt-BR' | 'en-US';

export interface Translations {
  common: {
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    deleting: string;
    edit: string;
    close: string;
    back: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    copy: string;
    copied: string;
    filter: string;
    all: string;
    status: string;
    actions: string;
    upload: string;
    viewAll: string;
    retry: string;
    dismiss: string;
    search: string;
    details: string;
    download: string;
    connected: string;
    disconnected: string;
    enabled: string;
    disabled: string;
    learnMore: string;
    yes: string;
    no: string;
  };
  nav: {
    dashboard: string;
    videos: string;
    agendamentos: string;
    calendario: string;
    contas: string;
    armazenamento: string;
    plano: string;
    configuracoes: string;
    navigation: string;
    uploadNewVideo: string;
    storage: string;
    logout: string;
    activeChannelsCount: string;
  };
  header: {
    tabs: Record<string, { title: string; subtitle: string }>;
    notifications: string;
    settings: string;
    uploadVideo: string;
    language: string;
    selectLanguage: string;
    portuguese: string;
    english: string;
    currentLanguageName: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
  };
  dashboard: {
    metrics: {
      totalViews: string;
      totalViewsDesc: string;
      scheduledPubs: string;
      scheduledPubsDesc: string;
      storageUsed: string;
      storageUsedDesc: string;
      connectedChannels: string;
      connectedChannelsDesc: string;
    };
    quickActions: {
      title: string;
      uploadVideo: string;
      uploadVideoDesc: string;
      schedulePost: string;
      schedulePostDesc: string;
      connectSocial: string;
      connectSocialDesc: string;
    };
    upcoming: {
      title: string;
      subtitle: string;
      viewCalendar: string;
      emptyTitle: string;
      emptyDesc: string;
      scheduleNow: string;
      scheduledFor: string;
      filterAll: string;
    };
    channels: {
      title: string;
      subtitle: string;
      manage: string;
      followers: string;
      directPostReady: string;
      connectAccount: string;
      emptyChannels: string;
    };
  };
  videos: {
    searchPlaceholder: string;
    filterAll: string;
    filterWithCuts: string;
    filterNoCuts: string;
    uploadNew: string;
    emptyTitle: string;
    emptyDesc: string;
    uploadFirst: string;
    noSearchResults: string;
    noSearchResultsDesc: string;
    duration: string;
    size: string;
    format: string;
    cutsAvailable: string;
    noCuts: string;
    actions: {
      split: string;
      aiMetadata: string;
      schedule: string;
      preview: string;
      delete: string;
    };
    storageWarning: {
      title: string;
      desc: string;
      upgrade: string;
    };
    deleteConfirm: {
      title: string;
      message: string;
    };
  };
  schedule: {
    title: string;
    subtitle: string;
    newSchedule: string;
    filterStatus: string;
    allPlatforms: string;
    emptyTitle: string;
    emptyDesc: string;
    scheduleFirst: string;
    status: {
      scheduled: string;
      published: string;
      failed: string;
      draft: string;
    };
    table: {
      video: string;
      platforms: string;
      dateTime: string;
      status: string;
      actions: string;
    };
    cancelConfirm: string;
  };
  calendar: {
    title: string;
    subtitle: string;
    today: string;
    month: string;
    week: string;
    scheduleOnDay: string;
    noPublicationsOnDay: string;
    publicationsCount: string;
    daysOfWeek: string[];
    months: string[];
  };
  connectedAccounts: {
    title: string;
    subtitle: string;
    officialNotice: string;
    officialNoticeDesc: string;
    accountsLimit: string;
    connectAccount: string;
    disconnectAccount: string;
    disconnectConfirm: string;
    followers: string;
    activeScopes: string;
    openSetupGuide: string;
    guideTitle: string;
    guideDesc: string;
    redirectUriLabel: string;
    requiredKeysLabel: string;
    statusConnected: string;
    statusDisconnected: string;
    configuredNotice: string;
    missingKeysNotice: string;
    connectingPopup: string;
  };
  storage: {
    title: string;
    subtitle: string;
    usedOf: string;
    percentUsed: string;
    filesCount: string;
    planTier: string;
    cleanStorage: string;
    cleanConfirm: string;
    upgradeStorage: string;
    breakdown: {
      videos: string;
      cuts: string;
      thumbnails: string;
      available: string;
    };
    features: {
      title: string;
      retention: string;
      cdn: string;
      backup: string;
    };
  };
  plan: {
    title: string;
    subtitle: string;
    currentPlanBadge: string;
    monthly: string;
    annual: string;
    discountBadge: string;
    selectPlan: string;
    currentPlanBtn: string;
    switchPlanSuccess: string;
    featuresIncluded: string;
    perMonth: string;
    tiers: {
      free: {
        name: string;
        desc: string;
        price: string;
      };
      pro: {
        name: string;
        desc: string;
        price: string;
      };
      agency: {
        name: string;
        desc: string;
        price: string;
      };
    };
    faq: {
      title: string;
      q1: string;
      a1: string;
      q2: string;
      a2: string;
    };
  };
  settings: {
    title: string;
    subtitle: string;
    tabs: {
      profile: string;
      preferences: string;
      integrations: string;
      danger: string;
    };
    profile: {
      name: string;
      email: string;
      avatarUrl: string;
      avatarHelp: string;
      savedSuccess: string;
    };
    preferences: {
      language: string;
      languageDesc: string;
      timezone: string;
      notificationsEmail: string;
      autoGenerateMetadata: string;
      autoGenerateDesc: string;
    };
    danger: {
      title: string;
      desc: string;
      deleteAccount: string;
      deleteConfirm: string;
    };
  };
  modals: {
    upload: {
      title: string;
      dragDropTitle: string;
      dragDropSubtitle: string;
      chooseFile: string;
      supportedFormats: string;
      maxSizeLabel: string;
      selectFormatWarning: string;
    };
    uploadProgress: {
      title: string;
      uploading: string;
      processing: string;
      optimizing: string;
      completed: string;
      cancelUpload: string;
    };
    split: {
      title: string;
      originalVideo: string;
      splitOptions: string;
      cutsCount: string;
      formatAspect: string;
      generateCuts: string;
      processingCuts: string;
      cutsCreatedSuccess: string;
    };
    scheduleModal: {
      title: string;
      selectVideo: string;
      selectPlatforms: string;
      publicationDate: string;
      publicationTime: string;
      captionLabel: string;
      captionPlaceholder: string;
      hashtagsLabel: string;
      generateWithAI: string;
      confirmSchedule: string;
      scheduling: string;
      successMessage: string;
    };
    aiMetadata: {
      title: string;
      subtitle: string;
      videoContext: string;
      toneLabel: string;
      generateBtn: string;
      generating: string;
      suggestedTitles: string;
      suggestedCaptions: string;
      suggestedHashtags: string;
      applyToVideo: string;
      appliedSuccess: string;
    };
    videoPlayer: {
      title: string;
      details: string;
      duration: string;
      resolution: string;
      size: string;
      splitAction: string;
      scheduleAction: string;
    };
  };
  login: {
    badge: string;
    loginTitle: string;
    loginSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    loginBtn: string;
    registerBtn: string;
    loggingIn: string;
    registering: string;
    demoAccess: string;
    fillDemoData: string;
    noAccount: string;
    hasAccount: string;
    createAccountLink: string;
    loginLink: string;
    copyright: string;
    termsLink: string;
    privacyLink: string;
  };
}
