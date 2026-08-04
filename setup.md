# Setup Guide — Maya Blockchain Explorer

Complete step-by-step setup for the three parts of this project: the **scraper**, the **backend API**, and the **frontend UI**, plus **backup and restore**.

---

## 0. What You Are Building

| Component | Folder | Stack | Port |
| --- | --- | --- | --- |
| Scraper | `maya-scraper/` | Python 3.12 + `requests` + `pymongo` | Mongo on `27017` |
| Backend API | `maya-blockchain/backend/` | FastAPI + Uvicorn + PyMongo | `8000` |
| Frontend UI | `maya-blockchain/frontend/` | Vite + React 18 + TypeScript, served by Nginx | `3000` |
| App database | `maya-blockchain/` (compose) | MongoDB 7 | `27018` on host |

Data flow:

```
Borlaug Explorer API  ->  maya-scraper  ->  MongoDB (maya_explorer)  ->  FastAPI backend  ->  React frontend
```

The scraper and the app are deployable independently. They connect either by pointing both at the **same MongoDB**, or by taking a **dump from the scraper Mongo and restoring it into the app Mongo** (covered in Section 5).

> `main.py` and `requirements.txt` in the repo root are the **legacy Selenium scraper**. They are kept for reference only. Use `maya-scraper/` for all real data collection.

---

## 1. Prerequisites

**Step 1.1 — Install Docker Desktop (or Docker Engine + Compose plugin).** This is the only hard requirement for the standard path.

```bash
docker --version          # expect 24+ (tested on 29.4.2)
docker compose version    # expect v2+ (tested on v5.1.3)
```

**Step 1.2 — Install the optional local-development tools.** Only needed if you want to run code outside Docker (Section 6).

```bash
python3 --version   # 3.11 or newer
node --version      # 20 or newer
npm --version
```

**Step 1.3 — Make sure the required ports are free.** `27017`, `27018`, `8000`, and `3000` must be available. Check with:

```bash
lsof -i :27017 -i :27018 -i :8000 -i :3000
```

If a port is taken, change it later in the relevant `.env` file rather than killing the other process.

---

## 2. Get the Code

**Step 2.1 — Clone the repository.**

```bash
git clone git@github.com:theaniketpatil03/maya-borlaug-blockchain-scrapper.git maya
cd maya
```

Use the HTTPS remote instead if you do not have SSH keys registered with GitHub:

```bash
git clone https://github.com/theaniketpatil03/maya-borlaug-blockchain-scrapper.git maya
```

**Step 2.2 — Confirm the folder layout.**

```bash
ls
# expect: maya-scraper/  maya-blockchain/  main.py  docker-compose.yml  Setup.md ...
```

**Step 2.3 — Never commit secrets.** `.env`, `*.key`, and `*.archive` are gitignored. Keep credentials out of tracked files. See Section 8 for the credentials that currently need rotating.

---

## 3. Set Up the Scraper

The scraper reads the public Borlaug explorer API and writes into MongoDB. It uses MongoDB itself as a durable job queue, so a crashed or stopped run can simply be restarted and it will pick up where it left off.

**Step 3.1 — Move into the scraper folder and create its environment file.**

```bash
cd maya-scraper
cp .env.example .env
```

**Step 3.2 — Review the settings in `.env`.** The defaults work as-is for a full run.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONGO_URI` | `mongodb://mongodb:27017` | Mongo connection string (service name inside Compose) |
| `MONGO_DB` | `maya_explorer` | Database name |
| `API_BASE_URL` | `https://maya.explorerapi.borlaug.network` | Source API |
| `SCRAPER_PER_PAGE` | `100` | Records fetched per API page |
| `SCRAPER_WORKERS` | `5` | Parallel fetch threads |
| `SCRAPER_DELAY_SECONDS` | `1.0` | Politeness delay between requests |
| `SCRAPER_REQUEST_TIMEOUT` | `30` | HTTP timeout in seconds |
| `SCRAPER_MAX_RETRIES` | `3` | Retries per failed request |
| `SCRAPER_RETRY_BACKOFF_SECONDS` | `2.0` | Backoff between retries |
| `SCRAPER_BATCH_SIZE` | `100` | Mongo bulk-write batch size |
| `SCRAPER_STALE_RUNNING_MINUTES` | `30` | Age after which a stuck `running` job resets to `pending` |
| `SCRAPER_START_PAGE` | `1` | First page to fetch |
| `SCRAPER_MAX_PAGES` | *(empty)* | Page cap; empty means unlimited |
| `SCRAPER_MAX_ITEMS_PER_STAGE` | *(empty)* | Item cap per stage; empty means unlimited |
| `SCRAPE_TRANSACTIONS` | `true` | Stage toggle: transaction list |
| `SCRAPE_ACCOUNTS` | `true` | Stage toggle: accounts |
| `SCRAPE_TRANSACTION_DETAILS` | `true` | Stage toggle: per-transaction detail |
| `SCRAPE_BLOCK_DETAILS` | `true` | Stage toggle: per-block detail |
| `SCRAPE_IDENTITIES` | `true` | Stage toggle: DID identities |

