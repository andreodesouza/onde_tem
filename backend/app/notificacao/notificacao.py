import requests
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import text
from fastapi import APIRouter
from ..database import get_db

# Inicializa apenas o agendador em segundo plano
scheduler = BackgroundScheduler()

# Configurações da Evolution API
EVOLUTION_URL = "https://evolution-api-wghc.onrender.com"
INSTANCE_NAME = "OndeTemApp"
API_KEY = "minha_chave_super_secreta_api"

def enviar_whatsapp_evolution(telefone: str, mensagem: str):
    # Remove qualquer caractere não numérico caso venha formatado da BD
    telefone_limpo = "".join(filter(str.isdigit, telefone))
    
    url = f"{EVOLUTION_URL}/message/sendText/{INSTANCE_NAME}"
    
    payload = {
        "number": telefone_limpo,
        "text": mensagem,
        "options": {
            "delay": 1200,
            "presence": "composing"
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "apikey": API_KEY
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code in [200, 201]:
            print(f"WhatsApp enviado com sucesso para {telefone_limpo}!")
        else:
            print(f"Erro ao enviar WhatsApp: {response.text}")
    except Exception as e:
        print(f"Exceção na requisição da Evolution API: {e}")

def verificar_lembretes_agendamentos():
    db_generator = get_db()
    db = next(db_generator)
    
    try:
        fuso_brasil = ZoneInfo("America/Sao_Paulo")
        agora = datetime.now(fuso_brasil).replace(tzinfo=None)
        
        # Janela de verificação (agendamentos daqui a 1 hora)
        alvo_1h_inicio = agora + timedelta(minutes=59)
        alvo_1h_fim = agora + timedelta(minutes=60)
        
        fmt = "%Y-%m-%d %H:%M:%S"
        
        print(f"[{agora}] A verificar agendamentos para disparo via WhatsApp...")

        # Consulta corrigida utilizando o cliente_nome para ligar à tabela usuario_perfil
        query = text("""
            SELECT a.id, a.cliente_nome, up.telefone AS cliente_telefone, s.nome AS servico_nome, a.data_hora 
            FROM agendamentos a
            LEFT JOIN usuario_perfil up ON a.cliente_nome = up.nome
            LEFT JOIN servicos s ON a.servico_id = s.id
            WHERE a.status = 'confirmado' 
              AND (a.data_hora >= :inicio_1h AND a.data_hora <= :fim_1h)
        """)
        
        resultados = db.execute(query, {
            "inicio_1h": alvo_1h_inicio.strftime(fmt),
            "fim_1h": alvo_1h_fim.strftime(fmt)
        }).fetchall()

        for ag in resultados:
            if ag.cliente_telefone:
                mensagem = f"Olá *{ag.cliente_nome}*! Passamos para lembrar que o seu agendamento para *{ag.servico_nome}* começa às *{ag.data_hora}*. Contamos com a sua presença!"
                enviar_whatsapp_evolution(ag.cliente_telefone, mensagem)
                print(f"-> Lembrete enviado via WhatsApp para {ag.cliente_nome} ({ag.cliente_telefone}).")

    except Exception as e:
        print(f"Erro ao verificar lembretes para WhatsApp: {e}")
    finally:
        db.close()

# Regista a tarefa para correr a cada 1 minuto de forma totalmente autónoma no servidor
scheduler.add_job(verificar_lembretes_agendamentos, 'interval', minutes=1)

# Inicia o agendador em segundo plano se ainda não estiver a correr
if not scheduler.running:
    scheduler.start()

# Cria um router vazio para satisfazer a importação do main.py
router = APIRouter()

@router.get("/testar-envio-imediato")
def testar_envio_imediato():
    enviar_whatsapp_evolution("5522974044370", "Olá André! Este é um teste manual de envio direto via Evolution API no Onde Tem?.")
    return {"status": "Mensagem de teste disparada!"}