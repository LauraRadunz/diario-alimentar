/* ============================
   DIÁRIO ALIMENTAR — app.js
   ============================ */

const UNIDADES = [
  "— unidade —",
  "unidade(s)",
  "g (grama)",
  "kg",
  "ml",
  "litro(s)",
  "colher de chá",
  "colher de sopa",
  "colher de sobremesa",
  "colher grande",
  "xícara",
  "xícara de chá",
  "xícara de café",
  "copo",
  "copo americano",
  "fatia",
  "pedaço",
  "porção",
  "punhado",
  "lata",
  "caixinha",
  "sachê",
  "tablete",
  "barra",
  "pacote",
];

// ─── Estado ──────────────────────────────────────────────
let dataSelecionada = null;
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let diasComRegistro = new Set();
let modalTipo = "refeicao";
let modalPeriodo = "manha";

// ─── Utilitários ─────────────────────────────────────────
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function horaAtual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  const dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dt = new Date(Number(a), Number(m)-1, Number(d));
  return `${dias[dt.getDay()]}, ${d} de ${meses[Number(m)-1]} de ${a}`;
}

function toast(msg) {
  let el = document.getElementById('toast-global');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-global';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Calendário ──────────────────────────────────────────
async function carregarDiasComRegistro() {
  try {
    const r = await fetch('/api/dias-com-registro');
    const dias = await r.json();
    diasComRegistro = new Set(dias);
  } catch { diasComRegistro = new Set(); }
}

function renderCalendario() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calMesAno').textContent = `${meses[mesAtual]} ${anoAtual}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
  const ultimoDia = new Date(anoAtual, mesAtual+1, 0).getDate();
  const hoje = hojeISO();

  // Vazios antes
  for (let i = 0; i < primeiroDia; i++) {
    const el = document.createElement('div');
    el.className = 'cal-dia vazio outro-mes';
    const dia = new Date(anoAtual, mesAtual, -primeiroDia + i + 1);
    el.textContent = dia.getDate();
    grid.appendChild(el);
  }

  for (let d = 1; d <= ultimoDia; d++) {
    const iso = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el = document.createElement('div');
    el.className = 'cal-dia';
    el.textContent = d;

    if (iso === hoje) el.classList.add('hoje');
    if (iso === dataSelecionada) el.classList.add('selecionado');
    if (diasComRegistro.has(iso)) el.classList.add('tem-registro');

    el.addEventListener('click', () => selecionarDia(iso));
    grid.appendChild(el);
  }
}

document.getElementById('prevMes').addEventListener('click', () => {
  mesAtual--;
  if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
  renderCalendario();
});

document.getElementById('nextMes').addEventListener('click', () => {
  mesAtual++;
  if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
  renderCalendario();
});

// ─── Seleção de dia ──────────────────────────────────────
async function selecionarDia(iso) {
  dataSelecionada = iso;
  renderCalendario();

  document.getElementById('diaTitulo').textContent = formatarData(iso);
  document.getElementById('diaSub').textContent = '';

  await carregarRefeicoes();
}

// ─── Carregar refeições do dia ────────────────────────────
async function carregarRefeicoes() {
  if (!dataSelecionada) return;
  try {
    const r = await fetch(`/api/refeicoes/${dataSelecionada}`);
    const refeicoes = await r.json();
    renderPeriodo('manha', refeicoes.filter(r => r.periodo === 'manha'));
    renderPeriodo('tarde', refeicoes.filter(r => r.periodo === 'tarde'));
    renderPeriodo('noite', refeicoes.filter(r => r.periodo === 'noite'));
  } catch { toast('Erro ao carregar refeições.'); }
}

