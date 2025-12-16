const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// POST criar novo pedido
router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { cliente_id, vendedor_id, itens, desconto = 0 } = req.body;
        
        // Gerar código do pedido
        const countResult = await client.query('SELECT COUNT(*) FROM pedido');
        const count = parseInt(countResult.rows[0].count) + 1;
        const codigo = `#PED-${(1000 + count).toString()}`;
        
        // Inserir pedido
        const pedidoResult = await client.query(
            `INSERT INTO pedido (codigo, cliente_id, vendedor_id, desconto)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [codigo, cliente_id, vendedor_id, desconto]
        );
        
        const pedidoId = pedidoResult.rows[0].id;
        
        // Inserir itens do pedido
        for (const item of itens) {
            // Verificar estoque
            const estoqueResult = await client.query(
                'SELECT estoque FROM produto WHERE id = $1',
                [item.produto_id]
            );
            
            if (estoqueResult.rows[0].estoque < item.quantidade) {
                throw new Error(`Estoque insuficiente para o produto ID: ${item.produto_id}`);
            }
            
            // Obter preço atual do produto
            const precoResult = await client.query(
                'SELECT preco FROM produto WHERE id = $1',
                [item.produto_id]
            );
            
            const preco = precoResult.rows[0].preco;
            
            // Inserir item
            await client.query(
                `INSERT INTO item_pedido (pedido_id, produto_id, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [pedidoId, item.produto_id, item.quantidade, preco]
            );
        }
        
        await client.query('COMMIT');
        
        // Retornar pedido completo
        const pedidoCompleto = await client.query(
            `SELECT p.*, 
                    c.nome as cliente_nome,
                    f.nome as vendedor_nome
             FROM pedido p
             LEFT JOIN cliente c ON p.cliente_id = c.id
             LEFT JOIN funcionario f ON p.vendedor_id = f.id
             WHERE p.id = $1`,
            [pedidoId]
        );
        
        res.status(201).json(pedidoCompleto.rows[0]);
        
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});