**Step 3.3 — Start MongoDB for the scraper.**

```bash
docker compose up -d mongodb
docker compose ps
```

You should see `maya-scraper-mongodb` in the `running` state with `27017` published.

**Step 3.4 — Do a small sample run first.** Never start with a full scrape on a fresh setup; verify the pipeline works on a handful of records. Temporarily set these in `.env`:

```env
SCRAPER_MAX_PAGES=2
SCRAPER_MAX_ITEMS_PER_STAGE=50
SCRAPER_WORKERS=3
SCRAPER_DELAY_SECONDS=1
```

Then run:

```bash
docker compose run --rm scraper
```

**Step 3.5 — Verify the sample data landed in MongoDB.**

```bash
docker exec -it maya-scraper-mongodb mongosh maya_explorer --eval '
  ["transactions","blocks","accounts","identities","events","inherents","logs"]
    .forEach(c => print(c + ": " + db[c].countDocuments()))
'
```

Every collection you enabled should report a non-zero count.

**Step 3.6 — Switch to a full run.** Clear the caps in `.env`:

```env
SCRAPER_MAX_PAGES=
SCRAPER_MAX_ITEMS_PER_STAGE=
SCRAPER_PER_PAGE=100
SCRAPER_WORKERS=5
SCRAPER_DELAY_SECONDS=1
```

Then start it detached so it survives your terminal closing, and follow the logs:

```bash
docker compose run -d --name maya-scraper-full scraper
docker logs -f maya-scraper-full
```

A full scrape takes many hours and produces roughly 2 GB of data.

**Step 3.7 — Understand what happens on restart.** The scraper runs its stages in this fixed order: transaction list, accounts, transaction details, block details, identities. Progress is tracked in Mongo through `transactions.detail_status`, `blocks.detail_status`, `identities.status`, and `scrape_state.last_completed_page`. If the container, server, or upstream API dies, just rerun the same command — jobs stuck in `running` beyond `SCRAPER_STALE_RUNNING_MINUTES` are automatically reset to `pending`.

**Step 3.8 — Check progress at any time.**

```bash
docker exec -it maya-scraper-mongodb mongosh maya_explorer --eval '
  printjson(db.scrape_state.find().toArray());
  printjson(db.transactions.aggregate([{$group:{_id:"$detail_status",n:{$sum:1}}}]).toArray());
'
```

---

## 4. Set Up the Backend and Frontend

Both run from a single Compose stack together with their own MongoDB.

**Step 4.1 — Move into the app folder and create its environment file.**

```bash
cd ../maya-blockchain
cp .env.example .env
```

**Step 4.2 — Review the settings in `.env`.**

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONGO_PORT` | `27018` | Host port for the app's Mongo (container still listens on `27017`) |
| `MONGO_URI` | `mongodb://mongodb:27017` | What the backend uses inside the Compose network |
| `MONGO_DB` | `maya_explorer` | Database name — must match the scraper |
| `BACKEND_PORT` | `8000` | Host port for the FastAPI API |
| `FRONTEND_PORT` | `3000` | Host port for the Nginx-served UI |
| `VITE_API_BASE_URL` | `/api` | Baked into the frontend at build time; Nginx proxies `/api/` to the backend |

The app's Mongo deliberately uses host port `27018` so it does not collide with the scraper's Mongo on `27017`.

**Step 4.3 — Build and start all three services.**

```bash
docker compose up -d --build
```

This builds the backend image (`python:3.12-slim` + Uvicorn), builds the frontend in a `node:20-alpine` stage and copies `dist/` into `nginx:1.27-alpine`, and starts MongoDB with a healthcheck the backend waits on.

**Step 4.4 — Verify all three containers are healthy.**

```bash
docker compose ps
```

Expect `maya-blockchain-mongodb`, `maya-blockchain-backend`, and `maya-blockchain-frontend` all running.

