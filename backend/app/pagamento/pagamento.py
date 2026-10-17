import unicodedata
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

router = APIRouter()

class PixRequest(BaseModel):
    transaction_amount: float
    description: str
    payer_email: str
    empresa_id: int
    cliente_nome: str

def limpar_ascii(texto: str) -> str:
    return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')

@router.post("/api/criar-pix")
async def criar_pagamento_pix(payload: PixRequest):
    # Insira o seu Access Token de teste aqui (começa com TEST-)
    ACCESS_TOKEN = os.getenv("TOKEN_MERCADO_PAGO", "SEU_ACCESS_TOKEN_DE_TESTE_AQUI")
    
    url = "https://api.mercadopago.com/v1/payments"
    
    cliente_seguro = limpar_ascii(payload.cliente_nome or "Cliente")
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": f"agenda-{payload.empresa_id}-{cliente_seguro}".replace(" ", "-")
    }
    
    # Garante um e-mail válido para o sandbox do Mercado Pago se o do cliente vier inválido
    email_pagador = payload.payer_email
    if not email_pagador or "@" not in email_pagador or "visitante" in email_pagador.lower():
        email_pagador = "test_user_123456@testuser.com"

    body = {
        "transaction_amount": float(payload.transaction_amount),
        "description": payload.description[:255], # Limite de caracteres do MP
        "payment_method_id": "pix",
        "payer": {
            "email": email_pagador,
            "first_name": cliente_seguro[:25]
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=body, headers=headers)
        
        # Mostra o erro detalhado no terminal do VS Code caso falhe
        if response.status_code != 201:
            print("--- RESPOSTA COMPLETA DO MERCADO PAGO ---")
            print(response.status_code, response.text)
            raise HTTPException(status_code=400, detail=response.json())
            
        data = response.json()
        point_of_interaction = data.get("point_of_interaction", {})
        tx_data = point_of_interaction.get("transaction_data", {})
        
        return {
            "payment_id": data.get("id"),
            "status": data.get("status"),
            "qr_code": tx_data.get("qr_code"),
            "qr_code_base64": tx_data.get("qr_code_base64")
        }