function renderPeriodo(periodo, refeicoes) {
  const container = document.getElementById(`entradas-${periodo}`);
  container.innerHTML = '';

  if (refeicoes.length === 0) {
    container.innerHTML = '<div class="vazio-msg">Nenhum registro ainda</div>';
    return;
  }

  refeicoes.forEach(r => {
    const card = document.createElement('div');
    card.className = `entrada-card tipo-${r.tipo}`;

    const badge = r.tipo === 'refeicao' ? '🍽️ Refeição' : '🍬 Lanche';

    let alimentosHTML = '';
    r.alimentos.forEach(a => {
      const medida = (a.quantidade || a.unidade)
        ? `<span class="alimento-medida">${a.quantidade || ''} ${a.unidade || ''}</span>`
        : '';
      alimentosHTML += `<div class="alimento-item">${a.nome} ${medida}</div>`;
    });

    card.innerHTML = `
      <div class="entrada-horario">
        <span class="badge">${badge}</span>
        ${r.horario}
      </div>
      <div class="entrada-alimentos">${alimentosHTML}</div>
      <button class="btn-deletar" data-id="${r.id}" title="Remover">✕</button>
    `;

    card.querySelector('.btn-deletar').addEventListener('click', async () => {
      if (!confirm('Remover este registro?')) return;
      await fetch(`/api/refeicoes/${r.id}`, { method: 'DELETE' });
      await carregarDiasComRegistro();
      renderCalendario();
      await carregarRefeicoes();
      toast('Registro removido.');
    });

    container.appendChild(card);
  });
}

// ─── Modal ────────────────────────────────────────────────
function abrirModal(tipo, periodo) {
  if (!dataSelecionada) { toast('Selecione um dia primeiro!'); return; }

  modalTipo = tipo;
  modalPeriodo = periodo;

  const titulo = tipo === 'refeicao' ? '🍽️ Nova Refeição' : '🍬 Lanche Rápido';
  document.getElementById('modalTitulo').textContent = titulo;
  document.getElementById('inputHorario').value = horaAtual();

  document.getElementById('camposRefeicao').style.display = tipo === 'refeicao' ? 'block' : 'none';
  document.getElementById('campoLanche').style.display = tipo === 'lanche' ? 'block' : 'none';

  if (tipo === 'refeicao') {
    document.getElementById('listaAlimentos').innerHTML = '';
    adicionarLinhaAlimento();
  } else {
    document.getElementById('lancheName').value = '';
    document.getElementById('lancheQtd').value = '';
    document.getElementById('lancheUnidade').value = '';
  }

  document.getElementById('modalRefeicao').classList.add('aberto');
}

function fecharModal() {
  document.getElementById('modalRefeicao').classList.remove('aberto');
}

document.getElementById('fecharModal').addEventListener('click', fecharModal);
document.getElementById('btnCancelar').addEventListener('click', fecharModal);
document.getElementById('modalRefeicao').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) fecharModal();
});

// Botões de adicionar nos períodos
document.querySelectorAll('.btn-add-tipo').forEach(btn => {
  btn.addEventListener('click', () => {
    abrirModal(btn.dataset.tipo, btn.dataset.periodo);
  });
});

// ─── Linhas de alimento ───────────────────────────────────
function criarSelectUnidade() {
  const sel = document.createElement('select');
  sel.className = 'select-unidade';
  UNIDADES.forEach((u, i) => {
    const opt = document.createElement('option');
    opt.value = i === 0 ? '' : u;
    opt.textContent = u;
    sel.appendChild(opt);
  });
  return sel;
}

function adicionarLinhaAlimento() {
  const lista = document.getElementById('listaAlimentos');
  const wrap = document.createElement('div');
  wrap.className = 'alimento-row-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-alimento';
  input.placeholder = 'Nome do alimento... ex: arroz branco, feijão carioca...';

  const btnRem = document.createElement('button');
  btnRem.className = 'btn-remover-alimento';
  btnRem.textContent = '✕';
  btnRem.title = 'Remover';
  btnRem.addEventListener('click', () => {
    if (lista.children.length > 1) wrap.remove();
    else toast('Precisa ter pelo menos um alimento.');
  });

  const medidaRow = document.createElement('div');
  medidaRow.className = 'alimento-medida-row';

  const inputQtd = document.createElement('input');
  inputQtd.type = 'text';
  inputQtd.className = 'input-qtd';
  inputQtd.placeholder = 'Qtd';
  inputQtd.inputMode = 'decimal';

  const sel = criarSelectUnidade();

  medidaRow.appendChild(inputQtd);
  medidaRow.appendChild(sel);

  wrap.appendChild(input);
  wrap.appendChild(btnRem);
  wrap.appendChild(medidaRow);
  lista.appendChild(wrap);

  input.focus();
}