**Step 4.5 — Check the backend responds.**

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/stats/latest
```

**Step 4.6 — Open the UI.**

```text
http://localhost:3000
```

At this point the app is running but the database is empty. Load data using Section 5.

**Step 4.7 — Know the available API routes.**

```text
GET /api/health
GET /api/stats/latest
GET /api/transactions
GET /api/transactions/{blockNumber}/{hash}
GET /api/blocks
GET /api/blocks/{number}
GET /api/accounts
GET /api/accounts/{signer}/transactions
GET /api/events/{id}
GET /api/inherents/{id}
GET /api/logs/{id}
GET /api/identities/{did}
GET /api/search?q={term}
```

---

## 5. Backup and Restore

MongoDB is the only stateful part of the system. Everything else is rebuildable from Git. Back up the `maya_explorer` database and you have backed up the project.

### 5A. Back up the scraper database

**Step 5.1 — Create a dump inside the scraper's Mongo container.** Write to `/tmp`, not `/data/db` — dumping into the live data volume can fill the disk and kill the dump mid-run.

```bash
docker exec maya-scraper-mongodb mongodump \
  --db maya_explorer \
  --archive=/tmp/maya_explorer.archive
```

**Step 5.2 — Copy the archive out to the host.**

```bash
docker cp maya-scraper-mongodb:/tmp/maya_explorer.archive ./maya_explorer.archive
docker exec maya-scraper-mongodb rm -f /tmp/maya_explorer.archive
```

**Step 5.3 — Verify the archive is complete.** A full dataset archive is roughly 1.8 GB; a sample-run archive is only tens of kilobytes.

```bash
ls -lh maya_explorer.archive
```

**Step 5.4 — Use a compressed, timestamped archive for real backups.** This is the form you want for anything you intend to keep. Create the host directory first.

```bash
mkdir -p ~/backups
docker exec maya-scraper-mongodb mongodump \
  --db maya_explorer \
  --archive=/tmp/backup.gz --gzip
docker cp maya-scraper-mongodb:/tmp/backup.gz \
  "$HOME/backups/maya_explorer_$(date +%Y%m%d_%H%M%S).archive.gz"
docker exec maya-scraper-mongodb rm -f /tmp/backup.gz
ls -lh ~/backups/
```

### 5B. Restore into the app database

Always copy into `/tmp` inside the app container (never into `/data/db`). `--drop` replaces existing collections for a clean reload.

**Step 5.5 — Restore an uncompressed archive** (from Step 5.1 / 5.2).

```bash
docker cp ./maya_explorer.archive maya-blockchain-mongodb:/tmp/maya_explorer.archive
docker exec maya-blockchain-mongodb mongorestore \
  --archive=/tmp/maya_explorer.archive --drop
docker exec maya-blockchain-mongodb rm -f /tmp/maya_explorer.archive
```

**Step 5.6 — Restore a gzipped archive** (from Step 5.4). Match the real filename under `~/backups/`.

```bash
ARCHIVE="$HOME/backups/maya_explorer_YYYYMMDD_HHMMSS.archive.gz"   # replace with your file
docker cp "$ARCHIVE" maya-blockchain-mongodb:/tmp/backup.gz
docker exec maya-blockchain-mongodb mongorestore \
  --archive=/tmp/backup.gz --gzip --drop
docker exec maya-blockchain-mongodb rm -f /tmp/backup.gz
```

**Step 5.7 — Verify the restore.**

```bash
docker exec -it maya-blockchain-mongodb mongosh maya_explorer --eval '
  db.getCollectionNames().forEach(c => print(c + ": " + db[c].countDocuments()))
'
curl http://localhost:8000/api/stats/latest
```

**Step 5.8 — Reload the UI.** `http://localhost:3000` should now show live data.

### 5C. Automate the backups

**Step 5.9 — Create a backup script** at `scripts/backup-mongo.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-maya-scraper-mongodb}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/maya-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" mongodump \
  --db maya_explorer --archive=/tmp/backup.gz --gzip
docker cp "$CONTAINER:/tmp/backup.gz" "$BACKUP_DIR/maya_explorer_$STAMP.archive.gz"
docker exec "$CONTAINER" rm -f /tmp/backup.gz

find "$BACKUP_DIR" -name 'maya_explorer_*.archive.gz' \
  -mtime "+$RETENTION_DAYS" -delete

echo "Backup complete: $BACKUP_DIR/maya_explorer_$STAMP.archive.gz"
```

**Step 5.10 — Make it executable and test it.**

