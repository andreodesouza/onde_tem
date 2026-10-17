// Configuração da URL da API (suporta localhost e produção)
const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "/api";

window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

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

    document.body.appendChild(modalOverlay);
    modalOverlay.appendChild(modalBox);

    const redirecionar = () => { window.location.href = 'login.html'; };
    document.getElementById('btn-ir-login').addEventListener('click', redirecionar);
    setTimeout(redirecionar, 3000);

    throw new Error("Acesso negado.");
}

let meusAgendamentos = [];
let listaSaloesParceiros = [];
let listaCompleta = false;

const iconeServico = `
<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <path d="M30 14c2-6 1-10-2-12 4 1 8 5 9 11" stroke="#472969" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M18 34c-4 1-8 5-8 10h22c0-6-3-10-8-12" stroke="#472969" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M20 33c-1-8 1-16 8-20 2 6 1 12-2 16" stroke="#472969" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="27" cy="22" r="5.5" stroke="#472969" stroke-width="1.6"/>
  <path d="M14 16l1.2 2.4 2.6.2-2 1.7.6 2.5L14 21.4 11.6 22.8l.6-2.5-2-1.7 2.6-.2L14 16z" fill="#472969"/>
  <path d="M36 20l.8 1.6 1.8.1-1.4 1.1.4 1.7-1.6-.9-1.6.9.4-1.7-1.4-1.1 1.8-.1L36 20z" fill="#472969"/>
</svg>`;

const iconeCalendario = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/>
  <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

function obterUsuario() {
    try {
        return JSON.parse(localStorage.getItem("usuario_logado") || localStorage.getItem("usuarioLogado")) || null;
    } catch (error) {
        return null;
    }
}

function atualizarDadosNaTela(usuario) {
    const nome = usuario?.nome || "visitante";

    document.getElementById("sidebar-nome").textContent = nome;
    document.getElementById("main-nome").textContent = nome;
    document.getElementById("agendamentos-nome").textContent = nome;
    document.getElementById("perfil-nome").textContent = nome === "visitante" ? "—" : nome;
    document.getElementById("perfil-email").textContent = usuario?.email || "—";
    document.getElementById("perfil-telefone").textContent = usuario?.telefone || "—";

    const partesEndereco = [
        usuario?.rua ? `${usuario.rua}${usuario?.numero ? `, nº ${usuario.numero}` : ''}` : '',
        usuario?.bairro,
        usuario?.cidade,
        usuario?.estado
    ].filter(Boolean);

    document.getElementById("perfil-endereco").textContent = partesEndereco.length ? partesEndereco.join(", ") : "—";
}

function aplicarAvatar(foto) {
    const temFoto = Boolean(foto);

    [
        ["btn-avatar", "avatar-img", "avatar-vazio"],
        ["avatar-perfil", "avatar-perfil-img", "avatar-perfil-vazio"]
    ].forEach(([caixaId, imgId, vazioId]) => {
        const caixa = document.getElementById(caixaId);
        const img = document.getElementById(imgId);
        const vazio = document.getElementById(vazioId);

        if (!caixa || !img || !vazio) return;

        caixa.classList.toggle("tem-foto", temFoto);
        vazio.hidden = temFoto;
        vazio.style.display = temFoto ? "none" : "";

        if (temFoto) {
            img.src = foto;
            img.hidden = false;
        } else {
            img.removeAttribute("src");
            img.hidden = true;
        }
    });

    const btnRemover = document.getElementById("btn-remover-foto");
    if (btnRemover) btnRemover.hidden = !temFoto;
}

async function buscarCep(cep) {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();

        if (!data.erro) {
            document.getElementById("input-edit-rua").value = data.logradouro || "";
            document.getElementById("input-edit-bairro").value = data.bairro || "";
            document.getElementById("input-edit-cidade").value = data.localidade || "";
            document.getElementById("input-edit-estado").value = data.uf || "";
            document.getElementById("input-edit-numero").focus();
        } else {
            alert("CEP não encontrado.");
        }
    } catch (err) {
        console.error("Erro ao buscar CEP:", err);
    }
}

function mostrarMensagemSenha(texto, erro) {
    const msg = document.getElementById("form-senha-msg");
    if (!msg) return;
    msg.textContent = texto;
    msg.classList.toggle("is-erro", Boolean(erro));
    msg.hidden = !texto;
}

