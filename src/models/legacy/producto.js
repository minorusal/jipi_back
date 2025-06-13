
'use strict'
const mysqlLib = require('../../lib/db')
const debug = require('debug')('old-api:services->producto')

async function getProducto () {
  return await mysqlLib.mysqlQuery('GET',
    'select * from producto where prod_status !=0'
  )
}
async function getProductoByID (prod_id) {
  return await mysqlLib.mysqlQuery('GET',
    `select p.*, 
      (select nombre from producto_categoria where categoria_id = p.prod_categoria_id) as prod_categoria
      from producto p
      where p.prod_status != 0 
      and p.prod_id = @prod_id`
    , prod_id)
}

async function getProductoTranslateByID (prod_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select * from producto_translate where prod_id =@prod_id'
    , prod_id)
}
async function getProductoFotosByID (prod_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select * from producto_foto where prod_id =@prod_id ORDER BY foto_num'
    , prod_id)
}

async function AddProducto (producto) {
  return await mysqlLib.mysqlQuery('SET',
    `insert into producto(emp_id,ctprod_id,prod_nuevo,prod_clearance,cmon_id,prod_precio_lista,prod_precio_promo,prod_precio_envio,prod_compra_minima,cuni_id,cmetodo_id,prod_cobertura_loc,prod_cobertura_nac,prod_cobertura_int,cenvio_id,prod_status,prod_update)
        values(@emp_id,@ctprod_id,@prod_nuevo,@prod_clearance,@cmon_id,@prod_precio_lista,@prod_precio_promo,@prod_precio_envio,@prod_compra_minima,@cuni_id,@cmetodo_id,@prod_cobertura_loc,@prod_cobertura_nac,@prod_cobertura_int,@cenvio_id,@prod_status,Now())
    `
    , producto)
}

async function UpdateProducto (producto) {
  return await mysqlLib.mysqlQuery('SET',
    `update producto
    set  emp_id = @emp_id, ctprod_id = @ctprod_id, prod_nuevo = @prod_nuevo,prod_clearance = @prod_clearance, cmon_id = @cmon_id,prod_precio_lista = @prod_precio_lista,prod_precio_promo =@prod_precio_promo,prod_precio_envio = @prod_precio_envio,prod_compra_minima = @prod_compra_minima, cuni_id = @cuni_id, cmetodo_id =@cmetodo_id, prod_cobertura_loc = @prod_cobertura_loc,prod_cobertura_nac =@prod_cobertura_nac,prod_cobertura_int = @prod_cobertura_int, cenvio_id =@cenvio_id,prod_status = @prod_status,prod_update =Now()
    where prod_id = @prod_id `
    , producto)
}

