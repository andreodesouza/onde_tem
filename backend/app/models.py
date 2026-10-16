from sqlalchemy import Column, Boolean, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from .database import Base
from sqlalchemy.orm import relationship

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
    foto_url = Column(String, nullable=True)             
    horario_funcionamento = Column(String, nullable=True)

class ProfissionalModel(Base):
    __tablename__ = "profissionais"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nome = Column(String, nullable=False)
    especialidade = Column(String, nullable=False)
    telefone = Column(String, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)

class ServicoModel(Base):
    __tablename__ = "servicos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nome = Column(String, nullable=False)
    preco = Column(Float, nullable=False)
    duracao_minutos = Column(Integer, nullable=False)
    profissional_id = Column(Integer, ForeignKey("profissionais.id"), nullable=True)
    descricao = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)

class AgendaHorarioModel(Base):
    __tablename__ = "agenda_horarios"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    data = Column(String, nullable=False)          # Formato: "2026-11-15"
    hora = Column(String, nullable=False)          # Formato: "14:00"
    disponivel = Column(Integer, default=1)        # 1 = Livre, 0 = Ocupado/Reservado
    profissional_id = Column(Integer, ForeignKey("profissionais.id"), nullable=True) # Opcional

class AgendamentoModel(Base):
    __tablename__ = "agendamentos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    cliente_nome = Column(String, nullable=False)
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=False)
    profissional_id = Column(Integer, ForeignKey("profissionais.id"), nullable=True)
    data_hora = Column(String, nullable=False) # Ex: "2026-10-14 11:00"
    status = Column(String, default="pendente") # pendente, confirmad

class UsuarioPerfilModel(Base):
    __tablename__ = "usuario_perfil"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, index=True)
    nome = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    rua = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    foto = Column(String, nullable=True) # <--- Adicionado para guardar a foto do perfil

    usuario = relationship("UsuarioModel", backref="perfil")