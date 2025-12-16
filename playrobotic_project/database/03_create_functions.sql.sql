-- Função para controlar estoque
CREATE OR REPLACE FUNCTION controlar_estoque()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Decrementa estoque ao adicionar item ao pedido
        UPDATE produto 
        SET estoque = estoque - NEW.quantidade
        WHERE id = NEW.produto_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Ajusta estoque quando quantidade é alterada
        UPDATE produto 
        SET estoque = estoque + OLD.quantidade - NEW.quantidade
        WHERE id = NEW.produto_id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Incrementa estoque ao remover item do pedido
        UPDATE produto 
        SET estoque = estoque + OLD.quantidade
        WHERE id = OLD.produto_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar valor total do pedido
CREATE OR REPLACE FUNCTION atualizar_valor_total_pedido()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE pedido p
        SET subtotal = COALESCE(
            (SELECT SUM(subtotal_item) 
             FROM item_pedido 
             WHERE pedido_id = OLD.pedido_id), 0),
            valor_total = COALESCE(
                (SELECT SUM(subtotal_item) 
                 FROM item_pedido 
                 WHERE pedido_id = OLD.pedido_id), 0) - desconto
        WHERE p.id = OLD.pedido_id;
    ELSE
        UPDATE pedido p
        SET subtotal = COALESCE(
            (SELECT SUM(subtotal_item) 
             FROM item_pedido 
             WHERE pedido_id = NEW.pedido_id), 0),
            valor_total = COALESCE(
                (SELECT SUM(subtotal_item) 
                 FROM item_pedido 
                 WHERE pedido_id = NEW.pedido_id), 0) - desconto
        WHERE p.id = NEW.pedido_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar visualização
CREATE OR REPLACE FUNCTION registrar_visualizacao()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE produto 
    SET qtd_visualizacoes = qtd_visualizacoes + 1
    WHERE id = NEW.produto_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular comissão
CREATE OR REPLACE FUNCTION calcular_comissao(pedido_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_valor_total DECIMAL(10,2);
    v_percentual_comissao DECIMAL(5,2);
    v_comissao DECIMAL(10,2);
BEGIN
    SELECT p.valor_total, f.percentual_comissao 
    INTO v_valor_total, v_percentual_comissao
    FROM pedido p
    JOIN funcionario f ON p.vendedor_id = f.id
    WHERE p.id = pedido_id AND p.status = 'faturado';
    
    IF v_valor_total IS NOT NULL AND v_percentual_comissao IS NOT NULL THEN
        v_comissao := v_valor_total * (v_percentual_comissao / 100);
        RETURN v_comissao;
    END IF;
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;