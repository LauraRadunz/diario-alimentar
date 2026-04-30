from flask import (Flask, request, jsonify, render_template,
                   send_file, session, redirect)
from flask_cors import CORS
from database import get_db
from usuarios import (sincronizar_admin, verificar_login,
                      cadastrar_usuario, listar_usuarios, atualizar_status)
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io, os
from datetime import datetime
from functools import wraps

# ── Fontes ─────────────────────────────────────────────────────────────────────
import reportlab as _rl

def _reg(a, f):
    candidatos = [
        os.path.join(os.path.dirname(_rl.__file__), "fonts", f),
        os.path.join("/usr/share/fonts/truetype/dejavu", f),
        os.path.join("/usr/share/fonts", f),
        os.path.join(os.path.dirname(__file__), "fonts", f),
    ]
    for p in candidatos:
        if os.path.exists(p):
            try:
                pdfmetrics.registerFont(TTFont(a, p))
                return True
            except Exception:
                pass
    return False

_ok   = _reg("Body","DejaVuSans.ttf") and _reg("Body-B","DejaVuSans-Bold.ttf") and _reg("Body-I","DejaVuSans-Oblique.ttf")
FONT  = "Body"   if _ok else "Helvetica"
FONT_B= "Body-B" if _ok else "Helvetica-Bold"
FONT_I= "Body-I" if _ok else "Helvetica-Oblique"
print(f"[PDF] Fonte: {'DejaVu (OK)' if _ok else 'Helvetica (fallback)'}")

# ── Flask ──────────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "diario-chave-secreta-2025")
CORS(app)
sincronizar_admin()

# ── Helpers de autenticação ────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def dec(*a,**kw):
        if "usuario_id" not in session:
            return jsonify({"erro":"não autenticado"}), 401
        return f(*a,**kw)
    return dec

def admin_required(f):
    @wraps(f)
    def dec(*a,**kw):
        if not session.get("is_admin"):
            return jsonify({"erro":"acesso negado"}), 403
        return f(*a,**kw)
    return dec

def uid(): return session["usuario_id"]

# ── Páginas ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return redirect("/login") if "usuario_id" not in session else render_template("index.html")

@app.route("/login")
def login_page():
    return redirect("/") if "usuario_id" in session else render_template("login.html")

@app.route("/cadastro")
def cadastro_page():
    return render_template("cadastro.html")

@app.route("/admin")
def admin_page():
    if not session.get("is_admin"): return redirect("/")
    return render_template("admin.html")

# ── Auth API ───────────────────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def api_login():
    d    = request.json
    user = verificar_login(d.get("username","").strip(), d.get("senha",""))
    if not user:
        return jsonify({"sucesso":False,"erro":"Usuário ou senha incorretos"}), 401
    if user["status"] == "pendente":
        return jsonify({"sucesso":False,"erro":"Seu cadastro ainda não foi aprovado. Aguarde a liberação."}), 403
    if user["status"] == "bloqueado":
        return jsonify({"sucesso":False,"erro":"Sua conta está bloqueada. Entre em contato com a administração."}), 403
    session["usuario_id"]   = user["id"]
    session["usuario_nome"] = user["nome"]
    session["is_admin"]     = bool(user["is_admin"])
    return jsonify({"sucesso":True,"nome":user["nome"],"is_admin":bool(user["is_admin"])})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"sucesso":True})

@app.route("/api/me")
def api_me():
    if "usuario_id" not in session:
        return jsonify({"autenticado":False}), 401
    return jsonify({"autenticado":True,"nome":session["usuario_nome"],"is_admin":session.get("is_admin",False)})

@app.route("/api/cadastro", methods=["POST"])
def api_cadastro():
    d = request.json
    username = d.get("username","").strip().lower()
    email    = d.get("email","").strip().lower()
    senha    = d.get("senha","")
    nome     = d.get("nome","").strip()
    if not all([username, email, senha, nome]):
        return jsonify({"sucesso":False,"erro":"Preencha todos os campos"}), 400
    if len(senha) < 6:
        return jsonify({"sucesso":False,"erro":"A senha precisa ter pelo menos 6 caracteres"}), 400
    res = cadastrar_usuario(username, email, senha, nome)
    if not res["sucesso"]:
        if "UNIQUE" in res.get("erro",""):
            return jsonify({"sucesso":False,"erro":"Usuário ou e-mail já cadastrado"}), 409
        return jsonify(res), 400
    return jsonify({"sucesso":True})

# ── Admin API ──────────────────────────────────────────────────────────────────
@app.route("/api/admin/usuarios")
@login_required
@admin_required
def api_admin_usuarios():
    return jsonify(listar_usuarios())

@app.route("/api/admin/usuarios/<int:uid_alvo>/status", methods=["PATCH"])
@login_required
@admin_required
def api_admin_status(uid_alvo):
    status = request.json.get("status")
    if status not in ("ativo","pendente","bloqueado"):
        return jsonify({"erro":"status inválido"}), 400
    atualizar_status(uid_alvo, status)
    return jsonify({"sucesso":True})

