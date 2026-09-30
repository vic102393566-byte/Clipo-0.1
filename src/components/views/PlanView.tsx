import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Zap,
  ArrowRight,
  HardDrive,
  Share2,
  Scissors,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { PlanTier, PlanConfig } from '../../types';
import { PLANS_CONFIG } from '../../services/storageService';

interface PlanViewProps {
  storageUsage?: {
    totalUsedBytes: number;
    totalLimitBytes: number;
    usedFormatted: string;
    limitFormatted: string;
    percentUsed: number;
    isOverLimit: boolean;
    availableBytes: number;
  };
  activePlan?: PlanTier;
  onSwitchPlan?: (planId: PlanTier) => void;
  connectedAccountsCount?: number;
  videosCount?: number;
  onBack?: () => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
  storageUsage,
  activePlan = 'pro',
  onSwitchPlan,
  connectedAccountsCount = 1,
  videosCount = 0,
  onBack,
}) => {
  const currentPlan = PLANS_CONFIG[activePlan] || PLANS_CONFIG.pro;
  const displayUsed = storageUsage?.usedFormatted || '0,0 GB';
  const displayLimit = storageUsage?.limitFormatted || currentPlan.labelLimit;
  const displayPercent = storageUsage?.percentUsed ?? 0;
  const isOverLimit = storageUsage?.isOverLimit ?? false;
  const videoPercent = Math.min(100, Math.round((videosCount / currentPlan.monthlyVideoLimit) * 100));

  const [upgradeSuccessMsg, setUpgradeSuccessMsg] = useState<string | null>(null);

  const handleSelectPlan = (tier: PlanTier) => {
    if (tier === activePlan) return;
    if (onSwitchPlan) {
      onSwitchPlan(tier);
      setUpgradeSuccessMsg(`Seu plano foi atualizado com sucesso para ${PLANS_CONFIG[tier].name}! Os novos limites de armazenamento e canais já estão ativos.`);
      setTimeout(() => setUpgradeSuccessMsg(null), 4000);
    }
  };

  const planTiers: PlanTier[] = ['basico', 'pro', 'premium'];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Back Navigation Button */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDBA74] hover:text-white transition py-1.5 px-3 -ml-1 rounded-xl hover:bg-[#151515] border border-transparent hover:border-[#27272A] cursor-pointer group"
            title="Voltar para a tela anterior"
          >
            <span className="text-base font-bold leading-none transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Voltar</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />
            <span className="text-xs font-semibold text-[#F97316] uppercase tracking-wider">
              Gestão de Assinatura
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">Meu plano</h2>
          <p className="text-xs text-[#FDBA74]">
            Acompanhe o uso de armazenamento em tempo real e os limites da sua assinatura
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-1.5 font-mono text-xs text-[#FDBA74]">
            Plano atual: <strong className="text-white">{currentPlan.name}</strong> ({currentPlan.priceMonthly}/mês)
          </div>
        </div>
      </div>

      {/* Success notification upon plan switch */}
      {upgradeSuccessMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{upgradeSuccessMsg}</span>
          </div>
          <button
            onClick={() => setUpgradeSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Warning banner if storage limit is exceeded */}
      {isOverLimit && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200 shadow-xl">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-100">Limite de Armazenamento Atingido!</h4>
            <p className="mt-0.5 text-rose-300/90 leading-relaxed">
              Você atingiu o teto de {currentPlan.labelLimit} do plano {currentPlan.name}. Novos uploads de vídeo e cortes automáticos estão bloqueados até você fazer upgrade ou liberar espaço.
            </p>
          </div>
        </div>
      )}

      {/* Active Plan Overview Card */}
      <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316]/20 border border-[#F97316]/30 text-[#F97316]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Plano {currentPlan.name}</h3>
                <span className="rounded-full bg-[#F97316]/20 border border-[#F97316]/40 px-2.5 py-0.5 text-[10px] font-semibold text-[#F97316]">
                  Assinatura Ativa
                </span>
              </div>
              <p className="text-xs text-[#FDBA74] mt-0.5">
                {currentPlan.priceMonthly} / mês · Sem fidelidade
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] text-[#FDBA74] block">Armazenamento disponível</span>
            <span className="font-mono text-sm font-semibold text-white">
              {displayUsed} <span className="text-[#FDBA74] font-normal">/</span> {displayLimit}
            </span>
          </div>
        </div>

        {/* Meters for Plan Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Storage Gauge */}
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[#FDBA74]">
                <HardDrive className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Armazenamento</span>
              </span>
              <span className="font-mono text-white font-semibold tabular-nums">
                {displayPercent}%
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#151515] border border-[#27272A]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  displayPercent >= 90
                    ? 'bg-rose-500'
                    : displayPercent >= 70
                    ? 'bg-amber-400'
                    : 'bg-[#F97316]'
                }`}
                style={{ width: `${Math.min(displayPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#FDBA74]">
              <span>{displayUsed} em uso</span>
              <span>Limite: {currentPlan.labelLimit}</span>
            </div>
          </div>

          {/* Videos Uploaded / Created Gauge */}
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[#FDBA74]">
                <Scissors className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Vídeos / Mês</span>
              </span>
              <span className="font-mono text-white font-semibold tabular-nums">
                {videoPercent}%
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#151515] border border-[#27272A]">
              <div
                className="h-full rounded-full bg-[#F97316] transition-all duration-500"
                style={{ width: `${Math.min(videoPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#FDBA74]">
              <span>{videosCount} vídeos criados</span>
              <span>Limite: {currentPlan.labelVideoLimit}</span>
            </div>
          </div>

          {/* Social Accounts Gauge */}
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[#FDBA74]">
                <Share2 className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Contas sociais</span>
              </span>
              <span className="font-mono text-white font-semibold tabular-nums">
                {connectedAccountsCount} / {currentPlan.maxSocialAccounts}
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#151515] border border-[#27272A]">
              <div
                className="h-full rounded-full bg-[#F97316] transition-all duration-500"
                style={{
                  width: `${Math.min((connectedAccountsCount / currentPlan.maxSocialAccounts) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#FDBA74]">
              <span>
                {currentPlan.maxSocialAccounts - connectedAccountsCount > 0
                  ? `${currentPlan.maxSocialAccounts - connectedAccountsCount} vaga(s) livre(s)`
                  : 'Limite atingido'}
              </span>
              <span>
                {currentPlan.maxSocialAccounts === 1
                  ? '1 conta social'
                  : `Até ${currentPlan.maxSocialAccounts} contas`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Cards Comparison */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Escolha o plano ideal para seu estúdio</h3>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {planTiers.map((tier) => {
            const plan = PLANS_CONFIG[tier];
            const isCurrent = tier === activePlan;
            const isPopular = tier === 'pro';

            return (
              <div
                key={tier}
                className={`relative flex flex-col justify-between rounded-2xl border p-6 transition ${
                  isCurrent
                    ? 'border-[#F97316] bg-[#151515] shadow-xl shadow-[#F97316]/10 ring-1 ring-[#F97316]'
                    : isPopular
                    ? 'border-[#F97316]/40 bg-[#151515] hover:border-[#F97316]/70'
                    : 'border-[#27272A] bg-[#151515] hover:border-[#F97316]/40'
                }`}
              >
                {/* Badges */}
                {isCurrent && (
                  <div className="absolute -top-3 left-6 rounded-full bg-[#F97316] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    Plano Ativo
                  </div>
                )}
                {!isCurrent && isPopular && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                    Mais Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-white">{plan.name}</h4>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
                      {plan.priceMonthly}
                    </span>
                    <span className="text-xs text-[#FDBA74]">/ mês</span>
                  </div>

                  {/* Plan Features */}
                  <div className="mt-6 space-y-3 border-t border-[#27272A] pt-4 text-xs text-[#FDBA74]">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-white">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upgrade / Current Action Button */}
                <div className="mt-8 pt-4 border-t border-[#27272A]">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-[#F97316]/20 border border-[#F97316]/40 py-2.5 text-center text-xs font-semibold text-[#F97316] cursor-default"
                    >
                      Plano em uso
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(tier)}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition active:scale-[0.98] ${
                        tier === 'premium' || tier === 'pro'
                          ? 'bg-[#F97316] text-white shadow-lg shadow-[#F97316]/25 hover:bg-[#EA580C]'
                          : 'border border-[#27272A] bg-[#0A0A0A] text-white hover:border-[#F97316]/40 hover:bg-[#151515]'
                      }`}
                    >
                      <span>Fazer upgrade</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
