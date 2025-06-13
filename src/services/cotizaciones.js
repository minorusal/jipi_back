'use strict'

const mysqlLib = require('../lib/db')

class CotizacionesService {
    constructor() {
        if (CotizacionesService.instance == null) {
            this.table = 'cotizaciones'
            CotizacionesService.instance = this
        }
        return CotizacionesService.instance
    }

    async getUserAdminByCompany(emp_id) {
        const columns = [
            'u.usu_id',
            'u.usu_nombre',
            'u.usu_app',
            'u.usu_puesto',
            'u.usu_tipo',
            'u.usu_email'
        ];
        const queryString = `
            SELECT ${columns.join()}
            FROM usuario AS u
            INNER JOIN empresa_usuario AS eu ON u.usu_id = eu.usu_id
            WHERE eu.emp_id = ${emp_id} AND u.usu_tipo = 3
            ORDER BY u.usu_id DESC`;
        const { result } = await mysqlLib.query(queryString);
        return result;
    }

    async getCompanyById(emp_id) {
        const columns = [
            'emp_id',
            'cin_id',
            'emp_nombre',
            'emp_razon_social',
            'emp_rfc',
            'emp_website',
            'emp_phone',
            'emp_logo',
            'emp_banner',
            'emp_video',
            'emp_ventas_gob',
            'emp_ventas_credito',
            'emp_ventas_contado',
            'emp_loc',
            'emp_nac',
            'emp_int',
            'emp_exportacion',
            'emp_credito',
            'emp_certificada',
            'emp_empleados',
            'emp_status',
            'emp_fecha_fundacion',
            'emp_fecha_creacion',
            'emp_update',
            'emp_marcas',
            'reg_active'
        ]
        const queryString = `SELECT ${columns.join()} FROM empresa WHERE emp_id = ${emp_id} ORDER BY emp_id DESC`
        const { result } = await mysqlLib.query(queryString)
        return result
    }

    async getUserByIdEmp(usu_id, emp_id) {
        const columns = [
            'u.usu_id',
            'u.usu_nombre',
            'u.usu_app',
            'u.usu_puesto',
            'u.usu_email'
        ];
        const queryString = `
            SELECT ${columns.join()}
            FROM usuario AS u
            INNER JOIN empresa_usuario AS eu ON u.usu_id = eu.usu_id
            WHERE u.usu_id = ${usu_id} AND eu.emp_id = ${emp_id}
            ORDER BY u.usu_id DESC`;
        const { result } = await mysqlLib.query(queryString);
        return result;
    }

    async getProdByIdEmp(prod_id, emp_id) {
        const columns = [
            '*'
        ];
        const queryString = `
            SELECT ${columns.join()}
            FROM producto AS p
            WHERE p.prod_id = ${prod_id} AND p.emp_id = ${emp_id}`;
        const { result } = await mysqlLib.query(queryString);
        return result;
    }


    async insertCotizacion(cotizacion) {
        try {
            const { emp_id_origen, emp_id_destino, admin_destino_id, usu_id_origen, divisa, cotizacion_pdf, subtotal, impuesto, concepto, total, estatus } = cotizacion;

            let queryString = `
                INSERT INTO ${this.table}
                (empresa_origen_id, empresa_destino_id, admin_destino_id, user_id, divisa, cotizacion_pdf, estatus, subtotal, impuesto, concepto, total)
                VALUES
                (${emp_id_origen}, ${emp_id_destino}, ${admin_destino_id}, ${usu_id_origen}, '${divisa}',`;

            if (cotizacion_pdf) {
                queryString += `'${cotizacion_pdf}',`;
            } else {
                queryString += `NULL,`;
            }

            queryString += `'${estatus}', ${subtotal ? subtotal : 'NULL'}, ${impuesto ? impuesto : 'NULL'}, '${concepto}', ${total ? total : 'NULL'})`;

            const { result } = await mysqlLib.query(queryString);

            return result;
        } catch (error) {
            return false;
        }
    }

