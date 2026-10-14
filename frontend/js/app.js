const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://127.0.0.1:8000"
  : "/api";

document.addEventListener("DOMContentLoaded", () => {
  inicializarMapa();
  carregarSaloesDaAPI();
  configurarFiltrosCategorias();
  configurarBusca();
  verificarEstadoLoginHeader();
});

let map;
let marcadores = [];

function inicializarMapa() {
  const elementoMapa = document.getElementById("map");
  if (!elementoMapa) return;

  map = L.map("map", { zoomControl: false }).setView([-22.9345, -42.4951], 14);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 15);
        L.marker([latitude, longitude]).addTo(map).bindPopup("Você está aqui!").openPopup();
      },
      () => {
        console.log("Geolocalização não permitida ou indisponível.");
      }
    );
  }
}

async function carregarSaloesDaAPI() {
  const containerCards = document.getElementById("container-cards");
  if (!containerCards) return;

  try {
    containerCards.innerHTML = "<p>A carregar estabelecimentos...</p>";

    const resposta = await fetch(`${API_URL}/api/saloes`);
    const saloes = resposta.ok ? await resposta.json() : [];

    containerCards.innerHTML = "";

    if (saloes.length === 0) {
      containerCards.innerHTML = "<p class='text-muted'>Nenhum salão encontrado no momento.</p>";
      return;
    }

    saloes.forEach((salao, index) => {
      const servicosTexto = (salao.servicos || "").toLowerCase();

      const cardHTML = `
        <div class="card-salao" data-index="${index}" data-servicos="${servicosTexto}">
            <img src="${salao.img || 'assets/img/icon-192.png'}" alt="${salao.nome}" class="card-img">
            <div class="card-body">
                <h3>${salao.nome}</h3>
                <p class="card-text">${salao.servicos}</p>
                <button class="btn-agendar" onclick="abrirAgendamento('${salao.id}', '${salao.nome}')">Agendar</button>
            </div>
        </div>`;
      containerCards.insertAdjacentHTML("beforeend", cardHTML);

      if (salao.lat && salao.lng) {
        const marker = L.marker([salao.lat, salao.lng]).addTo(map);
        marker.bindPopup(`<b>${salao.nome}</b><br>${salao.servicos}`);
        marcadores.push(marker);
      }
    });

  } catch (error) {
    console.error("Erro ao comunicar com o FastAPI:", error);
    containerCards.innerHTML = "<p class='text-danger'>Erro ao carregar dados do servidor.</p>";
  }
}

function configurarFiltrosCategorias() {
  const categorias = document.querySelectorAll(".category-item");

  categorias.forEach((item) => {
    item.addEventListener("click", () => {
      const filtro = item.getAttribute("data-categoria").toLowerCase().trim();
      const cards = document.querySelectorAll(".card-salao");

      categorias.forEach((c) => c.classList.remove("ativo"));
      item.classList.add("ativo");

      cards.forEach((card) => {
        const servicosCard = card.getAttribute("data-servicos") || "";

        if (filtro === "todos" || servicosCard.includes(filtro)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
}

function configurarBusca() {
  const inputBusca = document.getElementById("input-busca");
  if (!inputBusca) return;

  inputBusca.addEventListener("input", (e) => {
    const termo = e.target.value.toLowerCase();
    const cards = document.querySelectorAll(".card-salao");

    cards.forEach((card) => {
      const titulo = card.querySelector("h3").innerText.toLowerCase();
      const servicos = card.querySelector(".card-text").innerText.toLowerCase();

      if (titulo.includes(termo) || servicos.includes(termo)) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  });
}

// Verifica o estado da sessão e cria o menu em cascata no cabeçalho
function verificarEstadoLoginHeader() {
  const usuarioLogadoStr = localStorage.getItem('usuario_logado') || localStorage.getItem('usuarioLogado') || sessionStorage.getItem('usuarioLogado');
  const headerActions = document.querySelector('.header-actions');

  if (!headerActions) return;

  const btnLoginHeader = headerActions.querySelector('.btn-login-header');

  if (usuarioLogadoStr) {
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
      window.location.href = 'app.html';
    });
  }
}

// Modal Moderno de Acesso Restrito
function mostrarModalRestrito() {
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
}

function abrirAgendamento(salaoId, salaoNome) {
  const usuarioLogado = localStorage.getItem('usuario_logado') || localStorage.getItem('usuarioLogado') || sessionStorage.getItem('usuarioLogado');

  if (!usuarioLogado) {
    mostrarModalRestrito();
    return;
  }

  window.location.href = `salao.html?id=${salaoId}`;
}

function fecharModalAgendamento() {
  const modal = document.getElementById("modal-agendamento");
  if (modal) {
    modal.style.display = "none";
  }
}