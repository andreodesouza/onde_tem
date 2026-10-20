from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends
from sqlalchemy import text
from ..database import get_db

router = APIRouter()
scheduler = BackgroundScheduler()

def verificar_lembretes_agendamentos():
    db_generator = get_db()
    db = next(db_generator)
    
    try:
        # Fuso horário do Brasil para alinhar com os agendamentos da BD
        fuso_brasil = ZoneInfo("America/Sao_Paulo")
        agora = datetime.now(fuso_brasil).replace(tzinfo=None)
        
        alvo_1h_inicio = agora + timedelta(minutes=59)
        alvo_1h_fim = agora + timedelta(minutes=60)
        
        alvo_30m_inicio = agora + timedelta(minutes=29)
        alvo_30m_fim = agora + timedelta(minutes=30)
        
        fmt = "%Y-%m-%d %H:%M:%S"
        
        print(f"[{agora}] A verificar lembretes de agendamentos...")

        query = text("""
            SELECT a.id, a.cliente_nome, a.data_hora, s.nome AS servico_nome 
            FROM agendamentos a
            LEFT JOIN servicos s ON a.servico_id = s.id
            WHERE a.status = 'confirmado' 
              AND (
                (a.data_hora >= :inicio_1h AND a.data_hora <= :fim_1h) OR 
                (a.data_hora >= :inicio_30m AND a.data_hora <= :fim_30m)
              )
        """)
        
        resultados = db.execute(query, {
            "inicio_1h": alvo_1h_inicio.strftime(fmt),
            "fim_1h": alvo_1h_fim.strftime(fmt),
            "inicio_30m": alvo_30m_inicio.strftime(fmt),
            "fim_30m": alvo_30m_fim.strftime(fmt)
        }).fetchall()

        for ag in resultados:
            print(f"-> Encontrado agendamento ID {ag.id} para {ag.cliente_nome} às {ag.data_hora}.")

    except Exception as e:
        print(f"Erro ao verificar lembretes de agendamento: {e}")
    finally:
        db.close()

# Regista a tarefa para correr a cada 1 minuto
scheduler.add_job(verificar_lembretes_agendamentos, 'interval', minutes=1)

@router.get("/api/notificacoes/verificar-pendentes")
def verificar_notificacoes_cliente(cliente_nome: str, db = Depends(get_db)):
    fuso_brasil = ZoneInfo("America/Sao_Paulo")
    agora = datetime.now(fuso_brasil).replace(tzinfo=None)
    fmt = "%Y-%m-%d %H:%M:%S"
    
    alvo_1h_inicio = agora + timedelta(minutes=59)
    alvo_1h_fim = agora + timedelta(minutes=60)
    alvo_30m_inicio = agora + timedelta(minutes=29)
    alvo_30m_fim = agora + timedelta(minutes=30)
    
    query = text("""
        SELECT a.id, s.nome AS servico_nome, a.data_hora 
        FROM agendamentos a
        LEFT JOIN servicos s ON a.servico_id = s.id
        WHERE a.cliente_nome = :cliente_nome 
          AND a.status = 'confirmado'
          AND (
            (a.data_hora >= :i_1h AND a.data_hora <= :f_1h) OR 
            (a.data_hora >= :i_30m AND a.data_hora <= :f_30m)
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
        return {"encontrado": True, "servico": res.servico_nome or "Procedimento", "horario": res.data_hora}
    return {"encontrado": False}