    async inserCredito(cotizacion_id, credito) {
        try {
            // cotizacion_id [cotizacion_id], usu_id_origen [usuario_id], emp_id_origen [empresa_vendedora_id], emp_id_destino [empresa_compradora_id], monto [total], dias_credito, direccion_id
            const { usu_id_origen, direccion_id, emp_id_origen, emp_id_destino, total, dias_credito } = credito;
            let queryString = `
                INSERT INTO creditos
                (cotizacion_id, usuario_id, direccion_id, empresa_vendedora_id, empresa_compradora_id, monto, dias_credito)
                VALUES
                (${cotizacion_id}, ${usu_id_origen}, ${direccion_id}, ${emp_id_origen}, ${emp_id_destino}, ${total}, ${dias_credito})`;
            const { result } = await mysqlLib.query(queryString);

            return result
        } catch (error) {
            return false
        }
    }



    async insertProductoCotizado(producto) {
        const { cotizacion_id, producto_id, cantidad, serie, concepto_descripcion, precio_unitario, subtotal } = producto;
        let queryString = `
          INSERT INTO productos_cotizados
          (cotizacion_id, producto_id, cantidad, serie, concepto_descripcion, precio_unitario, subtotal)
          VALUES
          (${cotizacion_id}, ${producto_id}, ${cantidad}, '${serie}', '${concepto_descripcion}', ${precio_unitario}, ${subtotal} )
        `
        const { result } = await mysqlLib.query(queryString)

        return result
    }

    async getCotizacionById(cotizacion_id) {
        const columns = [
            'c.cotizacion_id',
            'c.empresa_origen_id AS empresa_vendedora_id',
            'c.empresa_destino_id AS empresa_compradora_id',
            'c.divisa',
            'c.cotizacion_pdf',
            'c.created_at AS cotizacion_fecha_creacion',
            'c.updated_at AS cotizacion_fecha_actualizacion',
            'c.estatus AS cotizacion_estatus',
            'pc.producto_cotizado_id',
            'pc.producto_id',
            'pc.cantidad',
            'pc.serie',
            'pc.concepto_descripcion',
            'pc.precio_unitario',
            'pc.subtotal',
            'p.prod_precio_lista',
            'pf.foto_url',
            'ev.emp_nombre AS empresa_vendedora_nombre',
            'ev.emp_razon_social AS empresa_vendedora_razon_social',
            'ev.emp_rfc AS empresa_vendedora_rfc',
            'ev.emp_website AS empresa_vendedora_website',
            'ev.emp_logo AS empresa_vendedora_logo',
            'ev.emp_banner AS empresa_vendedora_banner',
            'ev.emp_certificada AS empresa_vendedora_certificada',
            'COALESCE(ec.emp_nombre, "") AS empresa_compradora_nombre',
            'COALESCE(ec.emp_razon_social, "") AS empresa_compradora_razon_social',
            'COALESCE(ec.emp_rfc, "") AS empresa_compradora_rfc',
            'COALESCE(ec.emp_website, "") AS empresa_compradora_website',
            'COALESCE(ec.emp_logo, "") AS empresa_compradora_logo',
            'COALESCE(ec.emp_banner, "") AS empresa_compradora_banner',
            'COALESCE(ec.emp_certificada, "") AS empresa_compradora_certificada',
            'COALESCE(uv.usu_id, "") AS usuario_vendedor_id',
            'COALESCE(uv.usu_nombre, "") AS usuario_vendedor_nombre',
            'COALESCE(uv.usu_app, "") AS usuario_vendedor_app',
            'COALESCE(uv.usu_puesto, "") AS usuario_vendedor_puesto',
            'COALESCE(uv.usu_email, "") AS usuario_vendedor_email',
            'COALESCE(uv.usu_foto, "") AS usuario_vendedor_foto',
            'COALESCE(uv.usu_tipo, "") AS usuario_vendedor_tipo',
            'COALESCE(uc.usu_id, "") AS usuario_comprador_id',
            'COALESCE(uc.usu_nombre, "") AS usuario_comprador_nombre',
            'COALESCE(uc.usu_app, "") AS usuario_comprador_app',
            'COALESCE(uc.usu_puesto, "") AS usuario_comprador_puesto',
            'COALESCE(uc.usu_email, "") AS usuario_comprador_email',
            'COALESCE(uc.usu_foto, "") AS usuario_comprador_foto',
            'COALESCE(uc.usu_tipo, "") AS usuario_comprador_tip'
        ];
        const queryString = `
            SELECT ${columns.join()}
            FROM 
            cotizaciones AS c
            LEFT JOIN 
            productos_cotizados AS pc ON c.cotizacion_id = pc.cotizacion_id
            LEFT JOIN 
            producto AS p ON p.prod_id = pc.producto_id
            LEFT JOIN 
            producto_foto AS pf ON pf.prod_id = pc.producto_id
            LEFT JOIN 
            empresa AS ev ON ev.emp_id = c.empresa_origen_id
            LEFT JOIN 
            empresa AS ec ON ec.emp_id = c.empresa_destino_id
            LEFT JOIN 
            usuario AS uv ON uv.usu_id = c.user_id
            LEFT JOIN 
            usuario AS uc ON uc.usu_id = c.user_id_comprador
            WHERE c.cotizacion_id = ${cotizacion_id}`;
        const { result } = await mysqlLib.query(queryString);
        return result;
    }

