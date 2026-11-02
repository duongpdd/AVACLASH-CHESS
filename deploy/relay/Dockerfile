FROM node:22-bookworm-slim AS build
ENV CI=true
WORKDIR /source
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY contracts/package.json ./contracts/package.json
COPY web/package.json ./web/package.json
COPY packages/shared ./packages/shared
COPY packages/relay ./packages/relay
COPY tsconfig.json ./tsconfig.json
RUN pnpm --filter @avaclash/relay... install --frozen-lockfile
RUN pnpm --filter @avaclash/shared build && pnpm --filter @avaclash/relay build
RUN pnpm --filter @avaclash/relay deploy --prod /opt/relay

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 RESULTS_DIR=/data/results
WORKDIR /app
COPY --from=build --chown=node:node /opt/relay ./
RUN mkdir -p /data/results && chown -R node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
