const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET todos os clientes
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM cliente ORDER BY id DESC'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM cliente WHERE id = $1',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST criar cliente
router.post('/', async (req, res) => {
    try {
        const { nome, email, telefone, cpf, endereco, cidade, estado } = req.body;
        
        // Gerar código automático
        const countResult = await db.query('SELECT COUNT(*) FROM cliente');
        const count = parseInt(countResult.rows[0].count) + 1;
        const codigo = `#CLI-${count.toString().padStart(3, '0')}`;
        
        const { rows } = await db.query(
            `INSERT INTO cliente (codigo, nome, email, telefone, cpf, endereco, cidade, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [codigo, nome, email, telefone, cpf, endereco, cidade, estado]
        );
        
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT atualizar cliente
router.put('/:id', async (req, res) => {
    try {
        const { nome, email, telefone, cpf, endereco, cidade, estado, status } = req.body;
        
        const { rows } = await db.query(
            `UPDATE cliente 
             SET nome = $1, email = $2, telefone = $3, cpf = $4, 
                 endereco = $5, cidade = $6, estado = $7, status = $8
             WHERE id = $9
             RETURNING *`,
            [nome, email, telefone, cpf, endereco, cidade, estado, status, req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE cliente
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM cliente WHERE id = $1',
            [req.params.id]
        );
        
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});