    async getCotizacionProductos(cotizacionId) {
        const queryString = `
          SELECT
            r.cotizacion_id AS "cotizacion_id",
            r.producto_id AS "producto_id",
            r.empresa_id_vendedor AS "empresa_vendedor_id",
            r.cantidad AS "cantidad",
            r.cotizacion_version,
            r.precio,
            r.mejor_precio,
            r.cobertura_local,
            r.cobertura_nacional,
            r.cobertura_internacional,
            r.unidad_id,
            r.unidad,
            r.producto_disponible,
            r.moneda_id,
            r.moneda,
            r.producto_nombre,
            r.producto_descripcion,
            r.producto_video,
            r.producto_comentario,
            r.compra_minima
          FROM (
            SELECT
              cp.cot_id AS "cotizacion_id",
              p.prod_id AS "producto_id",
              cp.emp_id_vendedor AS "empresa_id_vendedor",
              cp_cantidad AS "cantidad",
              cp.cot_version AS "cotizacion_version",
              cp.cot_mejorprecio AS "mejor_precio",
              cp.cp_precio AS precio,
              p.prod_cobertura_loc AS "cobertura_local",
              p.prod_cobertura_nac AS "cobertura_nacional",
              p.prod_cobertura_int AS "cobertura_internacional",
              p.cuni_id AS "unidad_id",
              cu.cuni_desc_esp AS "unidad",
              p.prod_disponible AS "producto_disponible",
              cm.cmon_id AS "moneda_id",
              cm.cmon_desc_esp AS "moneda",
              pt.prod_nombre AS "producto_nombre",
              pt.prod_desc AS "producto_descripcion",
              pt.prod_video AS "producto_video",
              cp.cot_prod_comentario AS "producto_comentario",
              p.prod_compra_minima AS "compra_minima"
            FROM cot_productos AS cp
            INNER JOIN producto AS p
              ON cp.prod_id = p.prod_id
            INNER JOIN cat_unidad AS cu
              ON p.cuni_id = cu.cuni_id
            INNER JOIN cat_moneda AS cm
              ON p.cmon_id = cm.cmon_id
            INNER JOIN producto_translate AS pt
              ON pt.prod_id = p.prod_id
            ${cotizacionId ? `WHERE cotizacion_id = ${cotizacionId} AND pt.idioma_id = 1` : 'pt.idioma_id = 1'}
          ) as r;
        `

        return mysqlLib.query(queryString)
    }

    async seen(cotId) {

        const queryString = `
          UPDATE cotizaciones SET visto = 1 WHERE cotizacion_id = ${cotId}
        `
        const { result } = await mysqlLib.query(queryString)

        return result
    }



