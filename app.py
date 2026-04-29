from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from database import get_db, init_db
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io
import os
from datetime import datetime

# ── Registro de fontes com suporte completo a acentuação ──────────────────────
import reportlab as _rl
_FONTS_DIR = os.path.join(os.path.dirname(_rl.__file__), "fonts")

def _try_register(alias, filename):
    path = os.path.join(_FONTS_DIR, filename)
    if os.path.exists(path):
        try:
            pdfmetrics.registerFont(TTFont(alias, path))
            return True
        except Exception:
            pass
    return False

_ok = (
    _try_register("Body",    "DejaVuSans.ttf") and
    _try_register("Body-B",  "DejaVuSans-Bold.ttf") and
    _try_register("Body-I",  "DejaVuSans-Oblique.ttf")
)
FONT      = "Body"   if _ok else "Helvetica"
FONT_BOLD = "Body-B" if _ok else "Helvetica-Bold"
FONT_IT   = "Body-I" if _ok else "Helvetica-Oblique"

# ── App Flask ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)
init_db()

# ── Rotas ──────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/refeicoes/<data>", methods=["GET"])
def get_refeicoes(data):
    conn = get_db()
    refeicoes = conn.execute(
        "SELECT * FROM refeicoes WHERE data = ? ORDER BY horario", (data,)
    ).fetchall()
    resultado = []
    for r in refeicoes:
        alimentos = conn.execute(
            "SELECT * FROM alimentos WHERE refeicao_id = ?", (r["id"],)
        ).fetchall()
        resultado.append({
            "id": r["id"], "data": r["data"], "periodo": r["periodo"],
            "horario": r["horario"], "tipo": r["tipo"],
            "alimentos": [dict(a) for a in alimentos],
        })
    conn.close()
    return jsonify(resultado)

@app.route("/api/refeicoes", methods=["POST"])
def add_refeicao():
    data = request.json
    conn = get_db()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO refeicoes (data, periodo, horario, tipo) VALUES (?, ?, ?, ?)",
        (data["data"], data["periodo"], data["horario"], data["tipo"]),
    )
    rid = cur.lastrowid
    for a in data.get("alimentos", []):
        cur.execute(
            "INSERT INTO alimentos (refeicao_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)",
            (rid, a["nome"], a.get("quantidade", ""), a.get("unidade", "")),
        )
    conn.commit()
    conn.close()
    return jsonify({"id": rid, "success": True})

