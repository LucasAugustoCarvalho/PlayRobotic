#!/bin/bash

# ============================================
# Script de Configuração do Sistema PlayRobotic
# ============================================

echo "🚀 Iniciando configuração do Sistema PlayRobotic..."
echo "=================================================="
echo ""

# Verificar se o PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL não encontrado!"
    echo ""
    echo "Para instalar o PostgreSQL:"
    echo "  Ubuntu/Debian: sudo apt update && sudo apt install postgresql postgresql-contrib"
    echo "  CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    echo "  macOS: brew install postgresql"
    echo ""
    echo "Após instalar, inicie o serviço:"
    echo "  sudo systemctl start postgresql"
    echo "  sudo systemctl enable postgresql"
    exit 1
fi

echo "✅ PostgreSQL encontrado"

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo ""
    echo "Para instalar o Node.js:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install nodejs"
    echo "  macOS: brew install node"
    echo ""
    exit 1
fi

echo "✅ Node.js encontrado"

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado!"
    echo "Instale o npm: sudo apt install npm (Ubuntu) ou brew install npm (macOS)"
    exit 1
fi

echo "✅ npm encontrado"

echo ""
echo "📦 Criando estrutura de banco de dados..."
echo "----------------------------------------"

# Criar banco de dados se não existir
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw playrobotic_db; then
    echo "⚠️  Banco de dados 'playrobotic_db' já existe"
    read -p "Deseja recriar o banco de dados? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "🔄 Recriando banco de dados..."
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS playrobotic_db;"
        sudo -u postgres psql -c "CREATE DATABASE playrobotic_db;"
    fi
else
    echo "📁 Criando banco de dados 'playrobotic_db'..."
    sudo -u postgres psql -c "CREATE DATABASE playrobotic_db;"
fi

echo ""
echo "🗄️  Executando scripts SQL..."
echo "-----------------------------"

# Função para executar scripts SQL
executar_sql() {
    local arquivo=$1
    local descricao=$2
    
    echo "  Executando: $descricao"
    if sudo -u postgres psql -d playrobotic_db -f "$arquivo" 2>/dev/null; then
        echo "    ✅ Concluído"
    else
        echo "    ⚠️  Erro ao executar $arquivo"
        return 1
    fi
}

# Executar scripts na ordem
cd "$(dirname "$0")"

executar_sql "database/01_create_database.sql" "Criação do banco"
executar_sql "database/02_create_tables.sql" "Criação de tabelas"
executar_sql "database/03_create_functions.sql" "Criação de funções"
executar_sql "database/04_create_triggers.sql" "Criação de triggers"
executar_sql "database/05_insert_sample_data.sql" "Inserção de dados de teste"
executar_sql "database/06_create_indexes.sql" "Criação de índices"

echo ""
echo "🔧 Configurando API..."
echo "----------------------"

# Navegar para a pasta da API
cd api

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo "📄 Criando arquivo .env..."
    cat > .env << EOL
# Configuração do Banco de Dados
DB_USER=postgres
DB_HOST=localhost
DB_NAME=playrobotic_db
DB_PASSWORD=postgres
DB_PORT=5432

# Configuração da API
PORT=3000
NODE_ENV=development

# Configurações de Segurança
JWT_SECRET=playrobotic_secret_key_2025
EOL
    echo "    ⚠️  Arquivo .env criado. Configure a senha do PostgreSQL se necessário."
fi

echo ""
echo "📦 Instalando dependências Node.js..."
echo "------------------------------------"

# Instalar dependências
if npm install; then
    echo "✅ Dependências instaladas com sucesso"
else
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo ""
echo "✅ Configuração concluída com sucesso!"
echo ""
echo "=================================================="
echo "📋 PRÓXIMOS PASSOS:"
echo "=================================================="
echo ""
echo "1. 🔧 CONFIGURAR SENHA DO POSTGRESQL (se necessário):"
echo "   Edite o arquivo: api/.env"
echo "   Altere DB_PASSWORD para a senha do seu PostgreSQL"
echo ""
echo "2. 🚀 INICIAR A API:"
echo "   cd api && npm start"
echo "   Ou para desenvolvimento: npm run dev"
echo ""
echo "3. 🌐 ACESSAR O SISTEMA:"
echo "   Opção A - Abra diretamente no navegador:"
echo "     file://$(pwd)/../index.html"
echo ""
echo "   Opção B - Use um servidor local (recomendado):"
echo "     python3 -m http.server 8000"
echo "     Acesse: http://localhost:8000"
echo ""
echo "4. 📊 TESTAR A API:"
echo "   curl http://localhost:3000/api/clientes"
echo "   Deve retornar a lista de clientes"
echo ""
echo "=================================================="
echo "🔗 URLs do Sistema:"
echo "   API: http://localhost:3000"
echo "   Sistema: http://localhost:8000"
echo "=================================================="
echo ""
echo "❓ Para ajuda ou problemas:"
echo "   - Verifique se o PostgreSQL está rodando: sudo systemctl status postgresql"
echo "   - Verifique logs da API: tail -f api/server.log"
echo "   - Teste conexão com banco: psql -U postgres -d playrobotic_db"
echo ""