from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models import AgendaHorarioModel, UsuarioModel, ProfissionalModel

router = APIRouter(prefix="/api/agenda", tags=["Agenda e Horários"])

class GerarHorariosSchema(BaseModel):
    empresa_id: int
    data: str               # "2026-11-15"
    hora_inicio: str        # "09:00"
    hora_fim: str           # "18:00"
    intervalo_minutos: int  # Ex: 30 ou 60
    profissional_id: Optional[int] = None # <-- Aqui permitimos associar à profissional específica

@router.post("/gerar")
def gerar_horarios_dia(dados: GerarHorariosSchema, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta

    formato = "%H:%M"
    try:
        inicio = datetime.strptime(dados.hora_inicio, formato)
        fim = datetime.strptime(dados.hora_fim, formato)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de hora inválido. Use HH:MM")

    atual = inicio
    criados = 0
    
    while atual < fim:
        hora_str = atual.strftime("%H:%M")
        
        # Verifica se já existe este horário para esta empresa, data e profissional específica
        existe = db.query(AgendaHorarioModel).filter(
            AgendaHorarioModel.empresa_id == dados.empresa_id,
            AgendaHorarioModel.data == dados.data,
            AgendaHorarioModel.hora == hora_str,
            AgendaHorarioModel.profissional_id == dados.profissional_id
        ).first()

        if not existe:
            novo_slot = AgendaHorarioModel(
                empresa_id=dados.empresa_id,
                data=dados.data,
                hora=hora_str,
                disponivel=1,
                profissional_id=dados.profissional_id
            )
            db.add(novo_slot)
            criados += 1

        atual += timedelta(minutes=dados.intervalo_minutos)

    db.commit()
    return {"mensagem": f"{criados} horários gerados com sucesso para a profissional!"}

@router.get("/livres")
def listar_horarios_livres(empresa_id: int, data: str, profissional_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AgendaHorarioModel).filter(
        AgendaHorarioModel.empresa_id == empresa_id,
        AgendaHorarioModel.data == data,
        AgendaHorarioModel.disponivel == 1
    )
    
    # Se quiser filtrar por profissional específica na página do cliente, pode aplicar o filtro:
    if profissional_id:
        query = query.filter(AgendaHorarioModel.profissional_id == profissional_id)

    slots = query.all()
    
    resultado = []
    for s in slots:
        prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == s.profissional_id).first() if s.profissional_id else None
        resultado.append({
            "id": s.id,
            "hora": s.hora,
            "profissional_id": s.profissional_id,
            "profissional": prof.nome if prof else "Equipe Geral"
        })
    return resultado

@router.delete("/slot/{slot_id}")
def remover_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(AgendaHorarioModel).filter(AgendaHorarioModel.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Horário não encontrado.")
    db.delete(slot)
    db.commit()
    return {"mensagem": "Horário removido com sucesso!"}