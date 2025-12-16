-- Trigger para controle de estoque
CREATE TRIGGER trigger_controlar_estoque
AFTER INSERT OR UPDATE OR DELETE ON item_pedido
FOR EACH ROW
EXECUTE FUNCTION controlar_estoque();

-- Trigger para atualizar valor total do pedido
CREATE TRIGGER trigger_atualizar_valor_total
AFTER INSERT OR UPDATE OR DELETE ON item_pedido
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_pedido();

-- Trigger para registrar visualizações
CREATE TRIGGER trigger_registrar_visualizacao
AFTER INSERT ON visualizacao_produto
FOR EACH ROW
EXECUTE FUNCTION registrar_visualizacao();