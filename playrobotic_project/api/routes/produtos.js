const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET todos os produtos
router.get('/', async (req, res) => {
    try {
        const { categoria, status, busca } = req.query;
        let query = 'SELECT * FROM produto WHERE 1=1';
        const params = [];
        
        // Filtros
        if (categoria) {
            params.push(categoria);
            query += ` AND categoria = $${params.length}`;
        }
        
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        if (busca) {
            params.push(`%${busca}%`);
            query += ` AND (nome ILIKE $${params.length} OR codigo ILIKE $${params.length})`;
        }
        
        query += ' ORDER BY nome ASC';
        
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET produto por ID
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM produto WHERE id = $1',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET produtos com estoque baixo
router.get('/estoque/baixo', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM produto 
             WHERE estoque <= estoque_minimo 
             AND status = 'ativo'
             ORDER BY (estoque::float / estoque_minimo) ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos com estoque baixo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET produtos mais vendidos
router.get('/relatorios/mais-vendidos', async (req, res) => {
    try {
        const { periodo = '30' } = req.query;
        
        const { rows } = await db.query(
            `SELECT 
                p.id,
                p.codigo,
                p.nome,
                p.categoria,
                SUM(ip.quantidade) as total_vendido,
                SUM(ip.subtotal_item) as valor_total_vendas
             FROM item_pedido ip
             JOIN produto p ON ip.produto_id = p.id
             JOIN pedido ped ON ip.pedido_id = ped.id
             WHERE ped.status = 'faturado'
                AND ped.data_pedido >= CURRENT_DATE - INTERVAL '${periodo} days'
             GROUP BY p.id, p.codigo, p.nome, p.categoria
             ORDER BY total_vendido DESC
             LIMIT 10`
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos mais vendidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET produtos mais visualizados
router.get('/relatorios/mais-visualizados', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM produto 
             WHERE status = 'ativo'
             ORDER BY qtd_visualizacoes DESC 
             LIMIT 10`
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar produtos mais visualizados:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST criar produto
router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { 
            nome, 
            categoria, 
            descricao, 
            preco, 
            custo, 
            estoque, 
            estoque_minimo = 5 
        } = req.body;
        
        // Validar dados
        if (!nome || !categoria || !preco || estoque === undefined) {
            throw new Error('Campos obrigatórios faltando: nome, categoria, preco, estoque');
        }
        
        if (preco < 0) throw new Error('Preço não pode ser negativo');
        if (estoque < 0) throw new Error('Estoque não pode ser negativo');
        
        // Gerar código automático
        const countResult = await client.query('SELECT COUNT(*) FROM produto');
        const count = parseInt(countResult.rows[0].count) + 1;
        const codigo = `#PROD-${count.toString().padStart(3, '0')}`;
        
        // Inserir produto
        const { rows } = await client.query(
            `INSERT INTO produto (
                codigo, nome, categoria, descricao, 
                preco, custo, estoque, estoque_minimo, 
                qtd_visualizacoes, avaliacao_media, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 'ativo')
             RETURNING *`,
            [codigo, nome, categoria, descricao, preco, custo || null, estoque, estoque_minimo]
        );
        
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar produto:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// PUT atualizar produto
router.put('/:id', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { 
            nome, 
            categoria, 
            descricao, 
            preco, 
            custo, 
            estoque, 
            estoque_minimo, 
            status 
        } = req.body;
        
        // Verificar se produto existe
        const produtoExistente = await client.query(
            'SELECT * FROM produto WHERE id = $1',
            [req.params.id]
        );
        
        if (produtoExistente.rows.length === 0) {
            throw new Error('Produto não encontrado');
        }
        
        // Atualizar produto
        const { rows } = await client.query(
            `UPDATE produto 
             SET nome = COALESCE($1, nome),
                 categoria = COALESCE($2, categoria),
                 descricao = COALESCE($3, descricao),
                 preco = COALESCE($4, preco),
                 custo = COALESCE($5, custo),
                 estoque = COALESCE($6, estoque),
                 estoque_minimo = COALESCE($7, estoque_minimo),
                 status = COALESCE($8, status)
             WHERE id = $9
             RETURNING *`,
            [
                nome, 
                categoria, 
                descricao, 
                preco, 
                custo, 
                estoque, 
                estoque_minimo, 
                status, 
                req.params.id
            ]
        );
        
        await client.query('COMMIT');
        res.json(rows[0]);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar produto:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE produto (soft delete - muda status para inativo)
router.delete('/:id', async (req, res) => {
    try {
        // Verificar se produto existe
        const produtoExistente = await db.query(
            'SELECT * FROM produto WHERE id = $1',
            [req.params.id]
        );
        
        if (produtoExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        // Verificar se produto está em pedidos ativos
        const pedidosAtivos = await db.query(
            `SELECT COUNT(*) FROM item_pedido ip
             JOIN pedido p ON ip.pedido_id = p.id
             WHERE ip.produto_id = $1 AND p.status = 'pendente'`,
            [req.params.id]
        );
        
        if (parseInt(pedidosAtivos.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Produto está em pedidos pendentes. Cancele os pedidos primeiro.' 
            });
        }
        
        // Mudar status para inativo
        await db.query(
            "UPDATE produto SET status = 'inativo' WHERE id = $1",
            [req.params.id]
        );
        
        res.json({ message: 'Produto desativado com sucesso' });
        
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST registrar visualização
router.post('/:id/visualizar', async (req, res) => {
    try {
        const { cliente_id } = req.body;
        
        // Registrar visualização
        await db.query(
            `INSERT INTO visualizacao_produto (cliente_id, produto_id) 
             VALUES ($1, $2)`,
            [cliente_id || null, req.params.id]
        );
        
        res.json({ message: 'Visualização registrada' });
        
    } catch (error) {
        console.error('Erro ao registrar visualização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET recomendações para produto
router.get('/:id/recomendacoes', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT p.*, r.confianca
             FROM recomendacao r
             JOIN produto p ON r.produto_recomendado_id = p.id
             WHERE r.produto_base_id = $1 
                AND p.status = 'ativo'
                AND p.estoque > 0
             ORDER BY r.confianca DESC
             LIMIT 5`,
            [req.params.id]
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar recomendações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET estatísticas do produto
router.get('/:id/estatisticas', async (req, res) => {
    try {
        const produtoId = req.params.id;
        
        const [vendas, avaliacoes, visualizacoes] = await Promise.all([
            db.query(
                `SELECT 
                    COUNT(DISTINCT ip.pedido_id) as total_pedidos,
                    SUM(ip.quantidade) as total_vendido,
                    SUM(ip.subtotal_item) as valor_total_vendas
                 FROM item_pedido ip
                 JOIN pedido p ON ip.pedido_id = p.id
                 WHERE ip.produto_id = $1 AND p.status = 'faturado'`,
                [produtoId]
            ),
            
            db.query(
                `SELECT 
                    COUNT(*) as total_avaliacoes,
                    AVG(nota) as media_avaliacoes
                 FROM avaliacao
                 WHERE produto_id = $1`,
                [produtoId]
            ),
            
            db.query(
                `SELECT COUNT(*) as total_visualizacoes
                 FROM visualizacao_produto
                 WHERE produto_id = $1`,
                [produtoId]
            )
        ]);
        
        res.json({
            vendas: vendas.rows[0],
            avaliacoes: avaliacoes.rows[0],
            visualizacoes: visualizacoes.rows[0]
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;