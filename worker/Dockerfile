# ==============================================================================
# Clipo Video Worker - Dockerfile para Google Cloud Run
# Processamento de vídeo profissional com Node.js + FFmpeg
# ==============================================================================

FROM node:20-slim AS builder

WORKDIR /app

# Instalar FFmpeg e dependências de compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de dependências
COPY package.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte e configuração de build
COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript para JavaScript nativo
RUN npm run build

# ==============================================================================
# Estágio de Produção (Imagem final otimizada)
# ==============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Instalar FFmpeg completo e ffprobe para processamento
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -version \
  && ffprobe -version

ENV NODE_ENV=production
ENV PORT=8080

# Copiar package.json e instalar apenas dependências de produção
COPY package.json ./
RUN npm install --omit=dev

# Copiar build compilado do estágio anterior
COPY --from=builder /app/dist ./dist

# Criar diretório temporário para jobs de vídeo com permissões adequadas
RUN mkdir -p /tmp/clipo-jobs && chmod 777 /tmp/clipo-jobs

# Porta padrão exigida pelo Google Cloud Run
EXPOSE 8080

# Iniciar o servidor worker
CMD ["node", "dist/index.js"]
