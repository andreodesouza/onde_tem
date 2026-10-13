import os
import sib_api_v3_sdk 
from .email_templates import email_ativacao, email_recuperacao
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


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