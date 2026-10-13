// Configuração da URL da API (suporta localhost e ambiente de produção)
const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "/api";

// Força a recarga da página caso o utilizador use o botão "Voltar" do navegador
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

// Validação de Sessão Restrita para Salão (Bloqueio de Acesso)
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
        text-align: center; animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    modalBox.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
        <h3 style="color: #2d3748; font-size: 20px; font-weight: 600; margin-bottom: 8px;">Acesso Restrito</h3>
        <p style="color: #718096; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
            Você precisa estar conectado à sua conta de salão para aceder a esta página.
        </p>
        <button id="btn-ir-login" style="
            background: #482868; color: white; border: none; width: 100%;
            padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
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

    document.getElementById('btn-ir-login').addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    setTimeout(() => { window.location.href = 'login.html'; }, 3000);
    throw new Error("Acesso negado.");
}

// Parse dos dados do utilizador logado
let dadosUsuario = {};
try {
    dadosUsuario = JSON.parse(usuarioLogadoStr);
} catch (e) {
    dadosUsuario = { nome_fantasia: usuarioLogadoStr, id: 67 };
}

// Obtém o ID da empresa e o Nome de Exibição
const EMPRESA_ID = dadosUsuario.id || localStorage.getItem('empresa_id') || 67;
const NOME_EMPRESA = dadosUsuario.nome_fantasia || dadosUsuario.nome || "Meu Salão";

// Inicialização única ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
    const elNomeSalao = document.getElementById('salao-nome-fantasia');
    const elDetalhes = document.getElementById('salao-detalhes');

    if (elNomeSalao) elNomeSalao.textContent = NOME_EMPRESA;
    if (elDetalhes) elDetalhes.textContent = `Estabelecimento Parceiro | ID: ${EMPRESA_ID}`;

    // Carrega dados iniciais
    carregarAgendamentos();
    carregarProfissionais();
    carregarServicos();
    carregarConfiguracoes();
    inicializarMapaConfiguracoes();
});

// Alternância de abas
function mostrarSessao(sessaoId, btnElement) {
    document.querySelectorAll('.sessao-painel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const sessaoDestino = document.getElementById(sessaoId);
    if (sessaoDestino) sessaoDestino.style.display = 'block';

    if (btnElement) {
        btnElement.classList.add('active');
    }

    // Se abrir a aba de configurações, corrige o tamanho do mapa Leaflet se já estiver inicializado
    if (sessaoId === 'configuracoes' && typeof mapaConfig !== 'undefined' && mapaConfig) {
        setTimeout(() => { mapaConfig.invalidateSize(); }, 200);
    }
}

// --- GESTÃO DE AGENDAMENTOS ---
async function carregarAgendamentos() {
    try {
        const response = await fetch(`${API_URL}/api/agendamentos/empresa/${EMPRESA_ID}`);
        if (!response.ok) throw new Error('Falha ao carregar agendamentos');
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
                ${(ag.status === 'confirmado' || ag.status === 'pendente') ? `<button class="btn-action btn-cancelar" onclick="alterarStatusAgendamento(${ag.id}, 'cancelado')">Cancelar</button>` : ''}
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
    const select = document.getElementById('serv-profissional');
    if (!select) return;

    select.innerHTML = '<option value="">Qualquer profissional (Geral)</option>';
    if (profissionais) {
        profissionais.forEach(prof => {
            const opt = document.createElement('option');
            opt.value = prof.id;
            opt.textContent = `${prof.nome} (${prof.especialidade})`;
            select.appendChild(opt);
        });
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

        marcadorConfig.on('dragend', function (event) {
            const posicao = marcadorConfig.getLatLng();
            document.getElementById('conf-lat').value = posicao.lat;
            document.getElementById('conf-lng').value = posicao.lng;
            obterEnderecoPorCoordenadas(posicao.lat, posicao.lng);
        });
    } else {
        mapaConfig.setView([lat, lng], 16);
        marcadorConfig.setLatLng([lat, lng]);
    }

    document.getElementById('conf-lat').value = lat;
    document.getElementById('conf-lng').value = lng;

    setTimeout(() => { mapaConfig.invalidateSize(); }, 200);
}

async function obterEnderecoPorCoordenadas(lat, lng) {
    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await resp.json();
        if (data && data.display_name) {
            document.getElementById('conf-endereco').value = data.display_name;
        }
    } catch (e) {
        console.warn("Não foi possível atualizar o texto da morada.");
    }
}

function inicializarMapaConfiguracoes() {
    const inputEndereco = document.getElementById('conf-endereco');
    if (!inputEndereco) return;

    const containerSugestoes = document.createElement('div');
    containerSugestoes.id = 'sugestoes-endereco';
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

                    div.addEventListener('mouseenter', () => div.style.background = '#f7fafc');
                    div.addEventListener('mouseleave', () => div.style.background = 'white');

                    containerSugestoes.appendChild(div);
                });

                containerSugestoes.style.display = 'block';
            } catch (error) {
                console.error("Erro ao buscar endereços:", error);
            }
        }, 400);
    });

    document.addEventListener('click', (e) => {
        if (!inputEndereco.contains(e.target) && !containerSugestoes.contains(e.target)) {
            containerSugestoes.style.display = 'none';
        }
    });
}

async function carregarConfiguracoes() {
    try {
        const response = await fetch(`${API_URL}/configuracoes/${EMPRESA_ID}`);
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
        console.warn("Configurações ainda não carregadas do servidor.");
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

            // Atualiza o nome exibido no topo instantaneamente
            const elNomeSalao = document.getElementById('salao-nome-fantasia');
            if (elNomeSalao) elNomeSalao.textContent = payload.nome_fantasia;

            // Atualiza também no localStorage para persistir ao navegar ou recarregar
            try {
                let dadosLocais = JSON.parse(localStorage.getItem('usuarioLogado') || localStorage.getItem('usuario_logado') || '{}');
                dadosLocais.nome_fantasia = payload.nome_fantasia;
                dadosLocais.nome = payload.nome_fantasia;

                if (localStorage.getItem('usuarioLogado')) {
                    localStorage.setItem('usuarioLogado', JSON.stringify(dadosLocais));
                } else if (localStorage.getItem('usuario_logado')) {
                    localStorage.setItem('usuario_logado', JSON.stringify(dadosLocais));
                }
            } catch (err) {
                console.warn("Não foi possível atualizar o localStorage local.");
            }
        } else {
            const erro = await response.json();
            alert(`Erro ao salvar: ${erro.detail || 'Tente novamente.'}`);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão com o servidor.');
    }
}

function fazerLogout() {
    if (confirm("Deseja realmente sair da conta do estabelecimento?")) {
        localStorage.removeItem('empresa_id');
        localStorage.removeItem('token');
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('usuario_logado');
        sessionStorage.clear();

        window.location.href = 'login.html';
    }
}