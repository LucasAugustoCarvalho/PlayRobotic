-- ============================================
-- CONSULTAS SQL PARA RELATÓRIOS E ANÁLISES
-- Sistema PlayRobotic - Banco de Dados
-- ============================================

-- ============================================
-- 1. CONSULTAS BÁSICAS
-- ============================================

-- 1.1. Listar todos os clientes ativos
SELECT codigo, nome, email, telefone, cidade, estado, pontos_fidelidade
FROM cliente 
WHERE status = 'ativo'
ORDER BY nome;

-- 1.2. Listar todos os produtos ativos com estoque
SELECT codigo, nome, categoria, preco, estoque, estoque_minimo,
    CASE 
        WHEN estoque <= estoque_minimo THEN 'REPOR URGENTE'
        WHEN estoque <= estoque_minimo * 2 THEN 'REPOSIÇÃO PRÓXIMA'
        ELSE 'ESTOQUE OK'
    END as status_estoque
FROM produto 
WHERE status = 'ativo'
ORDER BY categoria, nome;

-- 1.3. Listar funcionários ativos
SELECT codigo, nome, cargo, tipo_contrato, salario_base, percentual_comissao
FROM funcionario 
WHERE status = 'ativo'
ORDER BY cargo, nome;

-- ============================================
-- 2. RELATÓRIOS DE VENDAS
-- ============================================

-- 2.1. Vendas por período (últimos 30 dias)
SELECT 
    DATE(data_pedido) as data,
    COUNT(*) as total_pedidos,
    SUM(valor_total) as total_vendas,
    AVG(valor_total) as ticket_medio
FROM pedido 
WHERE status = 'faturado'
    AND data_pedido >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(data_pedido)
ORDER BY data DESC;

-- 2.2. Vendas por vendedor
SELECT 
    f.codigo,
    f.nome,
    f.tipo_contrato,
    f.percentual_comissao,
    COUNT(p.id) as total_pedidos,
    SUM(p.valor_total) as total_vendas,
    SUM(p.valor_total * f.percentual_comissao / 100) as comissao_total
FROM pedido p
JOIN funcionario f ON p.vendedor_id = f.id
WHERE p.status = 'faturado'
    AND f.tipo_contrato = 'Comissionado'
GROUP BY f.id, f.codigo, f.nome, f.tipo_contrato, f.percentual_comissao
ORDER BY total_vendas DESC;

-- 2.3. Produtos mais vendidos
SELECT 
    p.codigo,
    p.nome,
    p.categoria,
    SUM(ip.quantidade) as total_vendido,
    SUM(ip.subtotal_item) as valor_total_vendas
FROM item_pedido ip
JOIN produto p ON ip.produto_id = p.id
JOIN pedido ped ON ip.pedido_id = ped.id
WHERE ped.status = 'faturado'
GROUP BY p.id, p.codigo, p.nome, p.categoria
ORDER BY total_vendido DESC
LIMIT 10;

-- 2.4. Vendas por categoria
SELECT 
    p.categoria,
    COUNT(DISTINCT ped.id) as total_pedidos,
    SUM(ip.quantidade) as total_itens,
    SUM(ip.subtotal_item) as total_vendas
FROM item_pedido ip
JOIN produto p ON ip.produto_id = p.id
JOIN pedido ped ON ip.pedido_id = ped.id
WHERE ped.status = 'faturado'
GROUP BY p.categoria
ORDER BY total_vendas DESC;

-- ============================================
-- 3. RELATÓRIOS DE CLIENTES
-- ============================================

-- 3.1. Clientes mais valiosos (maior ticket médio)
SELECT 
    c.codigo,
    c.nome,
    c.email,
    COUNT(p.id) as total_pedidos,
    SUM(p.valor_total) as total_gasto,
    AVG(p.valor_total) as ticket_medio,
    MAX(p.data_pedido) as ultima_compra
FROM cliente c
LEFT JOIN pedido p ON c.id = p.cliente_id AND p.status = 'faturado'
WHERE c.status = 'ativo'
GROUP BY c.id, c.codigo, c.nome, c.email
ORDER BY total_gasto DESC NULLS LAST;

-- 3.2. Segmentação de clientes (RFM)
SELECT 
    c.codigo,
    c.nome,
    COUNT(p.id) as frequencia,
    SUM(p.valor_total) as valor_total,
    EXTRACT(DAY FROM CURRENT_DATE - MAX(p.data_pedido)) as recencia,
    CASE 
        WHEN COUNT(p.id) = 0 THEN 'NOVO'
        WHEN MAX(p.data_pedido) < CURRENT_DATE - INTERVAL '90 days' THEN 'INATIVO'
        WHEN MAX(p.data_pedido) < CURRENT_DATE - INTERVAL '30 days' THEN 'RISCO'
        ELSE 'ATIVO'
    END as segmento
