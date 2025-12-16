const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'playrobotic_db',
    password: 'sua_senha',
    port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};