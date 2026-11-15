import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/views/DashboardView';
import { VideosView } from './components/views/VideosView';
import { ScheduleView } from './components/views/ScheduleView';
import { CalendarView } from './components/views/CalendarView';
import { ConnectedAccountsView } from './components/views/ConnectedAccountsView';
import { StorageView } from './components/views/StorageView';
import { PlanView } from './components/views/PlanView';
import { SettingsView } from './components/views/SettingsView';
import { LoginView } from './components/views/LoginView';
import { TermsView } from './components/views/TermsView';
import { PrivacyView } from './components/views/PrivacyView';
import { UploadVideoModal } from './components/UploadVideoModal';
import { UploadProgressModal } from './components/UploadProgressModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SplitVideoModal } from './components/SplitVideoModal';
import { ScheduleModal } from './components/ScheduleModal';
import { AIMetadataModal } from './components/AIMetadataModal';
import { BellRing, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { isValidVideoFile } from './utils/videoUtils';
import {
  publishPublicationMultiPlatform,
  syncSchedulesWithServer,
  fetchServerSchedules,
} from './services/publishService';
import {
  registerClipoServiceWorker,
  subscribeToNotificationStream,
  showBrowserNotificationFallback,
} from './services/pushNotificationService';
import {
  UserProfileSettings,
  getStoredUserProfile,
  saveStoredUserProfile,
  isUserLoggedIn,
  logoutUser,
  applyCustomThemeColors,
  clearCustomThemeColors,
  PRESET_THEMES,
  getDefaultCustomColors,
  LIGHT_MODE_COLORS,
} from './services/userSettingsService';
import { useTheme } from './theme/ThemeContext';
import { authService, DEFAULT_DEMO_USER, mapSupabaseUserToClipoUser } from './services/authService';
import { supabase, isSupabaseConfigured, ensureSupabaseConfigured, isUUID } from './services/supabaseClient';

import {
  TabType,
  ScheduledPublication,
  SocialAccount,
  SocialPlatform,
  VideoItem,
  PlanTier,
  User,
  AIMetadata,
  PublishNotificationEvent
} from './types';
import {
  initialConnectedAccounts,
  initialScheduledPublications,
  initialVideosList
} from './data/mockData';
import {
  getStoredVideosMetadata,
  saveVideosMetadata,
  getStoredPlan,
  saveStoredPlan,
  getStoredPublications,
  saveStoredPublications,
  getStoredSocialAccounts,
  saveStoredSocialAccounts,
  calculateStorageUsage,
  canUploadFileSize,
  currentStorageProvider,
  isCurrentUserDemo,
  PLANS_CONFIG
} from './services/storageService';

export default function App() {
  const { theme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [tabHistory, setTabHistory] = useState<TabType[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile navigation history handler
  const handleNavigateTab = useCallback((targetTab: TabType) => {
    setActiveTab((prev) => {
      if (prev === targetTab) return prev;
      setTabHistory((h) => [...h, prev]);
      return targetTab;
    });
    setIsSidebarOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Back button handler: returns to previous tab or falls back to 'dashboard'
  const handleGoBack = useCallback(() => {
    setTabHistory((prev) => {
      if (prev.length > 0) {
        const nextHistory = [...prev];
        const lastTab = nextHistory.pop()!;
        setActiveTab(lastTab);
        return nextHistory;
      } else {
        setActiveTab('dashboard');
        return [];
      }
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Authentication session state
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => authService.isAuthenticated());

  // Public standalone route detection for /termos and /privacidade
  const checkPublicRoute = (rawPath?: string): 'termos' | 'privacidade' | null => {
    if (typeof window === 'undefined') return null;
    const path = (rawPath || window.location.pathname || '')
      .toLowerCase()
      .split('?')[0]
      .split('#')[0]
      .trim()
      .replace(/\/+$/, '');

    if (path === '/termos' || path.endsWith('/termos') || path === '/termos.html') {
      return 'termos';
    }
    if (path === '/privacidade' || path.endsWith('/privacidade') || path === '/privacidade.html') {
      return 'privacidade';
    }
    return null;
  };

  const [currentPublicRoute, setCurrentPublicRoute] = useState<'termos' | 'privacidade' | null>(() => checkPublicRoute());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPublicRoute(checkPublicRoute());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigatePublic = useCallback((targetPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', targetPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setCurrentPublicRoute(checkPublicRoute(targetPath));
  }, []);

  const currentUserId = currentUser?.id;
  const isDemo = isCurrentUserDemo(currentUserId);

  // Active Plan Tier ('pro' or 'agency' or 'free')
  const [activePlan, setActivePlan] = useState<PlanTier>(() => getStoredPlan(currentUserId));

  // User Profile state (persisted in localStorage)
  const [userProfile, setUserProfile] = useState<UserProfileSettings>(() => getStoredUserProfile(currentUserId));

  // Aplicação reativa das cores e tema pré-definido do utilizador autenticado com prioridade para o Modo Claro
  useEffect(() => {
    if (isAuthenticated && currentUserId && (userProfile?.customColors || userProfile?.selectedTheme)) {
      const themeId = userProfile.selectedTheme || 'clipo-original';
      const colors = userProfile.customColors || PRESET_THEMES[themeId]?.colors || getDefaultCustomColors();
      applyCustomThemeColors(colors, themeId, resolvedTheme);
    } else {
      if (resolvedTheme === 'light') {
        applyCustomThemeColors(LIGHT_MODE_COLORS, 'light-clean', 'light');
      } else {
        clearCustomThemeColors();
      }
    }
  }, [isAuthenticated, currentUserId, userProfile?.customColors, userProfile?.selectedTheme, resolvedTheme]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadProgressOpen, setIsUploadProgressOpen] = useState(false);
  const [quotaOrFormatError, setQuotaOrFormatError] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Video viewer & publication viewer states
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<VideoItem | null>(null);
  const [previewPub, setPreviewPub] = useState<ScheduledPublication | null>(null);

  // Split Video Modal state
  const [videoToSplit, setVideoToSplit] = useState<VideoItem | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  // Dedicated Schedule Modal state
  const [videoToSchedule, setVideoToSchedule] = useState<VideoItem | null>(null);
  const [isNewScheduleModalOpen, setIsNewScheduleModalOpen] = useState(false);

  // AI Metadata Generation Modal state
  const [videoForAI, setVideoForAI] = useState<VideoItem | null>(null);
  const [isAIMetadataModalOpen, setIsAIMetadataModalOpen] = useState(false);

  const [publications, setPublications] = useState<ScheduledPublication[]>(() => {
    const saved = getStoredPublications(currentUserId);
    if (saved !== null) return saved;
    return isDemo ? initialScheduledPublications : [];
  });
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>(() => {
    const saved = getStoredSocialAccounts(currentUserId);
    if (saved !== null) return saved;
    return initialConnectedAccounts;
  });

  // Push & SSE real-time notification toast state
  const [activePushToast, setActivePushToast] = useState<PublishNotificationEvent | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedSignatureRef = useRef<string>('');
  const publicationsRef = useRef<ScheduledPublication[]>(publications);
  publicationsRef.current = publications;

  // Register Service Worker and listen for notification clicks to navigate directly to the publication
  useEffect(() => {
    registerClipoServiceWorker();
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_PUBLICATION') {
        setActiveTab(event.data.tab || 'agendamentos');
        if (event.data.publicationId) {
          const matched = publicationsRef.current.find((p) => p.id === event.data.publicationId);
          if (matched) setPreviewPub(matched);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, []);

  // Auto-dismiss live push toast
  useEffect(() => {
    if (!activePushToast) return;
    const timer = window.setTimeout(() => {
      setActivePushToast(null);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [activePushToast]);

  // Connect real-time SSE stream & hydrate background-published schedules from server
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    let isCancelled = false;

    fetchServerSchedules(currentUserId).then((serverPubs) => {
      if (isCancelled || !serverPubs || serverPubs.length === 0) return;
      setPublications((prev) => {
        const serverMap = new Map(serverPubs.map((sp) => [sp.id, sp]));
        let changed = false;
        const merged = prev.map((localPub) => {
          const serverMatch = serverMap.get(localPub.id);
          if (
            serverMatch &&
            (serverMatch.status !== localPub.status ||
              serverMatch.errorMessage !== localPub.errorMessage ||
              serverMatch.publishedAt !== localPub.publishedAt)
          ) {
            changed = true;
            return {
              ...localPub,
              status: serverMatch.status,
              errorMessage: serverMatch.errorMessage,
              platformResults: serverMatch.platformResults ?? localPub.platformResults,
              publishedAt: serverMatch.publishedAt ?? localPub.publishedAt,
              pushNotified: serverMatch.pushNotified ?? localPub.pushNotified,
            };
          }
          return localPub;
        });
        return changed ? merged : prev;
      });
    });

    const unsubscribeStream = subscribeToNotificationStream(
      currentUserId,
      (event) => {
        if (seenNotificationIdsRef.current.has(event.id)) return;
        seenNotificationIdsRef.current.add(event.id);

        const allowSuccess = userProfile?.notifications?.publishSuccess ?? true;
        const allowFailure = userProfile?.notifications?.publishFailure ?? true;
        if (
          (event.type === 'publish_success' && !allowSuccess) ||
          (event.type === 'publish_failure' && !allowFailure)
        ) {
          return;
        }

        setActivePushToast(event);
        showBrowserNotificationFallback(event.title, event.body);
      },
      (updatedPub) => {
        if (!updatedPub?.id) return;
        setPublications((prev) =>
          prev.map((p) =>
            p.id === updatedPub.id
              ? {
                  ...p,
                  status: updatedPub.status || p.status,
                  errorMessage: updatedPub.errorMessage,
                  platformResults: updatedPub.platformResults ?? p.platformResults,
                  publishedAt: updatedPub.publishedAt ?? p.publishedAt,
                  pushNotified: updatedPub.pushNotified ?? p.pushNotified,
                }
              : p
          )
        );
      }
    );

    return () => {
      isCancelled = true;
      unsubscribeStream();
    };
  }, [
    isAuthenticated,
    currentUserId,
    userProfile?.notifications?.publishSuccess,
    userProfile?.notifications?.publishFailure,
  ]);

  // Sync schedules with backend background dispatcher so due posts trigger social APIs + Push Notifications
  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;
    const signature = JSON.stringify(
      publications.map((p) => ({
        id: p.id,
        status: p.status,
        dateISO: p.dateISO,
        scheduledTime: p.scheduledTime,
        platforms: p.platforms,
        videoUrl: p.videoUrl,
        storagePath: p.storagePath,
        title: p.title,
      }))
    );
    if (signature === lastSyncedSignatureRef.current) return;
    lastSyncedSignatureRef.current = signature;

    const timer = window.setTimeout(() => {
      syncSchedulesWithServer(currentUserId, publications);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, currentUserId, publications]);

  // Persist social accounts state per user
  useEffect(() => {
    if (currentUserId) {
      saveStoredSocialAccounts(connectedAccounts, currentUserId);
    }
  }, [connectedAccounts, currentUserId]);

  // Videos list initialized from user-scoped persistent storage or default mock
  const [videosList, setVideosList] = useState<VideoItem[]>(() => {
    const saved = getStoredVideosMetadata(currentUserId);
    if (saved !== null) {
      return saved;
    }
    return isDemo ? initialVideosList : [];
  });

  // Re-hydrate video URLs from storage provider on load if needed
  useEffect(() => {
    let isCancelled = false;

    async function rehydrateVideoUrls() {
      let videosModified = false;
      const updatedVideos = await Promise.all(
        videosList.map(async (v) => {
          if (!v.videoUrl || v.storagePath) {
            const url = await currentStorageProvider.getVideoUrl(v.id, v.storagePath);
            if (url && url !== v.videoUrl) {
              videosModified = true;
              return { ...v, videoUrl: url };
            }
          }
          return v;
        })
      );

      if (!isCancelled && videosModified) {
        setVideosList(updatedVideos);
      }

      // Re-hydrate publication video URLs using storagePath, videoId or storage provider
      let pubsModified = false;
      const updatedPubs = await Promise.all(
        publications.map(async (pub) => {
          // If already has working videoUrl and no storagePath, keep as is
          let currentUrl = pub.videoUrl;
          let currentPath = pub.storagePath;

          // If publication references a video from library, backfill storagePath if missing
          if (!currentPath && pub.videoId) {
            const parentVideo = updatedVideos.find((v) => v.id === pub.videoId);
            if (parentVideo) {
              if (parentVideo.storagePath) {
                currentPath = parentVideo.storagePath;
              }
              if (!currentUrl && parentVideo.videoUrl) {
                currentUrl = parentVideo.videoUrl;
              }
            }
          }

          if (currentPath) {
            const refreshedUrl = await currentStorageProvider.getVideoUrl(pub.videoId || pub.id, currentPath);
            if (refreshedUrl && refreshedUrl !== currentUrl) {
              pubsModified = true;
              return { ...pub, videoUrl: refreshedUrl, storagePath: currentPath };
            }
          }

          if (currentUrl !== pub.videoUrl || currentPath !== pub.storagePath) {
            pubsModified = true;
            return { ...pub, videoUrl: currentUrl, storagePath: currentPath };
          }

          return pub;
        })
      );

      if (!isCancelled && pubsModified) {
        setPublications(updatedPubs);
      }
    }

    rehydrateVideoUrls();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Save videos metadata whenever videosList changes
  useEffect(() => {
    if (currentUserId) {
      saveVideosMetadata(videosList, currentUserId);
    }
  }, [videosList, currentUserId]);

  // Save publications whenever they change
  useEffect(() => {
    if (currentUserId) {
      saveStoredPublications(publications, currentUserId);
    }
  }, [publications, currentUserId]);

  // Save active plan whenever it changes
  const handleSwitchPlan = (plan: PlanTier) => {
    setActivePlan(plan);
    saveStoredPlan(plan, currentUserId);
  };

  // Real disk storage state from /api/storage/usage
  const [serverStorageBytes, setServerStorageBytes] = useState<number | null>(null);

  const fetchServerStorage = useCallback(async () => {
    try {
      const res = await fetch('/api/storage/usage');
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.totalUsedBytes === 'number') {
          setServerStorageBytes(data.totalUsedBytes);
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar uso real de armazenamento no servidor:', err);
    }
  }, []);

  useEffect(() => {
    fetchServerStorage();
  }, [fetchServerStorage]);

  // Compute live storage usage dynamically considering only real files in media/uploads and media/cuts
  const storageUsage = calculateStorageUsage(videosList, activePlan, serverStorageBytes ?? undefined);
  const currentPlanConfig = PLANS_CONFIG[activePlan];

  // Opens upload flow modal
  const handleOpenUploadPicker = () => {
    setQuotaOrFormatError(null);
    setUploadFile(null);
    setIsUploadProgressOpen(true);
  };

  // Handles file selection with format and plan quota checks
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format (MP4, MOV, WebM)
    if (!isValidVideoFile(file)) {
      setQuotaOrFormatError(
        `O formato do arquivo "${file.name}" não é suportado. Por favor, envie um vídeo nos formatos MP4, MOV ou WebM.`
      );
      return;
    }

    // Validate plan storage limits using real media storage calculation
    const quotaCheck = canUploadFileSize(file.size, videosList, activePlan, serverStorageBytes ?? undefined);
    if (!quotaCheck.allowed) {
      setQuotaOrFormatError(quotaCheck.message || 'Limite de armazenamento do plano atingido.');
      return;
    }

    setQuotaOrFormatError(null);
    setUploadFile(file);
    setIsUploadProgressOpen(true);
  };

  // Callback when upload progress completes
  const handleUploadComplete = (newVideo: VideoItem) => {
    setVideosList((prev) => [newVideo, ...prev]);
    fetchServerStorage();
  };

  // Opens automatic split video modal (checks storage limit)
  const handleOpenSplitVideo = (video: VideoItem) => {
    if (storageUsage.isOverLimit) {
      setQuotaOrFormatError(
        `Limite de armazenamento do plano ${currentPlanConfig.name} atingido (${storageUsage.limitFormatted}). Para dividir e gerar novas partes, faça upgrade do plano na aba "Meu plano" ou exclua mídias antigas.`
      );
      return;
    }
    setVideoToSplit(video);
    setIsSplitModalOpen(true);
  };

  // Saves generated video cut parts as independent items in "Meus vídeos" while keeping original
  const handleSplitComplete = (newParts: VideoItem[]) => {
    setVideosList((prev) => {
      const updated = [...newParts, ...prev];
      if (currentUserId) {
        saveVideosMetadata(updated, currentUserId);
      }
      return updated;
    });
    fetchServerStorage();
    setActiveTab('videos');
  };

  // Delete video from "Meus vídeos", server storage (media/uploads & media/cuts) and local cache
  const handleDeleteVideo = async (id: string) => {
    const videoToDelete = videosList.find((v) => v.id === id);

    // Identifica cortes derivados na lista caso esteja excluindo um vídeo original
    const isCutPart = id.startsWith('vid-part-');
    const cleanBaseTitle = videoToDelete?.title ? videoToDelete.title.replace(/\.[^/.]+$/, '').trim() : '';
    const relatedParts = !isCutPart && cleanBaseTitle
      ? videosList.filter((v) => v.id !== id && (
          v.title.startsWith(`${cleanBaseTitle} - Parte `) ||
          (videoToDelete?.title && v.title.startsWith(`${videoToDelete.title} - Parte `)) ||
          (v.videoUrl && videoToDelete?.videoUrl && v.videoUrl.includes(videoToDelete.id))
        ))
      : [];
    const relatedCutUrls = relatedParts.map((p) => p.videoUrl).filter(Boolean);
    const relatedThumbnails = relatedParts.map((p) => p.thumbnail).filter(Boolean);
    const relatedIds = relatedParts.map((p) => p.id);

    try {
      setDeleteErrorMessage(null);

      // 1. Chamar rota DELETE /api/videos/:id no backend para excluir arquivos reais e cortes
      const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoToDelete?.videoUrl,
          thumbnail: videoToDelete?.thumbnail,
          title: videoToDelete?.title,
          userId: currentUserId,
          relatedCutUrls,
          relatedThumbnails,
        }),
      });

      // Se retornar 404 (já excluído previamente), trata como sucesso para não travar a interface
      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${response.status} ao excluir vídeo no servidor.`);
      }

      // 2. Limpar do storage provider (Supabase Storage ou IndexedDB)
      try {
        await currentStorageProvider.deleteVideoBinary(id, videoToDelete?.storagePath);
        for (const relPart of relatedParts) {
          await currentStorageProvider.deleteVideoBinary(relPart.id, relPart.storagePath);
        }
      } catch (storageErr) {
        console.warn('Aviso ao remover do storage:', storageErr);
      }

      // 3. Atualizar a lista de vídeos e metadados no localStorage imediatamente
      const idsToRemove = new Set([id, ...relatedIds]);
      setVideosList((prev) => {
        const updated = prev.filter((v) => !idsToRemove.has(v.id));
        if (currentUserId) {
          saveVideosMetadata(updated, currentUserId);
        }
        const hasRealServerVideos = updated.some(
          (v) => v.videoUrl?.includes('/media/uploads') || v.videoUrl?.includes('/media/cuts')
        );
        if (!hasRealServerVideos || updated.length === 0) {
          setServerStorageBytes(0);
        } else {
          fetchServerStorage();
        }
        return updated;
      });

      if (selectedVideoForPlayer && idsToRemove.has(selectedVideoForPlayer.id)) {
        setSelectedVideoForPlayer(null);
      }
    } catch (err: any) {
      console.error('[ERRO NA EXCLUSÃO DO VÍDEO]:', err);
      // Mantém o vídeo na lista e mostra a mensagem real de erro
      setDeleteErrorMessage(err.message || 'Falha ao excluir o vídeo no servidor.');
    }
  };

  // Opens schedule modal for a specific video or generic
  const handleOpenScheduleModal = (video?: VideoItem) => {
    setVideoToSchedule(video || null);
    setIsNewScheduleModalOpen(true);
  };

  // Opens AI metadata generation modal for a video
  const handleOpenAIMetadata = (video: VideoItem) => {
    setVideoForAI(video);
    setIsAIMetadataModalOpen(true);
  };

  // Saves updated video information (title, description, hashtags)
  const handleSaveVideo = (updatedVideo: VideoItem) => {
    setVideosList((prev) => {
      const updated = prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v));
      if (currentUserId) {
        saveVideosMetadata(updated, currentUserId);
      }
      return updated;
    });
    if (selectedVideoForPlayer?.id === updatedVideo.id) {
      setSelectedVideoForPlayer(updatedVideo);
    }
  };

  // Saves generated AI metadata (title, description, hashtags, CTA) to the video in storage
  const handleSaveAIToVideo = (videoId: string, updatedTitle: string, aiData: AIMetadata) => {
    setVideosList((prev) => {
      const updated = prev.map((v) => {
        if (v.id === videoId) {
          return {
            ...v,
            title: updatedTitle,
            description: aiData.description || v.description,
            hashtags: aiData.hashtags || v.hashtags,
            aiMetadata: aiData,
          };
        }
        return v;
      });
      if (currentUserId) {
        saveVideosMetadata(updated, currentUserId);
      }
      return updated;
    });
  };

  // Direct transition from AI generator into the scheduling flow with prefilled data
  const handleScheduleWithAI = (video: VideoItem, aiData: AIMetadata) => {
    handleSaveAIToVideo(video.id, video.title, aiData);
    setVideoToSchedule({
      ...video,
      aiMetadata: aiData,
    });
    setIsNewScheduleModalOpen(true);
  };

  const handleAddPublication = (newPub: ScheduledPublication) => {
    setPublications([newPub, ...publications]);
    setActiveTab('agendamentos');
  };

  const handleDeletePublication = (id: string) => {
    setPublications(publications.filter((p) => p.id !== id));
  };

  const handleUpdateAccount = (platform: SocialPlatform, updatedFields: Partial<SocialAccount> & { connected: boolean }) => {
    setConnectedAccounts((prev) => {
      const updated = prev.map((acc) => {
        if (acc.platform === platform) {
          return {
            ...acc,
            ...updatedFields,
          };
        }
        return acc;
      });
      if (currentUserId) {
        saveStoredSocialAccounts(updated, currentUserId);
      }
      return updated;
    });
  };

  const handleUpdateTikTokAccount = (updatedFields: Partial<SocialAccount> & { connected: boolean }) => {
    handleUpdateAccount('tiktok', updatedFields);
  };

  const handlePublishNow = async (id: string) => {
    const pub = publications.find((p) => p.id === id);
    if (!pub) return;

    setPublications((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'processando', errorMessage: undefined } : p))
    );

    const result = await publishPublicationMultiPlatform(pub, currentUserId || 'default_user', {
      notifyOnSuccess: userProfile?.notifications?.publishSuccess ?? true,
      notifyOnFailure: userProfile?.notifications?.publishFailure ?? true,
    });

    setPublications((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: result.status,
              platformResults: result.platformResults,
              publishedAt: result.publishedAt || p.publishedAt,
              errorMessage: result.success
                ? undefined
                : result.error || 'Falha ao publicar nas redes sociais selecionadas.',
            }
          : p
      )
    );
  };

  const handleToggleConnect = (id: string) => {
    setConnectedAccounts((prev) => {
      const updated = prev.map((acc) =>
        acc.id === id ? { ...acc, connected: !acc.connected } : acc
      );
      if (currentUserId) {
        saveStoredSocialAccounts(updated, currentUserId);
      }
      return updated;
    });
  };

  // Terminate authentication session and redirect to Login
  const handleLogout = async () => {
    clearCustomThemeColors();
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUserProfile(getStoredUserProfile(undefined));
    setConnectedAccounts(initialConnectedAccounts);
  };

  const handleLoginSuccess = useCallback((user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    const userId = user.id;
    const isUserDemo = isCurrentUserDemo(userId);

    const savedVideos = getStoredVideosMetadata(userId);
    setVideosList(savedVideos !== null ? savedVideos : (isUserDemo ? initialVideosList : []));

    const savedPubs = getStoredPublications(userId);
    setPublications(savedPubs !== null ? savedPubs : (isUserDemo ? initialScheduledPublications : []));

    const savedAccounts = getStoredSocialAccounts(userId);
    setConnectedAccounts(savedAccounts !== null ? savedAccounts : initialConnectedAccounts);

    setActivePlan(getStoredPlan(userId));
    setUserProfile(getStoredUserProfile(userId));
    setActiveTab('dashboard');
  }, []);

  // Sincronização em tempo real com o Supabase Auth (restauração de sessão, Google OAuth e listener oficial)
  useEffect(() => {
    let isMounted = true;

    async function initSupabaseSession() {
      await ensureSupabaseConfigured();

      if (isSupabaseConfigured()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isUUID(session.user.id) && isMounted) {
            console.log('[Supabase Auth] Sessão ativa restaurada para UUID:', session.user.id);
            const supaUser = mapSupabaseUserToClipoUser(session.user);
            authService.setSession(supaUser, session.access_token);
            handleLoginSuccess(supaUser);
          } else if (isMounted) {
            // Se Supabase está configurado mas não tem sessão ativa, verifica se há sessão local válida com UUID
            const localSession = authService.getSession();
            if (localSession?.user && isUUID(localSession.user.id)) {
              console.log('[Auth] Restaurando sessão local autorizada com UUID válido:', localSession.user.email);
              handleLoginSuccess(localSession.user);
            } else {
              console.log('[Supabase Auth] Nenhuma sessão Supabase ativa. Solicitando login.');
              authService.clearSession();
              setCurrentUser(null);
              setIsAuthenticated(false);
            }
          }
        } catch (err) {
          console.warn('[App] Erro na restauração inicial de sessão Supabase:', err);
        }
      }
    }

    initSupabaseSession();

    // Listener de mudanças de estado no Supabase Auth (Sign In, Sign Out, Token Refresh, Google OAuth Redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log('[Supabase Auth onAuthStateChange]:', event, session?.user?.id);

      if (session?.user && isUUID(session.user.id)) {
        const supaUser = mapSupabaseUserToClipoUser(session.user);
        authService.setSession(supaUser, session.access_token);
        handleLoginSuccess(supaUser);
      } else if (event === 'SIGNED_OUT') {
        authService.clearSession();
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleLoginSuccess]);

  // Check directly from window.location as well on every render to ensure immediate zero-delay display
  const activePublicRoute = currentPublicRoute || (typeof window !== 'undefined' ? checkPublicRoute() : null);

  // Standalone public routes accessible without login (do not redirect to dashboard)
  if (activePublicRoute === 'termos') {
    return <TermsView onNavigate={handleNavigatePublic} />;
  }

  if (activePublicRoute === 'privacidade') {
    return <PrivacyView onNavigate={handleNavigatePublic} />;
  }

  // If user is currently logged out, display dedicated Login/Register screen
  if (!isAuthenticated || !currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigatePublic} />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--user-bg-main,#0B0F17)] text-[var(--user-text-primary,#F8FAFC)] font-sans transition-colors duration-200">
      {/* Hidden Native File Input for Video Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Format or Storage Limit Error Notification */}
      {quotaOrFormatError && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-2xl border border-rose-500/30 bg-[#151515] p-4 text-xs text-rose-200 shadow-2xl backdrop-blur flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-lg bg-rose-500/20 p-1.5 text-rose-400">
            ⚠️
          </div>
          <div className="flex-1">
            <p className="font-semibold text-rose-100">Limite de Armazenamento</p>
            <p className="mt-0.5 text-rose-300/90 leading-relaxed">{quotaOrFormatError}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  setQuotaOrFormatError(null);
                  setActiveTab('plano');
                }}
                className="rounded-lg bg-[#F97316] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#EA580C] transition"
              >
                Fazer upgrade de plano
              </button>
              <button
                onClick={() => setQuotaOrFormatError(null)}
                className="text-[11px] text-[#FDBA74] hover:text-white"
              >
                Dispensar
              </button>
            </div>
          </div>
          <button
            onClick={() => setQuotaOrFormatError(null)}
            className="text-rose-400 hover:text-white transition p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Delete Error Notification */}
      {deleteErrorMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-2xl border border-rose-500/30 bg-[#151515] p-4 text-xs text-rose-200 shadow-2xl backdrop-blur flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-lg bg-rose-500/20 p-1.5 text-rose-400">
            ⚠️
          </div>
          <div className="flex-1">
            <p className="font-semibold text-rose-100">Erro na exclusão do vídeo</p>
            <p className="mt-0.5 text-rose-300/90 leading-relaxed">{deleteErrorMessage}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => setDeleteErrorMessage(null)}
                className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30 transition"
              >
                Dispensar
              </button>
            </div>
          </div>
          <button
            onClick={() => setDeleteErrorMessage(null)}
            className="text-rose-400 hover:text-white transition p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Real-time Push / Social Publish Notification Banner */}
      {activePushToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all ${
            resolvedTheme === 'light'
              ? activePushToast.type === 'publish_failure'
                ? 'border-rose-200 bg-white text-slate-900'
                : 'border-emerald-200 bg-white text-slate-900'
              : activePushToast.type === 'publish_failure'
              ? 'border-rose-500/30 bg-[#111827]/95 text-slate-100'
              : 'border-emerald-500/30 bg-[#111827]/95 text-slate-100'
          }`}
        >
          <div
            className={`rounded-xl p-2 shrink-0 ${
              activePushToast.type === 'publish_success'
                ? resolvedTheme === 'light'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-500/15 text-emerald-400'
                : activePushToast.type === 'publish_failure'
                ? resolvedTheme === 'light'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-rose-500/15 text-rose-400'
                : resolvedTheme === 'light'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-indigo-500/15 text-indigo-400'
            }`}
          >
            {activePushToast.type === 'publish_success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : activePushToast.type === 'publish_failure' ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <BellRing className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold leading-snug">{activePushToast.title}</p>
            <p
              className={`mt-1 text-[11px] leading-relaxed ${
                resolvedTheme === 'light' ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              {activePushToast.body}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              {activePushToast.publicationId && (
                <button
                  type="button"
                  onClick={() => {
                    const matched = publications.find((p) => p.id === activePushToast.publicationId);
                    setActiveTab('agendamentos');
                    if (matched) setPreviewPub(matched);
                    setActivePushToast(null);
                  }}
                  style={{ backgroundColor: 'var(--user-btn-primary, #6366F1)' }}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 transition cursor-pointer"
                >
                  Ver agendamento
                </button>
              )}
              <button
                type="button"
                onClick={() => setActivePushToast(null)}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg transition cursor-pointer ${
                  resolvedTheme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActivePushToast(null)}
            aria-label="Fechar notificação"
            className={`p-1 rounded-lg transition cursor-pointer ${
              resolvedTheme === 'light'
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation - Hidden drawer by default */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onOpenUpload={handleOpenUploadPicker}
        onLogout={handleLogout}
        storageUsage={storageUsage}
        activePlanTier={currentPlanConfig.name}
        userProfile={userProfile}
      />

      {/* Main Content Area - Full width by default */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 w-full relative">
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          isOpenSidebar={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onOpenUpload={handleOpenUploadPicker}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNavigateTab={handleNavigateTab}
          onGoBack={handleGoBack}
          canGoBack={activeTab !== 'dashboard' || tabHistory.length > 0}
        />

        {/* Scrollable Viewport - pb-24 on mobile ensures bottom navigation bar never covers content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'dashboard' && (
              <DashboardView
                publications={publications}
                connectedAccounts={connectedAccounts}
                videosCount={videosList.length}
                userName={userProfile?.name}
                storageUsage={storageUsage}
                onOpenUpload={handleOpenUploadPicker}
                onSelectPublication={(pub) => setPreviewPub(pub)}
                onDeletePublication={handleDeletePublication}
                onNavigateTab={handleNavigateTab}
              />
            )}

            {activeTab === 'videos' && (
              <VideosView
                videos={videosList}
                onOpenUpload={handleOpenUploadPicker}
                onPreviewVideo={(video) => setSelectedVideoForPlayer(video)}
                onEditVideo={(video) => setSelectedVideoForPlayer(video)}
                onDeleteVideo={handleDeleteVideo}
                onSplitVideo={handleOpenSplitVideo}
                onScheduleVideo={(video) => handleOpenScheduleModal(video)}
                onGenerateAIMetadata={handleOpenAIMetadata}
                isOverLimit={storageUsage.isOverLimit}
                onUpgradeClick={() => handleNavigateTab('plano')}
                planName={currentPlanConfig.name}
                limitFormatted={currentPlanConfig.labelLimit}
              />
            )}

            {activeTab === 'agendamentos' && (
              <ScheduleView
                publications={publications}
                onOpenSchedule={() => handleOpenScheduleModal()}
                onSelectPublication={(pub) => setPreviewPub(pub)}
                onDeletePublication={handleDeletePublication}
              />
            )}

            {activeTab === 'calendario' && (
              <CalendarView
                publications={publications}
                onOpenSchedule={() => handleOpenScheduleModal()}
                onSelectPublication={(pub) => setPreviewPub(pub)}
                onBack={handleGoBack}
              />
            )}

            {activeTab === 'contas' && (
              <ConnectedAccountsView
                accounts={connectedAccounts}
                userId={currentUserId}
                onToggleConnect={handleToggleConnect}
                onUpdateAccount={handleUpdateAccount}
                onUpdateTikTokAccount={handleUpdateTikTokAccount}
                maxSocialAccounts={currentPlanConfig.maxSocialAccounts}
                planName={currentPlanConfig.name}
                onUpgradeClick={() => handleNavigateTab('plano')}
                onBack={handleGoBack}
              />
            )}

            {activeTab === 'armazenamento' && (
              <StorageView
                onUpgradeClick={() => handleNavigateTab('plano')}
                storageUsage={storageUsage}
                planTier={currentPlanConfig.name}
              />
            )}

            {activeTab === 'plano' && (
              <PlanView
                storageUsage={storageUsage}
                activePlan={activePlan}
                onSwitchPlan={handleSwitchPlan}
                connectedAccountsCount={connectedAccounts.filter((a) => a.connected).length}
                videosCount={videosList.length}
                onBack={handleGoBack}
              />
            )}

            {activeTab === 'configuracoes' && (
              <SettingsView
                userId={currentUserId}
                onProfileUpdated={(updated) => {
                  setUserProfile(updated);
                  saveStoredUserProfile(updated, currentUserId);
                }}
                onLogout={handleLogout}
                onBack={handleGoBack}
              />
            )}
          </div>
        </main>

        {/* Mobile Fixed Bottom Navigation Bar (Exclusive to mobile < 768px) */}
        <MobileBottomNav
          activeTab={activeTab}
          onNavigateTab={handleNavigateTab}
          onOpenUpload={handleOpenUploadPicker}
          onOpenMore={() => setIsSidebarOpen((prev) => !prev)}
          isSidebarOpen={isSidebarOpen}
        />
      </div>

      {/* Video Upload Progress Modal (Handles Name, Size, Progress Bar & Upload) */}
      <UploadProgressModal
        isOpen={isUploadProgressOpen}
        file={uploadFile}
        onClose={() => {
          setIsUploadProgressOpen(false);
          setUploadFile(null);
        }}
        onUploadComplete={handleUploadComplete}
        onOpenSplit={handleOpenSplitVideo}
        onScheduleVideo={(video) => handleOpenScheduleModal(video)}
        onNavigateVideos={() => handleNavigateTab('videos')}
      />

      {/* Video Player Modal for Viewing, Editing and Deleting Videos */}
      <VideoPlayerModal
        video={selectedVideoForPlayer}
        onClose={() => setSelectedVideoForPlayer(null)}
        onDeleteVideo={handleDeleteVideo}
        onSaveVideo={handleSaveVideo}
        onOpenSplit={handleOpenSplitVideo}
        onScheduleVideo={(video) => handleOpenScheduleModal(video)}
        onGenerateAIMetadata={handleOpenAIMetadata}
      />

      {/* AI Metadata Generation Modal */}
      <AIMetadataModal
        isOpen={isAIMetadataModalOpen}
        video={videoForAI}
        onClose={() => {
          setIsAIMetadataModalOpen(false);
          setVideoForAI(null);
        }}
        onSaveToVideo={handleSaveAIToVideo}
        onScheduleWithAI={handleScheduleWithAI}
      />

      {/* Automatic Video Split Modal */}
      <SplitVideoModal
        video={videoToSplit}
        isOpen={isSplitModalOpen}
        onClose={() => {
          setIsSplitModalOpen(false);
          setVideoToSplit(null);
        }}
        onSplitComplete={handleSplitComplete}
      />

      {/* Dedicated Scheduling Modal */}
      <ScheduleModal
        isOpen={isNewScheduleModalOpen}
        video={videoToSchedule}
        availableVideos={videosList}
        onClose={() => {
          setIsNewScheduleModalOpen(false);
          setVideoToSchedule(null);
        }}
        onScheduleSubmit={handleAddPublication}
      />

      {/* Schedule / Multi-channel Publication Modal */}
      <UploadVideoModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onAddPublication={handleAddPublication}
      />

      {/* Scheduled Publication Preview Modal */}
      <VideoPreviewModal
        publication={previewPub}
        availableVideos={videosList}
        onClose={() => setPreviewPub(null)}
        onPublishNow={handlePublishNow}
      />
    </div>
  );
}
