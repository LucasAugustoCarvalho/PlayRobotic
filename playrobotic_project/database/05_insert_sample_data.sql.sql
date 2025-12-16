-- Inserir clientes
INSERT INTO cliente (codigo, nome, email, telefone, cpf, cidade, estado, pontos_fidelidade) VALUES
('#CLI-001', 'João Silva', 'joao.silva@email.com', '(81) 99999-9999', '123.456.789-00', 'Recife', 'PE', 125),
('#CLI-002', 'Maria Oliveira', 'maria.oliveira@email.com', '(81) 98888-8888', '987.654.321-00', 'Recife', 'PE', 89),
('#CLI-003', 'Carlos Santos', 'carlos.santos@email.com', '(81) 97777-7777', '456.789.123-00', 'São Paulo', 'SP', 210);

-- Inserir funcionários
INSERT INTO funcionario (codigo, nome, cargo, tipo_contrato, salario_base, percentual_comissao, email, telefone) VALUES
('#FUNC-001', 'José Almeida', 'Vendedor', 'Comissionado', 1500.00, 5.00, 'jose.almeida@playrobotic.com', '(81) 96666-6666'),
('#FUNC-002', 'Fernanda Lima', 'Gerente', 'Fixo', 4500.00, 0.00, 'fernanda.lima@playrobotic.com', '(81) 95555-5555'),
('#FUNC-003', 'Roberto Costa', 'Vendedor', 'Comissionado', 1800.00, 4.50, 'roberto.costa@playrobotic.com', '(81) 94444-4444');

-- Inserir produtos
INSERT INTO produto (codigo, nome, categoria, descricao, preco, custo, estoque, estoque_minimo) VALUES
('#PROD-001', 'Smartphone XYZ', 'Celulares', 'Smartphone com tela 6.5", 128GB', 1899.00, 1200.00, 25, 5),
('#PROD-002', 'Notebook ABC', 'Computadores', 'Notebook i7, 16GB RAM, 512GB SSD', 3499.00, 2500.00, 12, 3),
('#PROD-003', 'Fone Bluetooth', 'Acessórios', 'Fone de ouvido sem fio com cancelamento de ruído', 199.00, 120.00, 78, 10),
('#PROD-004', 'Tablet 10"', 'Tablets', 'Tablet com tela 10 polegadas, 64GB', 1299.00, 800.00, 8, 2),
('#PROD-005', 'Smartwatch Pro', 'Wearables', 'Relógio inteligente com monitor cardíaco', 899.00, 550.00, 15, 5);

-- Inserir recomendações
INSERT INTO recomendacao (produto_base_id, produto_recomendado_id, confianca) VALUES
(1, 3, 0.85), -- Smartphone XYZ -> Fone Bluetooth
(1, 9, 0.70), -- Smartphone XYZ -> Carregador Rápido
(2, 6, 0.90), -- Notebook ABC -> Monitor 24"
(2, 7, 0.80); -- Notebook ABC -> Teclado Mecânico