FROM cliente c
LEFT JOIN pedido p ON c.id = p.cliente_id AND p.status = 'faturado'
GROUP BY c.id, c.codigo, c.nome
ORDER BY segmento, valor_total DESC NULLS LAST;

-- 3.3. Clientes inativos (sem compras nos últimos 90 dias)
SELECT 
    c.codigo,
    c.nome,
    c.email,
    c.telefone,
    MAX(p.data_pedido) as ultima_compra,
    EXTRACT(DAY FROM CURRENT_DATE - MAX(p.data_pedido)) as dias_sem_comprar
FROM cliente c
LEFT JOIN pedido p ON c.id = p.cliente_id AND p.status = 'faturado'
WHERE c.status = 'ativo'
GROUP BY c.id, c.codigo, c.nome, c.email, c.telefone
HAVING MAX(p.data_pedido) IS NULL 
    OR MAX(p.data_pedido) < CURRENT_DATE - INTERVAL '90 days'
ORDER BY dias_sem_comprar DESC NULLS FIRST;

-- ============================================
-- 4. RELATÓRIOS DE ESTOQUE
-- ============================================

-- 4.1. Produtos que precisam de reposição
SELECT 
    codigo,
    nome,
    categoria,
    estoque,
    estoque_minimo,
    preco,
    CASE 
        WHEN estoque = 0 THEN 'ESGOTADO'
        WHEN estoque <= estoque_minimo THEN 'REPOR URGENTE'
        WHEN estoque <= estoque_minimo * 2 THEN 'REPOSIÇÃO PRÓXIMA'
        ELSE 'NORMAL'
    END as status_reposicao,
    ROUND((estoque::float / NULLIF(estoque_minimo, 0)) * 100, 2) as percentual_estoque
FROM produto
WHERE status = 'ativo'
ORDER BY status_reposicao, estoque ASC;

-- 4.2. Valor total do estoque
SELECT 
    COUNT(*) as total_produtos,
    SUM(estoque) as total_unidades,
    SUM(preco * estoque) as valor_total_venda,
    SUM(COALESCE(custo, 0) * estoque) as valor_total_custo,
    SUM((preco - COALESCE(custo, 0)) * estoque) as lucro_potencial
FROM produto
WHERE status = 'ativo';

-- 4.3. Movimentação de estoque (últimos 30 dias)
SELECT 
    p.codigo,
    p.nome,
    p.categoria,
    SUM(ip.quantidade) as saidas,
    p.estoque as estoque_atual,
    p.estoque_minimo
FROM item_pedido ip
JOIN produto p ON ip.produto_id = p.id
JOIN pedido ped ON ip.pedido_id = ped.id
WHERE ped.status = 'faturado'
    AND ped.data_pedido >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.codigo, p.nome, p.categoria, p.estoque, p.estoque_minimo
ORDER BY saidas DESC;

-- ============================================
-- 5. RELATÓRIOS FINANCEIROS
-- ============================================

-- 5.1. Faturamento mensal (últimos 12 meses)
SELECT 
    TO_CHAR(data_pedido, 'MM/YYYY') as mes,
    COUNT(*) as total_pedidos,
    SUM(valor_total) as total_vendas,
    SUM(desconto) as total_descontos,
    AVG(valor_total) as ticket_medio
FROM pedido 
WHERE status = 'faturado'
    AND data_pedido >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(data_pedido, 'MM/YYYY')
ORDER BY MIN(data_pedido) DESC;

-- 5.2. Margem de lucro por produto
SELECT 
    p.codigo,
    p.nome,
    p.categoria,
    p.preco,
    p.custo,
    COALESCE(p.preco - p.custo, p.preco) as margem_absoluta,
    CASE 
        WHEN p.custo IS NULL OR p.custo = 0 THEN 100
        ELSE ROUND(((p.preco - p.custo) / p.custo) * 100, 2)
    END as margem_percentual,
    SUM(ip.quantidade) as total_vendido,
    SUM(ip.subtotal_item) as valor_vendas,
    SUM((p.preco - COALESCE(p.custo, 0)) * ip.quantidade) as lucro_total
