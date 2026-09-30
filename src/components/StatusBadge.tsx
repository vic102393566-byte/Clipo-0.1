import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Share2,
  XCircle
} from 'lucide-react';
import { PublicationStatus, SocialPlatform } from '../types';

export const getStatusDisplay = (status: PublicationStatus) => {
  switch (status) {
    case 'agendado':
      return {
        label: 'Agendado',
        colorClass: 'text-[#F97316] bg-[#F97316]/15 border-[#F97316]/30',
        dotClass: 'bg-[#F97316]',
        icon: Clock,
      };
    case 'processando':
      return {
        label: 'Processando',
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        dotClass: 'bg-amber-400 animate-pulse',
        icon: Loader2,
      };
    case 'publicado':
      return {
        label: 'Publicado',
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        dotClass: 'bg-emerald-400',
        icon: CheckCircle2,
      };
    case 'falhou':
      return {
        label: 'Falhou',
        colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        dotClass: 'bg-rose-500',
        icon: XCircle,
      };
    default:
      return {
        label: 'Agendado',
        colorClass: 'text-slate-400 bg-white/[0.05] border-white/[0.1]',
        dotClass: 'bg-slate-400',
        icon: Clock,
      };
  }
};

export const StatusBadge: React.FC<{ status: PublicationStatus; showIcon?: boolean }> = ({
  status,
  showIcon = true,
}) => {
  const conf = getStatusDisplay(status);
  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${conf.colorClass}`}
    >
      {showIcon && (
        <Icon className={`h-3 w-3 ${status === 'processando' ? 'animate-spin' : ''}`} />
      )}
      <span>{conf.label}</span>
    </span>
  );
};

export const PlatformBadge: React.FC<{ platform: SocialPlatform }> = ({ platform }) => {
  switch (platform) {
    case 'tiktok':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          TikTok
        </span>
      );
    case 'instagram':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
          Reels
        </span>
      );
    case 'youtube':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Shorts
        </span>
      );
    case 'linkedin':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          LinkedIn
        </span>
      );
    default:
      return <span className="text-[11px] text-slate-400">{platform}</span>;
  }
};
