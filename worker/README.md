# Clipo Video Worker (FFmpeg no Google Cloud Run)

Serviço independente para renderização, corte e processamento de vídeos do Clipo utilizando FFmpeg e Node.js em contêineres gerenciados.

---

## 1. Por que este serviço existe?

O frontend do Clipo está hospedado na Vercel (arquitetura Serverless/Edge), ideal para entrega rápida de páginas e APIs leves. No entanto, tarefas de processamento de mídia com **FFmpeg** possuem características específicas:
- Dependem de binários nativos do sistema operacional (`ffmpeg` e `ffprobe`).
- Podem consumir mais tempo de execução e memória RAM para vídeos de 50 MB a vários GB.
- Devem isolar o consumo de CPU da máquina do usuário final.

O **Google Cloud Run** resolve isso com:
1. **Contêineres com FFmpeg completo** (via Dockerfile).
2. **Escala até zero (Scale-to-Zero)**: custo zero quando nenhum vídeo estiver sendo processado.
3. **Plano Gratuito generoso**: até 2 milhões de requisições e horas de computação gratuitas mensais na Google Cloud.
4. **Isolamento de Segurança**: a chave `SUPABASE_SERVICE_ROLE_KEY` fica restrita ao Cloud Run, nunca exposta ao frontend ou ao navegador.

---

## 2. Proteções de Segurança Implementadas (Auditoria Concluída)

1. **Autenticação Obrigatória Supabase Auth em Todos os Endpoints**:
   - `POST /api/videos/split`
   - `GET /api/videos/split-progress/:jobId`
   - `POST /api/videos/cancel-split/:jobId`
   - O cabeçalho `Authorization: Bearer <access_token>` é verificado com `supabase.auth.getUser(token)`. Requisições sem token válido são imediatamente bloqueadas com HTTP 401.

2. **Identidade Inviolável do Servidor**:
   - O `userId` é extraído exclusivamente do token verificado (`req.user.id`).
   - Se o navegador tentar enviar um `userId` diferente no corpo da requisição, ela é rejeitada com HTTP 403 Forbidden.

3. **Eliminação de URLs Externas e Prevenção de SSRF**:
   - O worker **NÃO aceita URLs arbitrárias**.
   - Aceita unicamente `storagePath` apontando para o bucket privado `clipo-videos`.
   - O caminho deve obrigatoriamente iniciar com `{authenticated_userId}/`, bloqueando acesso a vídeos de qualquer outro usuário.

4. **Controle Rigoroso de Acesso a Trabalhos**:
   - Consultas de progresso (`split-progress/:jobId`) e ordens de cancelamento (`cancel-split/:jobId`) verificam a posse do trabalho (`job.userId === req.user.id`). Usuários não autorizados recebem HTTP 403 Forbidden.

5. **Sanitização contra Command Injection e Process Isolation (`spawn`)**:
   - Comandos FFmpeg e ffprobe não utilizam interpolação em shell (`exec`).
   - Binários são invocados via `child_process.spawn` com lista de argumentos separados.
   - Processos são iniciados com `detached: true` no Linux, permitindo encerramento confiável da árvore de processos inteira (`killProcessTree` com `-pid`).

6. **Validação Rigorosa de Parâmetros e Proteção contra DoS**:
   - `chunkSeconds`: restrito a números inteiros entre 10 e 3600 segundos.
   - Limite de tamanho de arquivo: máximo de 500 MB por vídeo.
   - Limite de duração: máximo de 3 horas (10.800 segundos).
   - Limite de partes: máximo de 30 partes por divisão. Divisões excessivas são rejeitadas.

7. **Limites de Concorrência e Retenção de Estado**:
   - Máximo de 3 trabalhos simultâneos por container.
   - Máximo de 1 trabalho simultâneo por usuário (evita duplicação acidental).
   - Trabalhos cancelados ou finalizados permanecem na memória por 5 minutos com status explícito, garantindo que o polling do frontend não receba erro 404 abrupto.

