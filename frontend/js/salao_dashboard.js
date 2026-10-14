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
    window.location.href = 'login.html';
    throw new Error("Acesso negado.");
}

let dadosUsuario = {};
try {
    dadosUsuario = JSON.parse(usuarioLogadoStr);
} catch (e) {
    dadosUsuario = { nome_fantasia: usuarioLogadoStr, id: 67 };
}

const EMPRESA_ID = dadosUsuario.id || localStorage.getItem('empresa_id') || 67;
const NOME_EMPRESA = dadosUsuario.nome_fantasia || dadosUsuario.nome || "Meu Salão";
let ficheiroFotoSelecionado = null;

document.addEventListener('DOMContentLoaded', () => {
    const elNomeSalao = document.getElementById('salao-nome-fantasia');
    const elDetalhes = document.getElementById('salao-detalhes');

    if (elNomeSalao) elNomeSalao.textContent = NOME_EMPRESA;
    if (elDetalhes) elDetalhes.textContent = `Estabelecimento Parceiro | ID: ${EMPRESA_ID}`;

    carregarAgendamentos();
    carregarProfissionais();
    carregarServicos();
    carregarConfiguracoes();
    inicializarMapaConfiguracoes();

    // Inicializa o campo de data da agenda com hoje
    const inputDataAgenda = document.getElementById("input-agenda-data");
    if (inputDataAgenda) {
        inputDataAgenda.valueAsDate = new Date();
        carregarHorariosAgenda(inputDataAgenda.value);

        inputDataAgenda.addEventListener("change", (e) => {
            carregarHorariosAgenda(e.target.value);
        });
    }
});

