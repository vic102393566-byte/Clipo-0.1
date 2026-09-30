import React, { useState } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText,
  Loader2,
  Lock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { PlanConfig, PlanTier } from '../types';

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: PlanConfig;
  currentPlanId: PlanTier;
  onConfirmPayment: (planId: PlanTier, paymentMethod: 'cartao' | 'pix' | 'boleto') => Promise<void>;
}

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
  isOpen,
  onClose,
  selectedPlan,
  currentPlanId,
  onConfirmPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'pix' | 'boleto'>('cartao');
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>('mensal');

  if (!isOpen) return null;

  const isUpgrade = currentPlanId === 'basico' || (currentPlanId === 'pro' && selectedPlan.id === 'premium');
  const isDowngrade = currentPlanId === 'premium' || (currentPlanId === 'pro' && selectedPlan.id === 'basico');

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirmPayment(selectedPlan.id, paymentMethod);
      setIsProcessing(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#27272A] bg-[#151515] shadow-2xl overflow-hidden my-8">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] px-6 py-4 bg-[#0A0A0A]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Confirmação de Assinatura</h3>
              <p className="text-[11px] text-[#FDBA74]">
                {isUpgrade ? 'Upgrade de plano imediato' : isDowngrade ? 'Alteração de plano' : 'Assinatura do plano selecionado'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#151515] hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* Plan Summary Card */}
          <div className="rounded-xl border border-[#F97316]/40 bg-[#0A0A0A] p-4.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#F97316] uppercase tracking-wider">
                  Plano Selecionado
                </span>
                <h4 className="text-lg font-extrabold text-white mt-0.5">Plano {selectedPlan.name}</h4>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-bold text-white tabular-nums">
                  {selectedPlan.priceMonthly}
                </span>
                <span className="text-xs text-[#FDBA74] block">/ mês</span>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[#27272A] pt-3 text-xs text-[#FDBA74]">
              {selectedPlan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate text-white">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-white block mb-2">
              Forma de pagamento para assinatura:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cartao')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-medium transition ${
                  paymentMethod === 'cartao'
                    ? 'border-[#F97316] bg-[#F97316]/15 text-white ring-1 ring-[#F97316]'
                    : 'border-[#27272A] bg-[#0A0A0A] text-[#FDBA74] hover:bg-[#151515] hover:text-white'
                }`}
              >
                <CreditCard className="h-4 w-4 mb-1 text-[#F97316]" />
                <span>Cartão</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-medium transition ${
                  paymentMethod === 'pix'
                    ? 'border-[#F97316] bg-[#F97316]/15 text-white ring-1 ring-[#F97316]'
                    : 'border-[#27272A] bg-[#0A0A0A] text-[#FDBA74] hover:bg-[#151515] hover:text-white'
                }`}
              >
                <QrCode className="h-4 w-4 mb-1 text-[#F97316]" />
                <span>PIX</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('boleto')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-medium transition ${
                  paymentMethod === 'boleto'
                    ? 'border-[#F97316] bg-[#F97316]/15 text-white ring-1 ring-[#F97316]'
                    : 'border-[#27272A] bg-[#0A0A0A] text-[#FDBA74] hover:bg-[#151515] hover:text-white'
                }`}
              >
                <FileText className="h-4 w-4 mb-1 text-[#F97316]" />
                <span>Boleto</span>
              </button>
            </div>
          </div>

          {/* Payment Notice / Security reassurance */}
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 text-[11px] text-[#FDBA74] flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Estrutura de pagamento pronta:</span>
              <p className="mt-0.5">
                Nenhum valor real será debitado do seu cartão no momento. Ao clicar em <strong>"Confirmar e Ativar Plano"</strong>, o webhook de confirmação é processado e sua assinatura passa para status <strong>Ativa</strong> com os novos limites imediatos.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-[#27272A] bg-[#0A0A0A] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl border border-[#27272A] bg-[#151515] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processando ativação...</span>
              </>
            ) : (
              <>
                <span>Confirmar e Ativar Plano</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