8. **Isolamento de Diretórios Temporários e Limpeza Segura**:
   - Cada trabalho utiliza uma pasta dedicada `/tmp/clipo-jobs/{jobId}`.
   - Em caso de erro ou cancelamento, apenas os cortes parciais daquele `jobId` são removidos do Supabase Storage.
   - **O vídeo original nunca é tocado ou modificado.**

9. **Política Restritiva de CORS**:
   - Proibido o uso de `*` como padrão.
   - Whitelist padrão restrita ao domínio oficial (`https://clipo-0-1.vercel.app`) e desenvolvimento local (`http://localhost:3000`).

---

## 3. Arquitetura no Cloud Run e Limitações de Estado em Memória

### Importante sobre o Estado dos Trabalhos (`activeJobs`):
- O worker atual armazena o acompanhamento de progresso em memória (`Map<string, ActiveSplitJob>`).
- No Google Cloud Run, cada contêiner é **independente e sem estado (stateless)**:
  - **Instância única (`--max-instances 1`)**: O estado é 100% consistente, pois todas as requisições chegam à mesma máquina.
  - **Múltiplas instâncias (`--max-instances > 1`)**: Se o Cloud Run criar 2 ou mais contêineres, uma requisição de polling pode atingir um contêiner diferente daquele que está processando o vídeo, retornando `"não encontrado nesta instância"`.
  - **Recomendação para a fase inicial de produção**: Configurar `--max-instances 1` (ou `--session-affinity`). Se o volume futuro demandar múltiplas instâncias paralelas, o progresso deve ser persistido em uma tabela Supabase (`video_jobs`) ou Firestore/Redis.
  - **Scale-to-zero e reinicializações**: Se o contêiner for desligado por inatividade pelo Cloud Run durante a ociosidade, o mapa de memória é reiniciado limpo (o que é o comportamento esperado para scale-to-zero).

---

## 4. Variáveis de Ambiente Necessárias (Cloud Run)

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta do servidor (Cloud Run define como 8080) | `8080` |
| `SUPABASE_URL` | URL do seu projeto Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço secreta do Supabase (NUNCA expor no frontend) | `eyJh...` |
| `ALLOWED_ORIGIN` | Domínios autorizados para CORS (separados por vírgula) | `https://clipo-0-1.vercel.app,http://localhost:3000` |
| `TEMP_DIR` | Diretório temporário para processamento | `/tmp/clipo-jobs` |

---

## 5. Como Testar o Worker Localmente

### Opção A: Executar com Node/tsx (requer FFmpeg instalado na máquina)

1. Entre na pasta do worker:
   ```bash
   cd worker
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o arquivo `.env` baseado em `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *(Preencha com sua `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`)*

4. Execute o build e a verificação de tipos:
   ```bash
   npm run lint
   npm run build
   ```

5. Inicie o servidor:
   ```bash
   npm run dev
   ```

6. Verifique o status público:
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8080/api/videos/ffmpeg-status
   ```

7. Teste de proteção contra requisições sem autenticação (deve retornar HTTP 401):
   ```bash
   curl -X POST http://localhost:8080/api/videos/split \
     -H "Content-Type: application/json" \
     -d '{"chunkSeconds": 60, "storagePath": "qualquer/video.mp4"}'
   ```
   *Resposta esperada:* `{"success":false,"error":"Autenticação obrigatória. Forneça o token de acesso do Supabase no cabeçalho Authorization: Bearer <token>."}`

### Opção B: Executar via Docker Localmente

```bash
docker build -t clipo-worker ./worker
docker run -p 8080:8080 --env-file worker/.env clipo-worker
```

---

## 6. Riscos a Serem Resolvidos Antes do Deploy no Cloud Run

1. **Definição de Secrets no Google Secret Manager**:
   - `SUPABASE_SERVICE_ROLE_KEY` deve ser salva como Secret no Cloud Run, não como variável de texto simples.
2. **Definição de Concorrência e Instâncias**:
   - Configurar `--concurrency 2` e `--max-instances 1` na fase inicial para garantir afinidade de memória das requisições de polling.
3. **Timeout do Cloud Run**:
   - Configurar `--timeout 900` (15 minutos) para garantir tempo suficiente para renderizar vídeos de até 500 MB.
