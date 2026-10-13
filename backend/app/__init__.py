from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from .database import get_db
from .models import ConfiguracaoEmpresaModel, UsuarioModel

router = APIRouter(prefix="/api/configuracoes", tags=["Configurações da Empresa"])

class ConfiguracaoUpdateSchema(BaseModel):
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    telefone_contato: Optional[str] = None
    categorias: Optional[str] = None
    endereco: Optional[str] = None
    descricao: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@router.get("/{empresa_id}")
def obter_configuracoes(empresa_id: int, db: Session = Depends(get_db)):
    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
    
    if not config:
        # Se ainda não existir registo, procura dados básicos na tabela usuarios para preencher por defeito
        usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
        return {
            "nome_fantasia": usuario.nome_fantasia or usuario.nome if usuario else "",
            "razao_social": usuario.razao_social if usuario else "",
            "telefone_contato": usuario.telefone if usuario else "",
            "endereco": "",
            "categorias": "",
            "descricao": "",
            "latitude": None,
            "longitude": None
        }
    
    return {
        "nome_fantasia": config.nome_fantasia,
        "razao_social": config.razao_social,
        "telefone_contato": config.telefone_contato,
        "endereco": config.endereco,
        "categorias": config.categorias,
        "descricao": config.descricao,
        "latitude": config.latitude,
        "longitude": config.longitude
    }

@router.put("/{empresa_id}")
def atualizar_configuracoes(empresa_id: int, dados: ConfiguracaoUpdateSchema, db: Session = Depends(get_db)):
    # Verifica se a empresa existe na tabela principal
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")

    # Busca ou cria o registo de configurações
    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
    
    if not config:
        config = ConfiguracaoEmpresaModel(empresa_id=empresa_id)
        db.add(config)

    # Atualiza apenas os campos que foram enviados (parcial)
    dados_dict = dados.dict(exclude_unset=True)
    for chave, valor in dados_dict.items():
        setattr(config, chave, valor)

    # Sincroniza o nome fantasia e razão social na tabela principal de utilizadores também
    if "nome_fantasia" in dados_dict and dados_dict["nome_fantasia"]:
        usuario.nome_fantasia = dados_dict["nome_fantasia"]
    if "razao_social" in dados_dict and dados_dict["razao_social"]:
        usuario.razao_social = dados_dict["razao_social"]

    db.commit()
    db.refresh(config)

    return {"mensagem": "Configurações atualizadas com sucesso!"}