async function BuscadorProducto (dato) {
  // idioma 1 español idioma 2 ingles busqueda por empresa o por texto
  if (dato.texto == undefined || dato.texto == '' || dato.texto == null) {
    if (dato.idioma_id == 1) {
      return await mysqlLib.mysqlQuery('GET',
            `
            SELECT
            pt.prod_nombre,
            pt.prod_desc,
            pt.prod_video,
            p.prod_id,
            p.prod_precio_lista,
            p.prod_precio_promo,
            p.prod_precio_envio,
            p.prod_precio_envio_nacional,
            p.prod_precio_envio_internacional,
            (select nombre from producto_categoria where categoria_id = p.prod_categoria_id) as prod_categoria,
            p.prod_cobertura_loc,
            p.prod_cobertura_nac,
            p.prod_cobertura_int,
            p.prod_compra_minima,
            p.prod_disponible,
            p.prod_clearance,
            c.cmon_id,
            c.cmon_desc_esp as  cmon_desc ,
            e.emp_certificada,
            e.emp_id,
            ct_uni.cuni_desc_esp as cuni_desc ,
            CASE
              WHEN length(emp_razon_social) > 0
                THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,''))
              ELSE coalesce(emp_nombre,'')
            END as emp_nombre,
            (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
            (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
            (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
            coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
            FROM
              producto_translate pt,
              producto p,
              cat_moneda c,
              empresa e,
              cat_unidad ct_uni
            WHERE pt.prod_id = p.prod_id
            and pt.idioma_id = 1
            and p.cmon_id  = c.cmon_id
            and p.emp_id = e.emp_id 
            and p.emp_id = @emp_id 
            and ct_uni.cuni_id = p.cuni_id 
            and p.prod_status = 1
            `
            , dato)
    } else if (dato.idioma_id == 2) {
      return await mysqlLib.mysqlQuery('GET',
            `         select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio, p.prod_precio_envio_nacional, p.prod_precio_envio_internacional, (select nombre from producto_categoria where categoria_id = p.prod_categoria_id) as prod_categoria, p.prod_cobertura_loc, p.prod_cobertura_nac, p.prod_cobertura_int,p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,e.cpais_id,ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada,
            c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
             (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
             (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
              (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
             coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
            from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni
            where pt.prod_id = p.prod_id and pt.idioma_id = 2 and p.cmon_id  = c.cmon_id  and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id  and p.emp_id = @emp_id and ct_uni.cuni_id = p.cuni_id and p.prod_status = 1`
            , dato)
    }
  } else {
    if (dato.idioma_id == 1) {
      return await mysqlLib.mysqlQuery('GET',
            `       
            select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio, p.prod_precio_envio_nacional, p.prod_precio_envio_internacional, (select nombre from producto_categoria where categoria_id = p.prod_categoria_id) as prod_categoria, p.prod_cobertura_loc, p.prod_cobertura_nac, p.prod_cobertura_int, p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,e.cpais_id,ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada,
            c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
             (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
             (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
              (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
             coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
            from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni
            where pt.prod_id = p.prod_id and pt.idioma_id = 1  and p.cmon_id  = c.cmon_id  and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id and ct_uni.cuni_id = p.cuni_id  
                and p.prod_status = 1
                and (UPPER(prod_nombre)   LIKE UPPER('%` + dato.texto + '%\') || UPPER(prod_desc)   LIKE UPPER( \'%' + dato.texto + `%'));

            `
            , dato)
    } else if (dato.idioma_id == 2) {
      return await mysqlLib.mysqlQuery('GET',
            `       
            select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio, p.prod_precio_envio_nacional, p.prod_precio_envio_internacional, (select nombre from producto_categoria where categoria_id = p.prod_categoria_id) as prod_categoria, p.prod_cobertura_loc, p.prod_cobertura_nac, p.prod_cobertura_int, p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,e.cpais_id,ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada,
            c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
             (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
             (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
              (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
             coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
            from producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni
            where pt.prod_id = p.prod_id and pt.idioma_id = 2  and p.cmon_id  = c.cmon_id  and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id and ct_uni.cuni_id = p.cuni_id  
                and p.prod_status = 1
                and (UPPER(prod_nombre)   LIKE UPPER('%` + dato.texto + '%\') || UPPER(prod_desc)   LIKE UPPER( \'%' + dato.texto + `%'));
           
            `
            , dato)
    }
  }
}

async function AddProductoTranslate (dato) {
  return await mysqlLib.mysqlQuery('SET',
    'insert into producto_translate (prod_id,prod_nombre,prod_desc,idioma_id,prod_video)values(@prod_id,@prod_nombre ,@prod_desc,@idioma_id,@prod_video )'
    , dato)
}

async function UpdateProductoTranslate (dato) {
  return await mysqlLib.mysqlQuery('SET',
        `UPDATE producto_translate 
            SET prod_nombre = @prod_nombre,
            prod_desc = @prod_desc,
            prod_video = @prod_video 
        WHERE prod_id = @prod_id and idioma_id = @idioma_id `
        , dato)
}

async function AddProductoMisProductos305 (producto) {
  // prod_nuevo: prod_nuevo, prod_clearance: prod_clearence
  return await mysqlLib.mysqlQuery('SET',
    `
    insert into producto(emp_id,prod_precio_lista,cmon_id,prod_precio_envio,prod_precio_promo,prod_compra_minima,cuni_id,cmetodo_id,prod_cobertura_loc,prod_cobertura_nac,prod_cobertura_int,prod_nuevo,prod_clearance,prod_status,prod_disponible,prod_marca, prod_precio_envio_nacional, prod_precio_envio_internacional, prod_categoria_id)
    values (@emp_id,@prod_precio_lista,@cmon_id,@prod_precio_envio,@prod_precio_promo,@prod_compra_minima,@cuni_id,@cmetodo_id,@prod_cobertura_loc,@prod_cobertura_nac,@prod_cobertura_int,@prod_nuevo,@prod_clearance,1,@prod_disponible,@prod_marca, @prod_precio_envio_nacional, @prod_precio_envio_internacional, @prod_categoria_id)
    `
    , producto)
}

