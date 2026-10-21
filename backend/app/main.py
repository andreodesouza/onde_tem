from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, get_db
from .configuracoes_salao_dashboard.configuracoes_salao_dashboard import router as configuracoes_router
from .login.efetuar_login import router as login_router
from .login.cadastro import router as cadastro_router
from .login.redefinir_senha import router as redefinir_senha_router
from .saloes.saloes import router as saloes_router
from .configuracoes_salao_dashboard.servicos_profissionais import router as servicos_profissionais_router
from.configuracoes_salao_dashboard.agenda import router as agenda_router
from .configuracoes_salao_dashboard.agendamentos import router as agendamentos_router
from .configuracoes_user_dashboard import configuracoes_user_dashboard as cfg_user # Ou o nome do seu import
from.pagamento.pagamento import router as pagamento_router
from .notificacao.notificacao import router as notificacao_router

# Cria as tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Onde Tem?", version="1.0.0")

@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok"}


# Regista o router com o prefixo /api/notificacoes
app.include_router(notificacao_router, prefix="/api/notificacoes", tags=["Notificacoes"])

app.include_router(configuracoes_router)  

app.include_router(login_router)

app.include_router(cadastro_router)  

app.include_router(redefinir_senha_router)  

app.include_router(saloes_router)

app.include_router(servicos_profissionais_router)

app.include_router(agenda_router)

app.include_router(agendamentos_router)

app.include_router(cfg_user.router)

app.include_router(pagamento_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)