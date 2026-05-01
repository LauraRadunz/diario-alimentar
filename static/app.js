/* ── Diário Alimentar — app.js ── */

const UNIDADES = [
  "","unidade(s)","g (grama)","kg","ml","litro(s)",
  "colher de chá","colher de sopa","colher de sobremesa","colher grande",
  "xícara","xícara de chá","xícara de café","copo","copo americano",
  "fatia","pedaço","porção","punhado","lata","caixinha","sachê",
  "tablete","barra","pacote","pão francês",
];

// ── Estado ─────────────────────────────────────────────────────────────────────
let dataSelecionada = null;
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
let diasComRegistro = new Set();
let modalTipo    = "refeicao";
let modalPeriodo = "manha";
let editandoId   = null;

// Para o modal de ingredientes
let ingredientesCallback = null;

// ── Utils ──────────────────────────────────────────────────────────────────────
const hojeISO   = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const horaAtual = () => { const d=new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const pad = n => String(n).padStart(2,'0');

function formatarData(iso) {
  const [a,m,d] = iso.split('-');
  const dias  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dt = new Date(Number(a), Number(m)-1, Number(d));
  return `${dias[dt.getDay()]}, ${d} de ${meses[Number(m)-1]} de ${a}`;
}

function toast(msg) {
  let el = document.getElementById('_toast');
  if (!el) { el=document.createElement('div'); el.id='_toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 2500);
}

// ── Modal de confirmação ───────────────────────────────────────────────────────
function confirmar(msg, opcoes = {}) {
  return new Promise(resolve => {
    const { txtOk = 'Remover', txtCancelar = 'Cancelar', perigo = true } = opcoes;
    let overlay = document.getElementById('_modalConfirm');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '_modalConfirm';
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p class="confirm-msg" id="_confirmMsg"></p>
          <div class="confirm-btns">
            <button class="confirm-btn-cancel" id="_confirmCancel"></button>
            <button class="confirm-btn-ok" id="_confirmOk"></button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    const box     = overlay.querySelector('.confirm-box');
    const msgEl   = overlay.querySelector('#_confirmMsg');
    const btnOk   = overlay.querySelector('#_confirmOk');
    const btnCanc = overlay.querySelector('#_confirmCancel');

    msgEl.textContent    = msg;
    btnOk.textContent    = txtOk;
    btnCanc.textContent  = txtCancelar;
    btnOk.className      = perigo ? 'confirm-btn-ok perigo' : 'confirm-btn-ok';

    overlay.classList.add('aberto');

    const cleanup = (val) => {
      overlay.classList.remove('aberto');
      btnOk.replaceWith(btnOk.cloneNode(true));
      btnCanc.replaceWith(btnCanc.cloneNode(true));
      resolve(val);
    };

    overlay.querySelector('#_confirmOk').addEventListener('click',    () => cleanup(true),  { once: true });
    overlay.querySelector('#_confirmCancel').addEventListener('click', () => cleanup(false), { once: true });
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); }, { once: true });
  });
}

// ── Usuário ────────────────────────────────────────────────────────────────────
async function carregarMe() {
  const r = await fetch('/api/me');
  if (r.status === 401) { window.location.href='/login'; return; }
  const d = await r.json();
  document.getElementById('nomeUsuario').textContent = d.nome;
  if (d.is_admin) document.getElementById('linkAdmin').style.display = 'inline-flex';
}

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', {method:'POST'});
  window.location.href = '/login';
});

// ── Calendário ─────────────────────────────────────────────────────────────────
async function carregarDiasComRegistro() {
  try { const r=await fetch('/api/dias-com-registro'); diasComRegistro=new Set(await r.json()); } catch {}
}