async function DeleteProducto306 (producto) {
  return await mysqlLib.mysqlQuery('SET',
    `update producto
    set  prod_status = 2,prod_update =Now()
    where prod_id = @prod_id `
    , producto)
}

async function UpdateProducto307 (producto) {
  // prod_id: prod_id, prod_precio_lista: prod_precio_lista, cmon_id: cmon_id, prod_precio_envio: prod_precio_envio, prod_precio_promo: prod_precio_promo, prod_compra_minima: prod_compra_minima,
  // cuni_id: cuni_id, cmetodo_id: cmetodo_id, prod_cobertura_loc: prod_cobertura_loc, prod_cobertura_nac: prod_cobertura_nac, prod_cobertura_int: prod_cobertura_int,
  // prod_disponible: prod_disponible, prod_marca: prod_marca
  return await mysqlLib.mysqlQuery('SET',
    `update producto
    set ctprod_id = @ctprod_id, prod_nuevo = @prod_nuevo,prod_clearance = @prod_clearance, 
        cmon_id = @cmon_id,prod_precio_lista = @prod_precio_lista,prod_precio_promo =@prod_precio_promo,
        prod_precio_envio = @prod_precio_envio,prod_compra_minima = @prod_compra_minima, cuni_id = @cuni_id, 
        cmetodo_id =@cmetodo_id, prod_cobertura_loc = @prod_cobertura_loc,prod_cobertura_nac =@prod_cobertura_nac,
        prod_cobertura_int = @prod_cobertura_int, prod_update =now(), prod_disponible = @prod_disponible, prod_marca = @prod_marca,
        prod_precio_envio_nacional = @prod_precio_envio_nacional, prod_precio_envio_internacional = @prod_precio_envio_internacional,
        prod_categoria_id = @prod_categoria_id
    where prod_id = @prod_id `
    , producto)
}

async function getidmaxProducto (d) {
  return await mysqlLib.mysqlQuery('GET',
    `Select *, max(prod_id) AS  prod_id
    from producto group by prod_id order by prod_id desc
  `
    , d)
}

async function uploadProductoRequiere (producto) {
  return await mysqlLib.mysqlQuery('SET',
    `insert into producto_foto(prod_id,foto_num,foto_url,foto_tipo) 
        select @prod_id, coalesce(max(foto_num)+1,1), @foto_url, 0
        from producto_foto
        where prod_id = @prod_id`
    , producto)
}

async function getProductoMacByID (prod_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select prod_id,foto_url,foto_tipo, MAX(foto_num) as foto_num  from  producto_foto  where prod_id = @prod_id'
    , prod_id)
}

async function DeleteProductoFoto (producto) {
  return await mysqlLib.mysqlQuery('SET',
    'DELETE FROM producto_foto WHERE producto_foto_id in (@producto_foto_id) '
    , producto)
}

async function BuscadorProductoEmpresa (dato) {
  if (dato.idioma == 1) {
    return await mysqlLib.mysqlQuery('GET',
        `        select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio,p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,
		ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada, ct_uni.cuni_id, p.cmetodo_id,
        p.prod_cobertura_loc,p.prod_cobertura_nac,p.prod_cobertura_int,
               c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
                (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
                 (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
                coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url,
                (select prod_nombre from producto_translate where prod_id = p.prod_id and idioma_id = 2 ) as prod_nombre_translate,
                (select prod_desc from producto_translate where prod_id = p.prod_id and idioma_id = 2 ) as prod_desc_translate,
                 (select prod_video from producto_translate where prod_id = p.prod_id and idioma_id = 2 ) as prod_video_translate,
                case pt.idioma_id WHEN 1 THEN ct_metodo.cmetodo_desc_esp
                                  ELSE ct_metodo.cmetodo_desc_ing END as metodo_pago_desc,
                case pt.idioma_id WHEN 1 THEN c.cmon_desc_esp
                                  ELSE c.cmon_desc_ing END as moneda_desc
               from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni, cat_metodo_pago ct_metodo
               where pt.prod_id = p.prod_id and pt.idioma_id = 1 and p.cmon_id  = c.cmon_id  
               and ct_metodo.cmetodo_id = p.cmetodo_id
               and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id  and p.emp_id = @emp_id and ct_uni.cuni_id = p.cuni_id and p.prod_status = 1 
               and pt.prod_nombre != ''	`
        , dato)
  } else if (dato.idioma == 2) {
    return await mysqlLib.mysqlQuery('GET',
        `        select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio,p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,
		ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada, ct_uni.cuni_id, p.cmetodo_id,
        p.prod_cobertura_loc,p.prod_cobertura_nac,p.prod_cobertura_int,
               c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
                (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
                 (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
                coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url,
                (select prod_nombre from producto_translate where prod_id = p.prod_id and idioma_id = 1 ) as prod_nombre_translate,
                (select prod_desc from producto_translate where prod_id = p.prod_id and idioma_id = 1 ) as prod_desc_translate,
                 (select prod_video from producto_translate where prod_id = p.prod_id and idioma_id = 1 ) as prod_video_translate,
                case pt.idioma_id WHEN 1 THEN ct_metodo.cmetodo_desc_esp
                                  ELSE ct_metodo.cmetodo_desc_ing END as metodo_pago_desc,
                case pt.idioma_id WHEN 1 THEN c.cmon_desc_esp
                                  ELSE c.cmon_desc_ing END as moneda_desc
               from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni, cat_metodo_pago ct_metodo
               where pt.prod_id = p.prod_id and pt.idioma_id = 2 and p.cmon_id  = c.cmon_id  
               and ct_metodo.cmetodo_id = p.cmetodo_id
               and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id  and p.emp_id = @emp_id and ct_uni.cuni_id = p.cuni_id and p.prod_status = 1 
               and pt.prod_nombre != ''`
        , dato)
  }
}

