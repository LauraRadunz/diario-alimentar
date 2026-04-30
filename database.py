import sqlite3, os

DATA_DIR = "/data" if os.path.isdir("/data") else "."
DB_PATH  = os.path.join(DATA_DIR, "diario.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            username  TEXT NOT NULL UNIQUE,
            email     TEXT NOT NULL UNIQUE,
            password  TEXT NOT NULL,
            nome      TEXT NOT NULL,
            status    TEXT NOT NULL DEFAULT 'pendente',
            is_admin  INTEGER NOT NULL DEFAULT 0,
            criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS refeicoes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            data       TEXT NOT NULL,
            periodo    TEXT NOT NULL,
            horario    TEXT NOT NULL,
            tipo       TEXT NOT NULL DEFAULT 'refeicao',
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS alimentos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            refeicao_id INTEGER NOT NULL,
            nome        TEXT NOT NULL,
            quantidade  TEXT,
            unidade     TEXT,
            ordem       INTEGER NOT NULL DEFAULT 0,
            ingredientes TEXT,
            FOREIGN KEY (refeicao_id) REFERENCES refeicoes(id) ON DELETE CASCADE
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS obs_dia (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            data       TEXT NOT NULL,
            obs        TEXT NOT NULL DEFAULT '',
            UNIQUE(usuario_id, data),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    """)

    # Migrações para bancos antigos
    for col, definition in [
        ("ordem",       "INTEGER NOT NULL DEFAULT 0"),
        ("ingredientes","TEXT"),
    ]:
        try:
            c.execute(f"ALTER TABLE alimentos ADD COLUMN {col} {definition}")
        except Exception:
            pass

    conn.commit(); conn.close()