@app.route("/api/refeicoes/<int:rid>", methods=["DELETE"])
def delete_refeicao(rid):
    conn = get_db()
    conn.execute("DELETE FROM alimentos WHERE refeicao_id = ?", (rid,))
    conn.execute("DELETE FROM refeicoes WHERE id = ?", (rid,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/dias-com-registro", methods=["GET"])
def dias_com_registro():
    conn = get_db()
    dias = conn.execute("SELECT DISTINCT data FROM refeicoes ORDER BY data").fetchall()
    conn.close()
    return jsonify([d["data"] for d in dias])

# ── PDF ────────────────────────────────────────────────────────────────────────

DIAS_PT = {
    "Monday": "Segunda-feira", "Tuesday": "Terça-feira",
    "Wednesday": "Quarta-feira", "Thursday": "Quinta-feira",
    "Friday": "Sexta-feira", "Saturday": "Sábado", "Sunday": "Domingo",
}
MESES_PT = {
    "January": "janeiro",   "February": "fevereiro", "March": "março",
    "April":   "abril",     "May":      "maio",       "June":  "junho",
    "July":    "julho",     "August":   "agosto",     "September": "setembro",
    "October": "outubro",   "November": "novembro",   "December":  "dezembro",
}
PERIODOS = {
    "manha": "Manhã",
    "tarde": "Tarde",
    "noite": "Noite",
}

def fmt_data(iso):
    dt  = datetime.strptime(iso, "%Y-%m-%d")
    ds  = DIAS_PT.get(dt.strftime("%A"), dt.strftime("%A"))
    mes = MESES_PT.get(dt.strftime("%B"), dt.strftime("%B"))
    return f"{ds}, {dt.day} de {mes} de {dt.year}"

def build_pdf(nome, dias_rows, conn):
    VERDE_DARK  = colors.HexColor("#1E3A08")
    VERDE_MED   = colors.HexColor("#3A6B18")
    VERDE_LIGHT = colors.HexColor("#6AAF35")
    VERDE_PALE  = colors.HexColor("#D6EDB8")
    AMARELO     = colors.HexColor("#8B6914")
    CINZA       = colors.HexColor("#555555")
    CINZA_LIGHT = colors.HexColor("#888888")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2.2*cm, leftMargin=2.2*cm,
        topMargin=2*cm, bottomMargin=2.2*cm,
    )
    s = getSampleStyleSheet()

    def P(name, **kw):
        return ParagraphStyle(name, parent=s["Normal"], fontName=FONT, **kw)

    sty_titulo   = P("titulo",   fontName=FONT_BOLD, fontSize=22, textColor=VERDE_DARK,  alignment=TA_CENTER, spaceAfter=2)
    sty_subtit   = P("subtit",   fontSize=11,        textColor=CINZA,       alignment=TA_CENTER, spaceAfter=2)
    sty_periodo_l= P("per_l",    fontSize=10,        textColor=CINZA_LIGHT, alignment=TA_CENTER, spaceAfter=10)
    sty_dia      = P("dia",      fontName=FONT_BOLD, fontSize=13, textColor=VERDE_DARK,  spaceBefore=14, spaceAfter=2)
    sty_periodo  = P("periodo",  fontName=FONT_BOLD, fontSize=11, textColor=VERDE_MED,   spaceBefore=8,  spaceAfter=3, leftIndent=4)
    sty_hora     = P("hora",     fontName=FONT_IT,   fontSize=9,  textColor=CINZA_LIGHT, spaceAfter=2,   leftIndent=10)
    sty_alimento = P("alimento", fontSize=10,        textColor=colors.HexColor("#222222"), spaceAfter=1, leftIndent=18, leading=14)
    sty_lanche   = P("lanche",   fontSize=10,        textColor=AMARELO,     spaceAfter=4, leftIndent=10, leading=14)
    sty_rodape   = P("rodape",   fontSize=8,         textColor=CINZA_LIGHT, alignment=TA_CENTER)

    story = []
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph("Diário Alimentar", sty_titulo))
    story.append(Spacer(1, 0.15*cm))
    story.append(Paragraph(f"Nome: {nome}", sty_subtit))

    if dias_rows:
        primeiro = fmt_data(dias_rows[0]["data"])
        ultimo   = fmt_data(dias_rows[-1]["data"])
        if primeiro == ultimo:
            story.append(Paragraph(primeiro, sty_periodo_l))
        else:
            story.append(Paragraph(f"{primeiro}   até   {ultimo}", sty_periodo_l))

    story.append(HRFlowable(width="100%", thickness=2, color=VERDE_MED, spaceAfter=10))

    for dia_row in dias_rows:
        iso = dia_row["data"]
        story.append(Paragraph(fmt_data(iso), sty_dia))
        story.append(HRFlowable(width="100%", thickness=0.6, color=VERDE_PALE, spaceAfter=4))

        refeicoes = conn.execute(
            "SELECT * FROM refeicoes WHERE data = ? ORDER BY periodo, horario", (iso,)
        ).fetchall()

        por_periodo = {"manha": [], "tarde": [], "noite": []}
        for r in refeicoes:
            if r["periodo"] in por_periodo:
                por_periodo[r["periodo"]].append(r)

        for pk, plabel in PERIODOS.items():
            items = por_periodo[pk]
            if not items:
                continue
            story.append(Paragraph(plabel, sty_periodo))
            for r in items:
                alimentos = conn.execute(
                    "SELECT * FROM alimentos WHERE refeicao_id = ?", (r["id"],)
                ).fetchall()
                if r["tipo"] == "lanche":
                    a      = alimentos[0] if alimentos else None
                    nome_l = a["nome"] if a else "Lanche"
                    medida = ""
                    if a and (a["quantidade"] or a["unidade"]):
                        q = (a["quantidade"] or "").strip()
                        u = (a["unidade"]    or "").strip()
                        medida = f"  ({q} {u})".rstrip()
                    story.append(Paragraph(
                        f"Lanche às {r['horario']} — {nome_l}{medida}", sty_lanche))
                else:
                    story.append(Paragraph(
                        f"Refeição registrada às {r['horario']}", sty_hora))
                    for a in alimentos:
                        q = (a["quantidade"] or "").strip()
                        u = (a["unidade"]    or "").strip()
                        medida = f"   {q} {u}".rstrip() if (q or u) else ""
                        story.append(Paragraph(f"•  {a['nome']}{medida}", sty_alimento))
                story.append(Spacer(1, 0.12*cm))

        story.append(Spacer(1, 0.3*cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=VERDE_PALE))
    story.append(Spacer(1, 0.1*cm))
    gerado_em = datetime.now().strftime("%d/%m/%Y às %H:%M")
    story.append(Paragraph(f"Relatório gerado em {gerado_em}  ·  Diário Alimentar", sty_rodape))

    doc.build(story)
    buffer.seek(0)
    return buffer

@app.route("/api/exportar-pdf", methods=["POST"])
def exportar_pdf():
    body        = request.json
    data_inicio = body.get("data_inicio")
    data_fim    = body.get("data_fim")
    nome        = (body.get("nome_paciente") or "Paciente").strip()

    conn   = get_db()
    params = []
    query  = "SELECT DISTINCT data FROM refeicoes"
    if data_inicio and data_fim:
        query  += " WHERE data BETWEEN ? AND ?"
        params  = [data_inicio, data_fim]
    query += " ORDER BY data"
    dias = conn.execute(query, params).fetchall()

    buf = build_pdf(nome, dias, conn)
    conn.close()

    safe = nome.replace(" ", "_").replace("/", "_")
    return send_file(buf, as_attachment=True,
                    download_name=f"diario_alimentar_{safe}.pdf",
                    mimetype="application/pdf")

# ── Entrada ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)