    async searchCompanies(searchTerm) {
        const queryString = `
            SELECT 
                empresa.*,
                empresa_usuario.emp_id, 
                empresa_usuario.usu_id, 
                usuario.usu_id,
                usuario.usu_nombre,
                usuario.usu_app,
                usuario.usu_puesto,
                usuario.usu_email,
                usuario.usu_boletin,
                usuario.usu_verificado,
                usuario.usu_idioma,
                usuario.usu_foto,
                usuario.usu_card,
                usuario.usu_tipo,
                usuario.usu_status,
                usuario.usu_update,
                usuario.reg_active, 
                COUNT(cotizaciones.cotizacion_id) AS cantidad_cotizaciones
            FROM 
                empresa
            LEFT JOIN 
                empresa_usuario ON empresa.emp_id = empresa_usuario.emp_id
            LEFT JOIN 
                usuario ON empresa_usuario.usu_id = usuario.usu_id
            LEFT JOIN 
                cotizaciones ON empresa.emp_id = cotizaciones.empresa_origen_id
            WHERE
                emp_nombre LIKE CONCAT('%', '${searchTerm}', '%') OR
                emp_razon_social LIKE CONCAT('%', '${searchTerm}', '%') OR
                emp_rfc LIKE CONCAT('%', '${searchTerm}', '%') OR
                emp_website LIKE CONCAT('%', '${searchTerm}', '%') OR
                emp_phone LIKE CONCAT('%', '${searchTerm}', '%') OR
                emp_marcas LIKE CONCAT('%', '${searchTerm}', '%') OR
                usu_nombre LIKE CONCAT('%', '${searchTerm}', '%') OR
                usu_app LIKE CONCAT('%', '${searchTerm}', '%') OR
                usu_puesto LIKE CONCAT('%', '${searchTerm}', '%') OR
                usu_email LIKE CONCAT('%', '${searchTerm}', '%') OR
                usu_card LIKE CONCAT('%', '${searchTerm}', '%') OR
                cotizaciones.estatus LIKE CONCAT('%', '${searchTerm}', '%')
            GROUP BY 
            empresa.emp_id, 
            empresa_usuario.usu_id
            ORDER BY 
            CASE WHEN MAX(cotizaciones.estatus) = 'pagada' THEN 0 ELSE 1 END, 
            cantidad_cotizaciones DESC;
    
        `;
        const { result } = await mysqlLib.query(queryString);
        return result;
    }

    async getCotizacionesByUserAndType(user_id, type) {
        const columns = [
            'c.cotizacion_id',
            'c.empresa_origen_id AS empresa_vendedora_id',
            'c.empresa_destino_id AS empresa_compradora_id',
            'c.cotizacion_pdf',
            'c.created_at AS cotizacion_fecha_creacion',
            'c.updated_at AS cotizacion_fecha_actualizacion',
            'c.estatus AS cotizacion_estatus',
            'p.prod_id',
            'pc.cantidad',
            'pc.serie',
            'pc.concepto_descripcion',
            'pc.precio_unitario',
            'pc.subtotal',
            'pf.foto_url',
            'ev.emp_nombre AS empresa_vendedora_nombre',
            'ev.emp_razon_social AS empresa_vendedora_razon_social',
            'ev.emp_rfc AS empresa_vendedora_rfc',
            'ev.emp_website AS empresa_vendedora_website',
            'ev.emp_logo AS empresa_vendedora_logo',
            'ev.emp_banner AS empresa_vendedora_banner',
            'ev.emp_certificada AS empresa_vendedora_certificada',
            'COALESCE(ec.emp_nombre, "") AS empresa_compradora_nombre',
            'COALESCE(ec.emp_razon_social, "") AS empresa_compradora_razon_social',
            'COALESCE(ec.emp_rfc, "") AS empresa_compradora_rfc',
            'COALESCE(ec.emp_website, "") AS empresa_compradora_website',
            'COALESCE(ec.emp_logo, "") AS empresa_compradora_logo',
            'COALESCE(ec.emp_banner, "") AS empresa_compradora_banner',
            'COALESCE(ec.emp_certificada, "") AS empresa_compradora_certificada',
            'COALESCE(uv.usu_id, "") AS usuario_vendedor_id',
            'COALESCE(uv.usu_nombre, "") AS usuario_vendedor_nombre',
            'COALESCE(uv.usu_app, "") AS usuario_vendedor_app',
            'COALESCE(uv.usu_puesto, "") AS usuario_vendedor_puesto',
            'COALESCE(uv.usu_email, "") AS usuario_vendedor_email',
            'COALESCE(uv.usu_foto, "") AS usuario_vendedor_foto',
            'COALESCE(uv.usu_tipo, "") AS usuario_vendedor_tipo',
            'COALESCE(uc.usu_id, "") AS usuario_comprador_id',
            'COALESCE(uc.usu_nombre, "") AS usuario_comprador_nombre',
            'COALESCE(uc.usu_app, "") AS usuario_comprador_app',
            'COALESCE(uc.usu_puesto, "") AS usuario_comprador_puesto',
            'COALESCE(uc.usu_email, "") AS usuario_comprador_email',
            'COALESCE(uc.usu_foto, "") AS usuario_comprador_foto',
            'COALESCE(uc.usu_tipo, "") AS usuario_comprador_tip'
        ];

        let queryString = `
            SELECT ${columns.join()}
            FROM 
            cotizaciones AS c
            LEFT JOIN 
            productos_cotizados AS pc ON c.cotizacion_id = pc.cotizacion_id
            LEFT JOIN 
            producto AS p ON p.prod_id = pc.producto_id
            LEFT JOIN 
            producto_foto AS pf ON pf.prod_id = pc.producto_id
            LEFT JOIN 
            empresa AS ev ON ev.emp_id = c.empresa_origen_id
            LEFT JOIN 
            empresa AS ec ON ec.emp_id = c.empresa_destino_id
            LEFT JOIN 
            usuario AS uv ON uv.usu_id = c.user_id
            LEFT JOIN 
            usuario AS uc ON uc.usu_id = c.user_id_comprador
            LEFT JOIN producto_translate AS pt ON pt.prod_id = pc.producto_id AND pt.idioma_id = 1
            WHERE c.user_id = ${user_id}`;


        if (type) {
            queryString += ` AND c.estatus = '${type}'`;
        }
        queryString += ` ORDER BY c.cotizacion_id;`;

        const { result } = await mysqlLib.query(queryString);
        return result;
    }

