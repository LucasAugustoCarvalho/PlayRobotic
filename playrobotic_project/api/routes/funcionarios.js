const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// GET todos os funcionários
router.get('/', async (req, res) => {
    try {
        const { status, cargo, tipo_contrato } = req.query;
        let query = 'SELECT * FROM funcionario WHERE 1=1';
        const params = [];
        
        // Filtros
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        
        if (cargo) {
            params.push(cargo);
            query += ` AND cargo = $${params.length}`;
        }
        
        if (tipo_contrato) {
            params.push(tipo_contrato);
            query += ` AND tipo_contrato = $${params.length}`;
        }
        
        query += ' ORDER BY nome ASC';
        
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET funcionário por ID
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM funcionario WHERE id = $1',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar funcionário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST criar funcionário
router.post('/', async (req, res) => {
    try {
        const { 
            nome, 
            cargo, 
            tipo_contrato, 
            salario_base, 
            percentual_comissao, 
            email, 
            telefone 
        } = req.body;
        
        // Validar dados
        if (!nome || !cargo || !tipo_contrato || !salario_base) {
            throw new Error('Campos obrigatórios faltando: nome, cargo, tipo_contrato, salario_base');
        }
        
        if (salario_base < 0) throw new Error('Salário base não pode ser negativo');
        
        if (tipo_contrato === 'Comissionado' && percentual_comissao === undefined) {
            throw new Error('Percentual de comissão obrigatório para funcionários comissionados');
        }
        
        // Gerar código automático
        const countResult = await db.query('SELECT COUNT(*) FROM funcionario');
        const count = parseInt(countResult.rows[0].count) + 1;
        const codigo = `#FUNC-${count.toString().padStart(3, '0')}`;
        
        // Inserir funcionário
        const { rows } = await db.query(
            `INSERT INTO funcionario (
                codigo, nome, cargo, tipo_contrato, 
                salario_base, percentual_comissao, 
                email, telefone, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ativo')
             RETURNING *`,
            [
                codigo, 
                nome, 
                cargo, 
                tipo_contrato, 
                salario_base, 
                percentual_comissao || 0, 
                email || null, 
                telefone || null
            ]
        );
        
        res.status(201).json(rows[0]);
        
    } catch (error) {
        console.error('Erro ao criar funcionário:', error);
        res.status(400).json({ error: error.message });
    }
});

// PUT atualizar funcionário
router.put('/:id', async (req, res) => {
    try {
        const { 
            nome, 
            cargo, 
            tipo_contrato, 
            salario_base, 
            percentual_comissao, 
            email, 
            telefone, 
            status 
        } = req.body;
        
        // Verificar se funcionário existe
        const funcionarioExistente = await db.query(
            'SELECT * FROM funcionario WHERE id = $1',
            [req.params.id]
        );
        
        if (funcionarioExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }
        
        // Atualizar funcionário
        const { rows } = await db.query(
            `UPDATE funcionario 
             SET nome = COALESCE($1, nome),
                 cargo = COALESCE($2, cargo),
                 tipo_contrato = COALESCE($3, tipo_contrato),
                 salario_base = COALESCE($4, salario_base),
                 percentual_comissao = COALESCE($5, percentual_comissao),
                 email = COALESCE($6, email),
                 telefone = COALESCE($7, telefone),
                 status = COALESCE($8, status)
             WHERE id = $9
             RETURNING *`,
            [
                nome, 
                cargo, 
                tipo_contrato, 
                salario_base, 
                percentual_comissao, 
                email, 
                telefone, 
                status, 
                req.params.id
            ]
        );
        
        res.json(rows[0]);
        
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE funcionário (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        // Verificar se funcionário existe
        const funcionarioExistente = await db.query(
            'SELECT * FROM funcionario WHERE id = $1',
            [req.params.id]
        );
        
        if (funcionarioExistente.rows.length === 0) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }
        
        // Verificar se funcionário tem pedidos ativos
        const pedidosAtivos = await db.query(
            `SELECT COUNT(*) FROM pedido 
             WHERE vendedor_id = $1 AND status = 'pendente'`,
            [req.params.id]
        );
        
        if (parseInt(pedidosAtivos.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Funcionário tem pedidos pendentes. Transfira os pedidos primeiro.' 
            });
        }
        
        // Mudar status para inativo
        await db.query(
            "UPDATE funcionario SET status = 'inativo' WHERE id = $1",
            [req.params.id]
        );
        
        res.json({ message: 'Funcionário desativado com sucesso' });
        
    } catch (error) {
        console.error('Erro ao deletar funcionário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET relatório de desempenho dos funcionários
router.get('/relatorios/desempenho', async (req, res) => {
    try {
        const { periodo = '30', tipo_contrato } = req.query;
        
        let whereClause = "WHERE p.status = 'faturado'";
        const params = [];
        
        if (tipo_contrato) {
            params.push(tipo_contrato);
            whereClause += ` AND f.tipo_contrato = $${params.length}`;
        }
        
        const { rows } = await db.query(
            `SELECT 
                f.id,
                f.codigo,
                f.nome,
                f.cargo,
                f.tipo_contrato,
                f.percentual_comissao,
                COUNT(DISTINCT p.id) as total_pedidos,
                SUM(p.valor_total) as total_vendas,
                CASE 
                    WHEN f.tipo_contrato = 'Comissionado' 
                    THEN SUM(p.valor_total * f.percentual_comissao / 100)
                    ELSE 0
                END as total_comissao,
                f.salario_base + 
                    CASE 
                        WHEN f.tipo_contrato = 'Comissionado' 
                        THEN SUM(p.valor_total * f.percentual_comissao / 100)
                        ELSE 0
                    END as salario_total
             FROM pedido p
             JOIN funcionario f ON p.vendedor_id = f.id
             ${whereClause}
                AND p.data_pedido >= CURRENT_DATE - INTERVAL '${periodo} days'
             GROUP BY f.id, f.codigo, f.nome, f.cargo, f.tipo_contrato, 
                      f.percentual_comissao, f.salario_base
             ORDER BY total_vendas DESC`,
            params
        );
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar relatório de desempenho:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET cálculo de salário do funcionário
router.get('/:id/calcular-salario', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        const targetMonth = mes || new Date().getMonth() + 1;
        const targetYear = ano || new Date().getFullYear();
        
        // Buscar funcionário
        const funcionario = await db.query(
            'SELECT * FROM funcionario WHERE id = $1',
            [req.params.id]
        );
        
        if (funcionario.rows.length === 0) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }
        
        const func = funcionario.rows[0];
        
        // Calcular comissão se for comissionado
        let comissao = 0;
        
        if (func.tipo_contrato === 'Comissionado') {
            const comissaoResult = await db.query(
                `SELECT SUM(valor_total * $1 / 100) as total_comissao
                 FROM pedido
                 WHERE vendedor_id = $2
                    AND status = 'faturado'
                    AND EXTRACT(MONTH FROM data_pedido) = $3
                    AND EXTRACT(YEAR FROM data_pedido) = $4`,
                [func.percentual_comissao, req.params.id, targetMonth, targetYear]
            );
            
            comissao = parseFloat(comissaoResult.rows[0].total_comissao) || 0;
        }
        
        // Calcular salário total
        const salarioTotal = parseFloat(func.salario_base) + comissao;
        
        res.json({
            funcionario: {
                codigo: func.codigo,
                nome: func.nome,
                cargo: func.cargo,
                tipo_contrato: func.tipo_contrato
            },
            periodo: {
                mes: targetMonth,
                ano: targetYear
            },
            calculo: {
                salario_base: func.salario_base,
                percentual_comissao: func.percentual_comissao,
                comissao_calculada: comissao,
                salario_total: salarioTotal
            }
        });
        
    } catch (error) {
        console.error('Erro ao calcular salário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET funcionários ativos para seleção (dropdown)
router.get('/dropdown/ativos', async (req, res) => {
    try {
        const { cargo } = req.query;
        let query = "SELECT id, codigo, nome, cargo FROM funcionario WHERE status = 'ativo'";
        const params = [];
        
        if (cargo) {
            params.push(cargo);
            query += ` AND cargo = $${params.length}`;
        }
        
        query += ' ORDER BY nome ASC';
        
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar funcionários para dropdown:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;