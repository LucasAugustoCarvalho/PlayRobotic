const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET relatório geral de vendas
router.get('/vendas', async (req, res) => {
    try {
        const { 
            data_inicio, 
            data_fim, 
            grupo = 'dia', 
            cliente_id, 
            vendedor_id 
        } = req.query;
        
        let groupBy = '';
        let dateFormat = '';
        
        switch (grupo) {
            case 'dia':
                groupBy = 'DATE(p.data_pedido)';
                dateFormat = 'DD/MM/YYYY';
                break;
            case 'semana':
                groupBy = 'EXTRACT(YEAR FROM p.data_pedido), EXTRACT(WEEK FROM p.data_pedido)';
                dateFormat = 'YYYY - Semana WW';
                break;
            case 'mes':
                groupBy = 'EXTRACT(YEAR FROM p.data_pedido), EXTRACT(MONTH FROM p.data_pedido)';
                dateFormat = 'MM/YYYY';
                break;
            default:
                groupBy = 'DATE(p.data_pedido)';
                dateFormat = 'DD/MM/YYYY';
        }
        
        let whereClause = "WHERE p.status = 'faturado'";
        const params = [];
        
        if (data_inicio) {
            params.push(data_inicio);
            whereClause += ` AND p.data_pedido >= $${params.length}`;
        }
        
        if (data_fim) {
            params.push(data_fim);
            whereClause += ` AND p.data_pedido <= $${params.length}`;
        }
        
        if (cliente_id) {
            params.push(cliente_id);
            whereClause += ` AND p.cliente_id = $${params.length}`;
        }
        
        if (vendedor_id) {
            params.push(vendedor_id);
            whereClause += ` AND p.vendedor_id = $${params.length}`;
        }
        
        const { rows } = await db.query(
            `SELECT 
                TO_CHAR(MIN(p.data_pedido), '${dateFormat}') as periodo,
                COUNT(*) as total_pedidos,
                SUM(p.valor_total) as total_vendas,
                AVG(p.valor_total) as ticket_medio,
                COUNT(DISTINCT p.cliente_id) as clientes_ativos
             FROM pedido p
             ${whereClause}
             GROUP BY ${groupBy}
             ORDER BY MIN(p.data_pedido) DESC`,
            params
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao gerar relatório de vendas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET relatório de produtos (estoque e vendas)
router.get('/produtos', async (req, res) => {
    try {
        const { status = 'ativo', ordenar_por = 'nome' } = req.query;
        
        let orderBy = '';
        switch (ordenar_por) {
            case 'vendas':
                orderBy = 'total_vendido DESC';
                break;
            case 'estoque':
                orderBy = 'p.estoque ASC';
                break;
            case 'valor':
                orderBy = 'valor_total_vendas DESC';
                break;
            default:
                orderBy = 'p.nome ASC';
        }
        
        const { rows } = await db.query(
            `SELECT 
                p.id,
                p.codigo,
                p.nome,
                p.categoria,
                p.preco,
                p.estoque,
                p.estoque_minimo,
                p.qtd_visualizacoes,
                p.avaliacao_media,
                p.status,
                COALESCE(SUM(ip.quantidade), 0) as total_vendido,
                COALESCE(SUM(ip.subtotal_item), 0) as valor_total_vendas,
                CASE 
                    WHEN p.estoque <= p.estoque_minimo THEN 'REPOR URGENTE'
                    WHEN p.estoque <= p.estoque_minimo * 2 THEN 'REPOSIÇÃO PRÓXIMA'
                    ELSE 'ESTOQUE OK'
                END as status_estoque,
                ROUND((p.estoque::float / NULLIF(p.estoque_minimo, 0)) * 100, 2) as percentual_estoque
             FROM produto p
             LEFT JOIN item_pedido ip ON p.id = ip.produto_id
             LEFT JOIN pedido ped ON ip.pedido_id = ped.id AND ped.status = 'faturado'
             WHERE p.status = $1
             GROUP BY p.id, p.codigo, p.nome, p.categoria, p.preco, 
                      p.estoque, p.estoque_minimo, p.qtd_visualizacoes, 
                      p.avaliacao_media, p.status
             ORDER BY ${orderBy}`,
            [status]
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao gerar relatório de produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET relatório de clientes
router.get('/clientes', async (req, res) => {
    try {
        const { status = 'ativo', ordenar_por = 'total_gasto' } = req.query;
        
        let orderBy = '';
        switch (ordenar_por) {
            case 'nome':
                orderBy = 'c.nome ASC';
                break;
            case 'pedidos':
                orderBy = 'total_pedidos DESC';
                break;
            case 'recencia':
                orderBy = 'data_ultima_compra DESC NULLS LAST';
                break;
            default:
                orderBy = 'total_gasto DESC NULLS LAST';
        }
        
        const { rows } = await db.query(
            `SELECT 
                c.id,
                c.codigo,
                c.nome,
                c.email,
                c.telefone,
                c.cidade,
                c.estado,
                c.data_cadastro,
                c.pontos_fidelidade,
                c.status,
                COUNT(p.id) as total_pedidos,
                COALESCE(SUM(p.valor_total), 0) as total_gasto,
                MAX(p.data_pedido) as data_ultima_compra,
                CASE 
                    WHEN COUNT(p.id) = 0 THEN 'NOVO'
                    WHEN MAX(p.data_pedido) < CURRENT_DATE - INTERVAL '90 days' THEN 'INATIVO'
                    WHEN MAX(p.data_pedido) < CURRENT_DATE - INTERVAL '30 days' THEN 'RISCO'
                    ELSE 'ATIVO'
                END as segmento_cliente,
                ROUND(COALESCE(AVG(p.valor_total), 0), 2) as ticket_medio
             FROM cliente c
             LEFT JOIN pedido p ON c.id = p.cliente_id AND p.status = 'faturado'
             WHERE c.status = $1
             GROUP BY c.id, c.codigo, c.nome, c.email, c.telefone, 
                      c.cidade, c.estado, c.data_cadastro, 
                      c.pontos_fidelidade, c.status
             ORDER BY ${orderBy}`,
            [status]
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao gerar relatório de clientes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET relatório financeiro
router.get('/financeiro', async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;
        
        let whereClause = "WHERE p.status = 'faturado'";
        const params = [];
        
        if (data_inicio) {
            params.push(data_inicio);
            whereClause += ` AND p.data_pedido >= $${params.length}`;
        }
        
        if (data_fim) {
            params.push(data_fim);
            whereClause += ` AND p.data_pedido <= $${params.length}`;
        }
        
        // Vendas por dia
        const vendasPorDia = await db.query(
            `SELECT 
                DATE(p.data_pedido) as data,
                COUNT(*) as total_pedidos,
                SUM(p.valor_total) as total_vendas,
                SUM(p.desconto) as total_descontos
             FROM pedido p
             ${whereClause}
             GROUP BY DATE(p.data_pedido)
             ORDER BY DATE(p.data_pedido) DESC`,
            params
        );
        
        // Vendas por categoria
        const vendasPorCategoria = await db.query(
            `SELECT 
                pr.categoria,
                COUNT(DISTINCT p.id) as total_pedidos,
                SUM(ip.quantidade) as total_itens,
                SUM(ip.subtotal_item) as total_vendas
             FROM pedido p
             JOIN item_pedido ip ON p.id = ip.pedido_id
             JOIN produto pr ON ip.produto_id = pr.id
             ${whereClause}
             GROUP BY pr.categoria
             ORDER BY total_vendas DESC`,
            params
        );
        
        // Top produtos
        const topProdutos = await db.query(
            `SELECT 
                pr.codigo,
                pr.nome,
                pr.categoria,
                SUM(ip.quantidade) as total_vendido,
                SUM(ip.subtotal_item) as total_vendas
             FROM pedido p
             JOIN item_pedido ip ON p.id = ip.pedido_id
             JOIN produto pr ON ip.produto_id = pr.id
             ${whereClause}
             GROUP BY pr.id, pr.codigo, pr.nome, pr.categoria
             ORDER BY total_vendido DESC
             LIMIT 10`,
            params
        );
        
        // Top clientes
        const topClientes = await db.query(
            `SELECT 
                c.codigo,
                c.nome,
                c.cidade,
                c.estado,
                COUNT(p.id) as total_pedidos,
                SUM(p.valor_total) as total_gasto
             FROM pedido p
             JOIN cliente c ON p.cliente_id = c.id
             ${whereClause}
             GROUP BY c.id, c.codigo, c.nome, c.cidade, c.estado
             ORDER BY total_gasto DESC
             LIMIT 10`,
            params
        );
        
        // Desempenho de vendedores
        const desempenhoVendedores = await db.query(
            `SELECT 
                f.codigo,
                f.nome,
                f.tipo_contrato,
                f.percentual_comissao,
                COUNT(p.id) as total_pedidos,
                SUM(p.valor_total) as total_vendas,
                SUM(p.valor_total * f.percentual_comissao / 100) as total_comissao
             FROM pedido p
             JOIN funcionario f ON p.vendedor_id = f.id
             ${whereClause}
             GROUP BY f.id, f.codigo, f.nome, f.tipo_contrato, f.percentual_comissao
             ORDER BY total_vendas DESC`,
            params
        );
        
        res.json({
            periodo: {
                data_inicio: data_inicio || 'Desde o início',
                data_fim: data_fim || 'Até agora'
            },
            vendas_por_dia: vendasPorDia.rows,
            vendas_por_categoria: vendasPorCategoria.rows,
            top_produtos: topProdutos.rows,
            top_clientes: topClientes.rows,
            desempenho_vendedores: desempenhoVendedores.rows,
            resumo: {
                total_pedidos: vendasPorDia.rows.reduce((sum, row) => sum + parseInt(row.total_pedidos), 0),
                total_vendas: vendasPorDia.rows.reduce((sum, row) => sum + parseFloat(row.total_vendas), 0),
                total_descontos: vendasPorDia.rows.reduce((sum, row) => sum + parseFloat(row.total_descontos || 0), 0),
                ticket_medio: vendasPorDia.rows.length > 0 ? 
                    vendasPorDia.rows.reduce((sum, row) => sum + parseFloat(row.total_vendas), 0) / 
                    vendasPorDia.rows.reduce((sum, row) => sum + parseInt(row.total_pedidos), 0) : 0
            }
        });
        
    } catch (error) {
        console.error('Erro ao gerar relatório financeiro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET relatório de estoque
router.get('/estoque', async (req, res) => {
    try {
        const { status = 'ativo' } = req.query;
        
        const { rows } = await db.query(
            `SELECT 
                p.id,
                p.codigo,
                p.nome,
                p.categoria,
                p.preco,
                p.custo,
                p.estoque,
                p.estoque_minimo,
                p.status,
                COALESCE(p.custo * p.estoque, 0) as valor_estoque_custo,
                COALESCE(p.preco * p.estoque, 0) as valor_estoque_venda,
                CASE 
                    WHEN p.estoque = 0 THEN 'ESGOTADO'
                    WHEN p.estoque <= p.estoque_minimo THEN 'REPOR URGENTE'
                    WHEN p.estoque <= p.estoque_minimo * 2 THEN 'REPOSIÇÃO PRÓXIMA'
                    ELSE 'NORMAL'
                END as status_reposicao,
                ROUND((p.estoque::float / NULLIF(p.estoque_minimo, 0)) * 100, 2) as percentual_estoque,
                COALESCE(SUM(ip.quantidade), 0) as vendas_ultimo_mes
             FROM produto p
             LEFT JOIN item_pedido ip ON p.id = ip.produto_id
             LEFT JOIN pedido ped ON ip.pedido_id = ped.id 
                AND ped.status = 'faturado'
                AND ped.data_pedido >= CURRENT_DATE - INTERVAL '30 days'
             WHERE p.status = $1
             GROUP BY p.id, p.codigo, p.nome, p.categoria, p.preco, 
                      p.custo, p.estoque, p.estoque_minimo, p.status
             ORDER BY status_reposicao, p.estoque ASC`,
            [status]
        );
        
        // Calcular totais
        const totais = {
            total_produtos: rows.length,
            total_estoque: rows.reduce((sum, row) => sum + row.estoque, 0),
            valor_total_custo: rows.reduce((sum, row) => sum + parseFloat(row.valor_estoque_custo), 0),
            valor_total_venda: rows.reduce((sum, row) => sum + parseFloat(row.valor_estoque_venda), 0),
            produtos_repor_urgente: rows.filter(row => row.estoque <= row.estoque_minimo).length,
            produtos_esgotados: rows.filter(row => row.estoque === 0).length
        };
        
        res.json({
            produtos: rows,
            totais: totais,
            alertas: {
                reposicao_urgente: rows.filter(row => row.estoque <= row.estoque_minimo && row.estoque > 0)
                    .map(p => ({ codigo: p.codigo, nome: p.nome, estoque: p.estoque, minimo: p.estoque_minimo })),
                esgotados: rows.filter(row => row.estoque === 0)
                    .map(p => ({ codigo: p.codigo, nome: p.nome }))
            }
        });
        
    } catch (error) {
        console.error('Erro ao gerar relatório de estoque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET dashboard (resumo geral)
router.get('/dashboard', async (req, res) => {
    try {
        // Últimos 30 dias
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - 30);
        
        const [
            totalClientes,
            totalProdutos,
            totalFuncionarios,
            vendasMes,
            pedidosMes,
            produtosEstoqueBaixo,
            topVendedores,
            clientesRecentes
        ] = await Promise.all([
            db.query("SELECT COUNT(*) FROM cliente WHERE status = 'ativo'"),
            db.query("SELECT COUNT(*) FROM produto WHERE status = 'ativo'"),
            db.query("SELECT COUNT(*) FROM funcionario WHERE status = 'ativo'"),
            db.query(
                `SELECT SUM(valor_total) as total 
                 FROM pedido 
                 WHERE status = 'faturado' 
                    AND data_pedido >= $1`,
                [dataInicio]
            ),
            db.query(
                `SELECT COUNT(*) as total 
                 FROM pedido 
                 WHERE status = 'faturado' 
                    AND data_pedido >= $1`,
                [dataInicio]
            ),
            db.query(
                `SELECT COUNT(*) as total 
                 FROM produto 
                 WHERE estoque <= estoque_minimo 
                    AND status = 'ativo'`
            ),
            db.query(
                `SELECT f.nome, COUNT(p.id) as pedidos, SUM(p.valor_total) as vendas
                 FROM pedido p
                 JOIN funcionario f ON p.vendedor_id = f.id
                 WHERE p.status = 'faturado' 
                    AND p.data_pedido >= $1
                 GROUP BY f.id, f.nome
                 ORDER BY vendas DESC
                 LIMIT 5`,
                [dataInicio]
            ),
            db.query(
                `SELECT nome, email, data_cadastro 
                 FROM cliente 
                 WHERE status = 'ativo'
                 ORDER BY data_cadastro DESC 
                 LIMIT 5`
            )
        ]);
        
        res.json({
            cards: {
                clientes: parseInt(totalClientes.rows[0].count),
                produtos: parseInt(totalProdutos.rows[0].count),
                funcionarios: parseInt(totalFuncionarios.rows[0].count),
                vendas_mes: parseFloat(vendasMes.rows[0].total || 0),
                pedidos_mes: parseInt(pedidosMes.rows[0].total),
                estoque_baixo: parseInt(produtosEstoqueBaixo.rows[0].total)
            },
            top_vendedores: topVendedores.rows,
            clientes_recentes: clientesRecentes.rows,
            periodo: 'Últimos 30 dias'
        });
        
    } catch (error) {
        console.error('Erro ao gerar dashboard:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET exportar relatório em CSV
router.get('/exportar/:tipo', async (req, res) => {
    try {
        const { tipo } = req.params;
        const { formato = 'csv' } = req.query;
        
        let query = '';
        let filename = '';
        
        switch (tipo) {
            case 'vendas':
                query = `SELECT 
                    p.codigo as pedido,
                    c.nome as cliente,
                    f.nome as vendedor,
                    p.data_pedido,
                    p.valor_total,
                    p.status,
                    COUNT(ip.id) as itens
                 FROM pedido p
                 LEFT JOIN cliente c ON p.cliente_id = c.id
                 LEFT JOIN funcionario f ON p.vendedor_id = f.id
                 LEFT JOIN item_pedido ip ON p.id = ip.pedido_id
                 WHERE p.status = 'faturado'
                 GROUP BY p.id, p.codigo, c.nome, f.nome, p.data_pedido, p.valor_total, p.status
                 ORDER BY p.data_pedido DESC`;
                filename = 'vendas';
                break;
                
            case 'produtos':
                query = `SELECT 
                    codigo, nome, categoria, preco, estoque, 
                    estoque_minimo, qtd_visualizacoes, avaliacao_media, status
                 FROM produto 
                 ORDER BY nome`;
                filename = 'produtos';
                break;
                
            case 'clientes':
                query = `SELECT 
                    codigo, nome, email, telefone, cidade, estado,
                    data_cadastro, pontos_fidelidade, status
                 FROM cliente 
                 ORDER BY nome`;
                filename = 'clientes';
                break;
                
            default:
                return res.status(400).json({ error: 'Tipo de relatório inválido' });
        }
        
        const { rows } = await db.query(query);
        
        if (formato === 'csv') {
            // Converter para CSV
            const headers = Object.keys(rows[0] || {}).join(';');
            const data = rows.map(row => 
                Object.values(row).map(value => 
                    typeof value === 'string' ? `"${value}"` : value
                ).join(';')
            ).join('\n');
            
            const csv = `${headers}\n${data}`;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}_${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csv);
            
        } else {
            // Retornar JSON
            res.json(rows);
        }
        
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;