document.getElementById('btnAddAlimento').addEventListener('click', adicionarLinhaAlimento);

// ─── Salvar ───────────────────────────────────────────────
document.getElementById('btnSalvar').addEventListener('click', async () => {
  const horario = document.getElementById('inputHorario').value;
  if (!horario) { toast('Informe o horário.'); return; }

  let alimentos = [];

  if (modalTipo === 'refeicao') {
    const linhas = document.querySelectorAll('#listaAlimentos .alimento-row-wrap');
    for (const linha of linhas) {
      const nome = linha.querySelector('.input-alimento').value.trim();
      const qtd = linha.querySelector('.input-qtd').value.trim();
      const unidade = linha.querySelector('.select-unidade').value;
      if (!nome) continue;
      alimentos.push({ nome, quantidade: qtd, unidade });
    }
    if (alimentos.length === 0) { toast('Adicione ao menos um alimento.'); return; }
  } else {
    const nome = document.getElementById('lancheName').value.trim();
    if (!nome) { toast('Descreva o que você comeu/bebeu.'); return; }
    const qtd = document.getElementById('lancheQtd').value.trim();
    const unidade = document.getElementById('lancheUnidade').value;
    alimentos.push({ nome, quantidade: qtd, unidade });
  }

  try {
    const resp = await fetch('/api/refeicoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: dataSelecionada,
        periodo: modalPeriodo,
        horario,
        tipo: modalTipo,
        alimentos
      })
    });
    const json = await resp.json();
    if (json.success) {
      fecharModal();
      await carregarDiasComRegistro();
      renderCalendario();
      await carregarRefeicoes();
      toast(modalTipo === 'refeicao' ? '✅ Refeição salva!' : '✅ Lanche salvo!');
    }
  } catch { toast('Erro ao salvar. Tente novamente.'); }
});

// ─── Modal PDF ────────────────────────────────────────────
document.getElementById('btnExportarPDF').addEventListener('click', () => {
  document.getElementById('modalPDF').classList.add('aberto');
});

document.getElementById('fecharModalPDF').addEventListener('click', () => {
  document.getElementById('modalPDF').classList.remove('aberto');
});

document.getElementById('btnCancelarPDF').addEventListener('click', () => {
  document.getElementById('modalPDF').classList.remove('aberto');
});

document.getElementById('modalPDF').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('modalPDF').classList.remove('aberto');
});

document.getElementById('btnGerarPDF').addEventListener('click', async () => {
  const nome = document.getElementById('pdfNome').value.trim() || 'Paciente';
  const inicio = document.getElementById('pdfInicio').value;
  const fim = document.getElementById('pdfFim').value;

  const btn = document.getElementById('btnGerarPDF');
  btn.textContent = 'Gerando...';
  btn.disabled = true;

  try {
    const resp = await fetch('/api/exportar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_paciente: nome,
        data_inicio: inicio || null,
        data_fim: fim || null
      })
    });

    if (!resp.ok) throw new Error('Falha');

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diario_alimentar_${nome.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('modalPDF').classList.remove('aberto');
    toast('📄 PDF gerado com sucesso!');
  } catch {
    toast('Erro ao gerar PDF. Tente novamente.');
  } finally {
    btn.textContent = 'Gerar PDF';
    btn.disabled = false;
  }
});

// ─── Init ─────────────────────────────────────────────────
(async () => {
  await carregarDiasComRegistro();
  renderCalendario();
  // Seleciona hoje automaticamente
  await selecionarDia(hojeISO());
})();
