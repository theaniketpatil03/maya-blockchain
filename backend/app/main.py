from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import get_db, serialize


app = FastAPI(title="Maya Blockchain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def page_params(page: int, per_page: int) -> tuple[int, int]:
    page = max(page, 1)
    per_page = min(max(per_page, 1), 200)
    return page, per_page


def paginated(collection: Any, query: dict[str, Any], sort: list[tuple[str, int]], page: int, per_page: int) -> dict[str, Any]:
    page, per_page = page_params(page, per_page)
    total = collection.count_documents(query)
    rows = (
        collection.find(query, {"_id": 0})
        .sort(sort)
        .skip((page - 1) * per_page)
        .limit(per_page)
    )
    return {"total": total, "page": page, "perPage": per_page, "slice": serialize(list(rows))}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/stats/latest")
def latest_stats() -> dict[str, Any]:
    db = get_db()
    latest_blocks = list(db.blocks.find({"detail_status": "done"}, {"_id": 0}).sort("number", -1).limit(10))
    # Prefer fully scraped transactions so home/detail cards have events/identity.
    latest_transactions = list(
        db.transactions.find({"detail_status": "done"}, {"_id": 0}).sort("blockNumber", -1).limit(10)
    )
    if len(latest_transactions) < 10:
        seen = {(row.get("blockNumber"), row.get("hash")) for row in latest_transactions}
        for row in db.transactions.find({}, {"_id": 0}).sort("blockNumber", -1).limit(20):
            key = (row.get("blockNumber"), row.get("hash"))
            if key in seen:
                continue
            latest_transactions.append(row)
            seen.add(key)
            if len(latest_transactions) >= 10:
                break
    return {
        "latestBlocks": serialize(latest_blocks),
        "latestTransactions": serialize(latest_transactions),
        "transactionCount": db.transactions.count_documents({}),
        "blockCount": db.blocks.count_documents({}),
        "accountCount": db.accounts.count_documents({}),
        "identityCount": db.identities.count_documents({"status": "done"}),
    }


@app.get("/api/transactions")
def transactions(page: int = 1, perPage: int = 10) -> dict[str, Any]:
    return paginated(get_db().transactions, {}, [("blockNumber", -1), ("index", -1)], page, perPage)


def enrich_transaction(tx: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    events = tx.get("events") or []
    # Normalize event ids (strings) into event documents when needed.
    if events and all(isinstance(item, str) for item in events):
        resolved = list(db.events.find({"id": {"$in": events}}, {"_id": 0}))
        by_id = {item["id"]: item for item in resolved}
        events = [by_id[item] for item in events if item in by_id]
        tx["events"] = events
    elif not events and tx.get("id"):
        tx["events"] = list(db.events.find({"extrinsicid": tx["id"]}, {"_id": 0}).sort("index", 1))

    identity = db.identities.find_one(
        {"$or": [{"extrinsicHash": tx.get("hash")}, {"extrinsicHash": tx.get("detail", {}).get("hash")}]},
        {"_id": 0},
    )
    if not identity:
        # Fall back to DID extracted from Registered event payload.
        for event in tx.get("events") or []:
            if event.get("meta", {}).get("name") != "Registered":
                continue
            data = event.get("event", {}).get("data") or []
            for part in data:
                if isinstance(part, dict) and isinstance(part.get("id"), str) and part["id"].startswith("0x"):
                    did = f"did:bws:{part['id'][2:]}"
                    identity = db.identities.find_one({"did": did}, {"_id": 0})
                    break
            if identity:
                break
    if identity:
        tx["identity"] = identity
    return tx


@app.get("/api/transactions/{block_number}/{tx_hash}")
def transaction_detail(block_number: int, tx_hash: str) -> dict[str, Any]:
    tx = get_db().transactions.find_one({"blockNumber": block_number, "hash": tx_hash}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return serialize(enrich_transaction(tx))


@app.get("/api/blocks")
def blocks(page: int = 1, perPage: int = 10) -> dict[str, Any]:
    return paginated(get_db().blocks, {"detail_status": "done"}, [("number", -1)], page, perPage)


@app.get("/api/blocks/{number}")
def block_detail(number: int) -> dict[str, Any]:
    block = get_db().blocks.find_one({"number": number}, {"_id": 0})
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    return serialize(block)


@app.get("/api/accounts")
def accounts(page: int = 1, perPage: int = 10) -> dict[str, Any]:
    return paginated(get_db().accounts, {}, [("count", -1), ("signer", 1)], page, perPage)


@app.get("/api/accounts/{signer}/transactions")
def account_transactions(signer: str, page: int = 1, perPage: int = 10) -> dict[str, Any]:
    return paginated(get_db().transactions, {"signer": signer}, [("blockNumber", -1), ("index", -1)], page, perPage)


@app.get("/api/events/{event_id}")
def event_detail(event_id: str) -> dict[str, Any]:
    event = get_db().events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return serialize(event)


@app.get("/api/inherents/{inherent_id}")
def inherent_detail(inherent_id: str) -> dict[str, Any]:
    inherent = get_db().inherents.find_one({"id": inherent_id}, {"_id": 0})
    if not inherent:
        raise HTTPException(status_code=404, detail="Inherent not found")
    return serialize(inherent)


@app.get("/api/logs/{log_id}")
def log_detail(log_id: str) -> dict[str, Any]:
    log = get_db().logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return serialize(log)


@app.get("/api/identities/{did:path}")
def identity_detail(did: str) -> dict[str, Any]:
    identity = get_db().identities.find_one({"did": did}, {"_id": 0})
    if not identity and did.startswith("0x"):
        identity = get_db().identities.find_one({"did": f"did:bws:{did[2:]}"}, {"_id": 0})
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")
    return serialize(identity)


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    db = get_db()
    term = q.strip()
    results: list[dict[str, Any]] = []

    if term.isdigit():
        block = db.blocks.find_one({"number": int(term)}, {"_id": 0})
        if block:
            results.append({"type": "block", "label": f"Block {term}", "url": f"/blocks/{term}", "data": serialize(block)})

    if re.fullmatch(r"\d+-\d+", term):
        for collection_name, item_type, path in [
            ("transactions", "transaction", "transactions"),
            ("events", "event", "events"),
            ("inherents", "inherent", "inherents"),
            ("logs", "log", "logs"),
        ]:
            item = db[collection_name].find_one({"id": term}, {"_id": 0})
            if item:
                results.append({"type": item_type, "label": term, "url": f"/{path}/{term}", "data": serialize(item)})

    if term.startswith("0x"):
        tx = db.transactions.find_one({"hash": term}, {"_id": 0})
        if tx:
            results.append(
                {
                    "type": "transaction",
                    "label": term,
                    "url": f"/transactions/{tx['blockNumber']}/{tx['hash']}",
                    "data": serialize(tx),
                }
            )
        block = db.blocks.find_one({"hash": term}, {"_id": 0})
        if block:
            results.append({"type": "block", "label": f"Block {block['number']}", "url": f"/blocks/{block['number']}", "data": serialize(block)})

    account = db.accounts.find_one({"signer": term}, {"_id": 0})
    if account:
        results.append({"type": "account", "label": term, "url": f"/accounts/{term}", "data": serialize(account)})

    identity_query = term if term.startswith("did:bws:") else None
    if identity_query:
        identity = db.identities.find_one({"did": identity_query}, {"_id": 0})
        if identity:
            results.append({"type": "identity", "label": identity_query, "url": f"/identities/{identity_query}", "data": serialize(identity)})

    if not results:
        regex = {"$regex": re.escape(term), "$options": "i"}
        for identity in db.identities.find(
            {
                "$or": [
                    {"did": regex},
                    {"subject": regex},
                    {"controller": regex},
                    {"properties.fact": regex},
                    {"properties.factParsed.u": regex},
                    {"properties.factParsed.h": regex},
                    {"properties.factParsed.mh": regex},
                ]
            },
            {"_id": 0},
        ).limit(10):
            results.append({"type": "identity", "label": identity.get("did", term), "url": f"/identities/{identity.get('did')}", "data": serialize(identity)})

    return {"query": term, "results": results[:20]}
