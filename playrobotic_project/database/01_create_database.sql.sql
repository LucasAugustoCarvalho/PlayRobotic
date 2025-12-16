-- Criação do banco de dados
CREATE DATABASE playrobotic_db;

-- Conectar ao banco criado
\c playrobotic_db;

-- Extensão para UUID (opcional, mas recomendado)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";