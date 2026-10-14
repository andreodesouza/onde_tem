from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, get_db
from .configuracoes_salao_dashboard.configuracoes_salao_dashboard import router as configuracoes_router
from .login.efetuar_login import router as login_router
from .login.cadastro import router as cadastro_router
from .login.redefinir_senha import router as redefinir_senha_router
from .saloes.saloes import router as saloes_router

# Cria as tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Onde Tem?", version="1.0.0")

app.include_router(configuracoes_router)  

app.include_router(login_router)

app.include_router(cadastro_router)  

app.include_router(redefinir_senha_router)  

app.include_router(saloes_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)