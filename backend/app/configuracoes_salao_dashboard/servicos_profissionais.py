from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import ProfissionalModel, ServicoModel, UsuarioModel

router = APIRouter(prefix="/api", tags=["Profissionais e Serviços"])

class ProfissionalCreate(BaseModel):
    nome: str
    especialidade: str
    telefone: Optional[str] = None

class ServicoCreate(BaseModel):
    nome: str
    preco: float
    duracao_minutos: int
    profissional_id: Optional[int] = None
    descricao: Optional[str] = None

@router.get("/profissionais")
def listar_profissionais(empresa_id: int, db: Session = Depends(get_db)):
    return db.query(ProfissionalModel).filter(ProfissionalModel.empresa_id == empresa_id).all()

@router.post("/profissionais")
def criar_profissional(empresa_id: int, dados: ProfissionalCreate, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")
    
    nova_prof = ProfissionalModel(
        empresa_id=empresa_id,
        nome=dados.nome,
        especialidade=dados.especialidade,
        telefone=dados.telefone
    )
    db.add(nova_prof)
    db.commit()
    db.refresh(nova_prof)
    return {"mensagem": "Profissional cadastrada com sucesso!", "id": nova_prof.id}

@router.get("/servicos")
def listar_servicos(empresa_id: int, db: Session = Depends(get_db)):
    servicos = db.query(ServicoModel).filter(ServicoModel.empresa_id == empresa_id).all()
    servicos = db.query(ServicoModel).filter(
    ServicoModel.empresa_id == empresa_id,
    ServicoModel.ativo == True
).all()
    
    resultado = []
    for s in servicos:
        prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == s.profissional_id).first() if s.profissional_id else None
        resultado.append({
            "id": s.id,
            "nome": s.nome,
            "preco": s.preco,
            "duracao_minutos": s.duracao_minutos,
            "descricao": s.descricao,
            "profissional_id": s.profissional_id,
            "profissional_nome": prof.nome if prof else "Equipe Geral"
        })
    return resultado

@router.post("/servicos")
def criar_servico(empresa_id: int, dados: ServicoCreate, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")
    
    novo_serv = ServicoModel(
        empresa_id=empresa_id,
        nome=dados.nome,
        preco=dados.preco,
        duracao_minutos=dados.duracao_minutos,
        profissional_id=dados.profissional_id,
        descricao=dados.descricao
    )
    db.add(novo_serv)
    db.commit()
    db.refresh(novo_serv)
    return {"mensagem": "Serviço cadastrado com sucesso!", "id": novo_serv.id}

from sqlalchemy.exc import IntegrityError

@router.delete("/servicos/{servico_id}")
def desativar_servico(servico_id: int, empresa_id: int, db: Session = Depends(get_db)):
    servico = db.query(ServicoModel).filter(
        ServicoModel.id == servico_id,
        ServicoModel.empresa_id == empresa_id
    ).first()

    if not servico:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    servico.ativo = False
    db.commit()

    return {"mensagem": "Serviço removido com sucesso!"}