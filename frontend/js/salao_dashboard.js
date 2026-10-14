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

    document.body.appendChild(modalOverlay);
    modalOverlay.appendChild(modalBox);

    document.getElementById('btn-ir-login').addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    setTimeout(() => { window.location.href = 'login.html'; }, 3000);
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

// --- GESTÃO DE AGENDA E HORÁRIOS ---
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

        const grupos = {};
        horarios.forEach(slot => {
            const profNome = slot.profissional || "Equipe Geral";
            if (!grupos[profNome]) grupos[profNome] = [];
            grupos[profNome].push(slot);
        });

        for (const [profNome, slots] of Object.entries(grupos)) {
            const grupoWrapper = document.createElement("div");
            grupoWrapper.style.cssText = `
                width: 100%; background: #fff; border: 1px solid var(--border-light);
                border-radius: 12px; padding: 15px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); margin-bottom: 10px;
            `;

            let htmlSlots = '';
            slots.forEach(slot => {
                htmlSlots += `
                    <div style="
                        background: #f7fafc; padding: 6px 10px; border-radius: 8px;
                        display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-primary);
                        border: 1px solid var(--border-light); margin: 3px;
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

async function removerSlotAgenda(slotId) {
    try {
        const res = await fetch(`${API_URL}/api/agenda/slot/${slotId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        const dataSelecionada = document.getElementById("input-agenda-data").value;
        carregarHorariosAgenda(dataSelecionada);
    } catch (err) {
        alert("Erro ao remover horário.");
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
    const selectServico = document.getElementById('serv-profissional');
    if (selectServico) {
        selectServico.innerHTML = '<option value="">Equipe Geral / Sem Profissional Específica</option>';
        if (profissionais) {
            profissionais.forEach(prof => {
                const opt = document.createElement('option');
                opt.value = prof.id;
                opt.textContent = `${prof.nome} (${prof.especialidade})`;
                selectServico.appendChild(opt);
            });
        }
    }

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

// --- FOTO E UPLOAD ---
function prepararUploadFoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    ficheiroFotoSelecionado = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        const imgPreview = document.getElementById('img-preview-salao');
        const placeholder = document.getElementById('preview-placeholder');

        imgPreview.src = e.target.result;
        imgPreview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
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
        const response = await fetch(`${API_URL}/api/configuracoes/${EMPRESA_ID}`);
        if (!response.ok) return;

        const config = await response.json();

        document.getElementById('conf-nome-fantasia').value = config.nome_fantasia || NOME_EMPRESA;
        document.getElementById('conf-razao-social').value = config.razao_social || '';
        document.getElementById('conf-telefone').value = config.telefone_contato || '';
        document.getElementById('conf-endereco').value = config.endereco || '';
        document.getElementById('conf-descricao').value = config.descricao || '';

        if (config.foto_url) {
            const imgPreview = document.getElementById('img-preview-salao');
            const placeholder = document.getElementById('preview-placeholder');
            imgPreview.src = config.foto_url;
            imgPreview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        }

        if (config.horario_funcionamento) {
            const partes = config.horario_funcionamento.split(',');
            if (partes.length >= 2) {
                document.getElementById('conf-dias-semana').value = partes[0].trim();
                const horas = partes[1].match(/\d{2}:\d{2}/g);
                if (horas && horas.length >= 2) {
                    document.getElementById('conf-hora-inicio').value = horas[0];
                    document.getElementById('conf-hora-fim').value = horas[1];
                }
            }
        }

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

    const dias = document.getElementById('conf-dias-semana').value;
    const hInicio = document.getElementById('conf-hora-inicio').value;
    const hFim = document.getElementById('conf-hora-fim').value;
    const horarioFormatado = `${dias}, das ${hInicio} às ${hFim}`;

    let fotoUrlFinal = null;

    if (ficheiroFotoSelecionado) {
        const formData = new FormData();
        formData.append("file", ficheiroFotoSelecionado);

        try {
            const resUpload = await fetch(`${API_URL}/api/configuracoes/upload-foto/${EMPRESA_ID}`, {
                method: "POST",
                body: formData
            });
            if (resUpload.ok) {
                const dadosUpload = await resUpload.json();
                fotoUrlFinal = dadosUpload.foto_url;
            }
        } catch (err) {
            console.warn("Erro ao enviar foto, mantendo anterior.");
        }
    }

    const payload = {
        nome_fantasia: document.getElementById('conf-nome-fantasia').value.trim(),
        razao_social: document.getElementById('conf-razao-social').value.trim(),
        telefone_contato: document.getElementById('conf-telefone').value.trim(),
        categorias: categoriasSelecionadas,
        endereco: document.getElementById('conf-endereco').value.trim(),
        descricao: document.getElementById('conf-descricao').value.trim(),
        horario_funcionamento: horarioFormatado,
        latitude: document.getElementById('conf-lat').value ? parseFloat(document.getElementById('conf-lat').value) : null,
        longitude: document.getElementById('conf-lng').value ? parseFloat(document.getElementById('conf-lng').value) : null
    };

    if (fotoUrlFinal) {
        payload.foto_url = fotoUrlFinal;
    }

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
        console.error('Erro:', error);
        alert('Erro de conexão com o servidor.');
    }
}

function fazerLogout() {
    if (confirm("Deseja realmente sair da conta do estabelecimento?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}