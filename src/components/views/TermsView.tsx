import React from 'react';
import {
  FileText,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Share2,
  Video,
  Clock,
  HelpCircle,
  Scissors
} from 'lucide-react';

interface TermsViewProps {
  onNavigate?: (path: string) => void;
}

export const TermsView: React.FC<TermsViewProps> = ({ onNavigate }) => {
  const handleGoHome = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/');
    } else {
      window.location.href = '/';
    }
  };

  const handleGoPrivacy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/privacidade');
    } else {
      window.location.href = '/privacidade';
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-[#F97316]/30 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#27272A] bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <a
            href="/"
            onClick={handleGoHome}
            className="flex items-center gap-2.5 transition hover:opacity-90"
            title="Ir para a página inicial do Clipo"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white shadow-md shadow-[#F97316]/20">
              <Scissors className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Clipo</span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/privacidade"
              onClick={handleGoPrivacy}
              className="text-xs font-medium text-[#FDBA74] hover:text-white transition hidden sm:inline-block"
            >
              Política de Privacidade
            </a>
            <a
              href="/"
              onClick={handleGoHome}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#151515] border border-[#27272A] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#F97316]/50 hover:bg-[#1E1E1E] transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#F97316]" />
              <span>Acessar o Clipo</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        {/* Header Title Banner */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-1 text-xs font-medium text-[#F97316] mb-4">
            <FileText className="h-3.5 w-3.5" />
            <span>Documento Oficial de Uso</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Termos de Serviço do Clipo
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#FDBA74]">
            Última atualização: 01 de outubro de 2026 · Versão 1.2
          </p>
          <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
            Bem-vindo ao <strong>Clipo</strong>. Ao utilizar nossa plataforma web, serviços de gerenciamento de mídia, ferramentas de corte de vídeo e agendamento para redes sociais, você concorda expressamente em vincular-se aos presentes Termos de Serviço. Leia atentamente este documento antes de usar a plataforma.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* 1. Visão Geral e Aceitação */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">1</span>
              <span>Visão Geral e Aceitação dos Termos</span>
            </h2>
            <p>
              O <strong>Clipo</strong> é uma aplicação de software desenvolvida para auxiliar criadores de conteúdo, editores e agências na gestão, adaptação de formato (como proporção 9:16), organização e agendamento de publicações de vídeos curtos em redes sociais conectadas pelo próprio usuário.
            </p>
            <p>
              Ao criar uma conta, conectar suas redes sociais ou utilizar qualquer recurso do Clipo, você confirma ter pelo menos 18 anos de idade (ou a maioridade legal em sua jurisdição), plena capacidade civil e concordância irrestrita com estes Termos de Serviço e com a nossa Política de Privacidade.
            </p>
          </section>

          {/* 2. Serviços Oferecidos */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">2</span>
              <span>Descrição dos Serviços</span>
            </h2>
            <p>O Clipo disponibiliza funcionalidades que incluem:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>Upload e armazenamento temporário de arquivos de vídeo em nuvem;</li>
              <li>Ferramenta de recorte e divisão de vídeos longos em múltiplos cortes no formato vertical 9:16;</li>
              <li>Assistência na organização de títulos, descrições e hashtags informativas;</li>
              <li>Calendário e fila de agendamento de postagens;</li>
              <li>Publicação automatizada em plataformas parceiras por meio de autorização direta do usuário (OAuth 2.0).</li>
            </ul>
            <p className="text-xs text-[#FDBA74]">
              O Clipo não garante aumento de visualizações, retenção, monetização ou alcance orgânico em nenhuma rede social. Nossa plataforma atua exclusivamente como ferramenta técnica de produtividade e publicação.
            </p>
          </section>

          {/* 3. Integração com Terceiros e APIs Oficiais */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">3</span>
              <span>Integrações com Plataformas de Terceiros e APIs</span>
            </h2>
            <p>
              O Clipo conecta-se a serviços externos através de suas interfaces de programação de aplicações (APIs) oficiais e protocolos de autorização segura (OAuth 2.0):
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5">
                <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                  TikTok Developer API
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                  Utiliza a TikTok Direct Post API v2 oficial. O usuário deve cumprir as Diretrizes da Comunidade e os Termos de Serviço do TikTok.
                </p>
              </div>
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5">
                <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  YouTube Data API
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                  Sujeito aos Termos de Serviço do YouTube e à Política de Privacidade do Google para postagem de Shorts e vídeos longos.
                </p>
              </div>
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5">
                <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-pink-500"></span>
                  Meta Graph API
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                  Para autenticação de contas creator/comerciais no Instagram conforme os Termos da Plataforma Meta.
                </p>
              </div>
            </div>
            <p>
              <strong>Isenção de Afiliação:</strong> O Clipo é uma ferramenta independente e não possui vínculo corporativo, parceria exclusiva, patrocínio ou endosso por parte de TikTok Inc., ByteDance Ltd., Google LLC ou Meta Platforms Inc.
            </p>
            <p>
              Você pode desconectar suas contas de redes sociais do Clipo a qualquer momento através do painel de Contas Conectadas ou revogar as permissões diretamente nos painéis de segurança de cada plataforma correspondente.
            </p>
          </section>

          {/* 4. Propriedade Intelectual e Responsabilidade pelo Conteúdo */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">4</span>
              <span>Propriedade Intelectual e Conteúdo do Usuário</span>
            </h2>
            <p>
              <strong>Seu Conteúdo Permanece Seu:</strong> O Clipo não reivindica qualquer direito de propriedade sobre os vídeos, áudios, imagens ou textos que você envia para a plataforma. Você mantém 100% da titularidade de seus direitos autorais.
            </p>
            <p>
              <strong>Licença Limitada de Operação:</strong> Você concede ao Clipo uma licença estritamente técnica, mundial, temporária e não exclusiva exclusivamente para processar, converter, armazenar e transmitir seu conteúdo para as redes sociais que você autorizar expressamente.
            </p>
            <p>
              <strong>Declaração de Direitos:</strong> Ao carregar ou agendar vídeos, você declara e garante que:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>Possui todas as autorizações, licenças, direitos autorais e direitos de imagem sobre o conteúdo e trilhas sonoras;</li>
              <li>O conteúdo não viola marcas registradas, patentes, segredos comerciais ou direitos de personalidade de terceiros;</li>
              <li>O conteúdo não incita violência, discriminação, discursos de ódio, assédio, nudez não autorizada ou práticas ilegais;</li>
              <li>O conteúdo respeita rigorosamente as Diretrizes de Comunidade de cada plataforma onde será veiculado.</li>
            </ul>
          </section>

          {/* 5. Contas de Usuário e Segurança */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">5</span>
              <span>Contas de Acesso e Responsabilidades</span>
            </h2>
            <p>
              Você é o único responsável por manter a confidencialidade de sua senha de acesso e pelo controle das sessões ativas. Qualquer atividade realizada a partir de suas credenciais será considerada de sua responsabilidade.
            </p>
            <p>
              Caso identifique qualquer uso não autorizado de sua conta ou vulnerabilidade de segurança, você concorda em notificar imediatamente a equipe do Clipo através de nossos canais de atendimento.
            </p>
          </section>

          {/* 6. Planos, Limites e Cancelamento */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">6</span>
              <span>Limites de Armazenamento e Planos de Assinatura</span>
            </h2>
            <p>
              O Clipo oferece planos com diferentes cotas de armazenamento em nuvem, limites mensais de processamento de vídeos e número máximo de canais conectados.
            </p>
            <p>
              Ao atingir 100% da cota contratada, novos uploads e cortes automáticos poderão ser pausados até a liberação de espaço pelo usuário ou realização de upgrade de plano. Você pode encerrar sua conta a qualquer momento na aba de Configurações.
            </p>
          </section>

          {/* 7. Limitação de Responsabilidade */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">7</span>
              <span>Disponibilidade e Isenção de Garantias</span>
            </h2>
            <p>
              Os serviços do Clipo são disponibilizados "como estão" e "conforme disponíveis". Embora envidemos os melhores esforços para assegurar alta disponibilidade e segurança:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>Não nos responsabilizamos por instabilidades ou bloqueios operacionais causados por APIs externas de redes sociais;</li>
              <li>Não respondemos por penalidades, desmonetizações ou suspensões aplicadas por plataformas terceiras contra os perfis dos usuários;</li>
              <li>Recomendamos a manutenção de backups locais dos seus arquivos originais.</li>
            </ul>
          </section>

          {/* 8. Contato e Informações Institucionais */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">8</span>
              <span>Informações Institucionais e Contato</span>
            </h2>
            <p>
              Dúvidas, sugestões ou notificações formais sobre estes Termos de Serviço podem ser enviadas diretamente aos nossos canais de suporte:
            </p>
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4 text-xs space-y-1.5 font-mono text-[#FDBA74]">
              <p><strong className="text-white">Aplicação:</strong> Clipo (Plataforma Web de Edição e Agendamento de Vídeos)</p>
              <p><strong className="text-white">Responsável Legal / Operador:</strong> [Razão Social / Nome do Desenvolvedor: Clipo Tecnologia]</p>
              <p><strong className="text-white">E-mail de Suporte:</strong> [E-mail de Contato: suporte@clipo.app]</p>
              <p><strong className="text-white">Website Oficial:</strong> https://clipo-0-1.vercel.app</p>
            </div>
          </section>
        </div>

        {/* Footer Navigation Back */}
        <div className="mt-12 pt-8 border-t border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FDBA74]">
          <div className="flex items-center gap-4">
            <a
              href="/privacidade"
              onClick={handleGoPrivacy}
              className="text-[#F97316] hover:underline"
            >
              Consultar Política de Privacidade →
            </a>
          </div>
          <p>© 2026 Clipo · Todos os direitos reservados.</p>
        </div>
      </main>
    </div>
  );
};
