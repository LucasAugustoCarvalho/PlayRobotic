-- Tabela de Clientes
CREATE TABLE cliente (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    endereco TEXT,
    cidade VARCHAR(50),
    estado VARCHAR(2),
    data_cadastro DATE DEFAULT CURRENT_DATE,
    status VARCHAR(10) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    total_compras DECIMAL(10,2) DEFAULT 0,
    pontos_fidelidade INTEGER DEFAULT 0
);

-- Tabela de Funcionários
CREATE TABLE funcionario (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    tipo_contrato VARCHAR(20) NOT NULL CHECK (tipo_contrato IN ('Fixo', 'Comissionado')),
    salario_base DECIMAL(10,2) NOT NULL,
    percentual_comissao DECIMAL(5,2) DEFAULT 0,
    email VARCHAR(100),
    telefone VARCHAR(20),
    status VARCHAR(10) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'ferias')),
    data_admissao DATE DEFAULT CURRENT_DATE
);

-- Tabela de Produtos
CREATE TABLE produto (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL CHECK (preco >= 0),
    custo DECIMAL(10,2),
    estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    estoque_minimo INTEGER DEFAULT 5,
    qtd_visualizacoes INTEGER DEFAULT 0,
    avaliacao_media DECIMAL(3,2) DEFAULT 0 CHECK (avaliacao_media BETWEEN 0 AND 5),
    status VARCHAR(10) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'))
);

-- Tabela de Pedidos
CREATE TABLE pedido (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES cliente(id) ON DELETE SET NULL,
    vendedor_id INTEGER REFERENCES funcionario(id) ON DELETE SET NULL,
    data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'faturado', 'cancelado')),
    subtotal DECIMAL(10,2) DEFAULT 0,
    desconto DECIMAL(10,2) DEFAULT 0,
    valor_total DECIMAL(10,2) DEFAULT 0,
    observacoes TEXT
);

-- Tabela de Itens do Pedido (associação N:M entre Pedido e Produto)
CREATE TABLE item_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produto(id),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal_item DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
    UNIQUE(pedido_id, produto_id)
);

-- Tabela de Avaliações
CREATE TABLE avaliacao (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produto(id),
    nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario TEXT,
    data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cliente_id, produto_id)
);

-- Tabela de Visualizações
CREATE TABLE visualizacao_produto (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES cliente(id) ON DELETE SET NULL,
    produto_id INTEGER NOT NULL REFERENCES produto(id),
    data_visualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duracao_segundos INTEGER
);

-- Tabela de Recomendações
CREATE TABLE recomendacao (
    id SERIAL PRIMARY KEY,
    produto_base_id INTEGER NOT NULL REFERENCES produto(id),
    produto_recomendado_id INTEGER NOT NULL REFERENCES produto(id),
    confianca DECIMAL(3,2) DEFAULT 0,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(produto_base_id, produto_recomendado_id)
);