function renderCalendario() {
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calMesAno').textContent = `${meses[mesAtual]} ${anoAtual}`;
  const grid = document.getElementById('calGrid'); grid.innerHTML = '';
  const primeiro = new Date(anoAtual, mesAtual, 1).getDay();
  const ultimo   = new Date(anoAtual, mesAtual+1, 0).getDate();
  const hoje     = hojeISO();

  for (let i=0; i<primeiro; i++) {
    const el=document.createElement('div'); el.className='cal-dia outro-mes';
    el.textContent=new Date(anoAtual,mesAtual,-primeiro+i+1).getDate(); grid.appendChild(el);
  }
  for (let d=1; d<=ultimo; d++) {
    const iso=`${anoAtual}-${pad(mesAtual+1)}-${pad(d)}`;
    const el=document.createElement('div'); el.className='cal-dia'; el.textContent=d;
    if (iso===hoje) el.classList.add('hoje');
    if (iso===dataSelecionada) el.classList.add('selecionado');
    if (diasComRegistro.has(iso)) el.classList.add('tem-registro');
    el.addEventListener('click', ()=>selecionarDia(iso));
    grid.appendChild(el);
  }
}

document.getElementById('prevMes').addEventListener('click',()=>{ mesAtual--; if(mesAtual<0){mesAtual=11;anoAtual--;} renderCalendario(); });
document.getElementById('nextMes').addEventListener('click',()=>{ mesAtual++; if(mesAtual>11){mesAtual=0;anoAtual++;} renderCalendario(); });

// ── Dia ───────────────────────────────────────────────────────────────────────
async function selecionarDia(iso) {
  dataSelecionada=iso; renderCalendario();
  document.getElementById('diaTitulo').textContent=formatarData(iso);
  document.getElementById('diaSub').textContent='';
  document.getElementById('obsDiaWrap').style.display='block';
  await carregarObs();
  await carregarRefeicoes();
}

// ── Observação do dia ─────────────────────────────────────────────────────────
let obsAberta = false;

document.getElementById('btnObsToggle').addEventListener('click', () => {
  obsAberta = !obsAberta;
  document.getElementById('obsDiaBody').style.display = obsAberta ? 'block' : 'none';
  document.getElementById('btnObsToggle').textContent = obsAberta ? '▴' : '▾';
});

async function carregarObs() {
  if (!dataSelecionada) return;
  try {
    const r = await fetch(`/api/obs/${dataSelecionada}`);
    const d = await r.json();
    document.getElementById('obsTexto').value = d.obs || '';
    // Se há obs salva, mostra indicador visual
    const bar = document.querySelector('.obs-dia-bar');
    bar.classList.toggle('tem-obs', !!(d.obs && d.obs.trim()));
  } catch {}
}

