import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from ..database import get_db
from ..models import ConfiguracaoEmpresaModel, UsuarioModel

router = APIRouter(prefix="/api/configuracoes", tags=["Configurações da Empresa"])

class ConfiguracaoUpdateSchema(BaseModel):
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    telefone_contato: Optional[str] = None
    categorias: Optional[str] = None
    endereco: Optional[str] = None
    descricao: Optional[str] = None
    horario_funcionamento: Optional[str] = None  # NOVO CAMPO DE HORÁRIO
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@router.get("/{empresa_id}")
def obter_configuracoes(empresa_id: int, db: Session = Depends(get_db)):
    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
    
    if not config:
        usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
        return {
            "nome_fantasia": usuario.nome_fantasia or usuario.nome if usuario else "",
            "razao_social": usuario.razao_social if usuario else "",
            "telefone_contato": usuario.telefone if usuario else "",
            "endereco": "",
            "categorias": "",
            "descricao": "",
            "horario_funcionamento": "",
            "foto_url": "",
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
        "horario_funcionamento": config.horario_funcionamento,
        "foto_url": config.foto_url,
        "latitude": config.latitude,
        "longitude": config.longitude
    }

@router.put("/{empresa_id}")
def atualizar_configuracoes(empresa_id: int, dados: ConfiguracaoUpdateSchema, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == empresa_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")

    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
    
    if not config:
        config = ConfiguracaoEmpresaModel(empresa_id=empresa_id)
        db.add(config)

    dados_dict = dados.dict(exclude_unset=True)
    for chave, valor in dados_dict.items():
        setattr(config, chave, valor)

    if "nome_fantasia" in dados_dict and dados_dict["nome_fantasia"]:
        usuario.nome_fantasia = dados_dict["nome_fantasia"]
    if "razao_social" in dados_dict and dados_dict["razao_social"]:
        usuario.razao_social = dados_dict["razao_social"]

    db.commit()
    db.refresh(config)

    return {"mensagem": "Configurações atualizadas com sucesso!"}

# NOVO ENDPOINT DE UPLOAD DE FOTO
@router.post("/upload-foto/{empresa_id}")
async def upload_foto_salao(
    empresa_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Apenas ficheiros de imagem são permitidos.")
    
    try:
        file_bytes = await file.read()
        extensao = file.filename.split(".")[-1]
        nome_ficheiro = f"salao_{empresa_id}.{extensao}"
        
        # Garante que a pasta estática local existe
        os.makedirs("static/uploads", exist_ok=True)
        caminho_local = f"static/uploads/{nome_ficheiro}"
        
        with open(caminho_local, "wb") as buffer:
            buffer.write(file_bytes)
        
        # URL relativo/público que será guardado na base de dados
        foto_url = f"/{caminho_local}"
        
        config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
        if config:
            config.foto_url = foto_url
        else:
            config = ConfiguracaoEmpresaModel(empresa_id=empresa_id, foto_url=foto_url)
            db.add(config)
            
        db.commit()
        db.refresh(config)
        
        return {"mensagem": "Foto enviada com sucesso!", "foto_url": foto_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar imagem: {str(e)}")