FROM produto p
LEFT JOIN item_pedido ip ON p.id = ip.produto_id
LEFT JOIN pedido ped ON ip.pedido_id = ped.id AND ped.status = 'faturado'
WHERE p.status = 'ativo'
GROUP BY p.id, p.codigo, p.nome, p.categoria, p.preco, p.custo
ORDER BY lucro_total DESC NULLS LAST;

-- ============================================
-- 6. ANÁLISE DE DESEMPENHO
-- ============================================

-- 6.1. Desempenho de vendedores
SELECT 
    f.codigo,
    f.nome,
    f.cargo,
    f.tipo_contrato,
    f.percentual_comissao,
    COUNT(DISTINCT p.id) as total_pedidos,
    COUNT(DISTINCT p.cliente_id) as clientes_unicos,
    SUM(p.valor_total) as total_vendas,
    AVG(p.valor_total) as ticket_medio,
    SUM(p.valor_total * f.percentual_comissao / 100) as comissao_total,
    f.salario_base + SUM(p.valor_total * f.percentual_comissao / 100) as custo_total
FROM pedido p
JOIN funcionario f ON p.vendedor_id = f.id
WHERE p.status = 'faturado'
    AND p.data_pedido >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY f.id, f.codigo, f.nome, f.cargo, f.tipo_contrato, f.percentual_comissao, f.salario_base
ORDER BY total_vendas DESC;

-- 6.2. Produtos mais visualizados
SELECT 
    codigo,
    nome,
    categoria,
    qtd_visualizacoes,
    avaliacao_media,
    estoque,
    ROUND((qtd_visualizacoes::float / NULLIF(estoque, 1)) * 100, 2) as taxa_conversao
FROM produto
WHERE status = 'ativo'
ORDER BY qtd_visualizacoes DESC
LIMIT 10;

-- 6.3. Taxa de conversão (visualizações para vendas)
SELECT 
    p.codigo,
    p.nome,
    p.qtd_visualizacoes,
    COALESCE(SUM(ip.quantidade), 0) as total_vendido,
    CASE 
        WHEN p.qtd_visualizacoes = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(ip.quantidade), 0)::float / p.qtd_visualizacoes) * 100, 4)
    END as taxa_conversao_percentual
FROM produto p
LEFT JOIN item_pedido ip ON p.id = ip.produto_id
LEFT JOIN pedido ped ON ip.pedido_id = ped.id AND ped.status = 'faturado'
WHERE p.status = 'ativo'
    AND p.qtd_visualizacoes > 0
GROUP BY p.id, p.codigo, p.nome, p.qtd_visualizacoes
ORDER BY taxa_conversao_percentual DESC;

-- ============================================
-- 7. CONSULTAS PARA DASHBOARD
-- ============================================

-- 7.1. Resumo do dia
SELECT 
    (SELECT COUNT(*) FROM cliente WHERE status = 'ativo') as total_clientes,
    (SELECT COUNT(*) FROM produto WHERE status = 'ativo' AND estoque > 0) as total_produtos,
    (SELECT COUNT(*) FROM funcionario WHERE status = 'ativo') as total_funcionarios,
    (SELECT COUNT(*) FROM pedido WHERE DATE(data_pedido) = CURRENT_DATE) as pedidos_hoje,
    (SELECT COALESCE(SUM(valor_total), 0) FROM pedido 
        WHERE DATE(data_pedido) = CURRENT_DATE AND status = 'faturado') as vendas_hoje;

-- 7.2. Pedidos recentes (últimas 24 horas)
SELECT 
    p.codigo,
    c.nome as cliente,
    f.nome as vendedor,
    p.data_pedido,
    p.valor_total,
    p.status,
    COUNT(ip.id) as total_itens
FROM pedido p
LEFT JOIN cliente c ON p.cliente_id = c.id
LEFT JOIN funcionario f ON p.vendedor_id = f.id
LEFT JOIN item_pedido ip ON p.id = ip.pedido_id
WHERE p.data_pedido >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY p.id, p.codigo, c.nome, f.nome, p.data_pedido, p.valor_total, p.status
ORDER BY p.data_pedido DESC
LIMIT 10;

-- 7.3. Alertas do sistema
SELECT 
    'ESTOQUE BAIXO' as tipo_alerta,
    COUNT(*) as quantidade,
    STRING_AGG(codigo, ', ') as itens
FROM produto 
WHERE status = 'ativo' AND estoque <= estoque_minimo AND estoque > 0
UNION ALL
SELECT 
    'PRODUTOS ESGOTADOS',
    COUNT(*),
    STRING_AGG(codigo, ', ')
FROM produto 
WHERE status = 'ativo' AND estoque = 0
UNION ALL
SELECT 
    'CLIENTES INATIVOS',
    COUNT(*),
    STRING_AGG(codigo, ', ')
