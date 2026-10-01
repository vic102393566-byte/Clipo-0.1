import React from 'react';
import {
  Shield,
  Lock,
  Eye,
  Key,
  Database,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Share2,
  FileCheck,
  Server,
  Scissors
} from 'lucide-react';

interface PrivacyViewProps {
  onNavigate?: (path: string) => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ onNavigate }) => {
  const handleGoHome = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/');
    } else {
      window.location.href = '/';
    }
  };

  const handleGoTerms = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/termos');
    } else {
      window.location.href = '/termos';
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
              href="/termos"
              onClick={handleGoTerms}
              className="text-xs font-medium text-[#FDBA74] hover:text-white transition hidden sm:inline-block"
            >
              Termos de Serviço
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
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 mb-4">
            <Shield className="h-3.5 w-3.5" />
            <span>Privacidade & Proteção de Dados</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Política de Privacidade do Clipo
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#FDBA74]">
            Última atualização: 01 de outubro de 2026 · Versão 1.2
          </p>
          <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
            A sua privacidade é fundamental para nós. Esta Política de Privacidade descreve de forma clara, transparente e acessível como o <strong>Clipo</strong> coleta, utiliza, processa, armazena e protege seus dados pessoais e as credenciais de suas redes sociais conectadas.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* 1. Informações que Coletamos */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">1</span>
              <span>Dados que Coletamos</span>
            </h2>
            <p>Para fornecer as ferramentas de gestão e publicação de vídeos, coletamos as seguintes categorias de dados:</p>

            <div className="space-y-3 pt-1">
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
                <h3 className="font-semibold text-white text-xs sm:text-sm flex items-center gap-2">
                  <Key className="h-4 w-4 text-[#F97316]" />
                  <span>A. Dados de Cadastro e Conta do Clipo</span>
                </h3>
                <p className="mt-1 text-slate-400 text-xs">
                  Quando você se cadastra, coletamos seu <strong>nome completo</strong>, <strong>endereço de e-mail</strong> e <strong>senha criptografada</strong>. As senhas são processadas utilizando algoritmos seguros de hash de mão única (bcrypt / Supabase Auth) e jamais são armazenadas em texto simples.
                </p>
              </div>

              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
                <h3 className="font-semibold text-white text-xs sm:text-sm flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-cyan-400" />
                  <span>B. Dados de Integração com Redes Sociais (OAuth)</span>
                </h3>
                <p className="mt-1 text-slate-400 text-xs leading-relaxed">
                  Quando você decide conectar uma rede social (TikTok, YouTube ou Instagram), utilizamos o protocolo padrão da indústria <strong>OAuth 2.0</strong>. O Clipo nunca recebe nem armazena a senha da sua rede social. Coletamos estritamente:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300 text-xs pl-1">
                  <li><strong>Identificador único do canal ou perfil</strong> (ex: <code className="font-mono text-[11px] text-[#FDBA74]">open_id</code> no TikTok);</li>
                  <li><strong>Nome público de exibição e nome de usuário</strong> (handle, ex: <code className="font-mono text-[11px] text-[#FDBA74]">@seu_canal</code>);</li>
                  <li><strong>URL da foto de perfil</strong> (avatar público para exibição visual no painel);</li>
                  <li><strong>Número aproximado de seguidores</strong> (para exibição de métricas operacionais);</li>
                  <li><strong>Tokens de autorização segura</strong> (<code className="font-mono text-[11px] text-[#FDBA74]">access_token</code> e <code className="font-mono text-[11px] text-[#FDBA74]">refresh_token</code>), que são criptografados no servidor.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
                <h3 className="font-semibold text-white text-xs sm:text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>C. Arquivos de Mídia e Conteúdo</span>
                </h3>
                <p className="mt-1 text-slate-400 text-xs">
                  Os arquivos de vídeo (.mp4, .mov, .webm) enviados pelo usuário, miniaturas (thumbnails) geradas, legendas e textos de descrição configurados para cada postagem agendada.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Tratamento de Dados do TikTok */}
          <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold">2</span>
              <span>Tratamento Específico de Dados do TikTok (API Oficial v2)</span>
            </h2>
            <p className="text-slate-300">
              O Clipo está em total conformidade com a <strong>TikTok Developer Terms of Service</strong> e a <strong>TikTok API Policy</strong>. A nossa integração utiliza a TikTok Direct Post API para permitir a publicação programada de vídeos curtos.
            </p>
            <div className="space-y-2 rounded-xl bg-[#0A0A0A] border border-cyan-500/20 p-4 text-xs">
              <p className="font-semibold text-cyan-300">Escopos solicitados e finalidade:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300 pl-1">
                <li><code className="font-mono text-[11px] text-cyan-400">user.info.basic</code> e <code className="font-mono text-[11px] text-cyan-400">user.info.profile</code>: Identificar a conta conectada e exibir o nome, avatar e contagem de seguidores no painel do usuário;</li>
                <li><code className="font-mono text-[11px] text-cyan-400">video.upload</code> e <code className="font-mono text-[11px] text-cyan-400">video.publish</code>: Efetuar o upload e a postagem do vídeo agendado na conta do usuário no TikTok quando o horário programado for atingido ou quando o usuário disparar a publicação manualmente.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              <strong>Garantia de Não-Compartilhamento:</strong> O Clipo <strong>NÃO</strong> compartilha, vende, transfere ou comercializa nenhum dado obtido através da API do TikTok com terceiros para fins de publicidade direcionada, corretores de dados (data brokers) ou sistemas externos de rastreamento.
            </p>
          </section>

          {/* 3. Finalidade do Tratamento */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">3</span>
              <span>Finalidades do Uso dos Dados</span>
            </h2>
            <p>Utilizamos os dados coletados estritamente para as seguintes finalidades:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>Autenticar o acesso do usuário à plataforma com segurança;</li>
              <li>Processar, recortar e converter vídeos em formatos compatíveis com celulares (9:16);</li>
              <li>Manter o agendamento de postagens e disparar a publicação na data e hora selecionadas pelo usuário;</li>
              <li>Calcular e apresentar o uso da cota de armazenamento em nuvem e limites do plano contratado;</li>
              <li>Garantir a segurança técnica, prevenir abusos e atender a obrigações legais aplicáveis.</li>
            </ul>
          </section>

          {/* 4. Armazenamento, Segurança e Criptografia */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">4</span>
              <span>Armazenamento e Medidas de Segurança</span>
            </h2>
            <p>
              Adotamos medidas técnicas e organizacionais rigorosas para proteger seus dados contra perda, extravio, acesso não autorizado, alteração ou divulgação indevida:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5">
                <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-[#F97316]" />
                  Comunicação Criptografada (HTTPS/TLS)
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Todas as transferências entre o seu navegador, o servidor do Clipo e as APIs do TikTok são criptografadas por TLS/HTTPS moderno.
                </p>
              </div>
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5">
                <p className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Server className="h-4 w-4 text-emerald-400" />
                  Isolamento de Credenciais
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Tokens de acesso OAuth e chaves de API residem no servidor protegido por variáveis de ambiente e nunca são transmitidos ao frontend público.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Seus Direitos e Exclusão de Dados */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">5</span>
              <span>Seus Direitos: Revogação e Exclusão Total de Dados</span>
            </h2>
            <p>
              Você possui controle total sobre suas informações e contas vinculadas:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-300">
              <li>
                <strong>Desconexão com 1 Clique:</strong> Na aba "Canais Oficiais OAuth", você pode clicar em "Desconectar" a qualquer momento. Isso remove imediatamente os tokens e dados da conta correspondente do servidor do Clipo.
              </li>
              <li>
                <strong>Exclusão de Conta:</strong> Na aba "Configurações", você pode solicitar a exclusão definitiva de sua conta, o que remove irreversivelmente seu perfil, vídeos armazenados, histórico de agendamentos e conexões sociais.
              </li>
              <li>
                <strong>Revogação pelo Provedor:</strong> Você também pode revogar a permissão do Clipo diretamente nas configurações de privacidade do seu aplicativo TikTok (em "Segurança e Permissões" &gt; "Apps e Serviços Autorizados").
              </li>
            </ul>
          </section>

          {/* 6. Compartilhamento com Terceiros */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">6</span>
              <span>Compartilhamento com Terceiros</span>
            </h2>
            <p>
              Não comercializamos nem compartilhamos seus dados com terceiros, exceto:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
              <li>Com a plataforma do TikTok (ByteDance Ltd.) exclusivamente para executar a publicação de vídeos que você agendou e aprovou;</li>
              <li>Com provedores essenciais de infraestrutura de nuvem contratados para hospedar o sistema (ex: Vercel, Supabase), que operam sob rigorosos acordos de processamento de dados e confidencialidade;</li>
              <li>Quando exigido por ordem judicial ou disposição legal expressa.</li>
            </ul>
          </section>

          {/* 7. Contato do Encarregado de Dados (DPO) */}
          <section className="rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316] text-xs font-bold">7</span>
              <span>Contato do Encarregado de Proteção de Dados (DPO)</span>
            </h2>
            <p>
              Para exercer seus direitos de titular dos dados (acesso, correção, portabilidade ou exclusão), ou para esclarecer dúvidas sobre esta Política de Privacidade, entre em contato com nosso canal dedicado:
            </p>
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4 text-xs space-y-1.5 font-mono text-[#FDBA74]">
              <p><strong className="text-white">Aplicação:</strong> Clipo (Gerenciamento e Publicação de Mídia)</p>
              <p><strong className="text-white">Controlador de Dados:</strong> [Razão Social / Nome do Desenvolvedor: Clipo Tecnologia]</p>
              <p><strong className="text-white">E-mail de Privacidade e DPO:</strong> [E-mail de Privacidade: privacidade@clipo.app]</p>
              <p><strong className="text-white">Website Oficial:</strong> https://clipo-0-1.vercel.app</p>
            </div>
          </section>
        </div>

        {/* Footer Navigation Back */}
        <div className="mt-12 pt-8 border-t border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FDBA74]">
          <div className="flex items-center gap-4">
            <a
              href="/termos"
              onClick={handleGoTerms}
              className="text-[#F97316] hover:underline"
            >
              Consultar Termos de Serviço →
            </a>
          </div>
          <p>© 2026 Clipo · Todos os direitos reservados.</p>
        </div>
      </main>
    </div>
  );
};
