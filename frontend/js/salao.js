// Configuração da URL da API (suporta localhost e produção)
const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://127.0.0.1:8000"
  : "/api";

// Força a recarga da página caso o utilizador use o botão "Voltar" do navegador
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// Verifica se o usuário está logado antes de rodar qualquer outra coisa na página
const usuarioLogadoStr = localStorage.getItem('usuarioLogado') ||
  localStorage.getItem('usuario_logado') ||
  sessionStorage.getItem('usuarioLogado');

if (!usuarioLogadoStr) {
  const modalOverlay = document.createElement('div');
  modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(5px);
        display: flex; justify-content: center; align-items: center; z-index: 99999;
        font-family: 'Poppins', sans-serif; animation: fadeIn 0.3s ease;
    `;

  const modalBox = document.createElement('div');
  modalBox.style.cssText = `
        background: #ffffff; padding: 30px; border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); width: 90%; max-width: 380px;
        text-align: center; transform: scale(0.9);
        animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

  modalBox.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
        <h3 style="color: #2d3748; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Acesso Restrito</h3>
        <p style="color: #718096; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
            Você precisa estar conectado à sua conta para aceder a esta página.
        </p>
        <button id="btn-ir-login" style="
            background: #6c5ce7; color: white; border: none; width: 100%;
            padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600;
            cursor: pointer; transition: background 0.2s;
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

  const redirecionar = () => { window.location.href = 'login.html'; };
  document.getElementById('btn-ir-login').addEventListener('click', redirecionar);
  setTimeout(redirecionar, 3000);

  throw new Error("Acesso negado: usuário não autenticado.");
}

// ==========================================
// CÓDIGO PRINCIPAL
// ==========================================

let carrinhoServicos = [];
let horarioSelecionadoSlot = null;
let salaoIdGlobal = null;