FROM cliente c
WHERE status = 'ativo' 
    AND NOT EXISTS (
        SELECT 1 FROM pedido p 
        WHERE p.cliente_id = c.id 
            AND p.data_pedido >= CURRENT_DATE - INTERVAL '90 days'
    );

-- ============================================
-- 8. CONSULTAS PARA SISTEMA DE RECOMENDAÇÕES
-- ============================================

-- 8.1. Produtos frequentemente comprados juntos
SELECT 
    p1.codigo as produto_principal,
    p1.nome as nome_principal,
    p2.codigo as produto_associado,
    p2.nome as nome_associado,
    COUNT(*) as frequencia
FROM item_pedido ip1
JOIN item_pedido ip2 ON ip1.pedido_id = ip2.pedido_id AND ip1.produto_id != ip2.produto_id
JOIN produto p1 ON ip1.produto_id = p1.id
JOIN produto p2 ON ip2.produto_id = p2.id
WHERE p1.status = 'ativo' AND p2.status = 'ativo'
GROUP BY p1.codigo, p1.nome, p2.codigo, p2.nome
HAVING COUNT(*) >= 3
ORDER BY frequencia DESC
LIMIT 20;

-- 8.2. Histórico de compras do cliente para recomendações
SELECT 
    c.codigo as cliente,
    c.nome as nome_cliente,
    p.codigo as produto_comprado,
    p.nome as nome_produto,
    p.categoria,
    COUNT(*) as vezes_comprado
FROM pedido ped
JOIN cliente c ON ped.cliente_id = c.id
JOIN item_pedido ip ON ped.id = ip.pedido_id
JOIN produto p ON ip.produto_id = p.id
WHERE ped.status = 'faturado'
    AND c.id = 1  -- Substituir pelo ID do cliente
GROUP BY c.codigo, c.nome, p.codigo, p.nome, p.categoria
ORDER BY vezes_comprado DESC;

-- ============================================
-- 9. CONSULTAS PARA PROGRAMA DE FIDELIDADE
-- ============================================

-- 9.1. Ranking de pontos de fidelidade
SELECT 
    codigo,
    nome,
    email,
    pontos_fidelidade,
    total_compras,
    CASE 
        WHEN pontos_fidelidade >= 1000 THEN 'OURO'
        WHEN pontos_fidelidade >= 500 THEN 'PRATA'
        WHEN pontos_fidelidade >= 100 THEN 'BRONZE'
        ELSE 'INICIANTE'
    END as nivel_fidelidade
FROM cliente
WHERE status = 'ativo'
ORDER BY pontos_fidelidade DESC
LIMIT 10;

-- 9.2. Clientes com aniversário no mês atual
SELECT 
    codigo,
    nome,
    email,
    telefone,
    data_nascimento,
    pontos_fidelidade
FROM cliente
WHERE status = 'ativo'
    AND EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY EXTRACT(DAY FROM data_nascimento);

-- ============================================
-- 10. CONSULTAS PARA AUDITORIA E LOGS
-- ============================================

-- 10.1. Log de alterações de estoque
SELECT 
    p.codigo,
    p.nome,
    'COMPRA' as tipo_movimentacao,
    ip.quantidade,
    ped.data_pedido as data,
    c.nome as cliente,
    f.nome as vendedor
FROM item_pedido ip
JOIN pedido ped ON ip.pedido_id = ped.id
JOIN produto p ON ip.produto_id = p.id
JOIN cliente c ON ped.cliente_id = c.id
JOIN funcionario f ON ped.vendedor_id = f.id
WHERE ped.status = 'faturado'
UNION ALL
-- Adicionar aqui outras movimentações (ajustes manuais, etc.)
ORDER BY data DESC
LIMIT 50;

-- 10.2. Histórico completo do pedido
SELECT 
    p.codigo as pedido,
    p.data_pedido,
    p.status,
    c.nome as cliente,
    f.nome as vendedor,
    pr.codigo as produto,
    pr.nome as nome_produto,
    ip.quantidade,
    ip.preco_unitario,
    ip.subtotal_item,
    p.subtotal,
    p.desconto,
    p.valor_total
FROM pedido p
JOIN cliente c ON p.cliente_id = c.id
JOIN funcionario f ON p.vendedor_id = f.id
JOIN item_pedido ip ON p.id = ip.pedido_id
JOIN produto pr ON ip.produto_id = pr.id
WHERE p.id = 1  -- Substituir pelo ID do pedido
ORDER BY pr.nome;