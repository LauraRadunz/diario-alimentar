"""
Gerenciamento de usuários.
O primeiro admin é criado pelas variáveis de ambiente ADMIN_USER / ADMIN_PASS / ADMIN_EMAIL.
Novos usuários se cadastram pelo app e ficam com status 'pendente' até você aprovar.
"""
import hashlib, os
from database import get_db, init_db

def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def sincronizar_admin():
    """Garante que o admin definido nas env vars exista e seja admin ativo."""
    init_db()
    username = os.environ.get("ADMIN_USER", "admin")
    senha    = os.environ.get("ADMIN_PASS", "admin123")
    email    = os.environ.get("ADMIN_EMAIL", "admin@diario.com")
    nome     = os.environ.get("ADMIN_NOME",  "Administrador")

    conn = get_db()
    existe = conn.execute(
        "SELECT id FROM usuarios WHERE username=?", (username,)
    ).fetchone()
    if not existe:
        conn.execute(
            "INSERT INTO usuarios (username,email,password,nome,status,is_admin) VALUES (?,?,?,?,?,?)",
            (username, email, _hash(senha), nome, "ativo", 1)
        )
        print(f"[admin] Criado: {username}")
    else:
        conn.execute(
            "UPDATE usuarios SET password=?,is_admin=1,status='ativo' WHERE username=?",
            (_hash(senha), username)
        )
    conn.commit(); conn.close()

def verificar_login(username: str, senha: str):
    conn  = get_db()
    user  = conn.execute(
        "SELECT * FROM usuarios WHERE username=? AND password=?",
        (username, _hash(senha))
    ).fetchone()
    conn.close()
    return dict(user) if user else None

def cadastrar_usuario(username, email, senha, nome):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO usuarios (username,email,password,nome,status,is_admin) VALUES (?,?,?,?,?,?)",
            (username, email, _hash(senha), nome, "pendente", 0)
        )
        conn.commit()
        return {"sucesso": True}
    except Exception as e:
        return {"sucesso": False, "erro": str(e)}
    finally:
        conn.close()

def listar_usuarios():
    conn  = get_db()
    users = conn.execute(
        "SELECT id,username,email,nome,status,is_admin,criado_em FROM usuarios ORDER BY criado_em DESC"
    ).fetchall()
    conn.close()
    return [dict(u) for u in users]

def atualizar_status(uid, status):
    conn = get_db()
    conn.execute("UPDATE usuarios SET status=? WHERE id=?", (status, uid))
    conn.commit(); conn.close()