document.addEventListener("DOMContentLoaded", () => {
  verificarEstadoLoginHeader();

  const urlParams = new URLSearchParams(window.location.search);
  salaoIdGlobal = urlParams.get("id");

  if (!salaoIdGlobal) {
    alert("Nenhum salão selecionado!");
    window.location.href = "app.html";
    return;
  }

  carregarDadosSalao(salaoIdGlobal);

  const inputData = document.getElementById("input-data-agendamento");
  if (inputData) {
    inputData.valueAsDate = new Date();
    carregarHorariosLivres(salaoIdGlobal, inputData.value, null);

    inputData.addEventListener("change", (e) => {
      const profFiltro = carrinhoServicos.length > 0 ? carrinhoServicos[0].profissional_id : null;
      carregarHorariosLivres(salaoIdGlobal, e.target.value, profFiltro);
    });
  }

  const btnConfirmar = document.getElementById("btn-continuar-agendamento");
  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", finalizarAgendamento);
  }
});

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

  document.getElementById('btn-dropdown-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dropdown-menu').classList.toggle('show');
  });

  window.addEventListener('click', () => {
    const menu = document.getElementById('dropdown-menu');
    if (menu) menu.classList.remove('show');
  });

  document.getElementById('btn-sair-sessao').addEventListener('click', () => {
    localStorage.clear();
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

  // --- NOVO TRATAMENTO DE HORÁRIOS EM ETIQUETAS ---
  const containerHorarioLista = document.getElementById("salao-horario-lista");
  if (containerHorarioLista) {
    containerHorarioLista.innerHTML = "";
    const horarioTexto = salao.horario || "Horário a consultar";

    // Se vier no formato novo separado por " | "
    if (horarioTexto.includes("|")) {
      const diasArray = horarioTexto.split("|");
      diasArray.forEach(item => {
        const span = document.createElement("span");
        span.style.cssText = "background: #f7fafc; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.8rem; color: #4a5568;";
        span.textContent = item.trim();
        containerHorarioLista.appendChild(span);
      });
    } else {
      // Fallback caso seja um texto simples antigo
      const span = document.createElement("span");
      span.style.cssText = "font-size: 0.85rem; color: #4a5568;";
      span.textContent = horarioTexto;
      containerHorarioLista.appendChild(span);
    }
  }
  // ---------------------------------------------

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

  if (!servicos || servicos.length === 0) {
    container.innerHTML = "<p>Nenhum serviço disponível no momento.</p>";
    return;
  }

  servicos.forEach(servico => {
    const card = document.createElement("div");
    card.className = "item-servico";

    // Mapeia todas as possíveis variações de nome do ID do profissional vindas da API
    const profId = servico.profissional_id !== undefined ? servico.profissional_id :
      (servico.id_profissional !== undefined ? servico.id_profissional : null);

    card.innerHTML = `
      <div class="servico-detalhes">
        <h3>${servico.nome}</h3>
        <p>${servico.descricao || ''}</p>
        <p style="font-size: 0.8rem; color: #482868; margin-top: 4px; font-weight: 500;">
          👤 Profissional: ${servico.profissional_nome || 'Equipe Geral'} (ID: ${profId})
        </p>
        <span class="servico-meta">⏱️ Duração média: ${servico.duracao_min} min</span>
      </div>
      <div class="servico-acao">
        <span class="servico-preco">R$ ${servico.preco.toFixed(2).replace('.', ',')}</span>
        <button class="btn-selecionar" id="btn-srv-${servico.id}" onclick="alternarServico('${servico.id}', '${servico.nome}', ${servico.preco}, ${profId !== null && !isNaN(profId) ? profId : 'null'})">
          Adicionar
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function alternarServico(id, nome, preco, profissionalId) {
  console.log("-> Serviço:", nome, "| ID do Profissional associado:", profissionalId);

  const index = carrinhoServicos.findIndex(s => s.id === id);
  const btn = document.getElementById(`btn-srv-${id}`);

  if (index > -1) {
    carrinhoServicos.splice(index, 1);
    if (btn) {
      btn.classList.remove("selecionado");
      btn.innerText = "Adicionar";
    }
  } else {
    carrinhoServicos.push({ id, nome, preco, profissional_id: profissionalId });
    if (btn) {
      btn.classList.add("selecionado");
      btn.innerText = "Remover";
    }
  }

  atualizarResumo();

  const inputData = document.getElementById("input-data-agendamento");
  if (inputData && inputData.value) {
    // Se houver serviços no carrinho, pega o profissional_id do primeiro serviço selecionado
    const profFiltro = carrinhoServicos.length > 0 ? carrinhoServicos[0].profissional_id : null;
    console.log("-> A filtrar horários na API para o profissional_id:", profFiltro);
    carregarHorariosLivres(salaoIdGlobal, inputData.value, profFiltro);
  }
}

async function carregarHorariosLivres(empresaId, data, profissionalId = null) {
  const container = document.getElementById("lista-horarios-disponiveis");
  container.innerHTML = "<p style='font-size: 0.8rem; color: #718096;'>A carregar horários...</p>";
  horarioSelecionadoSlot = null;
  validarBotaoContinuar();

  try {
    let url = `${API_URL}/api/agenda/livres?empresa_id=${empresaId}&data=${data}`;
    if (profissionalId && profissionalId !== 'null' && profissionalId !== null && profissionalId !== 'undefined' && !isNaN(profissionalId)) {
      url += `&profissional_id=${profissionalId}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const horarios = await res.json();

    container.innerHTML = "";

    if (!horarios || horarios.length === 0) {
      container.innerHTML = "<p style='font-size: 0.8rem; color: #e53e3e;'>Sem horários livres para este profissional nesta data.</p>";
      return;
    }

    horarios.forEach(slot => {
      const btnSlot = document.createElement("button");
      btnSlot.type = "button";
      btnSlot.className = "btn-slot-horario";
      btnSlot.style.cssText = `
        padding: 6px 10px; background: #fff; border: 1px solid #cbd5e0;
        border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: 500;
        transition: all 0.2s;
      `;
      btnSlot.textContent = `${slot.hora} (${slot.profissional})`;

      btnSlot.addEventListener("click", () => {
        document.querySelectorAll('.btn-slot-horario').forEach(b => {
          b.style.background = "#fff";
          b.style.color = "#2d3748";
          b.style.borderColor = "#cbd5e0";
        });
        btnSlot.style.background = "#6c5ce7";
        btnSlot.style.color = "#fff";
        btnSlot.style.borderColor = "#6c5ce7";

        horarioSelecionadoSlot = `${data} ${slot.hora}`;
        validarBotaoContinuar();
      });

      container.appendChild(btnSlot);
    });
  } catch (err) {
    container.innerHTML = "<p style='font-size: 0.8rem; color: #e53e3e;'>Erro ao carregar horários.</p>";
  }
}

function atualizarResumo() {
  const containerResumo = document.getElementById("itens-selecionados");
  const elementoTotal = document.getElementById("valor-total");

  if (carrinhoServicos.length === 0) {
    containerResumo.innerHTML = '<p class="empty-msg">Nenhum serviço selecionado ainda.</p>';
    elementoTotal.innerText = "R$ 0,00";
    validarBotaoContinuar();
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
  validarBotaoContinuar();
}

function validarBotaoContinuar() {
  const btnContinuar = document.getElementById("btn-continuar-agendamento");
  if (!btnContinuar) return;

  if (carrinhoServicos.length > 0 && horarioSelecionadoSlot) {
    btnContinuar.disabled = false;
  } else {
    btnContinuar.disabled = true;
  }
}

async function finalizarAgendamento() {
  let usuario;
  try {
    usuario = JSON.parse(usuarioLogadoStr);
  } catch (e) {
    usuario = { nome: "Cliente", email: "cliente@teste.com" };
  }

  if (carrinhoServicos.length === 0 || !horarioSelecionadoSlot) {
    alert("Selecione pelo menos um serviço e um horário.");
    return;
  }

  const btnConfirmar = document.getElementById("btn-continuar-agendamento");
  if (btnConfirmar) {
    btnConfirmar.innerText = "A bloquear horário...";
    btnConfirmar.disabled = true;
  }

  try {
    // 1. CRIA O AGENDAMENTO COMO 'PENDENTE' IMEDIATAMENTE (Trava o horário na BD)
    const servicoPrincipal = carrinhoServicos[0];
    const payloadAgendamento = {
      empresa_id: parseInt(salaoIdGlobal),
      servico_id: parseInt(servicoPrincipal.id),
      cliente_nome: usuario.nome || usuario.email || "Cliente Onde Tem",
      data_hora: horarioSelecionadoSlot
    };

    const resAgendamento = await fetch(`${API_URL}/api/agendamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadAgendamento)
    });

    if (!resAgendamento.ok) {
      throw new Error("Este horário já não está disponível ou ocorreu um erro ao bloquear.");
    }

    const dadosAgendamento = await resAgendamento.json();
    agendamentoIdCriado = dadosAgendamento.id; // Guarda o ID para atualizar o status depois

    // 2. COM O HORÁRIO JÁ TRAVADO, GERA O PIX NO MERCADO PAGO
    let valorTotal = carrinhoServicos.reduce((acc, s) => acc + s.preco, 0);
    let nomesServicos = carrinhoServicos.map(s => s.nome).join(", ");

    const responsePix = await fetch(`${API_URL}/api/criar-pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_amount: parseFloat(valorTotal),
        description: `Agendamento: ${nomesServicos}`,
        payer_email: usuario.email || "cliente@teste.com",
        empresa_id: parseInt(salaoIdGlobal),
        cliente_nome: usuario.nome || usuario.email || "Cliente Onde Tem"
      })
    });

    const resultadoPix = await responsePix.json();
    if (!responsePix.ok) throw new Error(resultadoPix.detail || "Erro ao gerar pagamento Pix.");

    if (btnConfirmar) {
      btnConfirmar.innerText = "Confirmar Agendamento";
      btnConfirmar.disabled = false;
    }

    // 3. ABRE O MODAL DO PIX COM O CRONÓMETRO JÁ COM O HORÁRIO BLOQUEADO NA BD
    mostrarModalPix(resultadoPix.qr_code, resultadoPix.qr_code_base64);

  } catch (err) {
    alert(err.message);
    if (btnConfirmar) {
      btnConfirmar.innerText = "Confirmar Agendamento";
      btnConfirmar.disabled = false;
    }
  }
}

