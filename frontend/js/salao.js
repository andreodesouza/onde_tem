// Força a recarga da página caso o utilizador use o botão "Voltar" do navegador[cite: 20]
const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://127.0.0.1:8000"
  : "/api";

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// Verifica se o usuário está logado antes de rodar qualquer outra coisa na página[cite: 20]
const usuarioLogadoStr = localStorage.getItem('usuarioLogado') ||
  localStorage.getItem('usuario_logado') ||
  sessionStorage.getItem('usuarioLogado');

if (!usuarioLogadoStr) {
  // Cria a estrutura do Modal Moderno[cite: 20]
  const modalOverlay = document.createElement('div');
  modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
        font-family: 'Poppins', sans-serif;
        animation: fadeIn 0.3s ease;
    `;

  const modalBox = document.createElement('div');
  modalBox.style.cssText = `
        background: #ffffff;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 380px;
        text-align: center;
        transform: scale(0.9);
        animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

  modalBox.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
        <h3 style="color: #2d3748; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Acesso Restrito</h3>
        <p style="color: #718096; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
            Você precisa estar conectado à sua conta para aceder a esta página.
        </p>
        <button id="btn-ir-login" style="
            background: #6c5ce7;
            color: white;
            border: none;
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        ">Fazer Login</button>
    `;

  const styleSheet = document.createElement('style');
  styleSheet.innerHTML = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
  document.head.appendChild(styleSheet);

  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  const redirecionar = () => {
    window.location.href = 'login.html';
  };

  document.getElementById('btn-ir-login').addEventListener('click', redirecionar);
  setTimeout(redirecionar, 3000);

  throw new Error("Acesso negado: usuário não autenticado.");
}

// ==========================================
// CÓDIGO PRINCIPAL (só roda se estiver logado)
// ==========================================

let carrinhoServicos = [];

document.addEventListener("DOMContentLoaded", () => {
  verificarEstadoLoginHeader();

  const urlParams = new URLSearchParams(window.location.search);
  const salaoId = urlParams.get("id");

  if (!salaoId) {
    alert("Nenhum salão selecionado!");
    window.location.href = "app.html";
    return;
  }

  carregarDadosSalao(salaoId);
});

// Renderiza o menu em cascata no cabeçalho da página do salão
function verificarEstadoLoginHeader() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  const btnLoginHeader = headerActions.querySelector('.btn-login-header');

  let usuario;
  try {
    usuario = JSON.parse(usuarioLogadoStr);
  } catch (e) {
    usuario = { nome: "Conta", tipo: "cliente" };
  }

  const nomeExibicao = usuario.nome || usuario.email || "Minha Conta";
  const isSalao = usuario.tipo === 'empresa';
  const linkPainel = isSalao ? 'salao_dashboard.html' : 'user_dashboard.html';
  const textoPainel = isSalao ? 'Painel do Salão' : 'Painel do Utilizador';

  const userMenuContainer = document.createElement('div');
  userMenuContainer.className = 'user-menu-container';

  userMenuContainer.innerHTML = `
    <button class="btn-user-dropdown" id="btn-dropdown-toggle" type="button">
      👤 ${nomeExibicao.split(' ')[0]} ▾
    </button>
    <div class="dropdown-content" id="dropdown-menu">
      <a href="${linkPainel}">${textoPainel}</a>
      <hr>
      <button id="btn-sair-sessao" type="button" style="color: #e53e3e;">Terminar Sessão</button>
    </div>
  `;

  if (btnLoginHeader) {
    btnLoginHeader.replaceWith(userMenuContainer);
  } else {
    headerActions.appendChild(userMenuContainer);
  }

  const toggleBtn = document.getElementById('btn-dropdown-toggle');
  const dropdownMenu = document.getElementById('dropdown-menu');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });

  dropdownMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  window.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
  });

  document.getElementById('btn-sair-sessao').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario_logado');
    localStorage.removeItem('usuarioLogado');
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'login.html';
  });
}

async function carregarDadosSalao(id) {
  try {
    const res = await fetch(`${API_URL}/api/saloes/${id}`);
    if (!res.ok) throw new Error("Erro ao buscar dados do estabelecimento.");

    const salao = await res.json();
    renderizarDetalhes(salao);
    renderizarServicos(salao.servicos_detalhados || []);
  } catch (error) {
    console.error(error);
    document.getElementById("salao-nome").innerText = "Estabelecimento não encontrado.";
  }
}

function renderizarDetalhes(salao) {
  document.title = `${salao.nome} — Onde Tem?`;
  document.getElementById("salao-nome").innerText = salao.nome;
  document.getElementById("salao-banner").src = salao.img;
  document.getElementById("salao-especialidades").innerText = salao.servicos;
  document.getElementById("salao-endereco").innerText = `📍 ${salao.endereco || "Endereço não informado"}`;
  document.getElementById("salao-horario").innerText = `🕒 ${salao.horario || "Horário a consultar"}`;
  document.getElementById("salao-rating").innerText = salao.avaliacao?.toFixed(1) || "5.0";
  document.getElementById("salao-reviews").innerText = `(${salao.total_avaliacoes || 0})`;

  const btnWhats = document.getElementById("btn-whatsapp");
  if (salao.telefone) {
    const numLimpo = salao.telefone.replace(/\D/g, "");
    btnWhats.href = `https://wa.me/55${numLimpo}?text=Olá,%20vi%20o%20${encodeURIComponent(salao.nome)}%20no%20Onde%20Tem!`;
  } else {
    btnWhats.style.display = "none";
  }
}

