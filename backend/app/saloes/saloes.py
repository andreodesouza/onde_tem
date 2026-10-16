from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import UsuarioModel, ConfiguracaoEmpresaModel, ServicoModel, ProfissionalModel

router = APIRouter(prefix="/api", tags=["Salões"])

@router.get("/saloes")
def listar_saloes(db: Session = Depends(get_db)):
    resultados = db.query(ConfiguracaoEmpresaModel, UsuarioModel).join(
        UsuarioModel, ConfiguracaoEmpresaModel.empresa_id == UsuarioModel.id
    ).all()
    
    lista_saloes = []
    for config, usuario in resultados:
        servicos_db = db.query(ServicoModel).filter(ServicoModel.empresa_id == usuario.id).all()
        servicos_formatados = []
        for s in servicos_db:
            prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == s.profissional_id).first() if s.profissional_id else None
            servicos_formatados.append({
                "id": s.id,
                "nome": s.nome,
                "descricao": s.descricao or "Sem descrição",
                "duracao_min": s.duracao_minutos,
                "preco": s.preco,
                "profissional_id": s.profissional_id,  # <-- Adicionado aqui
                "profissional_nome": prof.nome if prof else "Equipe Geral"
            })

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
            "servicos_detalhados": servicos_formatados
        })
        
    return lista_saloes

@router.get("/saloes/{salao_id}")
def obter_salao(salao_id: int, db: Session = Depends(get_db)):
    config = db.query(ConfiguracaoEmpresaModel).filter(ConfiguracaoEmpresaModel.empresa_id == salao_id).first()
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == salao_id).first()
    
    if not usuario or not config:
        raise HTTPException(status_code=404, detail="Salão não encontrado ou sem configurações ativas.")
        
    # Adicionado o filtro .filter(ServicoModel.ativo == True) aqui em baixo:
    servicos_db = db.query(ServicoModel).filter(
        ServicoModel.empresa_id == salao_id,
        ServicoModel.ativo == True
    ).all()
    
    servicos_formatados = []
    for s in servicos_db:
        prof = db.query(ProfissionalModel).filter(ProfissionalModel.id == s.profissional_id).first() if s.profissional_id else None
        
        servicos_formatados.append({
            "id": s.id,
            "nome": s.nome,
            "descricao": s.descricao or "Sem descrição disponível",
            "duracao_min": s.duracao_minutos,
            "preco": s.preco,
            "profissional_id": s.profissional_id,
            "profissional_nome": prof.nome if prof else "Equipe Geral"
        })

    return {
        "id": str(usuario.id),
        "nome": config.nome_fantasia or usuario.nome_fantasia or usuario.nome,
        "email": usuario.email,
        "lat": config.latitude if config.latitude else -22.901844,
        "lng": config.longitude if config.longitude else -42.474725,
        "servicos": config.categorias if config.categorias else "",
        "img": config.foto_url if config.foto_url else "",
        "endereco": config.endereco if config else "",
        "horario": config.horario_funcionamento if config else "",
        "telefone": config.telefone_contato or usuario.telefone or "",
        "avaliacao": 5.0,
        "total_avaliacoes": 1,
        "servicos_detalhados": servicos_formatados
    }