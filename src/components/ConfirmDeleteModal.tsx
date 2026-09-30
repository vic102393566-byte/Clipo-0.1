import React from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  videoTitle: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  videoTitle,
  isDeleting = false,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#151515] p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Excluir vídeo definitivamente?
              </h3>
              <p className="text-xs text-zinc-400">Esta ação não poderá ser desfeita</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (!isDeleting) onCancel();
            }}
            disabled={isDeleting}
            className="rounded-lg p-1 text-zinc-400 hover:bg-[#27272A] hover:text-white transition disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 text-xs">
          <p className="text-zinc-300">
            Você está prestes a excluir o vídeo:
          </p>
          <p className="mt-1 font-semibold text-white break-words">
            "{videoTitle}"
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-rose-300/90">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>
              O arquivo original em <code className="text-zinc-300">media/uploads</code> e todos os cortes derivados em <code className="text-zinc-300">media/cuts</code> serão removidos do servidor.
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#27272A] bg-[#222225] px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-[#2e2e33] hover:text-white transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition active:scale-[0.98] disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Sim, excluir vídeo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