    async updateCotizacionPdf(idCot, pdfPath) {
        try {
            const queryString = `
                UPDATE cotizaciones
                SET cotizacion_pdf = '${pdfPath}'
                WHERE cotizacion_id = ${idCot}
            `;
            const result = await mysqlLib.query(queryString);
            return result;
        } catch (error) {
            console.error("Error al actualizar el campo cotizacion_pdf:", error);
            throw error;
        }
    }

    async updateCotizacion(body) {
        try {
            if (!body) {
                throw new Error('El cuerpo de la solicitud no puede estar vacío');
            }

            const { cotizacion_id, estatus, subtotal, divisa, impuesto, concepto, total } = body;
            let queryString = `
                UPDATE cotizaciones
                SET subtotal = ${subtotal}, divisa = '${divisa}', impuesto = ${impuesto}, concepto = '${concepto}', total = ${total}, updated_at = NOW()
            `;

            if (estatus) {
                queryString += `, estatus = '${estatus}'`;
            }

            queryString += ` WHERE cotizacion_id = ${cotizacion_id}`;

            const result = await mysqlLib.query(queryString);

            return result;
        } catch (error) {
            throw error;
        }
    }

    async updateProductosCotizados(body) {
        try {
            const { cotizacion_id, productos } = body;
            // Borrar los registros existentes con el mismo cotizacion_id
            const deleteQuery = `DELETE FROM productos_cotizados WHERE cotizacion_id = ${cotizacion_id}`;
            await mysqlLib.query(deleteQuery);

            // Insertar los nuevos registros
            for (const producto of productos) {
                const { producto_id, cantidad, serie, concepto_descripcion, precio_unitario } = producto;
                const subtotal = cantidad * precio_unitario;

                const insertQuery = `
                    INSERT INTO productos_cotizados (cotizacion_id, producto_id, cantidad, serie, concepto_descripcion, precio_unitario, subtotal)
                    VALUES (${cotizacion_id}, ${producto_id}, ${cantidad}, '${serie}', '${concepto_descripcion}', ${precio_unitario}, ${subtotal})
                `;
                await mysqlLib.query(insertQuery);
            }

            // Devolver el resultado
            return { message: 'Productos cotizados actualizados correctamente' };
        } catch (error) {
            console.error('Error al actualizar los productos cotizados:', error);
            throw error;
        }
    }

