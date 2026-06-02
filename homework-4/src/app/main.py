from fastapi import FastAPI
from pydantic import BaseModel
from . import storage

app = FastAPI(
    title="Jedi Holocron Vault",
    description="Store and retrieve sacred Jedi knowledge — if you can find it.",
)


class Holocron(BaseModel):
    name: str   # SECURITY: not validated for ../ path traversal
    body: str


@app.post("/holocron", status_code=201)
def store(holocron: Holocron):
    # BUG #2: no existence check — silently overwrites an existing holocron
    # SECURITY: holocron.name is unsanitized — '../evil.txt' escapes the vault dir
    storage.write_holocron(holocron.name, holocron.body)
    return {"name": holocron.name, "status": "stored"}


@app.get("/holocron/{name}")
def read(name: str):
    # BUG #1: FileNotFoundError from storage is unhandled -> 500 instead of 404
    return {"name": name, "body": storage.read_holocron(name)}
