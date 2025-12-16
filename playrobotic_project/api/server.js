const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Importar rotas
const clientesRoutes = require('./routes/clientes');
const produtosRoutes = require('./routes/produtos');
const funcionariosRoutes = require('./routes/funcionarios');
const pedidosRoutes = require('./routes/pedidos');

// Usar rotas
app.use('/api/clientes', clientesRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/pedidos', pedidosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});