```bash
chmod +x scripts/backup-mongo.sh
./scripts/backup-mongo.sh maya-scraper-mongodb
```

**Step 5.11 — Schedule it with cron.** Run `crontab -e` and add a nightly job at 02:00:

```cron
0 2 * * * /home/ubuntu/maya/scripts/backup-mongo.sh maya-scraper-mongodb >> /home/ubuntu/maya-backup.log 2>&1
```

**Step 5.12 — Copy backups off the machine.** A backup on the same server is not a backup. Sync to another host or to object storage:

```bash
rsync -avz ~/maya-backups/ user@backup-host:/srv/maya-backups/
```

### 5D. Back up the Docker volumes directly

**Step 5.13 — Snapshot a whole volume** as an alternative to logical dumps. This captures the raw Mongo data files.

```bash
docker run --rm \
  -v maya-scraper_mongodb_data:/data \
  -v "$PWD:/backup" \
  alpine tar czf /backup/mongo_volume_$(date +%F).tar.gz -C /data .
```

The app stack's volume is named `maya-blockchain_mongodb_data`. List them with `docker volume ls`.

**Step 5.14 — Restore a volume snapshot.** Stop the stack first.

```bash
docker compose down
docker run --rm \
  -v maya-scraper_mongodb_data:/data \
  -v "$PWD:/backup" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/mongo_volume_2026-07-25.tar.gz -C /data"
docker compose up -d
```

---

## 6. Local Development Without Docker

Use this when you want hot reload while editing code.

**Step 6.1 — Start a MongoDB you can reach from the host.** The scraper's Mongo on `27017` works fine:

```bash
cd maya-scraper && docker compose up -d mongodb
```

**Step 6.2 — Run the backend with auto-reload.**

```bash
cd maya-blockchain/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MONGO_URI=mongodb://localhost:27017
export MONGO_DB=maya_explorer
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Step 6.3 — Run the frontend dev server** in a second terminal. Vite serves on `5173` and needs the absolute backend URL since Nginx is not in the picture.

```bash
cd maya-blockchain/frontend
npm install
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

Open `http://localhost:5173`.

**Step 6.4 — Run the scraper directly** if you need to debug it.

```bash
cd maya-scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MONGO_URI=mongodb://localhost:27017
export MONGO_DB=maya_explorer
export SCRAPER_MAX_PAGES=1
export SCRAPER_MAX_ITEMS_PER_STAGE=10
python scraper.py
```

**Step 6.5 — Produce a production frontend build** to check it compiles cleanly. `npm run build` runs `tsc` first, so TypeScript errors fail the build.

```bash
cd maya-blockchain/frontend
npm run build     # outputs to dist/
npm run preview
```

---

## 7. Deploy to the Server

The scraper host is an Ubuntu box at `140.245.233.202`, user `ubuntu`.

**Step 7.1 — Fix the SSH key permissions.** SSH refuses keys that are readable by other users.

```bash
chmod 600 ssh-key-scrapper.key
```

**Step 7.2 — Connect.**

```bash
ssh -i ssh-key-scrapper.key ubuntu@140.245.233.202
```

**Step 7.3 — Install Docker on the server** if it is not already there.

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
```

**Step 7.4 — Clone the repository and create both `.env` files.**

```bash
git clone https://github.com/theaniketpatil03/maya-borlaug-blockchain-scrapper.git maya
cd maya
cp maya-scraper/.env.example maya-scraper/.env
cp maya-blockchain/.env.example maya-blockchain/.env
```

**Step 7.5 — Point the app at the scraper's Mongo** so you skip dump-and-restore entirely. Both stacks live on the same host, so edit `maya-blockchain/.env`:

```env
MONGO_URI=mongodb://host.docker.internal:27017
```

On Linux, add the host mapping to the `backend` service in `maya-blockchain/docker-compose.yml`:

```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Alternatively keep the two stacks fully separate and run the Section 5 dump-and-restore on a schedule.

**Step 7.6 — Start both stacks.**

```bash
cd maya-scraper && docker compose up -d mongodb && docker compose run -d --name maya-scraper-full scraper
cd ../maya-blockchain && docker compose up -d --build
```

