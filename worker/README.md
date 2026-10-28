# Clipo Video Worker (FFmpeg + Google Cloud Speech no Cloud Run)

Serviço independente para renderização, corte de vídeos e transcrição automática de legendas com IA (`.vtt`, `.srt`, `.json`) utilizando FFmpeg, Google Cloud Speech-to-Text e Node.js em contêineres gerenciados.

---

## 1. Por que este serviço existe?

O frontend do Clipo está hospedado na Vercel (arquitetura Serverless/Edge), ideal para entrega rápida de páginas e APIs leves. No entanto, tarefas de processamento de mídia com **FFmpeg** e transcrição de áudio possuem características específicas:
- Dependem de binários nativos do sistema operacional (`ffmpeg` e `ffprobe`).
- Podem consumir mais tempo de execução e memória RAM para vídeos de 50 MB a vários GB.
- Devem isolar o consumo de CPU da máquina do usuário final.
- Precisam de credenciais de serviço restritas ao servidor (ex: Supabase Service Role e Google Cloud Speech).

O **Google Cloud Run** resolve isso com:
1. **Contêineres com FFmpeg completo e Node.js** (via Dockerfile).
2. **Escala até zero (Scale-to-Zero)**: custo zero quando nenhum vídeo estiver sendo processado.
3. **Plano Gratuito generoso**: até 2 milhões de requisições e horas de computação gratuitas mensais na Google Cloud.
4. **Isolamento de Segurança**: a chave `SUPABASE_SERVICE_ROLE_KEY` e credenciais Google ficam restritas ao Cloud Run, nunca expostas ao frontend ou ao navegador.

---

## 2. Funcionalidades do Worker

### A. Divisão e Corte de Vídeos com FFmpeg
- `POST /api/videos/split` (Inicia renderização de partes)
- `GET /api/videos/split-progress/:jobId` (Polling de progresso)
- `POST /api/videos/cancel-split/:jobId` (Cancelamento imediato)

### B. Legendas Automáticas com Google Cloud Speech-to-Text
- `POST /api/videos/subtitles` ou `/api/videos/subtitles/generate` (Inicia extração de áudio e transcrição)
- `GET /api/videos/subtitles-progress/:jobId` ou `/api/videos/subtitles/progress/:jobId` (Polling de progresso)
- `POST /api/videos/cancel-subtitles/:jobId` ou `/api/videos/subtitles/cancel/:jobId` (Cancelamento imediato)
- `GET /api/videos/speech-status` (Diagnóstico de configuração do Speech-to-Text)

---

## 3. Proteções de Segurança Implementadas

1. **Autenticação Obrigatória Supabase Auth em Todos os Endpoints**:
   - O cabeçalho `Authorization: Bearer <access_token>` é verificado com `supabase.auth.getUser(token)`. Requisições sem token válido são imediatamente bloqueadas com HTTP 401.

2. **Identidade Inviolável do Servidor**:
   - O `userId` é extraído exclusivamente do token verificado (`req.user.id`).
   - Se o navegador tentar enviar um `userId` diferente no corpo da requisição, ela é rejeitada com HTTP 403 Forbidden.

3. **Eliminação de URLs Externas e Prevenção de SSRF**:
   - O worker **NÃO aceita URLs arbitrárias**.
   - Aceita unicamente `storagePath` apontando para o bucket privado `clipo-videos`.
   - O caminho deve obrigatoriamente iniciar com `{authenticated_userId}/`, bloqueando acesso a vídeos de qualquer outro usuário.

4. **Controle Rigoroso de Acesso a Trabalhos**:
   - Consultas de progresso e ordens de cancelamento verificam a posse do trabalho (`job.userId === req.user.id`). Usuários não autorizados recebem HTTP 403 Forbidden.

5. **Sanitização contra Command Injection e Process Isolation (`spawn`)**:
   - Comandos FFmpeg e ffprobe não utilizam interpolação em shell (`exec`).
   - Binários são invocados via `child_process.spawn` com lista de argumentos separados.
   - Processos são iniciados com `detached: true` no Linux, permitindo encerramento confiável da árvore de processos inteira (`killProcessTree` com `-pid`).

