import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UsuarioModel
from ..schemas import SolicitarRecuperacaoSchema, RedefinirSenhaSchema
from ..criptografia_senha.criptografia_senha import hash_senha
from ..email.email_codigo import enviar_email_codigo_recuperacao

router = APIRouter(prefix="/api", tags=["Autenticação"])

@router.post("/solicitar-recuperacao")
def solicitar_recuperacao(dados: SolicitarRecuperacaoSchema, db: Session = Depends(get_db)):
    email_limpo = dados.email.lower().strip()
    
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email_limpo).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="E-mail não encontrado."
        )
    
    codigo_recuperacao = f"{random.randint(100000, 999999)}"
    usuario.codigo_ativacao = codigo_recuperacao
    db.commit()
    
    try:
        enviar_email_codigo_recuperacao(email_limpo, codigo_recuperacao)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Erro ao enviar e-mail de recuperação."
        )
        
    return {
        "mensagem": "Código de recuperação enviado com sucesso para o seu e-mail!",
        "email": email_limpo
    }

@router.post("/redefinir-senha")
def redefinir_senha(dados: RedefinirSenhaSchema, db: Session = Depends(get_db)):
    email_limpo = dados.email.lower().strip()
    codigo_limpo = dados.codigo.strip()
    
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email_limpo).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Utilizador não encontrado."
        )
        
    if not usuario.codigo_ativacao or usuario.codigo_ativacao != codigo_limpo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Código de recuperação inválido ou expirado."
        )
        
    # Atualiza a senha encriptando a nova palavra-passe
    usuario.senha = hash_senha(dados.nova_senha)
    usuario.codigo_ativacao = None
    db.commit()
    
    return {"mensagem": "Senha redefinida com sucesso! Já pode fazer login com a nova senha."}