-- Updates for cat_resultado_referencias_proveedores_algoritmo
-- Ajusta el valor del algoritmo v2 para el caso de "NO SE OBTUVO NINGÚN PROVEEDOR CON BUENAS O MALAS REFERENCIAS"

UPDATE cat_resultado_referencias_proveedores_algoritmo
SET valor_algoritmo_v2 = '-8',
    updated_at = NOW()
WHERE id_cat_resultado_referencias_proveedores = 6;