6. **Validação Rigorosa de Parâmetros e Proteção contra DoS**:
   - `chunkSeconds`: restrito a números inteiros entre 10 e 3600 segundos.
   - Limite de tamanho de arquivo: máximo de 500 MB por vídeo.
   - Limite de duração: máximo de 3 horas (10.800 segundos).
   - Limite de partes: máximo de 30 partes por divisão.
   - Validação de faixa de áudio no vídeo antes de transcrever.

7. **Limites de Concorrência e Retenção de Estado**:
   - Máximo de 3 trabalhos simultâneos por container.
   - Máximo de 1 trabalho simultâneo por usuário (evita duplicação acidental).
   - Trabalhos cancelados ou finalizados permanecem na memória por 5 minutos com status explícito, garantindo que o polling do frontend não receba erro 404 abrupto.

8. **Isolamento de Diretórios Temporários e Limpeza Segura**:
   - Cada trabalho utiliza uma pasta dedicada `/tmp/clipo-jobs/{jobId}`.
   - Em caso de erro ou cancelamento, apenas os arquivos parciais daquele `jobId` são removidos do Supabase Storage.
   - **O vídeo original nunca é tocado ou modificado.**

9. **Política Restritiva de CORS**:
   - Proibido o uso de `*` como padrão.
   - Whitelist padrão restrita ao domínio oficial (`https://clipo-0-1.vercel.app`) e desenvolvimento local (`http://localhost:3000`).

---

## 4. Como Funciona a Geração de Legendas

1. **Validação e Download**:
   O worker faz o download seguro do vídeo diretamente do Supabase Storage (`storagePath`).
2. **Inspeção com FFprobe**:
   Verifica tamanho, duração e confirma se há stream de áudio (`hasAudio`).
3. **Extração de Áudio com FFmpeg**:
   Converte a faixa sonora para FLAC mono a 16.000 Hz, formato padrão recomendado pelo Google Cloud Speech.
4. **Transcrição em Chunks com Timestamps por Palavra**:
   - Para vídeos curtos (< 50s), faz a transcrição direta.
   - Para vídeos longos, particiona em blocos de 45 segundos, transcreve com `enableWordTimeOffsets: true` e `languageCode: pt-BR`, ajustando o deslocamento temporal (`offset`) com precisão de milissegundos.
5. **Geração de Formatos Sincronizados**:
   - `.vtt` (WebVTT para uso nativo na tag `<track>` do player HTML5 / Clipo)
   - `.srt` (SubRip para download e editores como Premiere / CapCut)
   - `.json` (Estrutura com palavras, tempos e texto completo para edição no navegador)
6. **Upload Seguro no Supabase**:
   Salva os 3 arquivos em `${userId}/videos/subtitles/${jobId}/` no bucket privado `clipo-videos` e retorna Signed URLs válidas por 7 dias.

---

## 5. Variáveis de Ambiente Necessárias (Cloud Run)

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta do servidor (Cloud Run define como 8080) | `8080` |
| `SUPABASE_URL` | URL do seu projeto Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço secreta do Supabase (NUNCA expor no frontend) | `eyJh...` |
| `ALLOWED_ORIGIN` | Domínios autorizados para CORS (separados por vírgula) | `https://clipo-0-1.vercel.app,http://localhost:3000` |
| `TEMP_DIR` | Diretório temporário para processamento | `/tmp/clipo-jobs` |
| `GOOGLE_CREDENTIALS_JSON` | *(Opcional)* Credenciais da Service Account Google Cloud em JSON string | `{"type":"service_account",...}` |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(Opcional)* Caminho do arquivo JSON de credenciais | `/caminho/service-account.json` |

> **Dica no Cloud Run**: Se você criar a Service Account do Cloud Run com a permissão `roles/speech.client`, o contêiner se autentica automaticamente sem precisar definir `GOOGLE_APPLICATION_CREDENTIALS` nem `GOOGLE_CREDENTIALS_JSON`!

---

## 6. Como Executar e Testar

### Compilação do Worker:
```bash
cd worker
npm run lint    # Verifica erros de tipagem com TypeScript
npm run build   # Compila para dist/
```

### Inicialização em Desenvolvimento:
```bash
cd worker
npm run dev
```

### Inicialização em Produção:
```bash
cd worker
npm start
```