async function getProductoFoto (prod_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select * from producto_foto where prod_id = @prod_id '
    , prod_id)
}

async function DeleteImageProducto (dato) {
  return await mysqlLib.mysqlQuery('SET',
    'delete from producto_foto where producto_foto_id = @producto_foto_id'
    , dato)
}

async function getProductoDetalleByID (producto) {
  if (producto.idioma_id == '1') {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT p.prod_id, p.emp_id, pt.prod_desc, pt.prod_nombre, p.prod_precio_lista, p.prod_precio_promo, p.prod_clearance, p.prod_nuevo, p.prod_compra_minima,
                p.prod_marca, prod_cobertura_loc, prod_cobertura_nac, prod_cobertura_int, pt.prod_video, p.prod_disponible,
                cmetodo_id, 
                (SELECT cmon_desc_esp FROM cat_moneda WHERE cmon_id = p.cmon_id) as cmon_desc,
                (SELECT cuni_desc_esp FROM cat_unidad WHERE cuni_id = p.cuni_id) as cuni_desc,
                (SELECT cenvio_desc_esp FROM cat_envio WHERE cenvio_id = p.cenvio_id ) as envio,
                (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
                coalesce((SELECT avg(cal_numero) FROM producto_calif WHERE prod_id = p.prod_id),0) as calif,
                (SELECT FORMAT(avg(TIMESTAMPDIFF(MINUTE,v1.cot_fecha,coalesce(v2.cot_prod_update,v1.cot_fecha))),0) as avgdif
                    FROM 
                    (SELECT cp.*, c.cot_fecha FROM cotizacion c, cot_productos cp
                    WHERE c.cot_id = cp.cot_id 
                    and cp.prod_id in (SELECT prod_id FROM producto WHERE emp_id in (SELECT emp_id FROM producto WHERE prod_id = @prod_id ))
                    and cot_fecha >= date_add(now(), interval -3 month) and cp.cot_version = 1 ) as v1 LEFT JOIN
                    (SELECT cp.*, c.cot_fecha FROM cotizacion c, cot_productos cp
                    WHERE c.cot_id = cp.cot_id 
                    and cp.prod_id in (SELECT prod_id FROM producto WHERE emp_id in (SELECT emp_id FROM producto WHERE prod_id = @prod_id ))
                    and cot_fecha >= date_add(now(), interval -3 month) and cp.cot_version = 2 ) as v2 
                    ON v1.cot_id = v2.cot_id and v1.prod_id = v2.prod_id ) as avgresponse
            FROM producto p, producto_translate pt
            WHERE p.prod_id = @prod_id and p.prod_id = pt.prod_id and pt.idioma_id = @idioma_id`
        , producto)
  } else {
    return await mysqlLib.mysqlQuery('GET',
        `SELECT p.prod_id, p.emp_id, pt.prod_desc, pt.prod_nombre, p.prod_precio_lista, p.prod_precio_promo, p.prod_clearance, p.prod_nuevo, p.prod_compra_minima,
                p.prod_marca, prod_cobertura_loc, prod_cobertura_nac, prod_cobertura_int, pt.prod_video, p.prod_disponible,
                cmetodo_id,
                (SELECT cmon_desc_ing FROM cat_moneda WHERE cmon_id = p.cmon_id) as cmon_desc,
                (SELECT cuni_desc_ing FROM cat_unidad WHERE cuni_id = p.cuni_id) as cuni_desc,
                (SELECT cenvio_desc_ing FROM cat_envio WHERE cenvio_id = p.cenvio_id ) as envio,
                (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
                coalesce((SELECT avg(cal_numero) FROM producto_calif WHERE prod_id = p.prod_id),0) as calif,
                (SELECT FORMAT(avg(TIMESTAMPDIFF(MINUTE,v1.cot_fecha,coalesce(v2.cot_prod_update,v1.cot_fecha))),0) as avgdif
                    FROM 
                    (SELECT cp.*, c.cot_fecha FROM cotizacion c, cot_productos cp
                    WHERE c.cot_id = cp.cot_id 
                    and cp.prod_id in (SELECT prod_id FROM producto WHERE emp_id in (SELECT emp_id FROM producto WHERE prod_id = @prod_id ))
                    and cot_fecha >= date_add(now(), interval -3 month) and cp.cot_version = 1 ) as v1 LEFT JOIN
                    (SELECT cp.*, c.cot_fecha FROM cotizacion c, cot_productos cp
                    WHERE c.cot_id = cp.cot_id 
                    and cp.prod_id in (SELECT prod_id FROM producto WHERE emp_id in (SELECT emp_id FROM producto WHERE prod_id = @prod_id ))
                    and cot_fecha >= date_add(now(), interval -3 month) and cp.cot_version = 2 ) as v2 
                    ON v1.cot_id = v2.cot_id and v1.prod_id = v2.prod_id ) as avgresponse
            FROM producto p, producto_translate pt
            WHERE p.prod_id = @prod_id and p.prod_id = pt.prod_id and pt.idioma_id = @idioma_id`
        , producto)
  }
}

async function BuscadorProductoByID (dato) {
  // idioma 1 español idioma 2 ingles busqueda por empresa o por texto
  if (dato.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
            `SELECT
              pt.prod_nombre,
              pt.prod_desc,
              pt.prod_video,
              p.prod_id,
              p.prod_precio_lista,
              p.prod_precio_promo,
              p.prod_precio_envio,
              p.prod_compra_minima,
              p.prod_disponible,
              p.prod_clearance,
              c.cmon_id,
              c.cmon_desc_esp as  cmon_desc,
              e.emp_certificada,
              ct_uni.cuni_desc_esp as cuni_desc,
              CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre,
              (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
              (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
              coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
            FROM
              producto_translate pt,
              producto p,
              cat_moneda c,
              empresa e,
              cat_unidad ct_uni
            WHERE pt.prod_id = p.prod_id
            AND pt.idioma_id = 1
            AND p.cmon_id  = c.cmon_id
            AND p.emp_id = e.emp_id
            AND ct_uni.cuni_id = p.cuni_id
            AND p.prod_status = 1
            AND p.prod_id in (` + dato.prod_ids + ');'
            , dato)
  } else if (dato.idioma_id == 2) {
    return await mysqlLib.mysqlQuery('GET',
            ` select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio,p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada,
                c.cmon_desc_esp as  cmon_desc , CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, p.prod_disponible,p.prod_clearance,
                (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
                (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
                coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
                from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni
                where pt.prod_id = p.prod_id and pt.idioma_id = 1 and p.cmon_id  = c.cmon_id  and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id and ct_uni.cuni_id = p.cuni_id and p.prod_status = 1 and p.prod_id in (` + dato.prod_ids + ');'
            , dato)
  }
}
module.exports = {
  getProducto,
  getProductoByID,
  getProductoTranslateByID,
  getProductoFotosByID,
  AddProducto,
  UpdateProducto,
  BuscadorProducto,
  AddProductoMisProductos305,
  DeleteProducto306,
  UpdateProducto307,
  getidmaxProducto,
  uploadProductoRequiere,
  getProductoMacByID,
  DeleteProductoFoto,
  getProductoDetalleByID,
  BuscadorProductoByID,

  /* Producto translate */
  AddProductoTranslate,
  UpdateProductoTranslate,
  BuscadorProductoEmpresa,
  getProductoFoto,
  DeleteImageProducto

}
