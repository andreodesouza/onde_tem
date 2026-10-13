from sqlalchemy import Column, Boolean, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from .database import Base

class UsuarioModel(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    senha = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    nome = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    nome_fantasia = Column(String, nullable=True)
    razao_social = Column(String, nullable=True)
    codigo_ativacao = Column(String, nullable=True)
    ativo = Column(Boolean, default=False, nullable=False)

class ConfiguracaoEmpresaModel(Base):
    __tablename__ = "configuracoes_empresa"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    empresa_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), unique=True, nullable=False)
    nome_fantasia = Column(String(150), nullable=True)
    razao_social = Column(String(150), nullable=True)
    telefone_contato = Column(String(30), nullable=True)
    endereco = Column(Text, nullable=True)
    categorias = Column(String(255), nullable=True)
    descricao = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    atualizado_em = Column(DateTime, server_default=func.now(), onupdate=func.now())