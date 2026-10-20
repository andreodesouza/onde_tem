from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..database import get_db

# 1. ESTA LINHA É OBRIGATÓRIA ANTES DE QUALQUER @router
router = APIRouter()

# Inicializa o agendador
scheduler = BackgroundScheduler()

def verificar_lembretes_agendamentos():
    db_generator = get_db()
    db = next(db_generator)
    
    try:
        agora = datetime.now()
        alvo_1h_inicio = agora + timedelta(minutes=59)
        alvo_1h_fim = agora + timedelta(minutes=60)
        alvo_30m_inicio = agora + timedelta(minutes=29)
        alvo_30m_fim = agora + timedelta(minutes=30)
        fmt = "%Y-%m-%d %H:%M:%S"
        
        print(f"[{agora}] A verificar lembretes de agendamentos...")

        query = text("""
            SELECT id, cliente_nome, data_hora, servico_id, empresa_id 
            FROM agendamentos 
            WHERE status = 'confirmado' 
              AND (
                (data_hora >= :inicio_1h AND data_hora <= :fim_1h) OR 
                (data_hora >= :inicio_30m AND data_hora <= :fim_30m)
              )
        """)
        
        resultados = db.execute(query, {
            "inicio_1h": alvo_1h_inicio.strftime(fmt),
            "fim_1h": alvo_1h_fim.strftime(fmt),
            "inicio_30m": alvo_30m_inicio.strftime(fmt),
            "fim_30m": alvo_30m_fim.strftime(fmt)
        }).fetchall()

        for ag in resultados:
            print(f"-> Encontrado agendamento ID {ag.id} para {ag.cliente_nome} às {ag.data_hora}. Disparando notificação...")

    except Exception as e:
        print(f"Erro ao verificar lembretes de agendamento: {e}")
    finally:
        db.close()

scheduler.add_job(verificar_lembretes_agendamentos, 'interval', minutes=1)

@router.get("/api/notificacoes/verificar-pendentes")
def verificar_notificacoes_cliente(cliente_nome: str, db = Depends(get_db)):
    agora = datetime.now()
    fmt = "%Y-%m-%d %H:%M:%S"
    
    alvo_1h_inicio = agora + timedelta(minutes=59)
    alvo_1h_fim = agora + timedelta(minutes=60)
    alvo_30m_inicio = agora + timedelta(minutes=29)
    alvo_30m_fim = agora + timedelta(minutes=30)
    
    query = text("""
        SELECT id, servico_id, data_hora 
        FROM agendamentos 
        WHERE cliente_nome = :cliente_nome 
          AND status = 'confirmado'
          AND (
            (data_hora >= :i_1h AND data_hora <= :f_1h) OR 
            (data_hora >= :i_30m AND data_hora <= :f_30m)
          )
    """)
    
    res = db.execute(query, {
        "cliente_nome": cliente_nome,
        "i_1h": alvo_1h_inicio.strftime(fmt),
        "f_1h": alvo_1h_fim.strftime(fmt),
        "i_30m": alvo_30m_inicio.strftime(fmt),
        "f_30m": alvo_30m_fim.strftime(fmt)
    }).fetchone()
    
    if res:
        return {"encontrado": True, "servico_id": res.servico_id, "horario": res.data_hora}
    return {"encontrado": False}