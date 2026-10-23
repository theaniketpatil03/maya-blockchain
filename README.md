# Maya Blockchain Explorer

Frontend/backend deployment for the cloned Maya/Borlaug blockchain explorer. The UI reads from this backend only; the backend reads from MongoDB populated by `maya-scraper`.

## Services

- `mongodb`: MongoDB data store
- `backend`: FastAPI API server
- `frontend`: React/Vite UI served by Nginx

## Run

```bash
cp .env.example .env
docker compose up -d --build
```

Open:

```text
http://localhost:3000
```

Backend API:

```text
http://localhost:8000/api/health
```

MongoDB is not published on the host. The backend reaches it as `mongodb:27017` on the Compose network, using the username and password in `.env`.

If the homepage is blank, check backend can resolve Mongo:

```bash
docker compose ps
docker exec maya-blockchain-backend getent hosts mongodb
curl http://localhost:8000/api/stats/latest
```

If Mongo is disconnected from the Compose network, recreate the stack (volume data is kept):

```bash
docker compose down
docker compose up -d
```

## Restore Scraped Data

If the scraper produced a Mongo archive:

```bash
docker cp maya_explorer.archive maya-blockchain-mongodb:/tmp/maya_explorer.archive
docker exec maya-blockchain-mongodb mongorestore \
  -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
  --archive=/tmp/maya_explorer.archive --drop
```

## Main API Routes

- `GET /api/stats/latest`
- `GET /api/transactions`
- `GET /api/transactions/{blockNumber}/{hash}`
- `GET /api/blocks`
- `GET /api/blocks/{number}`
- `GET /api/accounts`
- `GET /api/accounts/{signer}/transactions`
- `GET /api/events/{id}`
- `GET /api/inherents/{id}`
- `GET /api/logs/{id}`
- `GET /api/identities/{did}`
- `GET /api/search?q={term}`

## Notes

The app is deployable separately from the scraper. For production, point both the scraper and this app to the same MongoDB instance or restore the scraper dump into this MongoDB volume.
