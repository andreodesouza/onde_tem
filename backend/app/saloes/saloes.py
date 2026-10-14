from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UsuarioModel, ConfiguracaoEmpresaModel

router = APIRouter(prefix="/api", tags=["Salões"])

@router.get("/saloes")
def listar_saloes(db: Session = Depends(get_db)):
    # Fazemos a consulta unindo a tabela de Configurações com a de Utilizadores, 
    # garantindo que só trazemos empresas que têm registo na tabela de configurações.
    resultados = db.query(ConfiguracaoEmpresaModel, UsuarioModel).join(
        UsuarioModel, ConfiguracaoEmpresaModel.empresa_id == UsuarioModel.id
    ).all()
    
    lista_saloes = []
    for config, usuario in resultados:
        lista_saloes.append({
            "id": str(usuario.id),
            "nome": config.nome_fantasia or usuario.nome_fantasia or usuario.nome or "Estabelecimento",
            "email": usuario.email,
            "lat": config.latitude if config.latitude else -22.901844,
            "lng": config.longitude if config.longitude else -42.474725,
            "servicos": config.categorias if config.categorias else "Serviços de Beleza",
            "img": config.foto_url if config.foto_url else "",
            "endereco": config.endereco if config.endereco else "Endereço não informado",
            "horario": config.horario_funcionamento if config.horario_funcionamento else "",
            "telefone": config.telefone_contato or usuario.telefone or "",
            "avaliacao": 5.0,
            "total_avaliacoes": 1,
            "servicos_detalhados": []
        })
        
    return lista_saloes

@router.get("/saloes/{salao_id}")
def obter_salao(salao_id: int, db: Session = Depends(get_db)):
    # Busca a configuração específica da empresa
    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == salao_id).first()
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == salao_id).first()
    
    if not usuario or not config:
        raise HTTPException(status_code=404, detail="Salão não encontrado ou sem configurações ativas.")
        
    return {
        "id": str(usuario.id),
        "nome": config.nome_fantasia or usuario.nome_fantasia or usuario.nome,
        "email": usuario.email,
        "lat": config.latitude if config.latitude else -22.901844,
        "lng": config.longitude if config.longitude else -42.474725,
        "servicos": config.categorias if config.categorias else "",
        "img": config.foto_url if config.foto_url else "",
        "endereco": config.endereco if config.endereco else "",
        "horario": config.horario_funcionamento if config.horario_funcionamento else "",
        "telefone": config.telefone_contato or usuario.telefone or "",
        "avaliacao": 5.0,
        "total_avaliacoes": 1,
        "servicos_detalhados": []
    }