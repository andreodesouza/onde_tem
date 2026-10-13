from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, get_db
from .saloes import saloes
from .configuracoes_salao_dashboard.configuracoes_salao_dashboard import router as configuracoes_router
from .login.efetuar_login import router as login_router
from .login.cadastro import router as cadastro_router
from .login.redefinir_senha import router as redefinir_senha_router

# Cria as tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Onde Tem?", version="1.0.0")

app.include_router(configuracoes_router)  

app.include_router(login_router)

app.include_router(cadastro_router)  

app.include_router(redefinir_senha_router)  

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SALÕES FICTÍCIOS ---
saloes_db = saloes.saloes()


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