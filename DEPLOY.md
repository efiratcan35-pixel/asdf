# Production Deployment (Docker)

Bu proje `api` (NestJS) + `portal` (Next.js) olarak Docker ile birlikte deploy edilir.

## 1) Sunucu Hazırlık

1. Linux VPS acin (Ubuntu 22.04+).
2. Docker ve Compose kurun.
3. Repo'yu sunucuya kopyalayin.

## 2) Env Hazirla

1. Kopyalayin:
```bash
cp .env.prod.example .env.prod
```
2. `.env.prod` icini doldurun:
- `JWT_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_BASE_URL`
- `NEXT_PUBLIC_API_BASE`
- SMTP degerleri (mail gonderecekseniz)

## 3) Build + Run

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## 4) Kontrol

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f portal
```

## 5) SSL + Domain

- Portal: `3000`
- API: `3002`

Canli ortamda Nginx/Caddy ile reverse proxy yapip:
- `https://your-domain.com` -> `portal:3000`
- `https://api.your-domain.com` -> `api:3002`

## Notlar

- SQLite dosyasi `api/prisma/dev.db` icinde tutulur (volume ile kalicidir).
- Yuklenen dosyalar `api/uploads`, diger json datalar `api/data` altinda kalicidir.
- Guncelleme icin:
```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

