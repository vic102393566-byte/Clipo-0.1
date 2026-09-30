import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Film,
  Check,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ScheduledPublication, SocialPlatform } from '../types';
import { formatFileSize, extractVideoMetadata } from '../utils/videoUtils';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPublication: (pub: ScheduledPublication) => void;
}

export const UploadVideoModal: React.FC<UploadVideoModalProps> = ({
  isOpen,
  onClose,
  onAddPublication,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    'tiktok',
    'instagram',
    'youtube',
  ]);
  const [scheduledDate, setScheduledDate] = useState('2026-09-24');
  const [scheduledTime, setScheduledTime] = useState('19:00');
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [simulatedFileName, setSimulatedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const togglePlatform = (p: SocialPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((item) => item !== p));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const [selectedDuration, setSelectedDuration] = useState('1:00');
  const [selectedFileSize, setSelectedFileSize] = useState('15.4 MB');

  const processSelectedFile = async (file: File) => {
    setSimulatedFileName(file.name);
    setSelectedFileSize(formatFileSize(file.size));
    try {
      const meta = await extractVideoMetadata(file);
      if (meta.duration) setSelectedDuration(meta.duration);
    } catch {}
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setTitle(cleanName);
      setDescription('Dicas essenciais gravadas para engajamento nos primeiros 3 segundos.');
    }
  };

  const handleSimulateFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
      return;
    }
    const names = [
      'corte_podcast_ep42_final_9x16.mp4',
      'hack_produtividade_reels_v2.mp4',
      'workflow_criativo_short.mp4'
    ];
    const picked = names[Math.floor(Math.random() * names.length)];
    setSimulatedFileName(picked);
    setSelectedDuration('1:00');
    setSelectedFileSize('15.4 MB');
    if (!title) {
      setTitle('Novo corte viral para redes sociais');
      setDescription('Dicas essenciais gravadas para engajamento nos primeiros 3 segundos.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newPub: ScheduledPublication = {
      id: `pub-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Sem legenda configurada',
      thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
      duration: selectedDuration,
      scheduledTime: scheduledTime,
      scheduledDateLabel: '24 Set',
      dateISO: scheduledDate,
      platforms: selectedPlatforms,
      status: 'agendado',
      aspectRatio: '9:16',
      fileSize: selectedFileSize,
    };

    onAddPublication(newPub);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl rounded-2xl border border-[#27272A] bg-[#151515] p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316]">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Enviar e agendar vídeo</h2>
              <p className="text-xs text-[#FDBA74]">Distribuição inteligente nos canais configurados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Upload Drop Zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processSelectedFile(file);
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) {
                processSelectedFile(dropped);
              } else {
                handleSimulateFileSelect();
              }
            }}
            onClick={handleSimulateFileSelect}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
              isDragging
                ? 'border-[#F97316] bg-[#F97316]/10'
                : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#F97316]/50 hover:bg-[#151515]'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] group-hover:scale-105 transition">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div className="mt-3">
              {simulatedFileName ? (
                <div className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                  <Check className="h-4 w-4" />
                  <span>Arquivo carregado: {simulatedFileName}</span>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-white">
                    Clique para selecionar ou arraste o arquivo aqui
                  </p>
                  <p className="mt-1 text-[11px] text-[#FDBA74]">
                    MP4, MOV ou WebM até 2 GB · Formato 9:16 recomendado
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74]">
              Título do vídeo
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 3 Hacks de Produtividade que Todo Criador Precisa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          {/* Description / Caption input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#FDBA74]">
                Legenda e hashtags
              </label>
              <button
                type="button"
                onClick={() => {
                  setDescription(
                    'Você já sabia dessas dicas? Comente qual fez mais sentido para a sua rotina! 🔥 #produtividade #creator #tech #shorts #reels'
                  );
                }}
                className="flex items-center gap-1 text-[11px] font-medium text-[#F97316] hover:text-[#9333EA]"
              >
                <Sparkles className="h-3 w-3" />
                <span>Gerar sugestão inteligente</span>
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Adicione o texto que acompanhará a publicação em todas as redes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          {/* Channels Selector */}
          <div>
            <label className="block text-xs font-medium text-[#FDBA74] mb-2">
              Publicar simultaneamente em:
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'tiktok' as SocialPlatform, label: 'TikTok', color: 'hover:border-slate-400' },
                { id: 'instagram' as SocialPlatform, label: 'Instagram Reels', color: 'hover:border-pink-500' },
                { id: 'youtube' as SocialPlatform, label: 'YouTube Shorts', color: 'hover:border-red-500' },
                { id: 'linkedin' as SocialPlatform, label: 'LinkedIn', color: 'hover:border-blue-500' },
              ].map((item) => {
                const isSelected = selectedPlatforms.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePlatform(item.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium transition ${
                      isSelected
                        ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                        : 'border-[#27272A] bg-[#0A0A0A] text-[#FDBA74]'
                    } ${item.color}`}
                  >
                    <span>{item.label}</span>
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-md ${
                        isSelected ? 'bg-[#F97316] text-white' : 'border border-[#27272A]'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-[#FDBA74]">
                Data do agendamento
              </label>
              <div className="relative mt-1.5">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none font-mono tabular-nums [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#FDBA74]">
                Horário ideal
              </label>
              <div className="relative mt-1.5">
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none font-mono tabular-nums [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* AI Subtitles toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#F97316]" />
              <div>
                <p className="text-xs font-medium text-white">Legendas automáticas dinâmicas</p>
                <p className="text-[11px] text-[#FDBA74]">Transcreve áudio com destaque nas palavras-chave</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoCaptions(!autoCaptions)}
              className={`h-5 w-9 rounded-full p-0.5 transition ${
                autoCaptions ? 'bg-[#F97316]' : 'bg-[#27272A]'
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  autoCaptions ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98]"
            >
              Agendar publicação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