function renderizarServicos(servicos) {
  const container = document.getElementById("lista-servicos");
  container.innerHTML = "";

  if (servicos.length === 0) {
    container.innerHTML = "<p>Nenhum serviço disponível no momento.</p>";
    return;
  }

  servicos.forEach(servico => {
    const card = document.createElement("div");
    card.className = "item-servico";

    card.innerHTML = `
      <div class="servico-detalhes">
        <h3>${servico.nome}</h3>
        <p>${servico.descricao}</p>
        <span class="servico-meta">⏱️ Duração média: ${servico.duracao_min} min</span>
      </div>
      <div class="servico-acao">
        <span class="servico-preco">R$ ${servico.preco.toFixed(2).replace('.', ',')}</span>
        <button class="btn-selecionar" id="btn-srv-${servico.id}" onclick="alternarServico('${servico.id}', '${servico.nome}', ${servico.preco})">
          Adicionar
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function alternarServico(id, nome, preco) {
  const index = carrinhoServicos.findIndex(s => s.id === id);
  const btn = document.getElementById(`btn-srv-${id}`);

  if (index > -1) {
    carrinhoServicos.splice(index, 1);
    btn.classList.remove("selecionado");
    btn.innerText = "Adicionar";
  } else {
    carrinhoServicos.push({ id, nome, preco });
    btn.classList.add("selecionado");
    btn.innerText = "Remover";
  }

  atualizarResumo();
}

function atualizarResumo() {
  const containerResumo = document.getElementById("itens-selecionados");
  const elementoTotal = document.getElementById("valor-total");
  const btnContinuar = document.getElementById("btn-continuar-agendamento");

  if (carrinhoServicos.length === 0) {
    containerResumo.innerHTML = '<p class="empty-msg">Nenhum serviço selecionado ainda.</p>';
    elementoTotal.innerText = "R$ 0,00";
    btnContinuar.disabled = true;
    return;
  }

  containerResumo.innerHTML = "";
  let total = 0;

  carrinhoServicos.forEach(item => {
    total += item.preco;
    const linha = document.createElement("div");
    linha.className = "resumo-item";
    linha.innerHTML = `
      <span>${item.nome}</span>
      <strong>R$ ${item.preco.toFixed(2).replace('.', ',')}</strong>
    `;
    containerResumo.appendChild(linha);
  });

  elementoTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
  btnContinuar.disabled = false;
}

document.getElementById("btn-continuar-agendamento").addEventListener("click", () => {
  sessionStorage.setItem("agendamento_itens", JSON.stringify(carrinhoServicos));
  alert("Próxima etapa: Integração com calendário/horários disponíveis!");
});