# ── Refeições API ──────────────────────────────────────────────────────────────
@app.route("/api/refeicoes/<data>")
@login_required
def get_refeicoes(data):
    conn = get_db()
    refs = conn.execute(
        "SELECT * FROM refeicoes WHERE data=? AND usuario_id=? ORDER BY horario",
        (data, uid())
    ).fetchall()
    out = []
    for r in refs:
        als = conn.execute(
            "SELECT * FROM alimentos WHERE refeicao_id=? ORDER BY ordem, id", (r["id"],)
        ).fetchall()
        out.append({**dict(r), "alimentos":[dict(a) for a in als]})
    conn.close()
    return jsonify(out)

@app.route("/api/refeicoes", methods=["POST"])
@login_required
def add_refeicao():
    d=request.json; conn=get_db(); cur=conn.cursor()
    cur.execute(
        "INSERT INTO refeicoes (usuario_id,data,periodo,horario,tipo) VALUES (?,?,?,?,?)",
        (uid(),d["data"],d["periodo"],d["horario"],d["tipo"])
    )
    rid=cur.lastrowid
    for i,a in enumerate(d.get("alimentos",[])):
        cur.execute(
            "INSERT INTO alimentos (refeicao_id,nome,quantidade,unidade,ordem) VALUES (?,?,?,?,?)",
            (rid,a["nome"],a.get("quantidade",""),a.get("unidade",""),i)
        )
    conn.commit(); conn.close()
    return jsonify({"id":rid,"success":True})

@app.route("/api/refeicoes/<int:rid>", methods=["PUT"])
@login_required
def update_refeicao(rid):
    d=request.json; conn=get_db()
    r=conn.execute("SELECT id FROM refeicoes WHERE id=? AND usuario_id=?",(rid,uid())).fetchone()
    if not r: conn.close(); return jsonify({"erro":"não encontrado"}),404
    conn.execute("UPDATE refeicoes SET horario=?,periodo=? WHERE id=?",(d["horario"],d["periodo"],rid))
    conn.execute("DELETE FROM alimentos WHERE refeicao_id=?",(rid,))
    for i,a in enumerate(d.get("alimentos",[])):
        conn.execute(
            "INSERT INTO alimentos (refeicao_id,nome,quantidade,unidade,ordem) VALUES (?,?,?,?,?)",
            (rid,a["nome"],a.get("quantidade",""),a.get("unidade",""),i)
        )
    conn.commit(); conn.close()
    return jsonify({"success":True})

@app.route("/api/refeicoes/<int:rid>", methods=["DELETE"])
@login_required
def delete_refeicao(rid):
    conn=get_db()
    r=conn.execute("SELECT id FROM refeicoes WHERE id=? AND usuario_id=?",(rid,uid())).fetchone()
    if r:
        conn.execute("DELETE FROM alimentos WHERE refeicao_id=?",(rid,))
        conn.execute("DELETE FROM refeicoes WHERE id=?",(rid,))
        conn.commit()
    conn.close()
    return jsonify({"success":True})

@app.route("/api/dias-com-registro")
@login_required
def dias_com_registro():
    conn=get_db()
    dias=conn.execute(
        "SELECT DISTINCT data FROM refeicoes WHERE usuario_id=? ORDER BY data",(uid(),)
    ).fetchall()
    conn.close()
    return jsonify([d["data"] for d in dias])

# ── PDF ────────────────────────────────────────────────────────────────────────
DIAS_PT ={"Monday":"Segunda-feira","Tuesday":"Terça-feira","Wednesday":"Quarta-feira",
          "Thursday":"Quinta-feira","Friday":"Sexta-feira","Saturday":"Sábado","Sunday":"Domingo"}
MESES_PT={"January":"janeiro","February":"fevereiro","March":"março","April":"abril",
          "May":"maio","June":"junho","July":"julho","August":"agosto",
          "September":"setembro","October":"outubro","November":"novembro","December":"dezembro"}
PERIODOS={"manha":"Manhã","tarde":"Tarde","noite":"Noite"}

def fmt_data(iso):
    dt=datetime.strptime(iso,"%Y-%m-%d")
    return f"{DIAS_PT.get(dt.strftime('%A'),'')} , {dt.day} de {MESES_PT.get(dt.strftime('%B'),'')} de {dt.year}"

