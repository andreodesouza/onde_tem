import os
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from supabase import create_client, Client
from ..database import get_db
from ..models import UsuarioModel, UsuarioPerfilModel

# Carrega as credenciais do ambiente para o cliente Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "O_SEU_URL_DO_SUPABASE")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "A_SUA_CHAVE_DO_SUPABASE")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter(prefix="/api/usuarios", tags=["Configurações do Utilizador"])

class UsuarioPerfilUpdateSchema(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    cep: Optional[str] = None
    rua: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    senha_atual: Optional[str] = None
    nova_senha: Optional[str] = None

@router.get("/perfil")
def obter_perfil_usuario(email: str, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    
    perfil = db.query(UsuarioPerfilModel).filter(UsuarioPerfilModel.usuario_id == usuario.id).first()
    
    return {
        "nome": perfil.nome if perfil and perfil.nome else usuario.nome,
        "email": usuario.email,
        "telefone": perfil.telefone if perfil and perfil.telefone else (usuario.telefone if hasattr(usuario, "telefone") else ""),
        "cep": perfil.cep if perfil else "",
        "rua": perfil.rua if perfil else "",
        "numero": perfil.numero if perfil else "",
        "bairro": perfil.bairro if perfil else "",
        "cidade": perfil.cidade if perfil else "",
        "estado": perfil.estado if perfil else "",
        "foto": perfil.foto if perfil else ""
    }

class UsuarioPerfilUpdateSchema(BaseModel):
    email: str  # <--- Inclui o e-mail no corpo
    nome: Optional[str] = None
    telefone: Optional[str] = None
    cep: Optional[str] = None
    rua: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    senha_atual: Optional[str] = None
    nova_senha: Optional[str] = None

@router.put("/perfil")
def atualizar_perfil_usuario(dados: UsuarioPerfilUpdateSchema, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == dados.email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")

    perfil = db.query(UsuarioPerfilModel).filter(UsuarioPerfilModel.usuario_id == usuario.id).first()
    if not perfil:
        perfil = UsuarioPerfilModel(usuario_id=usuario.id)
        db.add(perfil)

    dados_dict = dados.dict(exclude_unset=True)
    
    if "nova_senha" in dados_dict and dados_dict["nova_senha"]:
        if usuario.senha and usuario.senha != dados_dict.get("senha_atual"):
            raise HTTPException(status_code=400, detail="A senha atual não confere.")
        usuario.senha = dados_dict["nova_senha"]
    
    # Atualiza o nome na tabela principal e nos agendamentos antigos pelo nome anterior
    nome_antigo = usuario.nome
    if "nome" in dados_dict and dados_dict["nome"]:
        novo_nome = dados_dict["nome"]
        
        # Atualiza os agendamentos que tinham o nome antigo para o novo nome
        from ..models import AgendamentoModel
        db.query(AgendamentoModel).filter(
            AgendamentoModel.cliente_nome == nome_antigo
        ).update({"cliente_nome": novo_nome})
        
        usuario.nome = novo_nome
        db.commit()
        
    if "telefone" in dados_dict and dados_dict["telefone"]:
        if hasattr(usuario, "telefone"):
            usuario.telefone = dados_dict["telefone"]

    for chave, valor in dados_dict.items():
        if chave not in ["email", "senha_atual", "nova_senha"]:
            setattr(perfil, chave, valor)

    db.commit()
    db.refresh(usuario)
    db.refresh(perfil)

    return {
        "mensagem": "Perfil atualizado com sucesso!",
        "usuario": {
            "nome": usuario.nome,
            "email": usuario.email,
            "telefone": perfil.telefone,
            "cep": perfil.cep,
            "rua": perfil.rua,
            "numero": perfil.numero,
            "bairro": perfil.bairro,
            "cidade": perfil.cidade,
            "estado": perfil.estado,
            "foto": perfil.foto
        }
    }

@router.post("/upload-foto-perfil")
async def upload_foto_perfil_supabase(
    email: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Apenas ficheiros de imagem são permitidos.")
    
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    
    try:
        file_bytes = await file.read()
        extensao = file.filename.split(".")[-1]
        caminho_no_bucket = f"user_{usuario.id}_perfil.{extensao}"
        
        # Nome do bucket dedicado para as fotos de perfil (pode criar no Supabase Storage)
        bucket_name = "perfis-usuarios" 
        
        supabase.storage.from_(bucket_name).upload(
            path=caminho_no_bucket,
            file=file_bytes,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        
        public_url_response = supabase.storage.from_(bucket_name).get_public_url(caminho_no_bucket)
        foto_url = public_url_response if isinstance(public_url_response, str) else public_url_response.get("publicUrl")

        perfil = db.query(UsuarioPerfilModel).filter(UsuarioPerfilModel.usuario_id == usuario.id).first()
        if not perfil:
            perfil = UsuarioPerfilModel(usuario_id=usuario.id, foto=foto_url)
            db.add(perfil)
        else:
            perfil.foto = foto_url
            
        db.commit()
        db.refresh(perfil)
        
        return {"mensagem": "Foto enviada com sucesso para o Supabase!", "foto_url": foto_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar imagem para o Supabase: {str(e)}")