    async getDetailsById(id) {
        debug('quotes->getDetailsBy')

        const queryString = `
          SELECT 
          c.cot_id AS "cotizacion_id",
          c.usu_id_comprador AS "usuario_comprador_id",
          c.usu_id_vendedor AS "usuario_vendedor_id",
          c.cot_delivery AS "cotizacion_fecha_entrega",
          c.created_at AS "cotizacion_fecha",
          c.cot_comentario AS "comentario",
          c.cot_status AS "cotizacion_estatus",
          c.cot_comentario AS "cotizacion_comentario",
          c.credito_dias AS "credito_dias",
          cmp.cmetodo_id AS "metodo_pago_id",
          cmp.cmetodo_desc_esp AS "metodo_pago",
          e2.emp_id AS "empresa_vendedor_id",
          e2.emp_nombre AS "empresa_vendedor_nombre",
          e2.emp_logo AS "empresa_vendedor_logo",
          e2.emp_certificada AS "empresa_vendedor_certificada",
          e2.emp_razon_social AS "empresa_vendedora_razon_social",
          e.emp_id AS "empresa_comprador_id",
          e.emp_nombre AS "empresa_comprador_nombre",
          e.emp_logo AS "empresa_comprador_logo",
          e.emp_certificada AS "empresa_comprador_certificada",
          e.emp_razon_social AS "empresa_comprador_razon_social",
          c.descuento AS "cotizacion_descuento",
          c.visto AS "cotizacion_visto",
          e.emp_rfc AS "comprador_rfc",
          e2.emp_website AS "vendedor_website",
          uv.usu_nombre AS "usuario_vendedor_nombre",
          uv.usu_app AS "usuario_vendedor_apellido",
          uv.usu_foto AS "usuario_vendedor_foto",
          uc.usu_nombre AS "usuario_comprador_nombre",
          uc.usu_app AS "usuario_comprador_apellido",
          uc.usu_foto AS "usuario_comprador_foto",
          rc.rep_id AS "reporte_cotizacion_id",
          rc.vigente AS "reporte_cotizacion_vigente",
          rc.fecha_creacion AS "reporte_cotizacion_fecha_creacion",
          rc.fecha_actualizacion AS "reporte_cotizacion_fecha_actualizacion"
        FROM ${this.table} AS c
        LEFT JOIN empresa_usuario AS eu ON eu.usu_id = c.usu_id_comprador
        LEFT JOIN cat_metodo_pago AS cmp ON cmp.cmetodo_id = c.cmetodo_id
        LEFT JOIN empresa AS e ON e.emp_id = eu.emp_id
        LEFT JOIN empresa AS e2 ON e2.emp_id = c.emp_id_vendedor
        LEFT JOIN reporte_cotizacion AS rc ON rc.cot_id = c.cot_id
        JOIN usuario AS uv ON uv.usu_id = c.usu_id_vendedor
        JOIN usuario AS uc ON uc.usu_id = c.usu_id_comprador
        WHERE 
          c.cot_id = ${id}
        ORDER BY c.cot_id DESC
        `

        const { result } = await mysqlLib.query(queryString)

        return result
    }

