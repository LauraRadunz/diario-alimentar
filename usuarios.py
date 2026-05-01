import hashlib, os
from database import get_db, init_db

def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def sincronizar_admin():
    init_db()
    username = os.environ.get("ADMIN_USER", "admin")
    senha    = os.environ.get("ADMIN_PASS", "admin123")
    email    = os.environ.get("ADMIN_EMAIL", "admin@diario.com")
    nome     = os.environ.get("ADMIN_NOME",  "Administrador")

    conn = get_db()
    try:
        existe = conn.execute(
            "SELECT id FROM usuarios WHERE username=?", (username,)
        ).fetchone()

        if not existe:
            # Verifica se o email já existe (pode ter sido cadastrado por outro usuário)
            email_existe = conn.execute(
                "SELECT id FROM usuarios WHERE email=?", (email,)
            ).fetchone()

            if email_existe:
                # Atualiza esse usuário para ser admin
                conn.execute(
                    "UPDATE usuarios SET username=?, password=?, nome=?, is_admin=1, status='ativo' WHERE email=?",
                    (username, _hash(senha), nome, email)
                )
                print(f"[admin] Usuário existente promovido a admin: {username}")
            else:
                conn.execute(
                    "INSERT INTO usuarios (username,email,password,nome,status,is_admin) VALUES (?,?,?,?,?,?)",
                    (username, email, _hash(senha), nome, "ativo", 1)
                )
                print(f"[admin] Criado: {username}")
        else:
            # Já existe, só atualiza senha e garante admin
            conn.execute(
                "UPDATE usuarios SET password=?, nome=?, is_admin=1, status='ativo' WHERE username=?",
                (_hash(senha), nome, username)
            )

        conn.commit()
    except Exception as e:
        print(f"[admin] Erro ao sincronizar admin: {e}")
    finally:
        conn.close()

def verificar_login(username: str, senha: str):
    conn  = get_db()
    # Aceita login por username OU por e-mail
    user  = conn.execute(
        "SELECT * FROM usuarios WHERE (username=? OR email=?) AND password=?",
        (username, username, _hash(senha))
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
    conn.commit()
    conn.close()