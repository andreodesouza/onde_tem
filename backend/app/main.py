import bcrypt
import os
from dotenv import load_dotenv
load_dotenv()
import random
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from .database import engine, Base, get_db
from .models import UsuarioModel
from .schemas import UsuarioCadastro, UsuarioLogin, AtivacaoConta, SolicitarRecuperacaoSchema, RedefinirSenhaSchema
from .email_templates import email_ativacao, email_recuperacao
from .saloes import saloes
from .configuracoes_salao_dashboard.configuracoes_salao_dashboard import router as configuracoes_router

# Cria as tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Onde Tem?", version="1.0.0")

app.include_router(configuracoes_router)  # Inclui o router das configurações do salão

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SALÕES FICTÍCIOS ---
saloes_db = saloes.saloes()


# --- CRIPTOGRAFIA DA SENHA  ---
def hash_senha(senha: str) -> str:
    # Converte a senha para bytes, gera o salt e faz o hash (trunca com segurança nos 72 bytes)
    senha_bytes = senha.encode('utf-8')[:72]
    hashed = bcrypt.hashpw(senha_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')

def verificar_senha(senha_plain: str, senha_hash: str) -> bool:
    try:
        senha_bytes = senha_plain.encode('utf-8')[:72]
        return bcrypt.checkpw(senha_bytes, senha_hash.encode('utf-8'))
    except Exception:
        return False

# --- FUNÇÃO DE E-MAIL COM BREVO ---
def enviar_email_codigo(email_destino: str, codigo: str):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = os.getenv("API_KEY_BREVO")

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    subject = "Código de Ativação — Onde Tem?"
    
    html_content = email_ativacao.obter_html_ativacao(codigo)
    
    sender = {"name": "Onde Tem", "email": "andreodesouza2@gmail.com"}
    to = [{"email": email_destino}]

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        html_content=html_content,
        sender=sender,
        subject=subject
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"E-mail enviado com sucesso via Brevo para {email_destino}. ID: {api_response.message_id}")
    except ApiException as e:
        print(f"Erro ao enviar e-mail via Brevo: {e}")

def enviar_email_codigo_recuperacao(email_destino: str, codigo: str):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = os.getenv("API_KEY_BREVO")

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    subject = "Código de Recuperação de Senha — Onde Tem?"
    
    html_content = email_recuperacao.obter_html_recuperacao(codigo)
    
    sender = {"name": "Onde Tem", "email": "andreodesouza2@gmail.com"}
    to = [{"email": email_destino}]

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        html_content=html_content,
        sender=sender,
        subject=subject
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"E-mail enviado com sucesso via Brevo para {email_destino}. ID: {api_response.message_id}")
    except ApiException as e:
        print(f"Erro ao enviar e-mail via Brevo: {e}")        

# --- ROTAS DA API ---

@app.post("/api/cadastro", status_code=status.HTTP_201_CREATED)
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

@app.post("/api/ativar")
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

@app.post("/api/login")
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

@app.post("/api/solicitar-recuperacao")
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

@app.post("/api/redefinir-senha")
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

# --- ROTA PARA LISTAR TODOS OS SALÕES ---
@app.get("/api/saloes")
def listar_saloes():
    return saloes_db

# --- ROTA PARA BUSCAR SALÃO POR ID ---
@app.get("/api/saloes/{salao_id}")
def obter_salao(salao_id: str):
    salao = next((s for s in saloes_db if s["id"] == salao_id), None)
    if not salao:
        raise HTTPException(status_code=404, detail="Salão não encontrado")
    return salao