from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UsuarioModel
from ..schemas import UsuarioLogin
from ..criptografia_senha.criptografia_senha import verificar_senha

router = APIRouter(prefix="/api", tags=["Autenticação"])

@router.post("/login")
def efetuar_login(dados: UsuarioLogin, db: Session = Depends(get_db)):
    email_limpo = dados.email.lower().strip()
    
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email_limpo).first()
    
    # Valida se o utilizador existe e se a senha corresponde ao hash guardado
    if not usuario or not verificar_senha(dados.senha, usuario.senha):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="E-mail ou palavra-passe incorretos."
        )
        
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Conta não ativada. Por favor, insira o código enviado por e-mail."
        )
        
    return {
        "token": "token-jwt-exemplo-seguro",
        "usuario": {
            "nome": usuario.nome or usuario.nome_fantasia,
            "email": usuario.email,
            "tipo": usuario.tipo
        }
    }