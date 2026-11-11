# Imagen base oficial con el parche de seguridad crítico de Node.js (Octubre 2026)
# Mitiga CVE-2026-111497 (Brotli RCE/DoS), CVE-2026-105482 (DNS), CVE-2026-105483/106069 (TLS)
FROM node:22.23.4-alpine

WORKDIR /app

# Hardening: Asegurar permisos para usuario no privilegiado 'node'
RUN chown -R node:node /app

COPY --chown=node:node package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY --chown=node:node packages ./packages
COPY --chown=node:node apps ./apps

# Ejecutar como usuario no-root para prevenir escalamiento de privilegios
USER node

# Hardening: Forzar entorno de producción por defecto
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "--experimental-strip-types", "apps/api/src/server.ts"]
