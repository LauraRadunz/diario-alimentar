import sqlite3

DB_PATH = "diario.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS refeicoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            periodo TEXT NOT NULL,
            horario TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'refeicao'
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refeicao_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            quantidade TEXT,
            unidade TEXT,
            FOREIGN KEY (refeicao_id) REFERENCES refeicoes(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()
