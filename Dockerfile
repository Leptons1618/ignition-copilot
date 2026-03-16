FROM node:20-alpine AS client-build
WORKDIR /app

COPY demo-app/client/package*.json demo-app/client/
RUN npm --prefix demo-app/client ci

COPY demo-app/client demo-app/client
RUN npm --prefix demo-app/client run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY demo-app/server/package*.json demo-app/server/
RUN npm --prefix demo-app/server ci --omit=dev

COPY demo-app/server demo-app/server
COPY --from=client-build /app/demo-app/client/dist /app/demo-app/client/dist

EXPOSE 3001
WORKDIR /app/demo-app/server

CMD ["node", "index.js"]
