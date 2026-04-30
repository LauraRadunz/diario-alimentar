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
            status    TEXT NOT NULL DEFAULT 'pendente',  -- pendente | ativo | bloqueado
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
            FOREIGN KEY (refeicao_id) REFERENCES refeicoes(id) ON DELETE CASCADE
        )
    """)

    # Migração: adiciona coluna ordem se não existir (para bancos antigos)
    try:
        c.execute("ALTER TABLE alimentos ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0")
    except Exception:
        pass

    conn.commit(); conn.close()