def build_pdf(nome,dias_rows,conn,user_id):
    VD=colors.HexColor("#1E3A08");VM=colors.HexColor("#3A6B18")
    VP=colors.HexColor("#D6EDB8");AM=colors.HexColor("#8B6914")
    CZ=colors.HexColor("#555555");CL=colors.HexColor("#888888")
    buf=io.BytesIO()
    doc=SimpleDocTemplate(buf,pagesize=A4,rightMargin=2.2*cm,leftMargin=2.2*cm,topMargin=2*cm,bottomMargin=2.2*cm)
    s=getSampleStyleSheet()
    def P(n,**kw): return ParagraphStyle(n,parent=s["Normal"],fontName=FONT,**kw)
    st=dict(
        titulo=P("t",fontName=FONT_B,fontSize=22,textColor=VD,alignment=TA_CENTER,spaceAfter=2),
        subtit=P("s",fontSize=11,textColor=CZ,alignment=TA_CENTER,spaceAfter=2),
        per_l =P("pl",fontSize=10,textColor=CL,alignment=TA_CENTER,spaceAfter=10),
        dia   =P("d",fontName=FONT_B,fontSize=13,textColor=VD,spaceBefore=14,spaceAfter=2),
        periodo=P("p",fontName=FONT_B,fontSize=11,textColor=VM,spaceBefore=8,spaceAfter=3,leftIndent=4),
        hora  =P("h",fontName=FONT_I,fontSize=9,textColor=CL,spaceAfter=2,leftIndent=10),
        alimento=P("a",fontSize=10,textColor=colors.HexColor("#222"),spaceAfter=1,leftIndent=18,leading=14),
        lanche=P("l",fontSize=10,textColor=AM,spaceAfter=4,leftIndent=10,leading=14),
        rodape=P("r",fontSize=8,textColor=CL,alignment=TA_CENTER),
    )
    story=[Spacer(1,.2*cm),Paragraph("Diário Alimentar",st["titulo"]),
           Spacer(1,.15*cm),Paragraph(f"Nome: {nome}",st["subtit"])]
    if dias_rows:
        prim=fmt_data(dias_rows[0]["data"]); ult=fmt_data(dias_rows[-1]["data"])
        story.append(Paragraph(prim if prim==ult else f"{prim}  até  {ult}",st["per_l"]))
    story.append(HRFlowable(width="100%",thickness=2,color=VM,spaceAfter=10))
    for row in dias_rows:
        iso=row["data"]
        story.append(Paragraph(fmt_data(iso),st["dia"]))
        story.append(HRFlowable(width="100%",thickness=.6,color=VP,spaceAfter=4))
        refs=conn.execute(
            "SELECT * FROM refeicoes WHERE data=? AND usuario_id=? ORDER BY periodo,horario",(iso,user_id)
        ).fetchall()
        pp={"manha":[],"tarde":[],"noite":[]}
        for r in refs:
            if r["periodo"] in pp: pp[r["periodo"]].append(r)
        for pk,plabel in PERIODOS.items():
            if not pp[pk]: continue
            story.append(Paragraph(plabel,st["periodo"]))
            for r in pp[pk]:
                als=conn.execute("SELECT * FROM alimentos WHERE refeicao_id=? ORDER BY ordem,id",(r["id"],)).fetchall()
                if r["tipo"]=="lanche":
                    a=als[0] if als else None; nl=a["nome"] if a else "Lanche"; med=""
                    if a and (a["quantidade"] or a["unidade"]):
                        med=f"  ({(a['quantidade'] or '').strip()} {(a['unidade'] or '').strip()})".rstrip()
                    story.append(Paragraph(f"Lanche às {r['horario']} — {nl}{med}",st["lanche"]))
                else:
                    story.append(Paragraph(f"Refeição registrada às {r['horario']}",st["hora"]))
                    for a in als:
                        q=(a["quantidade"] or "").strip(); u=(a["unidade"] or "").strip()
                        med=f"   {q} {u}".rstrip() if (q or u) else ""
                        story.append(Paragraph(f"•  {a['nome']}{med}",st["alimento"]))
                story.append(Spacer(1,.12*cm))
        story.append(Spacer(1,.3*cm))
    story.append(HRFlowable(width="100%",thickness=.5,color=VP))
    story.append(Spacer(1,.1*cm))
    story.append(Paragraph(f"Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}  ·  Diário Alimentar",st["rodape"]))
    doc.build(story); buf.seek(0); return buf

@app.route("/api/exportar-pdf", methods=["POST"])
@login_required
def exportar_pdf():
    try:
        body=request.json; di=body.get("data_inicio"); df=body.get("data_fim")
        nome=(body.get("nome_paciente") or session.get("usuario_nome","Paciente")).strip()
        conn=get_db(); params=[uid()]
        query="SELECT DISTINCT data FROM refeicoes WHERE usuario_id=?"
        if di and df: query+=" AND data BETWEEN ? AND ?"; params+=[di,df]
        query+=" ORDER BY data"
        dias=conn.execute(query,params).fetchall()
        buf=build_pdf(nome,dias,conn,uid()); conn.close()
        safe=nome.replace(" ","_").replace("/","_")
        return send_file(buf,as_attachment=True,download_name=f"diario_alimentar_{safe}.pdf",mimetype="application/pdf")
    except Exception as e:
        import traceback
        print("[PDF ERROR]", traceback.format_exc())
        return jsonify({"erro": str(e)}), 500

if __name__=="__main__":
    port=int(os.environ.get("PORT",5000))
    app.run(debug=True,host="0.0.0.0",port=port)
