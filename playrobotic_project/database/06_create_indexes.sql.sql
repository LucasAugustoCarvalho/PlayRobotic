-- Índices para otimização
CREATE INDEX idx_cliente_email ON cliente(email);
CREATE INDEX idx_cliente_status ON cliente(status);
CREATE INDEX idx_produto_categoria ON produto(categoria);
CREATE INDEX idx_produto_status ON produto(status);
CREATE INDEX idx_pedido_cliente ON pedido(cliente_id);
CREATE INDEX idx_pedido_vendedor ON pedido(vendedor_id);
CREATE INDEX idx_pedido_data ON pedido(data_pedido);
CREATE INDEX idx_pedido_status ON pedido(status);
CREATE INDEX idx_item_pedido_produto ON item_pedido(produto_id);
CREATE INDEX idx_avaliacao_produto ON avaliacao(produto_id);