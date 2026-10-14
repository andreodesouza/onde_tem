import os
from pathlib import Path
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Localiza a pasta raiz do projeto (subindo três pastas a partir de database.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(os.path.join(BASE_DIR, ".env"))

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Codifica a palavra-passe para que carateres especiais (como o '@') não quebrem a URL
senha_segura = quote_plus(DB_PASSWORD) if DB_PASSWORD else ""

# Monta a string de conexão de forma segura para o PostgreSQL
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{senha_segura}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()