import bcrypt

def hash_senha(senha: str) -> str:
    # Converte a senha para bytes, gera o salt e faz o hash (trunca com segurança nos 72 bytes)
    senha_bytes = senha.encode('utf-8')[:72]
    hashed = bcrypt.hashpw(senha_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')

def verificar_senha(senha_plain: str, senha_hash: str) -> bool:
    try:
        senha_bytes = senha_plain.encode('utf-8')[:72]
        return bcrypt.checkpw(senha_bytes, senha_hash.encode('utf-8'))
    except Exception:
        return False   