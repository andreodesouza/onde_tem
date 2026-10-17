from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_db
from ..models import AgendamentoModel, ServicoModel, AgendaHorarioModel, ProfissionalModel, ConfiguracaoEmpresaModel

router = APIRouter(prefix="/api/agendamentos", tags=["Agendamentos"])

def expirar_agendamentos_pendentes(db: Session):
    # Definido para 1 minuto para testes (pode alterar para timedelta(minutes=5) em produção)
    limite = datetime.now() - timedelta(minutes=1)
    
    # Busca todos os agendamentos pendentes
    pendentes = db.query(AgendamentoModel).filter(AgendamentoModel.status == "pendente").all()
    
    for ag in pendentes:
        # Verifica se passou o limite de tempo e se o modelo possui o campo created_at
        if hasattr(ag, "created_at") and ag.created_at and ag.created_at < limite:
            ag.status = "cancelado"
            
            # Liberta o slot correspondente na tabela de horários da agenda
            partes = ag.data_hora.split(" ")
            if len(partes) == 2:
                data_str, hora_str = partes[0], partes[1]
                slot = db.query(AgendaHorarioModel).filter(
                    AgendaHorarioModel.empresa_id == ag.empresa_id,
                    AgendaHorarioModel.data == data_str,
                    AgendaHorarioModel.hora == hora_str
                ).first()
                if slot:
                    slot.disponivel = 1  # Liberta o horário novamente
                    
    db.commit()

class AgendamentoCreateSchema(BaseModel):
    empresa_id: int
    servico_id: int
    cliente_nome: str
    data_hora: str  # Formato: "YYYY-MM-DD HH:MM"

@router.post("")
def criar_agendamento(dados: AgendamentoCreateSchema, db: Session = Depends(get_db)):
    # Valida se o serviço existe
    servico = db.query(ServicoModel).filter(ServicoModel.id == dados.servico_id).first()
    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    # Separa a data e a hora do formato "YYYY-MM-DD HH:MM"
    partes = dados.data_hora.split(" ")
    data_str = partes[0] if len(partes) > 0 else ""
    hora_str = partes[1] if len(partes) > 1 else ""

    # Procura e atualiza o slot na agenda para indisponível (0) se existir
    slot = db.query(AgendaHorarioModel).filter(
        AgendaHorarioModel.empresa_id == dados.empresa_id,
        AgendaHorarioModel.data == data_str,
        AgendaHorarioModel.hora == hora_str
    ).first()

    if slot:
        slot.disponivel = 0

    novo_agendamento = AgendamentoModel(
        empresa_id=dados.empresa_id,
        servico_id=dados.servico_id,
        profissional_id=servico.profissional_id,
        cliente_nome=dados.cliente_nome,
        data_hora=dados.data_hora,
        status="pendente"
    )
    
    db.add(novo_agendamento)
    db.commit()
    db.refresh(novo_agendamento)
    
    return {"mensagem": "Agendamento solicitado com sucesso!", "id": novo_agendamento.id}

@router.get("/empresa/{empresa_id}")
def listar_agendamentos_empresa(empresa_id: int, db: Session = Depends(get_db)):
    expirar_agendamentos_pendentes(db) # <--- Limpa os expirados automaticamente ao listar
    
    agendamentos = db.query(AgendamentoModel).filter(AgendamentoModel.empresa_id == empresa_id).all()
    resultado = []
    for ag in agendamentos:
        servico = db.query(ServicoModel).filter(ServicoModel.id == ag.servico_id).first()
        prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == ag.profissional_id).first() if ag.profissional_id else None
        
        resultado.append({
            "id": ag.id,
            "cliente": ag.cliente_nome,
            "empresa_id": ag.empresa_id,
            "servico": servico.nome if servico else "Serviço",
            "profissional": prof.nome if prof else "Equipe Geral",
            "data": ag.data_hora,
            "status": ag.status
        })
    return resultado

@router.put("/{agendamento_id}/status")
def alterar_status_agendamento(agendamento_id: int, empresa_id: int, status_data: dict, db: Session = Depends(get_db)):
    ag = db.query(AgendamentoModel).filter(AgendamentoModel.id == agendamento_id, AgendamentoModel.empresa_id == empresa_id).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    
    novo_status = status_data.get("status")
    if novo_status not in ["pendente", "confirmado", "recusado", "concluido", "cancelado"]:
        raise HTTPException(status_code=400, detail="Status inválido.")
        
    ag.status = novo_status
    db.commit()
    return {"mensagem": "Status atualizado com sucesso!"}

@router.get("/cliente")
def listar_agendamentos_cliente(cliente_nome: str, db: Session = Depends(get_db)):
    expirar_agendamentos_pendentes(db) # <--- Limpa os expirados automaticamente ao listar
    
    agendamentos = db.query(AgendamentoModel).filter(
        AgendamentoModel.cliente_nome.ilike(f"%{cliente_nome}%")
    ).all()
    
    resultado = []
    for ag in agendamentos:
        servico = db.query(ServicoModel).filter(ServicoModel.id == ag.servico_id).first()
        prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == ag.profissional_id).first() if ag.profissional_id else None
        config_salao = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == ag.empresa_id).first()
        
        resultado.append({
            "id": ag.id,
            "empresa_id": ag.empresa_id,
            "cliente_nome": ag.cliente_nome,
            "servico_nome": servico.nome if servico else "Serviço",
            "profissional_nome": prof.nome if prof else "Equipe Geral",
            "salao_nome": config_salao.nome_fantasia if config_salao else "Estabelecimento",
            "data_hora": ag.data_hora,
            "status": ag.status
        })
    return resultado

class StatusUpdateSchema(BaseModel):
    status: str

@router.patch("/{agendamento_id}/atualizar-status")
def atualizar_status_direto(agendamento_id: int, dados: StatusUpdateSchema, db: Session = Depends(get_db)):
    ag = db.query(AgendamentoModel).filter(AgendamentoModel.id == agendamento_id).first()
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    
    if dados.status not in ["pendente", "confirmado", "recusado", "concluido", "cancelado"]:
        raise HTTPException(status_code=400, detail="Status inválido.")
        
    ag.status = dados.status
    
    # SE O STATUS FOR MUDADO PARA "CANCELADO" OU "RECUSADO", LIBERTA O HORÁRIO NA AGENDA
    if dados.status in ["cancelado", "recusado"]:
        partes = ag.data_hora.split(" ")
        if len(partes) == 2:
            data_str, hora_str = partes[0], partes[1]
            slot = db.query(AgendaHorarioModel).filter(
                AgendaHorarioModel.empresa_id == ag.empresa_id,
                AgendaHorarioModel.data == data_str,
                AgendaHorarioModel.hora == hora_str
            ).first()
            if slot:
                slot.disponivel = 1  # Torna o horário disponível novamente na tabela de horários
                
    db.commit()
    return {"mensagem": "Status atualizado e horário libertado com sucesso!", "status": ag.status}