    async getCotizacionProductos(cotizacionId) {

        const queryString = `
        SELECT
        r.cotizacion_id AS "cotizacion_id",
        r.producto_id AS "producto_id",
        -- r.empresa_id_vendedor AS "empresa_vendedor_id",
        r.cantidad AS "cantidad",
        -- r.cotizacion_version,
        -- r.precio,
        -- r.mejor_precio,
        r.cobertura_local,
        r.cobertura_nacional,
        r.cobertura_internacional,
        r.unidad_id,
        r.unidad,
        r.producto_disponible,
        r.moneda_id,
        r.moneda,
        r.producto_nombre,
        r.producto_descripcion,
        r.producto_video,
        r.producto_comentario,
        r.compra_minima
        FROM (
        SELECT
        cp.producto_cotizado_id AS "cotizacion_id",
        -- cp.emp_id_vendedor AS "empresa_id_vendedor",
        cp.cantidad AS "cantidad",
        -- cp.cot_version AS "cotizacion_version",
        -- cp.cot_mejorprecio AS "mejor_precio",
        -- cp.precio_unitario AS precio,
        p.prod_cobertura_loc AS "cobertura_local",
        p.prod_cobertura_nac AS "cobertura_nacional",
        p.prod_id AS "producto_id",
        p.prod_cobertura_int AS "cobertura_internacional",
        p.cuni_id AS "unidad_id",
        cu.cuni_desc_esp AS "unidad",
        p.prod_disponible AS "producto_disponible",
        cm.cmon_id AS "moneda_id",
        cm.cmon_desc_esp AS "moneda",
        pt.prod_nombre AS "producto_nombre",
        pt.prod_desc AS "producto_descripcion",
        pt.prod_video AS "producto_video",
        cp.concepto_descripcion AS "producto_comentario",
        p.prod_compra_minima AS "compra_minima"
        FROM productos_cotizados AS cp
        
        LEFT JOIN producto AS p
        ON cp.producto_id = p.prod_id
        
        LEFT JOIN cat_unidad AS cu
        ON p.cuni_id = cu.cuni_id
        
        LEFT JOIN cat_moneda AS cm
        ON p.cmon_id = cm.cmon_id
        
        INNER JOIN producto_translate AS pt
        ON pt.prod_id = p.prod_id
            ${cotizacionId ? `WHERE cotizacion_id = ${cotizacionId} AND pt.idioma_id = 1` : 'pt.idioma_id = 1'}
          ) as r;
        `

        return mysqlLib.query(queryString)
    }


    async getById(id) {

        const queryString = `
          SELECT 
          c.cotizacion_id AS "cotizacion_id",
          c.user_id_comprador AS "usuario_comprador_id",
          c.user_id AS "usuario_vendedor_id",
          -- c.cot_delivery AS "cotizacion_fecha_entrega",
          c.created_at AS "cotizacion_fecha",
          c.cot_comentario AS "comentario",
          c.estatus AS "cotizacion_estatus",
          c.cot_comentario AS "cotizacion_comentario",
          -- c.descuento AS "cotizacion_descuento",
          -- c.visto AS "cotizacion_visto",
          -- c.domicilio_id AS "empresa_comprador_domicilio_id",
          c.credito_fecha AS "credito_fecha",
          c.credito_dias AS "credito_dias",

          cmp.cmetodo_id AS "metodo_pago_id",
          cmp.cmetodo_desc_esp AS "metodo_pago",
          e.emp_id AS "empresa_comprador_id",
          e.emp_nombre AS "empresa_comprador_nombre",
          e.emp_logo AS "empresa_comprador_logo",
          e.emp_certificada AS "empresa_comprador_certificada",
          e2.emp_id AS "empresa_vendedor_id",
          e2.emp_nombre AS "empresa_vendedor_nombre",
          e2.emp_logo AS "empresa_vendedor_logo",
          e2.emp_certificada AS "empresa_vendedor_certificada"
        FROM cotizaciones AS c
        LEFT JOIN empresa_usuario AS eu
          ON eu.usu_id = c.user_id_comprador
        LEFT JOIN cat_metodo_pago AS cmp
          ON cmp.cmetodo_id = c.cmetodo_id
        LEFT JOIN empresa AS e
          ON e.emp_id = eu.emp_id
        LEFT JOIN empresa AS e2
          ON e2.emp_id = c.empresa_origen_id
        WHERE 
          c.cotizacion_id = ${id}
        ORDER BY c.cotizacion_id DESC
        `

        const { result } = await mysqlLib.query(queryString)

        return result
    }


    async getBuyerAndSeller(quote) {

        const queryString = `
        SELECT
        c.user_id_comprador AS 'usuario_comprador',
        c.user_id AS 'usuario_vendedor',
        c.empresa_origen_id AS 'empresa_vendedora',
        c.empresa_destino_id AS 'empresa_compradora',
        vendedora.emp_nombre AS 'empresa_vendedora_nombre',
        compradora.emp_nombre AS 'empresa_compradora_nombre'
      FROM cotizaciones AS c
      JOIN empresa AS vendedora
      ON vendedora.emp_id = c.empresa_origen_id
      JOIN empresa AS compradora
      ON compradora.emp_id = c.empresa_destino_id
      WHERE c.cotizacion_id = ${quote}
        `

        const { result } = await mysqlLib.query(queryString)

        return result
    }
}

module.exports = Object.freeze(new CotizacionesService())