function mostrarSessao(sessaoId, btnElement) {
    document.querySelectorAll('.sessao-painel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const sessaoDestino = document.getElementById(sessaoId);
    if (sessaoDestino) sessaoDestino.style.display = 'block';

    if (btnElement) {
        btnElement.classList.add('active');
    }

    if (sessaoId === 'configuracoes' && typeof mapaConfig !== 'undefined' && mapaConfig) {
        setTimeout(() => { mapaConfig.invalidateSize(); }, 200);
    }
}

// --- GESTÃO DE AGENDAMENTOS ---
async function carregarAgendamentos() {
    try {
        const response = await fetch(`${API_URL}/api/agendamentos/empresa/${EMPRESA_ID}`);
        if (!response.ok) throw new Error();
        const agendamentos = await response.json();
        renderizarTabelaAgendamentos(agendamentos);
    } catch {
        renderizarTabelaAgendamentos([]);
    }
}

function renderizarTabelaAgendamentos(agendamentos) {
    const tbody = document.querySelector('#tabela-agendamentos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let pendentes = 0;
    let confirmados = 0;

    if (!agendamentos || agendamentos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum agendamento registado.</td></tr>`;
        document.getElementById('total-pendentes').textContent = 0;
        document.getElementById('total-confirmados').textContent = 0;
        return;
    }

    agendamentos.forEach(ag => {
        if (ag.status === 'pendente') pendentes++;
        if (ag.status === 'confirmado') confirmados++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${ag.cliente}</strong></td>
            <td>${ag.servico}</td>
            <td>${ag.profissional || 'Não atribuído'}</td>
            <td>${ag.data}</td>
            <td><span class="status-badge badge-${ag.status}">${ag.status}</span></td>
            <td class="action-buttons">
                ${ag.status === 'pendente' ? `<button class="btn-action btn-confirmar" onclick="alterarStatusAgendamento(${ag.id}, 'confirmado')">Confirmar</button>` : ''}
                ${ag.status === 'pendente' ? `<button class="btn-action btn-recusar" onclick="alterarStatusAgendamento(${ag.id}, 'recusado')">Recusar</button>` : ''}
                ${ag.status === 'confirmado' ? `<button class="btn-action btn-concluir" onclick="alterarStatusAgendamento(${ag.id}, 'concluido')">Concluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-pendentes').textContent = pendentes;
    document.getElementById('total-confirmados').textContent = confirmados;
}

async function alterarStatusAgendamento(id, novoStatus) {
    if (!confirm(`Deseja alterar o status para "${novoStatus.toUpperCase()}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/agendamentos/${id}/status?empresa_id=${EMPRESA_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });

        if (response.ok) {
            alert('Status atualizado com sucesso!');
            carregarAgendamentos();
        } else {
            const erro = await response.json();
            alert(`Erro: ${erro.detail}`);
        }
    } catch {
        alert('Erro ao comunicar com o servidor.');
    }
}

// --- GESTÃO DE AGENDA E HORÁRIOS LIVRES ---
async function carregarHorariosAgenda(dataSelecionada) {
    const container = document.getElementById("lista-horarios-gerados");
    if (!container) return;

    container.innerHTML = "<p style='color: var(--text-secondary); font-size: 0.9rem;'>Carregando horários...</p>";

    try {
        const res = await fetch(`${API_URL}/api/agenda/livres?empresa_id=${EMPRESA_ID}&data=${dataSelecionada}`);
        if (!res.ok) throw new Error();
        const horarios = await res.json();

        container.innerHTML = "";

        if (!horarios || horarios.length === 0) {
            container.innerHTML = "<p style='color: var(--text-secondary); font-size: 0.9rem;'>Nenhum horário livre gerado para esta data.</p>";
            return;
        }

        // Agrupa os horários por nome da profissional
        const grupos = {};
        horarios.forEach(slot => {
            const profNome = slot.profissional || "Equipe Geral";
            if (!grupos[profNome]) {
                grupos[profNome] = [];
            }
            grupos[profNome].push(slot);
        });

        // Cria uma caixa/card para cada profissional com os respetivos horários
        for (const [profNome, slots] of Object.entries(grupos)) {
            const grupoWrapper = document.createElement("div");
            grupoWrapper.style.cssText = `
                width: 100%; background: #fff; border: 1px solid var(--border-light);
                border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);
            `;

            let htmlSlots = '';
            slots.forEach(slot => {
                htmlSlots += `
                    <div style="
                        background: #f7fafc; padding: 8px 12px; border-radius: 8px;
                        display: inline-flex; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--text-primary);
                        border: 1px solid var(--border-light); margin: 4px;
                    ">
                        <span>⏰ <strong>${slot.hora}</strong></span>
                        <button onclick="removerSlotAgenda(${slot.id})" style="background: none; border: none; color: #e53e3e; cursor: pointer; font-weight: bold; font-size: 1rem;" title="Remover horário">×</button>
                    </div>
                `;
            });

            grupoWrapper.innerHTML = `
                <h4 style="font-size: 0.95rem; font-weight: 600; color: #482868; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    👤 ${profNome} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary);">(${slots.length} horários disponíveis)</span>
                </h4>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${htmlSlots}
                </div>
            `;

            container.appendChild(grupoWrapper);
        }

    } catch (err) {
        container.innerHTML = "<p style='color: #e53e3e; font-size: 0.9rem;'>Erro ao carregar horários.</p>";
    }
}

async function gerarHorariosNaAgenda() {
    const data = document.getElementById("input-agenda-data").value;
    const hora_inicio = document.getElementById("input-agenda-inicio").value;
    const hora_fim = document.getElementById("input-agenda-fim").value;
    const intervalo_minutos = parseInt(document.getElementById("input-agenda-intervalo").value);
    const profissionalIdVal = document.getElementById("input-agenda-profissional").value;

    if (!data) {
        alert("Por favor, selecione uma data.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/agenda/gerar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                empresa_id: parseInt(EMPRESA_ID),
                data: data,
                hora_inicio: hora_inicio,
                hora_fim: hora_fim,
                intervalo_minutos: intervalo_minutos,
                profissional_id: profissionalIdVal ? parseInt(profissionalIdVal) : null
            })
        });

        const resultado = await res.json();
        if (!res.ok) throw new Error(resultado.detail || "Erro ao gerar horários.");

        alert(resultado.mensagem);
        carregarHorariosAgenda(data);
    } catch (err) {
        alert(err.message);
    }
}

async function removerSlotAgenda(slotId) {
    if (!confirm("Deseja realmente remover este horário da agenda?")) return;

    try {
        const res = await fetch(`${API_URL}/api/agenda/slot/${slotId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover horário.");

        const data = document.getElementById("input-agenda-data").value;
        carregarHorariosAgenda(data);
    } catch (err) {
        alert(err.message);
    }
}

// --- GESTÃO DE PROFISSIONAIS ---
async function carregarProfissionais() {
    try {
        const response = await fetch(`${API_URL}/api/profissionais?empresa_id=${EMPRESA_ID}`);
        if (!response.ok) throw new Error();
        const lista = await response.json();
        renderizarTabelaProfissionais(lista);
    } catch {
        renderizarTabelaProfissionais([]);
    }
}

function renderizarTabelaProfissionais(lista) {
    const tbody = document.querySelector('#tabela-profissionais tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma profissional cadastrada.</td></tr>`;
        document.getElementById('total-profissionais').textContent = 0;
        atualizarSelectProfissionais([]);
        return;
    }

    lista.forEach(prof => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${prof.nome}</strong></td>
            <td>${prof.especialidade}</td>
            <td>${prof.telefone || 'Não informado'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-profissionais').textContent = lista.length;
    atualizarSelectProfissionais(lista);
}

async function salvarProfissional(event) {
    event.preventDefault();
    const payload = {
        nome: document.getElementById('prof-nome').value.trim(),
        especialidade: document.getElementById('prof-especialidade').value.trim(),
        telefone: document.getElementById('prof-telefone').value.trim()
    };

    try {
        const response = await fetch(`${API_URL}/api/profissionais?empresa_id=${EMPRESA_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('form-profissional').reset();
            carregarProfissionais();
        } else {
            const erro = await response.json();
            alert(`Erro: ${erro.detail || 'Não foi possível cadastrar a profissional.'}`);
        }
    } catch {
        alert('Erro ao ligar ao servidor.');
    }
}

// --- GESTÃO DE SERVIÇOS ---
async function carregarServicos() {
    try {
        const response = await fetch(`${API_URL}/api/servicos?empresa_id=${EMPRESA_ID}`);
        if (!response.ok) throw new Error();
        const lista = await response.json();
        renderizarTabelaServicos(lista);
    } catch {
        renderizarTabelaServicos([]);
    }
}

function renderizarTabelaServicos(lista) {
    const tbody = document.querySelector('#tabela-servicos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum serviço cadastrado.</td></tr>`;
        return;
    }

    lista.forEach(serv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${serv.nome}</strong></td>
            <td>${serv.descricao || 'Sem descrição'}</td>
            <td>R$ ${parseFloat(serv.preco).toFixed(2)}</td>
            <td>${serv.duracao_minutos} min</td>
            <td>${serv.profissional_nome || 'Equipe Geral'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarSelectProfissionais(profissionais) {
    // 1. Atualiza o select da aba de Serviços
    const selectServico = document.getElementById('serv-profissional');
    if (selectServico) {
        selectServico.innerHTML = '<option value="">Qualquer profissional (Geral)</option>';
        if (profissionais) {
            profissionais.forEach(prof => {
                const opt = document.createElement('option');
                opt.value = prof.id;
                opt.textContent = `${prof.nome} (${prof.especialidade})`;
                selectServico.appendChild(opt);
            });
        }
    }

    // 2. Atualiza o select da aba de Agenda / Horários
    const selectAgenda = document.getElementById('input-agenda-profissional');
    if (selectAgenda) {
        selectAgenda.innerHTML = '<option value="">Equipe Geral / Sem Profissional Específica</option>';
        if (profissionais) {
            profissionais.forEach(prof => {
                const opt = document.createElement('option');
                opt.value = prof.id;
                opt.textContent = `${prof.nome} (${prof.especialidade})`;
                selectAgenda.appendChild(opt);
            });
        }
    }
}

async function salvarServico(event) {
    event.preventDefault();
    const payload = {
        nome: document.getElementById('serv-nome').value.trim(),
        preco: parseFloat(document.getElementById('serv-preco').value),
        duracao_minutos: parseInt(document.getElementById('serv-duracao').value),
        profissional_id: document.getElementById('serv-profissional').value ? parseInt(document.getElementById('serv-profissional').value) : null,
        descricao: document.getElementById('serv-descricao').value.trim()
    };

    try {
        const response = await fetch(`${API_URL}/api/servicos?empresa_id=${EMPRESA_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            document.getElementById('form-servico').reset();
            carregarServicos();
        } else {
            const erro = await response.json();
            alert(`Erro: ${erro.detail || 'Não foi possível cadastrar o serviço.'}`);
        }
    } catch {
        alert('Erro ao ligar ao servidor.');
    }
}

// --- CONFIGURAÇÕES E MAPA INTERATIVO ---
let mapaConfig = null;
let marcadorConfig = null;
let timeoutAutocompleteConfig = null;

function inicializarOuAtualizarMapa(lat, lng) {
    const containerMapaDiv = document.getElementById('mapa-config-container');
    if (!containerMapaDiv) return;

    containerMapaDiv.style.display = 'block';

    if (!mapaConfig) {
        mapaConfig = L.map('mapa-config-container').setView([lat, lng], 16);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapaConfig);

        marcadorConfig = L.marker([lat, lng], { draggable: true }).addTo(mapaConfig);

        marcadorConfig.on('dragend', function () {
            const posicao = marcadorConfig.getLatLng();
            document.getElementById('conf-lat').value = posicao.lat;
            document.getElementById('conf-lng').value = posicao.lng;
        });
    } else {
        mapaConfig.setView([lat, lng], 16);
        marcadorConfig.setLatLng([lat, lng]);
    }

    document.getElementById('conf-lat').value = lat;
    document.getElementById('conf-lng').value = lng;

    setTimeout(() => { mapaConfig.invalidateSize(); }, 200);
}

function inicializarMapaConfiguracoes() {
    const inputEndereco = document.getElementById('conf-endereco');
    if (!inputEndereco) return;

    const containerSugestoes = document.createElement('div');
    containerSugestoes.style.cssText = `
        position: absolute; background: white; border: 1px solid #cbd5e0;
        border-radius: 8px; max-height: 200px; overflow-y: auto; width: 100%;
        z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: none;
    `;
    inputEndereco.parentNode.style.position = 'relative';
    inputEndereco.parentNode.appendChild(containerSugestoes);

    inputEndereco.addEventListener('input', (e) => {
        clearTimeout(timeoutAutocompleteConfig);
        const query = e.target.value.trim();

        if (query.length < 3) {
            containerSugestoes.style.display = 'none';
            return;
        }

        timeoutAutocompleteConfig = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=5`);
                const resultados = await response.json();

                containerSugestoes.innerHTML = '';
                if (resultados.length === 0) {
                    containerSugestoes.style.display = 'none';
                    return;
                }

                resultados.forEach(item => {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding: 10px; font-size: 0.85rem; cursor: pointer; border-bottom: 1px solid #edf2f7; background: #fff;';
                    div.textContent = item.display_name;

                    div.addEventListener('click', () => {
                        inputEndereco.value = item.display_name;
                        containerSugestoes.style.display = 'none';
                        inicializarOuAtualizarMapa(parseFloat(item.lat), parseFloat(item.lon));
                    });

                    containerSugestoes.appendChild(div);
                });

                containerSugestoes.style.display = 'block';
            } catch (error) {
                console.error("Erro ao buscar endereços:", error);
            }
        }, 400);
    });
}

async function carregarConfiguracoes() {
    try {
        const response = await fetch(`${API_URL}/api/configuracoes/${EMPRESA_ID}`);
        if (!response.ok) return;

        const config = await response.json();

        document.getElementById('conf-nome-fantasia').value = config.nome_fantasia || NOME_EMPRESA;
        document.getElementById('conf-razao-social').value = config.razao_social || '';
        document.getElementById('conf-telefone').value = config.telefone_contato || '';
        document.getElementById('conf-endereco').value = config.endereco || '';
        document.getElementById('conf-descricao').value = config.descricao || '';

        if (config.latitude && config.longitude) {
            document.getElementById('conf-lat').value = config.latitude;
            document.getElementById('conf-lng').value = config.longitude;
            inicializarOuAtualizarMapa(config.latitude, config.longitude);
        }

        if (config.categorias) {
            const categoriasArr = config.categorias.split('•').map(c => c.trim());
            document.querySelectorAll('input[name="categorias"]').forEach(chk => {
                chk.checked = categoriasArr.includes(chk.value);
            });
        }
    } catch (e) {
        console.warn("Configurações não carregadas.");
    }
}

async function salvarConfiguracoes(event) {
    event.preventDefault();

    const categoriasSelecionadas = Array.from(document.querySelectorAll('input[name="categorias"]:checked'))
        .map(chk => chk.value)
        .join(' • ');

    const payload = {
        nome_fantasia: document.getElementById('conf-nome-fantasia').value.trim(),
        razao_social: document.getElementById('conf-razao-social').value.trim(),
        telefone_contato: document.getElementById('conf-telefone').value.trim(),
        categorias: categoriasSelecionadas,
        endereco: document.getElementById('conf-endereco').value.trim(),
        descricao: document.getElementById('conf-descricao').value.trim(),
        latitude: document.getElementById('conf-lat').value ? parseFloat(document.getElementById('conf-lat').value) : null,
        longitude: document.getElementById('conf-lng').value ? parseFloat(document.getElementById('conf-lng').value) : null
    };

    try {
        const response = await fetch(`${API_URL}/api/configuracoes/${EMPRESA_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('Configurações atualizadas com sucesso!');
            const elNomeSalao = document.getElementById('salao-nome-fantasia');
            if (elNomeSalao) elNomeSalao.textContent = payload.nome_fantasia;
        } else {
            const erro = await response.json();
            alert(`Erro ao salvar: ${erro.detail || 'Tente novamente.'}`);
        }
    } catch (error) {
        alert('Erro de conexão com o servidor.');
    }
}

function fazerLogout() {
    if (confirm("Deseja realmente sair da conta do estabelecimento?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}