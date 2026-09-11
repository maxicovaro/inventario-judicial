FROM node:22-bookworm-slim

ARG MYSQL_SERIES=mysql-8.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && mkdir -p /usr/share/keyrings \
  && curl -fsSL https://repo.mysql.com/RPM-GPG-KEY-mysql-2025 \
    | gpg --dearmor -o /usr/share/keyrings/mysql.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/mysql.gpg] https://repo.mysql.com/apt/debian/ bookworm ${MYSQL_SERIES}" \
    > /etc/apt/sources.list.d/mysql.list \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends mysql-community-client \
  && rm -rf /var/lib/apt/lists/* /root/.gnupg

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
