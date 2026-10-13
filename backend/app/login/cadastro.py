import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UsuarioModel
from ..schemas import UsuarioCadastro, AtivacaoConta
from ..criptografia_senha.criptografia_senha import hash_senha
from ..email.email_codigo import enviar_email_codigo

router = APIRouter(prefix="/api", tags=["Autenticação"])

@router.post("/cadastro", status_code=status.HTTP_201_CREATED)
def cadastrar_utilizador(usuario: UsuarioCadastro, db: Session = Depends(get_db)):
    email_limpo = usuario.email.lower().strip()
    
    existente = db.query(UsuarioModel).filter(UsuarioModel.email == email_limpo).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Este e-mail já está registado."
        )
    
    codigo_gerado = f"{random.randint(100000, 999999)}"
    
    novo_usuario = UsuarioModel(
        email=email_limpo,
        senha=hash_senha(usuario.senha),
        tipo=usuario.tipo,
        nome=usuario.nome,
        telefone=usuario.telefone,
        nome_fantasia=usuario.nome_fantasia,
        razao_social=usuario.razao_social,
        codigo_ativacao=codigo_gerado,
        ativo=False
    )
    
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    
    enviar_email_codigo(email_limpo, codigo_gerado)
    
    return {
        "mensagem": "Registo efetuado com sucesso! Verifique o seu e-mail para obter o código de ativação.",
        "email": email_limpo
    }

@router.post("/ativar")
def ativar_conta(dados: AtivacaoConta, db: Session = Depends(get_db)):
    email_limpo = dados.email.lower().strip()
    codigo_limpo = dados.codigo.strip()
    
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email_limpo).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
        
    if usuario.ativo:
        return {"mensagem": "Esta conta já se encontra ativa."}
        
    if usuario.codigo_ativacao != codigo_limpo:
        raise HTTPException(status_code=400, detail="Código de ativação incorreto.")
        
    usuario.ativo = True
    usuario.codigo_ativacao = None  
    db.commit()
    
    return {"mensagem": "Conta ativada com sucesso! Já pode fazer login."}