let usuarios = [];

async function carregar() {
  const r = await fetch('/api/admin/usuarios');
  if (r.status === 403) { window.location.href = '/'; return; }
  usuarios = await r.json();
  renderTab('pendentes');
  const n = usuarios.filter(u => u.status === 'pendente').length;
  document.getElementById('cntPendente').textContent = n || '';
}

function renderTab(tab) {
  const mapa = { pendentes:'pendente', ativos:'ativo', bloqueados:'bloqueado' };
  const status = mapa[tab];
  const lista  = document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`);
  const filtro = usuarios.filter(u => u.status === status && !u.is_admin);

  lista.innerHTML = '';
  if (!filtro.length) {
    lista.innerHTML = `<div class="vazio-admin">Nenhum usuário ${status} no momento.</div>`;
    return;
  }

  filtro.forEach(u => {
    const card = document.createElement('div');
    card.className = 'user-card';
    const data = new Date(u.criado_em).toLocaleDateString('pt-BR');
    let acoes = '';
    if (u.status === 'pendente') {
      acoes = `<button class="btn-aprovar"  onclick="mudar(${u.id},'ativo')">Aprovar</button>
               <button class="btn-bloquear" onclick="mudar(${u.id},'bloqueado')">Rejeitar</button>`;
    } else if (u.status === 'ativo') {
      acoes = `<button class="btn-bloquear" onclick="mudar(${u.id},'bloqueado')">Bloquear</button>`;
    } else {
      acoes = `<button class="btn-reativar" onclick="mudar(${u.id},'ativo')">Reativar</button>`;
    }
    card.innerHTML = `
      <div class="user-info">
        <div class="user-nome">${u.nome}</div>
        <div class="user-detalhe">@${u.username} · ${u.email}</div>
        <div class="user-detalhe">Cadastrado em ${data}</div>
      </div>
      <div class="user-acoes">${acoes}</div>`;
    lista.appendChild(card);
  });
}

async function mudar(uid, status) {
  await fetch(`/api/admin/usuarios/${uid}/status`, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({status})
  });
  await carregar();
  // Volta para a aba correta
  const tabAtual = document.querySelector('.admin-tab.ativo').dataset.tab;
  renderTab(tabAtual);
}

// Tabs
document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    ['Pendentes','Ativos','Bloqueados'].forEach(t =>
      document.getElementById(`tab${t}`).style.display = 'none'
    );
    const tab = btn.dataset.tab;
    document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).style.display = 'flex';
    renderTab(tab);
  });
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', {method:'POST'});
  window.location.href = '/login';
});

carregar();