document.getElementById('btnSalvarObs').addEventListener('click', async () => {
  if (!dataSelecionada) return;
  const obs = document.getElementById('obsTexto').value.trim();
  try {
    await fetch(`/api/obs/${dataSelecionada}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({obs})
    });
    const bar = document.querySelector('.obs-dia-bar');
    bar.classList.toggle('tem-obs', !!obs);
    toast('📝 Observação salva!');
  } catch { toast('Erro ao salvar observação.'); }
});

// ── Refeições ─────────────────────────────────────────────────────────────────
async function carregarRefeicoes() {
  if (!dataSelecionada) return;
  try {
    const r=await fetch(`/api/refeicoes/${dataSelecionada}`);
    const refs=await r.json();
    ['manha','tarde','noite'].forEach(p=>renderPeriodo(p,refs.filter(r=>r.periodo===p)));
  } catch { toast('Erro ao carregar.'); }
}

function tipoInfo(tipo) {
  if (tipo === 'refeicao') return { emoji:'🍽️', label:'Refeição', cls:'tipo-refeicao' };
  if (tipo === 'lanche')   return { emoji:'🥪', label:'Lanche',   cls:'tipo-lanche' };
  if (tipo === 'belisco')  return { emoji:'🍬', label:'Belisco',  cls:'tipo-belisco' };
  return { emoji:'🍽️', label:'Refeição', cls:'tipo-refeicao' };
}

function renderPeriodo(periodo, refeicoes) {
  const c=document.getElementById(`entradas-${periodo}`); c.innerHTML='';
  if (!refeicoes.length) { c.innerHTML='<div class="vazio-msg">Nenhum registro ainda</div>'; return; }
  refeicoes.forEach(r=>{
    const card=document.createElement('div');
    const info = tipoInfo(r.tipo);
    card.className=`entrada-card ${info.cls}`;
    let alsHTML='';
    r.alimentos.forEach(a=>{
      const med=(a.quantidade||a.unidade)?`<span class="alimento-medida">${(a.quantidade||'').trim()} ${(a.unidade||'').trim()}</span>`:'';
      const ingHTML = a.ingredientes ? `<div class="alimento-ingredientes">↳ ${a.ingredientes}</div>` : '';
      alsHTML+=`<div class="alimento-item">${a.nome} ${med}</div>${ingHTML}`;
    });
    card.innerHTML=`
      <div class="entrada-horario"><span class="badge">${info.emoji} ${info.label}</span> ${r.horario}</div>
      <div class="entrada-alimentos">${alsHTML}</div>
      <div class="entrada-btns">
        <button class="btn-copiar" data-id="${r.id}" title="Copiar para outro dia">📋</button>
        <button class="btn-editar" data-id="${r.id}" title="Editar">✏️</button>
        <button class="btn-deletar" data-id="${r.id}" title="Remover">✕</button>
      </div>`;
    card.querySelector('.btn-copiar').addEventListener('click', () => abrirModalCopiar(r));
    card.querySelector('.btn-editar').addEventListener('click',()=>abrirEdicao(r));
    card.querySelector('.btn-deletar').addEventListener('click',async()=>{
      const ok = await confirmar('Remover este registro?', { txtOk: 'Remover', txtCancelar: 'Cancelar', perigo: true });
      if (!ok) return;
      await fetch(`/api/refeicoes/${r.id}`,{method:'DELETE'});
      await carregarDiasComRegistro(); renderCalendario(); await carregarRefeicoes();
      toast('Removido.');
    });
    c.appendChild(card);
  });
}

// ── Preenchimento de select de unidade ────────────────────────────────────────
function preencherSelectUnidade(sel, valor='') {
  sel.innerHTML='';
  UNIDADES.forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u||'— unidade —'; sel.appendChild(o); });
  sel.value=valor;
}

// ── Modal de ingredientes ─────────────────────────────────────────────────────
function abrirModalIngredientes(valorAtual, callback) {
  document.getElementById('inputIngredientes').value = valorAtual || '';
  ingredientesCallback = callback;
  document.getElementById('modalIngredientes').classList.add('aberto');
}

document.getElementById('fecharModalIngredientes').addEventListener('click', () => {
  document.getElementById('modalIngredientes').classList.remove('aberto');
  ingredientesCallback = null;
});
document.getElementById('btnCancelarIngredientes').addEventListener('click', () => {
  document.getElementById('modalIngredientes').classList.remove('aberto');
  ingredientesCallback = null;
});
document.getElementById('btnSalvarIngredientes').addEventListener('click', () => {
  const val = document.getElementById('inputIngredientes').value.trim();
  if (ingredientesCallback) ingredientesCallback(val);
  document.getElementById('modalIngredientes').classList.remove('aberto');
  ingredientesCallback = null;
});
document.getElementById('modalIngredientes').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('modalIngredientes').classList.remove('aberto');
    ingredientesCallback = null;
  }
});

// ── Modal principal ───────────────────────────────────────────────────────────
function labelModal(tipo) {
  if (tipo === 'refeicao') return '🍽️ Nova Refeição';
  if (tipo === 'lanche')   return '🥪 Novo Lanche';
  if (tipo === 'belisco')  return '🍬 Novo Belisco';
  return '🍽️ Nova Refeição';
}
function labelAlimentos(tipo) {
  if (tipo === 'refeicao') return 'Alimentos <span style="font-size:11px;color:#aaa;font-weight:400">(segure e arraste para reordenar)</span>';
  if (tipo === 'lanche')   return 'O que você comeu/bebeu?';
  if (tipo === 'belisco')  return 'O que você beliscou?';
  return 'Alimentos';
}

function abrirModal(tipo, periodo) {
  if (!dataSelecionada) { toast('Selecione um dia primeiro!'); return; }
  editandoId=null; modalTipo=tipo; modalPeriodo=periodo;
  document.getElementById('modalTitulo').textContent = labelModal(tipo);
  document.getElementById('labelAlimentos').innerHTML = labelAlimentos(tipo);
  document.getElementById('inputHorario').value=horaAtual();
  document.getElementById('listaAlimentos').innerHTML='';
  adicionarLinhaAlimento();
  document.getElementById('modalRefeicao').classList.add('aberto');
}

function abrirEdicao(r) {
  editandoId=r.id; modalTipo=r.tipo; modalPeriodo=r.periodo;
  const prefixo = r.tipo==='refeicao'?'✏️ Editar Refeição': r.tipo==='lanche'?'✏️ Editar Lanche':'✏️ Editar Belisco';
  document.getElementById('modalTitulo').textContent = prefixo;
  document.getElementById('labelAlimentos').innerHTML = labelAlimentos(r.tipo);
  document.getElementById('inputHorario').value=r.horario;
  document.getElementById('listaAlimentos').innerHTML='';
  r.alimentos.forEach(a=>adicionarLinhaAlimento(a.nome, a.quantidade, a.unidade, a.ingredientes||''));
  if (!r.alimentos.length) adicionarLinhaAlimento();
  document.getElementById('modalRefeicao').classList.add('aberto');
}

function fecharModal() { document.getElementById('modalRefeicao').classList.remove('aberto'); editandoId=null; }
document.getElementById('fecharModal').addEventListener('click',fecharModal);
document.getElementById('btnCancelar').addEventListener('click',fecharModal);
document.getElementById('modalRefeicao').addEventListener('click',e=>{ if(e.target===e.currentTarget)fecharModal(); });
document.querySelectorAll('.btn-add-tipo').forEach(b=>b.addEventListener('click',()=>abrirModal(b.dataset.tipo,b.dataset.periodo)));

// ── Linhas alimento com drag & drop ───────────────────────────────────────────
let dragSrc = null;

function adicionarLinhaAlimento(nome='', qtd='', unidade='', ingredientes='') {
  const lista=document.getElementById('listaAlimentos');
  const wrap=document.createElement('div');
  wrap.className='alimento-row-wrap'; wrap.draggable=true;
  wrap._ingredientes = ingredientes; // guarda no elemento

  const handle=document.createElement('span'); handle.className='drag-handle'; handle.innerHTML='⠿'; handle.title='Arrastar para reordenar';
  const input=document.createElement('input'); input.type='text'; input.className='input-alimento'; input.placeholder='Nome do alimento...'; input.value=nome;

  const btnRem=document.createElement('button'); btnRem.className='btn-remover-alimento'; btnRem.textContent='✕';
  btnRem.addEventListener('click',()=>{ if(lista.children.length>1) wrap.remove(); else toast('Precisa ter ao menos um item.'); });

  // Botão de ingredientes
  const btnIng=document.createElement('button'); btnIng.className='btn-ingredientes'; btnIng.title='Detalhar ingredientes';
  btnIng.innerHTML='🧂';
  btnIng.classList.toggle('tem-ingredientes', !!(ingredientes && ingredientes.trim()));
  btnIng.addEventListener('click', ()=>{
    abrirModalIngredientes(wrap._ingredientes, (val)=>{
      wrap._ingredientes = val;
      btnIng.classList.toggle('tem-ingredientes', !!val);
      btnIng.title = val ? `Ingredientes: ${val}` : 'Detalhar ingredientes';
    });
  });

  const medRow=document.createElement('div'); medRow.className='alimento-medida-row';
  const inputQtd=document.createElement('input'); inputQtd.type='text'; inputQtd.className='input-qtd'; inputQtd.placeholder='Qtd'; inputQtd.inputMode='decimal'; inputQtd.value=qtd;
  const sel=document.createElement('select'); sel.className='select-unidade'; preencherSelectUnidade(sel, unidade);

  const acoesTopo = document.createElement('div'); acoesTopo.className='alimento-acoes-topo';
  acoesTopo.appendChild(handle);
  acoesTopo.appendChild(input);
  acoesTopo.appendChild(btnIng);
  acoesTopo.appendChild(btnRem);

  medRow.appendChild(inputQtd); medRow.appendChild(sel);
  wrap.appendChild(acoesTopo); wrap.appendChild(medRow);
  lista.appendChild(wrap);

  // Drag events
  wrap.addEventListener('dragstart',e=>{ dragSrc=wrap; wrap.style.opacity='0.4'; e.dataTransfer.effectAllowed='move'; });
  wrap.addEventListener('dragend',  ()=>{ dragSrc=null; wrap.style.opacity='1'; document.querySelectorAll('.alimento-row-wrap').forEach(w=>w.classList.remove('drag-over')); });
  wrap.addEventListener('dragover', e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; wrap.classList.add('drag-over'); });
  wrap.addEventListener('dragleave',()=>wrap.classList.remove('drag-over'));
  wrap.addEventListener('drop',     e=>{ e.preventDefault(); wrap.classList.remove('drag-over'); if(dragSrc&&dragSrc!==wrap){ const els=[...lista.children]; const si=els.indexOf(dragSrc); const di=els.indexOf(wrap); if(si<di) lista.insertBefore(dragSrc,wrap.nextSibling); else lista.insertBefore(dragSrc,wrap); } });

  // Touch drag (mobile)
  let touchY=0, clone=null, touchTarget=null;
  handle.addEventListener('touchstart',e=>{ touchTarget=wrap; touchY=e.touches[0].clientY; clone=wrap.cloneNode(true); clone.style.cssText=`position:fixed;left:${wrap.getBoundingClientRect().left}px;width:${wrap.offsetWidth}px;opacity:0.8;z-index:9999;pointer-events:none;`; document.body.appendChild(clone); wrap.style.opacity='0.3'; },{passive:true});
  handle.addEventListener('touchmove',e=>{ if(!clone) return; const t=e.touches[0]; clone.style.top=`${t.clientY - wrap.offsetHeight/2}px`; const el=document.elementFromPoint(t.clientX,t.clientY); const over=el&&el.closest('.alimento-row-wrap'); document.querySelectorAll('.alimento-row-wrap').forEach(w=>w.classList.remove('drag-over')); if(over&&over!==touchTarget) over.classList.add('drag-over'); },{passive:true});
  handle.addEventListener('touchend',e=>{ if(!clone) return; clone.remove(); clone=null; touchTarget.style.opacity='1'; const t=e.changedTouches[0]; const el=document.elementFromPoint(t.clientX,t.clientY); const over=el&&el.closest('.alimento-row-wrap'); if(over&&over!==touchTarget){ const els=[...lista.children]; const si=els.indexOf(touchTarget); const di=els.indexOf(over); if(si<di) lista.insertBefore(touchTarget,over.nextSibling); else lista.insertBefore(touchTarget,over); } document.querySelectorAll('.alimento-row-wrap').forEach(w=>w.classList.remove('drag-over')); });

  if (!nome) input.focus();
}

document.getElementById('btnAddAlimento').addEventListener('click',()=>adicionarLinhaAlimento());

// ── Salvar ────────────────────────────────────────────────────────────────────
document.getElementById('btnSalvar').addEventListener('click', async()=>{
  const horario=document.getElementById('inputHorario').value;
  if (!horario) { toast('Informe o horário.'); return; }

  let alimentos=[];
  document.querySelectorAll('#listaAlimentos .alimento-row-wrap').forEach(l=>{
    const nome = l.querySelector('.input-alimento').value.trim();
    const qtd  = l.querySelector('.input-qtd').value.trim();
    const und  = l.querySelector('.select-unidade').value;
    const ing  = l._ingredientes || '';
    if (nome) alimentos.push({nome, quantidade:qtd, unidade:und, ingredientes:ing});
  });
  if (!alimentos.length) { toast('Adicione ao menos um item.'); return; }

  const payload={data:dataSelecionada,periodo:modalPeriodo,horario,tipo:modalTipo,alimentos};
  const url  = editandoId ? `/api/refeicoes/${editandoId}` : '/api/refeicoes';
  const meth = editandoId ? 'PUT' : 'POST';
  try {
    const r=await fetch(url,{method:meth,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if (j.success) { fecharModal(); await carregarDiasComRegistro(); renderCalendario(); await carregarRefeicoes(); toast(editandoId?'✅ Editado!':'✅ Salvo!'); }
  } catch { toast('Erro ao salvar.'); }
});

// ── Modal Copiar Refeição ─────────────────────────────────────────────────────
let refeicaoParaCopiar = null;

function abrirModalCopiar(r) {
  refeicaoParaCopiar = r;
  // Data padrão: dia seguinte ao selecionado
  const [a, m, d] = dataSelecionada.split('-').map(Number);
  const amanha = new Date(a, m - 1, d + 1);
  const iso = `${amanha.getFullYear()}-${pad(amanha.getMonth()+1)}-${pad(amanha.getDate())}`;
  document.getElementById('copiarData').value = iso;
  document.getElementById('copiarPeriodo').value = r.periodo;
  document.getElementById('modalCopiar').classList.add('aberto');
}

function fecharModalCopiar() {
  document.getElementById('modalCopiar').classList.remove('aberto');
  refeicaoParaCopiar = null;
}

document.getElementById('fecharModalCopiar').addEventListener('click', fecharModalCopiar);
document.getElementById('btnCancelarCopiar').addEventListener('click', fecharModalCopiar);
document.getElementById('modalCopiar').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModalCopiar();
});

document.getElementById('btnConfirmarCopiar').addEventListener('click', async () => {
  const data    = document.getElementById('copiarData').value;
  const periodo = document.getElementById('copiarPeriodo').value;
  if (!data) { toast('Escolha uma data de destino.'); return; }

  const btn = document.getElementById('btnConfirmarCopiar');
  btn.textContent = 'Copiando...'; btn.disabled = true;

  try {
    const payload = {
      data,
      periodo,
      horario:  refeicaoParaCopiar.horario,
      tipo:     refeicaoParaCopiar.tipo,
      alimentos: refeicaoParaCopiar.alimentos.map(a => ({
        nome:        a.nome,
        quantidade:  a.quantidade  || '',
        unidade:     a.unidade     || '',
        ingredientes: a.ingredientes || '',
      }))
    };
    const r = await fetch('/api/refeicoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j.success) {
      fecharModalCopiar();
      await carregarDiasComRegistro();
      renderCalendario();
      // Se copiou para o dia que está aberto, recarrega
      if (data === dataSelecionada) await carregarRefeicoes();
      toast('📋 Refeição copiada!');
    } else {
      toast('Erro ao copiar.');
    }
  } catch { toast('Erro ao copiar.'); }
  finally { btn.textContent = 'Copiar'; btn.disabled = false; }
});

// ── Modal PDF ─────────────────────────────────────────────────────────────────
document.getElementById('btnExportarPDF').addEventListener('click',()=>document.getElementById('modalPDF').classList.add('aberto'));
document.getElementById('fecharModalPDF').addEventListener('click',()=>document.getElementById('modalPDF').classList.remove('aberto'));
document.getElementById('btnCancelarPDF').addEventListener('click',()=>document.getElementById('modalPDF').classList.remove('aberto'));
document.getElementById('modalPDF').addEventListener('click',e=>{ if(e.target===e.currentTarget)document.getElementById('modalPDF').classList.remove('aberto'); });

document.getElementById('btnGerarPDF').addEventListener('click',async()=>{
  const nome=document.getElementById('pdfNome').value.trim()||'Paciente';
  const inicio=document.getElementById('pdfInicio').value;
  const fim=document.getElementById('pdfFim').value;
  const btn=document.getElementById('btnGerarPDF'); btn.textContent='Gerando...'; btn.disabled=true;
  try {
    const r=await fetch('/api/exportar-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome_paciente:nome,data_inicio:inicio||null,data_fim:fim||null})});
    if(!r.ok) throw new Error();
    const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`diario_alimentar_${nome.replace(/\s+/g,'_')}.pdf`; a.click(); URL.revokeObjectURL(url);
    document.getElementById('modalPDF').classList.remove('aberto'); toast('📄 PDF gerado!');
  } catch { toast('Erro ao gerar PDF.'); }
  finally { btn.textContent='Gerar PDF'; btn.disabled=false; }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async()=>{
  await carregarMe();
  await carregarDiasComRegistro();
  renderCalendario();
  await selecionarDia(hojeISO());
})();

// ── PWA — Registro do Service Worker ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('SW não registrado:', err));
  });
}