function atualizarStats() {
    const elAgendados = document.getElementById("stat-agendamentos");
    const elConfirmados = document.getElementById("stat-confirmados");
    const elFinalizados = document.getElementById("stat-finalizados");

    const ativos = meusAgendamentos.filter(a => a.status !== "concluido" && a.status !== "recusado" && a.status !== "cancelado");
    const confirmados = meusAgendamentos.filter(a => a.status === "confirmado");
    const finalizados = meusAgendamentos.filter(a => a.status === "concluido");

    if (elAgendados) elAgendados.textContent = String(ativos.length);
    if (elConfirmados) elConfirmados.textContent = String(confirmados.length);
    if (elFinalizados) elFinalizados.textContent = String(finalizados.length);
}

function acaoDoItem(item) {
    if (item.status === "pendente" || item.status === "confirmado") {
        const textoBadge = item.status === "pendente" ? "Pendente" : "Confirmado";
        const estiloBadge = item.status === "pendente" ? "background: #fef3c7; color: #d97706;" : "background: #e0f2fe; color: #0284c7;";

        return `
            <div style="display: flex; gap: 6px; align-items: center;">
                <span class="badge" style="${estiloBadge}">${textoBadge}</span>
                <button type="button" class="btn-cancelar-ag" data-id="${item.id}" data-empresa="${item.empresa_id}" style="background: #fee2e2; color: #dc2626; border: none; height: 30px; padding: 0 10px; border-radius: 999px; font-size: 11px; cursor: pointer; font-weight: 500;">Cancelar</button>
            </div>
        `;
    }
    if (item.status === "concluido") return `<span class="badge finalizado">Finalizado</span>`;
    if (item.status === "cancelado") return `<span class="badge" style="background: #f3f4f6; color: #6b7280;">Cancelado</span>`;
    if (item.status === "recusado") return `<span class="badge" style="background: #fee2e2; color: #dc2626;">Recusado</span>`;
    return `<span class="badge">${item.status}</span>`;
}

function renderItem(item) {
    return `
    <article class="agendamento">
      <div class="agendamento-conteudo-principal">
        <div class="agendamento-icone">${iconeServico}</div>
        <div class="agendamento-info">
          <div class="agendamento-meta">
            <span>${iconeCalendario} ${item.data_hora || item.data}</span>
            <span>👤 ${item.profissional_nome || 'Equipe Geral'}</span>
          </div>
          <h3>${item.servico_nome || item.servico || 'Procedimento'}</h3>
          <p>Salão: ${item.salao_nome || 'Estabelecimento'}</p>
        </div>
      </div>
      <div class="agendamento-acao">${acaoDoItem(item)}</div>
    </article>`;
}

function termoBusca() {
    const input = document.getElementById("busca-procedimento");
    return input ? input.value.trim().toLowerCase() : "";
}