// Função auxiliar modificada para gravar os agendamentos após o cliente interagir com o Pix
async function confirmarGravacaoAgendamentos() {
  if (!agendamentoIdCriado) return false;

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoIdCriado}/atualizar-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmado" })
    });

    if (!res.ok) throw new Error("Erro ao atualizar status para confirmado.");
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function cancelarAgendamentoPendente() {
  if (!agendamentoIdCriado) return;

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoIdCriado}/atualizar-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" })
    });

    if (!res.ok) throw new Error("Erro ao cancelar o agendamento.");
    console.log("Agendamento cancelado com sucesso por expiração/desistência.");
  } catch (err) {
    console.error("Erro ao cancelar agendamento expirado:", err);
  }
}

let temporizadorPixId = null;

function mostrarModalPix(copiaECola, qrBase64) {
  // Limpa qualquer temporizador anterior se houver
  if (temporizadorPixId) clearInterval(temporizadorPixId);

  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center; z-index: 99999;
        font-family: 'Poppins', sans-serif;
    `;

  overlay.innerHTML = `
        <div style="background: #fff; padding: 30px; border-radius: 16px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="color: #472969; font-size: 20px; font-weight: 600; margin-bottom: 4px;">Pagamento via Pix</h3>
            <p id="texto-tempo-pix" style="color: #e53e3e; font-size: 13px; font-weight: 600; margin-bottom: 12px;">Expira em: 05:00</p>
            <p style="color: #718096; font-size: 12px; margin-bottom: 14px;">Escaneie o QR Code abaixo ou utilize o Pix Copia e Cola para concluir.</p>
            
            ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR Code Pix" style="width: 160px; height: 160px; margin-bottom: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">` : ''}
            
            <textarea readonly style="width: 100%; height: 60px; font-size: 11px; padding: 8px; border: 1px solid #cbd5e0; border-radius: 8px; resize: none; background: #f8fafc; margin-bottom: 12px;">${copiaECola}</textarea>
            
            <button id="btn-copiar-pix" style="background: #472969; color: #fff; border: none; width: 100%; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 8px;">📋 Copiar Código Pix</button>
            
            <button id="btn-simular-aprovado" style="background: #27ae60; color: #fff; border: none; width: 100%; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 8px;">💳 Simular Pagamento Aprovado (Teste)</button>
            
            <button id="btn-fechar-pix" style="background: #e2e8f0; color: #4a5568; border: none; width: 100%; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;">Cancelar / Fechar</button>
        </div>
    `;

  document.body.appendChild(overlay);

  // Botão Copiar Pix
  document.getElementById("btn-copiar-pix").addEventListener("click", () => {
    navigator.clipboard.writeText(copiaECola);
    alert("Código Pix Copia e Cola copiado com sucesso!");
  });

  // Botão Simular Aprovado
  document.getElementById("btn-simular-aprovado").addEventListener("click", async () => {
    if (temporizadorPixId) clearInterval(temporizadorPixId);
    const btn = document.getElementById("btn-simular-aprovado");
    btn.innerText = "A processar pagamento e agendamento...";
    btn.disabled = true;

    const sucesso = await confirmarGravacaoAgendamentos();

    if (sucesso) {
      alert("🎉 Pagamento simulado com sucesso e agendamento registado!");
      document.body.removeChild(overlay);
      window.location.href = "user_dashboard.html";
    } else {
      btn.innerText = "💳 Simular Pagamento Aprovado (Teste)";
      btn.disabled = false;
    }
  });

  // Botão Cancelar Manual
  document.getElementById("btn-fechar-pix").addEventListener("click", async () => {
    if (temporizadorPixId) clearInterval(temporizadorPixId);
    await cancelarAgendamentoPendente();
    document.body.removeChild(overlay);
  });

  // --- CONFIGURAÇÃO DO CRONÓMETRO DE 5 MINUTOS ---
  let tempoRestante = 60; // 60 segundos = 1 minuto
  const elementoTempo = document.getElementById("texto-tempo-pix");

  temporizadorPixId = setInterval(async () => {
    tempoRestante--;

    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;

    elementoTempo.innerText = `Expira em: ${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    if (tempoRestante <= 0) {
      clearInterval(temporizadorPixId);
      alert("⏰ O tempo para pagamento expirou. O agendamento foi cancelado e o horário foi libertado.");

      // Cancela o agendamento no backend para libertar o horário
      await cancelarAgendamentoPendente();

      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      window.location.reload();
    }
  }, 1000);
}

// Função auxiliar para cancelar/libertar o horário se expirar ou for cancelado
// Função auxiliar para cancelar/libertar o horário se expirar ou for cancelado
async function cancelarAgendamentoPendente() {
  if (!agendamentoIdCriado) return;

  try {
    const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoIdCriado}/atualizar-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" })
    });

    if (!res.ok) throw new Error("Erro ao cancelar o agendamento.");
    console.log("Agendamento cancelado com sucesso.");
  } catch (err) {
    console.error("Erro ao cancelar agendamento:", err);
  }
}