**Step 7.7 — Open the firewall for the public ports.**

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
```

Do **not** expose `27017` or `27018` — the Mongo instances have no authentication configured.

**Step 7.8 — Confirm the containers restart after a reboot.** Every long-lived service already sets `restart: unless-stopped`, so Docker brings them back automatically. The scraper is deliberately `restart: "no"` because it is a one-shot job; rerun it manually or from cron.

**Step 7.9 — Deploy an update.**

```bash
cd ~/maya
git pull
cd maya-blockchain && docker compose up -d --build
```

---

## 8. Security Checklist

**Step 8.1 — Rotate the leaked GitHub token.** `server.txt` contains a live GitHub personal access token in plain text. Revoke it at <https://github.com/settings/tokens> and issue a new one.

**Step 8.2 — Stop tracking the credentials file.** Move the contents of `server.txt` into a password manager and add both `server.txt` and `ssh-key-scrapper.key` to `.gitignore`.

**Step 8.3 — Enable MongoDB authentication before any public exposure.** Both Mongo instances currently run without credentials.

**Step 8.4 — Tighten CORS for production.** The backend sets `allow_origins=["*"]` in `maya-blockchain/backend/app/main.py`. Replace it with your actual frontend origin.

**Step 8.5 — Keep `.env` files out of Git.** Only the `.env.example` templates should ever be committed.

---

## 9. Troubleshooting

**Homepage is blank.** The backend cannot reach Mongo, or the database is empty. Work through:

```bash
docker compose ps
docker exec maya-blockchain-backend getent hosts mongodb
curl http://localhost:8000/api/stats/latest
docker compose logs backend
```

**Mongo dropped off the Compose network.** Recreate the stack; the named volume keeps your data.

```bash
docker compose down
docker compose up -d
```

**Port already in use.** Change `MONGO_PORT`, `BACKEND_PORT`, or `FRONTEND_PORT` in the relevant `.env`, then `docker compose up -d`.

**Scraper stalls or exits early.** Look at the logs, then simply rerun it — the Mongo-backed queue resumes from the last completed page.

```bash
docker logs --tail 200 maya-scraper-full
docker compose run --rm scraper
```

**Frontend calls the wrong API URL.** `VITE_API_BASE_URL` is baked in at build time, so changing it requires a rebuild:

```bash
docker compose up -d --build frontend
```

**Rate-limited by the upstream API.** Increase `SCRAPER_DELAY_SECONDS` and lower `SCRAPER_WORKERS` in `maya-scraper/.env`.

**Start completely fresh.** This deletes all scraped data:

```bash
docker compose down -v
```

---

## 10. Command Cheat Sheet

```bash
# --- Scraper ---
cd maya-scraper
cp .env.example .env
docker compose up -d mongodb
docker compose run --rm scraper                    # foreground
docker compose run -d --name maya-scraper-full scraper   # background
docker logs -f maya-scraper-full

# --- Backend + Frontend ---
cd maya-blockchain
cp .env.example .env
docker compose up -d --build
curl http://localhost:8000/api/health
open http://localhost:3000

# --- Backup (uncompressed) ---
docker exec maya-scraper-mongodb mongodump --db maya_explorer --archive=/tmp/maya_explorer.archive
docker cp maya-scraper-mongodb:/tmp/maya_explorer.archive ./maya_explorer.archive
docker exec maya-scraper-mongodb rm -f /tmp/maya_explorer.archive

# --- Backup (gzip, recommended) ---
mkdir -p ~/backups
docker exec maya-scraper-mongodb mongodump --db maya_explorer --archive=/tmp/backup.gz --gzip
docker cp maya-scraper-mongodb:/tmp/backup.gz "$HOME/backups/maya_explorer_$(date +%Y%m%d_%H%M%S).archive.gz"
docker exec maya-scraper-mongodb rm -f /tmp/backup.gz

# --- Restore (uncompressed) ---
docker cp ./maya_explorer.archive maya-blockchain-mongodb:/tmp/maya_explorer.archive
docker exec maya-blockchain-mongodb mongorestore --archive=/tmp/maya_explorer.archive --drop
docker exec maya-blockchain-mongodb rm -f /tmp/maya_explorer.archive

# --- Restore (gzip) ---
# ARCHIVE=~/backups/maya_explorer_YYYYMMDD_HHMMSS.archive.gz
docker cp "$ARCHIVE" maya-blockchain-mongodb:/tmp/backup.gz
docker exec maya-blockchain-mongodb mongorestore --archive=/tmp/backup.gz --gzip --drop
docker exec maya-blockchain-mongodb rm -f /tmp/backup.gz

# --- Inspect ---
docker compose ps
docker compose logs -f backend
docker exec -it maya-blockchain-mongodb mongosh maya_explorer

# --- Teardown ---
docker compose down       # keep data
docker compose down -v    # delete data
```
