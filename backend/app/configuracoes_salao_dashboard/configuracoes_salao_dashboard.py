import os
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from supabase import create_client, Client

from ..database import get_db
from ..models import ConfiguracaoEmpresaModel, UsuarioModel

# Carrega as credenciais do ambiente (certifique-se de que estão no seu .env ou Render)
SUPABASE_URL = os.getenv("SUPABASE_URL", "O_SEU_URL_DO_SUPABASE")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "A_SUA_CHAVE_DO_SUPABASE")

# Cria a instância correta do cliente
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter(prefix="/api/configuracoes", tags=["Configurações da Empresa"])

class ConfiguracaoUpdateSchema(BaseModel):
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    telefone_contato: Optional[str] = None
    categorias: Optional[str] = None
    endereco: Optional[str] = None
    descricao: Optional[str] = None
    horario_funcionamento: Optional[str] = None
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

@router.post("/upload-foto/{empresa_id}")
async def upload_foto_supabase(
    empresa_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Apenas ficheiros de imagem são permitidos.")
    
    try:
        # 1. Lê os bytes do ficheiro enviado
        file_bytes = await file.read()
        extensao = file.filename.split(".")[-1]
        caminho_no_bucket = f"salao_{empresa_id}.{extensao}"
        
        bucket_name = "saloes-fotos" # Nome do bucket criado no painel do Supabase Storage
        
        # 2. Faz o upload direto para o Supabase Storage (substitui se já existir com upsert)
        supabase.storage.from_(bucket_name).upload(
            path=caminho_no_bucket,
            file=file_bytes,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        # 3. Obtém o link público definitivo gerado pelo Supabase
        public_url_response = supabase.storage.from_(bucket_name).get_public_url(caminho_no_bucket)
        
        foto_url = public_url_response if isinstance(public_url_response, str) else public_url_response.get("publicUrl")

        # 4. Guarda o link URL na base de dados PostgreSQL
        config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == empresa_id).first()
        if config:
            config.foto_url = foto_url
        else:
            config = ConfiguracaoEmpresaModel(empresa_id=empresa_id, foto_url=foto_url)
            db.add(config)
            
        db.commit()
        db.refresh(config)
        
        return {"mensagem": "Foto enviada para o Supabase com sucesso!", "foto_url": foto_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar imagem para o Supabase: {str(e)}")