function escapar(texto) {
    return String(texto).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function filtrarPorServico(lista) {
    const termo = termoBusca();
    if (!termo) return lista.slice();
    return lista.filter((item) => {
        const txt = `${item.servico_nome || item.servico || ''} ${item.salao_nome || ''}`.toLowerCase();
        return txt.includes(termo);
    });
}

function filtrarSaloes() {
    const termo = termoBusca();
    if (!termo) return listaSaloesParceiros.slice();
    return listaSaloesParceiros.filter((salao) => {
        const campos = `${salao.nome} ${salao.endereco} ${salao.servicos}`.toLowerCase();
        return campos.includes(termo);
    });
}

const iconeCoracao = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.4l-1.1-1C6.2 14.2 3.5 11.7 3.5 8.6 3.5 6.2 5.3 4.4 7.7 4.4c1.4 0 2.7.6 3.6 1.7.9-1.1 2.2-1.7 3.6-1.7 2.4 0 4.2 1.8 4.2 4.2 0 3.1-2.7 5.6-7.4 9.8L12 19.4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const iconeEstrela = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.2 4.6 5 .7-3.6 3.5.9 5.1L12 15.1 7.5 17.5l.9-5.1L4.8 8.9l5-.7L12 3.6z"/></svg>`;

function renderSalao(salao) {
    const ativo = salao.favorito ? " is-ativo" : "";
    const imagemCapa = salao.img || "assets/img/saloes/bella.jpg";

    return `
    <article class="salao">
      <div class="salao-capa">
        <img src="${escapar(imagemCapa)}" alt="" onerror="this.src='assets/img/saloes/bella.jpg'">
        <button type="button" class="salao-favorito${ativo}" data-id="${salao.id}">${iconeCoracao}</button>
        <div class="salao-info">
          <div class="salao-linha">
            <h3>${escapar(salao.nome)}</h3>
            <span class="salao-nota">${iconeEstrela} ${escapar(salao.avaliacao || "5.0")}</span>
          </div>
          <p>${escapar(salao.endereco)}</p>
          <p>${escapar(salao.servicos || "Serviços de Beleza")}</p>
        </div>
      </div>
      <div class="salao-acoes">
        <button type="button" class="btn-salao" data-acao="agendar" data-id="${salao.id}">Agendar</button>
        <button type="button" class="btn-salao" data-acao="perfil" data-id="${salao.id}">Conhecer perfil</button>
      </div>
    </article>`;
}

function renderSaloes() {
    const lista = document.getElementById("lista-saloes");
    if (!lista) return;
    const encontrados = filtrarSaloes();
    lista.innerHTML = encontrados.length ? encontrados.map(renderSalao).join("") : `<p class="saloes-vazio">Nenhum salão encontrado.</p>`;
}

function renderListas() {
    const proximos = filtrarPorServico(meusAgendamentos.filter(a => a.status !== "concluido" && a.status !== "cancelado" && a.status !== "recusado"));
    const listaProximos = document.getElementById("lista-proximos");
    const listaAgendamentos = document.getElementById("lista-agendamentos");

    const origem = listaCompleta ? meusAgendamentos : meusAgendamentos.filter(a => a.status !== "concluido" && a.status !== "cancelado" && a.status !== "recusado");
    const visiveis = filtrarPorServico(origem);

    if (listaProximos) {
        listaProximos.innerHTML = proximos.length ? proximos.map(renderItem).join("") : `<p class="lista-vazia">Nenhum agendamento pendente.</p>`;
    }

    if (listaAgendamentos) {
        listaAgendamentos.innerHTML = visiveis.length ? visiveis.map(renderItem).join("") : `<p class="lista-vazia">Nenhum agendamento registado.</p>`;
    }

    const verTodosAg = document.getElementById("ver-todos-agendamentos");
    if (verTodosAg) {
        verTodosAg.textContent = listaCompleta ? "Ver ativos >" : "Ver todos >";
    }

    renderSaloes();
    atualizarStats();
}

async function carregarDadosCliente(usuario) {
    try {
        const nomeCliente = usuario.nome || usuario.email;
        const resAg = await fetch(`${API_URL}/api/agendamentos/cliente?cliente_nome=${encodeURIComponent(nomeCliente)}`);
        if (resAg.ok) meusAgendamentos = await resAg.json();

        const resSal = await fetch(`${API_URL}/api/saloes`);
        if (resSal.ok) listaSaloesParceiros = await resSal.json();

        const resPerfil = await fetch(`${API_URL}/api/usuarios/perfil?email=${encodeURIComponent(usuario.email)}`);
        if (resPerfil.ok) {
            const dadosPerfil = await resPerfil.json();
            Object.assign(usuario, dadosPerfil);
            localStorage.setItem("usuario_logado", JSON.stringify(usuario));
            localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
            atualizarDadosNaTela(usuario);
            aplicarAvatar(usuario.foto);
        }

        renderListas();
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
    }
}

async function cancelarAgendamentoCliente(evento) {
    const botao = evento.target.closest(".btn-cancelar-ag");
    if (!botao) return;

    if (!confirm("Deseja realmente cancelar este agendamento?")) return;

    const agendamentoId = botao.dataset.id;
    const empresaId = botao.dataset.empresa;

    try {
        const res = await fetch(`${API_URL}/api/agendamentos/${agendamentoId}/status?empresa_id=${empresaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelado" })
        });

        if (res.ok) {
            alert("Agendamento cancelado com sucesso!");
            carregarDadosCliente(obterUsuario());
        } else {
            alert("Erro ao cancelar o agendamento.");
        }
    } catch (err) {
        alert("Erro de conexão.");
    }
}

function mostrarView(nome) {
    document.querySelectorAll(".view").forEach((view) => {
        view.hidden = view.id !== `view-${nome}`;
    });

    document.querySelectorAll(".menu-item").forEach((botao) => {
        botao.classList.toggle("is-active", botao.dataset.view === nome);
    });

    const conteudo = document.querySelector(".conteudo");
    if (conteudo) conteudo.scrollTop = 0;
}

document.addEventListener("DOMContentLoaded", () => {
    let usuario = obterUsuario();
    atualizarDadosNaTela(usuario);
    aplicarAvatar(usuario?.foto || "");
    carregarDadosCliente(usuario);

    const buscaProc = document.getElementById("busca-procedimento");
    if (buscaProc) {
        buscaProc.addEventListener("input", () => {
            const viewAtiva = document.querySelector(".view:not([hidden])");
            if (!viewAtiva || viewAtiva.id !== "view-agendamentos") mostrarView("dashboard");
            renderListas();
        });
    }

    const btnVerTodos = document.getElementById("ver-todos");
    if (btnVerTodos) {
        btnVerTodos.addEventListener("click", () => {
            if (buscaProc) buscaProc.value = "";
            listaCompleta = true;
            mostrarView("agendamentos");
            renderListas();
        });
    }

    const btnVerTodosAg = document.getElementById("ver-todos-agendamentos");
    if (btnVerTodosAg) {
        btnVerTodosAg.addEventListener("click", () => {
            listaCompleta = !listaCompleta;
            renderListas();
        });
    }

    document.getElementById("lista-proximos")?.addEventListener("click", cancelarAgendamentoCliente);
    document.getElementById("lista-agendamentos")?.addEventListener("click", cancelarAgendamentoCliente);

    document.querySelectorAll(".menu-item").forEach((botao) => {
        botao.addEventListener("click", () => {
            if (botao.dataset.view === "agendamentos") listaCompleta = false;
            mostrarView(botao.dataset.view);
            renderListas();
        });
    });

    document.getElementById("btn-avatar")?.addEventListener("click", () => mostrarView("perfil"));

    const inputCep = document.getElementById("input-edit-cep");
    if (inputCep) {
        inputCep.addEventListener("blur", (e) => buscarCep(e.target.value));
    }

    const inputFoto = document.getElementById("input-foto");
    if (inputFoto) {
        inputFoto.addEventListener("change", async (evento) => {
            const arquivo = evento.target.files && evento.target.files[0];
            evento.target.value = "";
            if (!arquivo) return;

            const formData = new FormData();
            formData.append("file", arquivo);

            try {
                const res = await fetch(`${API_URL}/api/usuarios/upload-foto-perfil?email=${encodeURIComponent(usuario.email)}`, {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();
                if (res.ok) {
                    usuario.foto = data.foto_url;
                    localStorage.setItem("usuario_logado", JSON.stringify(usuario));
                    localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
                    aplicarAvatar(usuario.foto);
                } else {
                    alert(data.detail || "Erro ao atualizar foto.");
                }
            } catch (error) {
                alert("Erro de conexão ao enviar foto.");
            }
        });
    }

    const btnRemoverFoto = document.getElementById("btn-remover-foto");
    if (btnRemoverFoto) {
        btnRemoverFoto.addEventListener("click", async () => {
            try {
                const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: usuario.email, foto: "" })
                });

                if (res.ok) {
                    delete usuario.foto;
                    localStorage.setItem("usuario_logado", JSON.stringify(usuario));
                    localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
                    aplicarAvatar("");
                }
            } catch (err) {
                alert("Erro ao remover foto.");
            }
        });
    }

    const btnEditarPerfil = document.getElementById("btn-editar-perfil");
    const formEditarPerfil = document.getElementById("form-editar-perfil");
    const perfilDadosVisualizacao = document.getElementById("perfil-dados-visualizacao");
    const btnCancelarEdit = document.getElementById("btn-cancelar-edit");

    if (btnEditarPerfil && formEditarPerfil) {
        btnEditarPerfil.addEventListener("click", () => {
            document.getElementById("input-edit-nome").value = usuario.nome || "";
            document.getElementById("input-edit-telefone").value = usuario.telefone || "";
            document.getElementById("input-edit-cep").value = usuario.cep || "";
            document.getElementById("input-edit-rua").value = usuario.rua || "";
            document.getElementById("input-edit-numero").value = usuario.numero || "";
            document.getElementById("input-edit-bairro").value = usuario.bairro || "";
            document.getElementById("input-edit-cidade").value = usuario.cidade || "";
            document.getElementById("input-edit-estado").value = usuario.estado || "";

            perfilDadosVisualizacao.hidden = true;
            formEditarPerfil.hidden = false;

            // <--- ADICIONE ESTA LINHA: Garante que o painel rola para o topo ao abrir o formulário
            const painelPerfil = document.querySelector('.perfil-painel');
            if (painelPerfil) painelPerfil.scrollTop = 0;
        });
    }

    if (btnCancelarEdit && formEditarPerfil) {
        btnCancelarEdit.addEventListener("click", () => {
            formEditarPerfil.hidden = true;
            perfilDadosVisualizacao.hidden = false;
        });
    }

    if (formEditarPerfil) {
        formEditarPerfil.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            const dadosAtualizados = {
                email: usuario.email,
                nome: document.getElementById("input-edit-nome").value.trim(),
                telefone: document.getElementById("input-edit-telefone").value.trim(),
                cep: document.getElementById("input-edit-cep").value.trim(),
                rua: document.getElementById("input-edit-rua").value.trim(),
                numero: document.getElementById("input-edit-numero").value.trim(),
                bairro: document.getElementById("input-edit-bairro").value.trim(),
                cidade: document.getElementById("input-edit-cidade").value.trim(),
                estado: document.getElementById("input-edit-estado").value.trim()
            };

            try {
                const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dadosAtualizados)
                });

                const data = await res.json();
                if (res.ok) {
                    Object.assign(usuario, data.usuario);
                    localStorage.setItem("usuario_logado", JSON.stringify(usuario));
                    localStorage.setItem("usuarioLogado", JSON.stringify(usuario));

                    atualizarDadosNaTela(usuario);
                    formEditarPerfil.hidden = true;
                    perfilDadosVisualizacao.hidden = false;
                    alert("Perfil atualizado com sucesso!");
                } else {
                    alert(data.detail || "Erro ao atualizar perfil.");
                }
            } catch (err) {
                alert("Erro de conexão.");
            }
        });
    }

    const formSenha = document.getElementById("form-senha");
    const btnTrocarSenha = document.getElementById("btn-trocar-senha");
    if (btnTrocarSenha && formSenha) {
        btnTrocarSenha.addEventListener("click", () => {
            formSenha.hidden = false;
            mostrarMensagemSenha("");
            document.getElementById("senha-atual")?.focus();
        });
    }

    document.getElementById("btn-cancelar-senha")?.addEventListener("click", () => {
        formSenha.reset();
        formSenha.hidden = true;
        mostrarMensagemSenha("");
    });

    if (formSenha) {
        formSenha.addEventListener("submit", async (evento) => {
            evento.preventDefault();
            const atual = document.getElementById("senha-atual").value;
            const nova = document.getElementById("senha-nova").value;
            const confirma = document.getElementById("senha-confirma").value;

            if (nova.length < 6) {
                mostrarMensagemSenha("A nova senha precisa ter pelo menos 6 caracteres.", true);
                return;
            }
            if (nova !== confirma) {
                mostrarMensagemSenha("A confirmação não confere com a nova senha.", true);
                return;
            }

            try {
                const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: usuario.email, senha_atual: atual, nova_senha: nova })
                });

                const data = await res.json();
                if (res.ok) {
                    formSenha.reset();
                    formSenha.hidden = true;
                    mostrarMensagemSenha("Senha atualizada com sucesso!");
                } else {
                    mostrarMensagemSenha(data.detail || "Erro ao atualizar senha.", true);
                }
            } catch (err) {
                mostrarMensagemSenha("Erro de conexão.", true);
            }
        });
    }

    document.getElementById("btn-sair")?.addEventListener("click", () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "login.html";
    });
});