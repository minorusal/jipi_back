'use strict'

const debug = require('debug')('old-api:products-service')
const mysqlLib = require('../lib/db')

class ProductService {
  constructor () {
    if (ProductService.instance == null) {
      this.table = 'producto'
      this.visitsTable = 'producto_vistas'
      ProductService.instance = this
    }
    return ProductService.instance
  }

  async get () {
    debug('ProductService -> get')
    const queryString = `SELECT * FROM ${this.table} ORDER BY prod_id DESC`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductById (producto) {
    debug('ProductService -> getProductById')
    const queryString = `
      SELECT * FROM ${this.table}
      WHERE prod_id = ${producto}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getByIdDetalles (id) {
    debug('ProductService -> getById')

    const expected = { producto: null, empresa: null, fotos: null }

    // GETTING PRODUCT
    let queryString = `
      SELECT
        p.prod_id,
        p.prod_clearance,
        p.prod_compra_minima,
        pt.prod_desc,
        p.prod_disponible,
        pt.prod_nombre,
        pt.prod_video,
        p.prod_nuevo,
        p.prod_precio_lista,
        p.prod_precio_promo,
        e.emp_id,
        pc.cal_numero AS "calif",
        cm.cmon_desc_esp AS "cmon_desc",
        cu.cuni_desc_esp AS "cuni_desc",
        ce.cenvio_desc_esp AS "envio",
        p.prod_cobertura_int,
        p.prod_cobertura_loc,
        p.prod_cobertura_nac,
        p.cmetodo_id,
        p.prod_marca
      FROM producto AS p
      INNER JOIN producto_translate AS pt
        ON p.prod_id = pt.prod_id
      INNER JOIN cat_unidad AS cu
        ON p.cuni_id = cu.cuni_id
      INNER JOIN cat_moneda AS cm
        ON p.cmon_id = cm.cmon_id
      INNER JOIN empresa AS e
        ON p.emp_id = e.emp_id
      LEFT JOIN producto_calif AS pc
        ON pc.prod_id = p.prod_id
      LEFT JOIN cat_envio AS ce
        ON ce.cenvio_id = p.cenvio_id
      WHERE
        p.prod_id = ${id}
    `
    debug(queryString)
    const { result: producto } = await mysqlLib.query(queryString)
    expected.producto = producto[0]

    expected.producto.calif = expected.producto.calif || 0

    const query = await mysqlLib.query(`
        SELECT
          COUNT(*) AS favorito
        FROM favorito AS f
        WHERE f.prod_id = ${expected.producto.prod_id}
      `)
    expected.producto.favorito = query.result[0].favorito

    // AVG RESPONSE
    queryString = `
      SELECT
        AVG(cal_numero) AS avgresponse
      FROM producto_calif AS pf
      WHERE prod_id = ${id}
    `

    const { result: avg } = await mysqlLib.query(queryString)
    expected.producto.avgresponse = avg[0].avgresponse || 0

    // GETTING EMPRSA
    queryString = `
      SELECT
        e.*,
        it.*
      FROM empresa AS e
      LEFT JOIN industria AS i
        ON e.cin_id = i.industria_id
      LEFT JOIN industria_translate AS it
        ON it.industria_id = i.industria_id
      WHERE e.emp_id = ${producto[0].emp_id}
      AND it.idioma_id = 1
    `
    const { result: empresa } = await mysqlLib.query(queryString)

    expected.empresa = empresa[0]

    // GETTING DOMICILIO
    queryString = `
    SELECT
    d.direccion as emp_domicilio,
    d.domicilio_tipo as emp_domicilio_tipo,
    d.google_id as emp_google_id,
    pt.nombre as emp_pais_nombre,
    pt.pais_id as emp_pais_id
    FROM domicilio d
    join estado e on d.estado_id = e.estado_id
    join pais_translate pt on e.pais_id = pt.pais_id
    WHERE d.emp_id =  ${producto[0].emp_id} and pt.idioma_id = 1
    ORDER BY d.domicilio_id ASC LIMIT 1
    `

    const { result: domicilioRaw } = await mysqlLib.query(queryString)
    const [domicilio] = domicilioRaw.length > 0 ? domicilioRaw : [{ emp_domicilio: '', emp_domicilio_tipo: '', emp_google_id: '' }]

    expected.empresa = { ...expected.empresa, ...domicilio }

    // GETTING PICTURES
    queryString = `
      SELECT
        *
      FROM producto_foto AS pf
      WHERE pf.prod_id = ${producto[0].prod_id}
    `

    const { result: producto_fotos } = await mysqlLib.query(queryString)

    expected.fotos = producto_fotos

    return expected
  }

  async getById (producto) {
    debug('products -> getById')

    const queryString = `
      SELECT
        p.prod_id AS "producto_id",
        p.emp_id AS "empresa_id",
        p.prod_nuevo AS "producto_nuevo",
        p.prod_clearance AS "producto_clearance",
        p.cmon_id AS "moneda_id",
        p.prod_precio_lista AS "precio_lista",
        p.prod_precio_promo AS "precio_promo",
        p.prod_precio_envio AS "precio_envio",
        p.prod_compra_minima AS "compra_minima",
        p.cuni_id AS "unidad_id",
        p.cmetodo_id AS "metodo_pago_id",
        p.prod_cobertura_loc AS "cobertura_local",
        p.prod_cobertura_nac AS "cobertura_nacional",
        p.prod_cobertura_int AS "cobertura_internacional",
        p.cenvio_id AS "envio_id",
        p.prod_disponible AS "disponible",
        p.prod_marca AS "marca",
        p.prod_status AS "estatus",
        p.prod_update AS "update",
        p.prod_precio_envio_nacional AS "precio_envio_nacional",
        p.prod_precio_envio_internacional AS "precio_envio_internacional",
        p.prod_categoria_id AS "categoria_id",
        cu.cuni_desc_esp AS "unidad_esp",
        cu.cuni_desc_ing AS "unidad_ing",
        cm.cmon_desc_esp AS "moneda_esp",
        cm.cmon_desc_ing AS "moneda_ing",
        ce.cenvio_desc_esp AS "envio_esp",
        ce.cenvio_desc_ing AS "envio_ing",
        pc.nombre AS "categoria"
      FROM producto AS p
      JOIN cat_unidad AS cu ON cu.cuni_id = p.cuni_id
      INNER JOIN cat_moneda AS cm ON cm.cmon_id = p.cmon_id
      LEFT JOIN cat_envio AS ce ON ce.cenvio_id = p.cenvio_id
      LEFT JOIN cat_metodo_pago AS mp ON mp.cmetodo_id = p.cmetodo_id
      LEFT JOIN producto_categoria AS pc ON pc.categoria_id = p.prod_categoria_id
      WHERE p.prod_id = ${producto}
    `

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getProductoFoto (id) {
    debug('ProductService -> getProductoFoto')
    const queryString = `SELECT * FROM producto_foto WHERE prod_id = ${id} ORDER BY foto_num ASC LIMIT 1`
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductoFotos (id) {
    debug('ProductService -> getProductoFotos')
    const queryString = `
      SELECT *
      FROM producto_foto
      WHERE prod_id = ${id}
      ORDER BY foto_num ASC
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllData () {
    debug('ProductService -> getAllData')
    const queryString = `
      SELECT
        p.prod_id AS "producto_id",
        p.emp_id AS "empresa_id",
        pt.prod_nombre AS "nombre",
        pt.prod_desc AS "descripcion",
        pt.prod_video AS "video",
        p.prod_marca AS "marca",
        p.cmon_id AS "cmon_id",
        p.prod_precio_lista AS "precio_lista",
        p.prod_precio_promo AS "precio_promo",
        p.prod_precio_envio AS "precio_envio",
        p.prod_compra_minima AS "compra_minima",
        p.prod_cobertura_loc AS "cobertura_local",
        p.prod_cobertura_nac AS "cobertura_nacional",
        p.prod_cobertura_int AS "cobertura_internacional",
        pf.foto_url AS "foto_url",
        pf.foto_tipo AS "foto_tipo",
        p.prod_status AS "status"
      FROM ${this.table} As p
      INNER JOIN producto_translate AS pt 
        ON p.prod_id = pt.prod_id
      INNER JOIN producto_foto AS pf
        ON p.prod_id = pf.prod_id
      ORDER BY p.prod_id DESC
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllDataLatest () {
    debug('ProductService -> getAllDataLatest')
    const queryString = `
    select
    p.prod_id,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join empresa e on p.emp_id = e.emp_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1
    order by p.prod_id desc limit 15
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getAllDataHistorical () {
    debug('ProductService -> getAllDataHistoricalByUser')

    const queryString = `
    select
    distinct
    p.prod_id,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join empresa e on p.emp_id = e.emp_id
    join (select hb.termino as term_busq from historial_busqueda hb where length(hb.termino) > 1) hb2
        on (
            pt.prod_nombre like concat('%', hb2.term_busq, '%') 
            or pt.prod_desc like concat('%', hb2.term_busq, '%')
        )
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1 limit 6
    `

    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAllDataVisitRelated (user) {
    debug('ProductService -> getAllDataVisitRelated')

    const queryString = `
    select
    distinct
    p.prod_id,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join producto_vistas pv on p.prod_id = pv.prod_id join empresa e on p.emp_id = e.emp_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1
    and pv.usu_id = ${user}
    limit 15
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAllDataBestSelling () {
    debug('ProductService -> getAllDataBestSelling')
    const queryString = `
    select
    distinct
    p.prod_id,
    count(*) as count,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join cot_productos cp on p.prod_id = cp.prod_id join empresa e on p.emp_id = e.emp_id join cotizacion c on cp.cot_id = c.cot_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1 and c.cot_status = 2
    group by prod_id order by count desc limit 15
    `
    debug(queryString)
    const { result: bestSelling } = await mysqlLib.query(queryString)

    const newResult = bestSelling.map(({ count, ...rest }) => rest)

    return newResult
  }

  async getAllDataSearchRelated (user) {
    debug('ProductService -> getAllDataSearchRelated')

    const queryString = `
        select
        distinct
        p.prod_id,
        pt.prod_nombre,
        p.prod_precio_lista,
        p.prod_precio_promo,
        p.prod_compra_minima,
        pt.prod_desc,
        p.prod_precio_envio as prod_precio_envio_local,
        p.prod_precio_envio_nacional,
        p.prod_precio_envio_internacional,
        p.cmon_id as prod_moneda,
        p.prod_clearance,
        p.prod_disponible,
        p.prod_categoria_id,
        p.prod_marca,
        p.prod_cobertura_loc,
        p.prod_cobertura_nac,
        p.prod_cobertura_int,
        (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
        (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
        (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
        p.emp_id,
        e.emp_nombre,
        e.emp_certificada
        from producto as p
        join producto_translate pt on p.prod_id = pt.prod_id join empresa e on p.emp_id = e.emp_id
        join (select distinct hb.termino as term_busq from historial_busqueda hb where hb.usu_id = ${user} and length(hb.termino) > 1 collate utf8mb4_unicode_ci limit 15) hb2  
            on (
                pt.prod_nombre like concat('%', hb2.term_busq, '%') collate utf8mb4_unicode_ci
                or pt.prod_desc like concat('%', hb2.term_busq, '%') collate utf8mb4_unicode_ci
            )
        where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1
        limit 15
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAllDataMostWanted () {
    debug('ProductService -> getAllDataMostWanted')

    const queryString = `
    select
    distinct
    p.prod_id,
    count(*) as count,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join producto_vistas pv on p.prod_id = pv.prod_id join empresa e on p.emp_id = e.emp_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1
    group by prod_id order by count desc limit 15
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    const newResult = result.map(({ count, ...rest }) => rest)

    return newResult
  }

  async getAllDataTendencies () {
    debug('ProductService -> getAllDataTendencies')

    const queryString = `
    select
    distinct
    p.prod_id,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join empresa e on p.emp_id = e.emp_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' and p.prod_status = 1
    order by rand() limit 15
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getAllDataPromos () {
    debug('ProductService -> getAllDataPromos')
    const queryString = `
    select
    distinct
    p.prod_id,
    pt.prod_nombre,
    p.prod_precio_lista,
    p.prod_precio_promo,
    p.prod_compra_minima,
    pt.prod_desc,
    p.prod_precio_envio as prod_precio_envio_local,
    p.prod_precio_envio_nacional,
    p.prod_precio_envio_internacional,
    p.cmon_id as prod_moneda,
    p.prod_clearance,
    p.prod_disponible,
    p.prod_categoria_id,
    p.prod_marca,
    p.prod_cobertura_loc,
    p.prod_cobertura_nac,
    p.prod_cobertura_int,
    (select pc.cal_numero from producto_calif pc where p.prod_id = pc.prod_id) as prod_calif,
    (select pf.foto_tipo from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_tipo,
    (select pf.foto_url from producto_foto pf where pf.foto_num = 1 and p.prod_id = pf.prod_id) as prod_foto_url,
    p.emp_id,
    e.emp_nombre,
    e.emp_certificada
    from producto as p
    join producto_translate pt on p.prod_id = pt.prod_id join empresa e on p.emp_id = e.emp_id
    where pt.idioma_id = 1 and pt.prod_nombre is not null and trim(pt.prod_nombre) != '' 
    and p.prod_precio_promo < p.prod_precio_lista  and p.prod_precio_promo > 0 and p.prod_status = 1
    order by rand()  limit 12
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductoTraducciones (producto) {
    const queryString = `
      SELECT
        idioma_id AS "idioma",
        prod_nombre AS "nombre",
        prod_desc AS "descripcion",
        prod_video AS "video"
      FROM producto_translate
      WHERE prod_id = ${producto}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductoCalificacion (producto) {
    const queryString = `
      SELECT
        FORMAT(AVG(cal_numero), 2) AS 'total'
      FROM producto_calif
      WHERE prod_id = ${producto}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductoCalificaciones (producto) {
    const queryString = `
      SELECT
        pc.usu_id AS "usuario_id",
        pc.cal_numero AS "calificacion",
        pc.cal_fecha AS "fecha",
        u.usu_nombre AS "nombre",
        u.usu_app AS "apellido",
        u.usu_puesto AS "puesto",
        u.usu_foto AS "avatar"
      FROM producto_calif as pc
      JOIN usuario AS u
      ON u.usu_id = pc.usu_id
      WHERE prod_id = ${producto}
    `

    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductosByEmpresaId (emp_id, text) {
    const queryString = `
    SELECT
        p.prod_id,
        p.prod_clearance,
        p.prod_compra_minima,
        pt.prod_desc,
        p.prod_disponible,
        pt.prod_nombre,
        pt.prod_video,
        p.prod_precio_envio,
        p.prod_precio_lista,
        p.prod_precio_promo,
        e.emp_nombre,
        e.emp_id,
        e.emp_certificada,
        (SELECT ROUND(AVG(cal_numero), 2) FROM producto_calif WHERE prod_id = p.prod_id) AS calif,
        p.cmon_id,
        cm.cmon_desc_esp AS cmon_desc,
        cu.cuni_id,
        cu.cuni_desc_esp AS cuni_desc,
        p.prod_marca AS marca
      FROM producto AS p
        LEFT JOIN producto_translate AS pt ON p.prod_id = pt.prod_id
        LEFT JOIN cat_unidad AS cu ON p.cuni_id = cu.cuni_id
        LEFT JOIN cat_moneda AS cm ON p.cmon_id = cm.cmon_id
        LEFT JOIN empresa AS e ON p.emp_id = e.emp_id
      WHERE
        p.prod_status = 1
			AND pt.idioma_id = 1
			AND e.emp_id = ${emp_id};`

      const { result } = await mysqlLib.query(queryString)
      return result
  }

  async search (text, query) {
    debug('ProductService -> search')

    let limitCondition = query && query.limit ? `LIMIT ${query.limit}` : ''
    limitCondition = (query && query.limit && query.page) ? `${limitCondition} OFFSET ${(parseInt(query.page) - 1) * parseInt(query.limit)}` : limitCondition

    let queryString = `
      SELECT
        p.prod_id,
        p.prod_clearance,
        p.prod_compra_minima,
        pt.prod_desc,
        p.prod_disponible,
        pt.prod_nombre,
        pt.prod_video,
        p.prod_precio_envio,
        p.prod_precio_lista,
        p.prod_precio_promo,
        e.emp_nombre,
        e.emp_id,
        e.emp_certificada,
        (SELECT ROUND(AVG(cal_numero), 2) FROM producto_calif WHERE prod_id = p.prod_id) AS "calif",
        p.cmon_id,
        cm.cmon_desc_esp AS "cmon_desc",
        cu.cuni_id,
        cu.cuni_desc_esp AS "cuni_desc",
        p.prod_marca AS "marca"
      FROM producto AS p
      LEFT JOIN producto_translate AS pt
        ON p.prod_id = pt.prod_id
      LEFT JOIN cat_unidad AS cu
        ON p.cuni_id = cu.cuni_id
      LEFT JOIN cat_moneda AS cm
        ON p.cmon_id = cm.cmon_id
      LEFT JOIN empresa AS e
        ON p.emp_id = e.emp_id
      WHERE
        p.prod_status = 1 
        AND (
          (replace(replace(pt.prod_nombre,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
          OR (replace(replace(pt.prod_desc,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
          OR (replace(replace(p.prod_marca,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
        )
        AND pt.idioma_id = 1
      ${limitCondition}
    `
    debug(queryString)

    const { result: productos } = await mysqlLib.query(queryString)

    for (let i = 0; i < productos.length; ++i) {
      productos[i].calif = productos[i].calif || 0
      const { result } = await mysqlLib.query(`
        SELECT
          COUNT(*) AS numero
        FROM producto_calif AS pc
        WHERE pc.prod_id = ${productos[i].prod_id}
      `)

      productos[i].numero = result[0].numero

      const query = await mysqlLib.query(`
        SELECT
          COUNT(*) AS favorito
        FROM favorito AS f
        WHERE f.prod_id = ${productos[i].prod_id}
      `)
      productos[i].favorito = query.result[0].favorito
      const fotoResult = await this.getProductoFoto(productos[i].prod_id)
      debug(fotoResult)
      productos[i].foto_url = fotoResult && fotoResult[0] && fotoResult[0].foto_url ? fotoResult[0].foto_url : null
    }

    queryString = `
    SELECT
      count(*) as count
    FROM producto AS p
    LEFT JOIN producto_translate AS pt
      ON p.prod_id = pt.prod_id
    LEFT JOIN cat_unidad AS cu
      ON p.cuni_id = cu.cuni_id
    LEFT JOIN cat_moneda AS cm
      ON p.cmon_id = cm.cmon_id
    LEFT JOIN empresa AS e
      ON p.emp_id = e.emp_id
    WHERE
      p.prod_status = 1 
      AND (
        (replace(replace(pt.prod_nombre,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
        OR (replace(replace(pt.prod_desc,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
        OR (replace(replace(p.prod_marca,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h',''))
      )
      AND pt.idioma_id = 1
  `

    const { result: totalRaw } = await mysqlLib.query(queryString)
    const [{ count }] = totalRaw

    return { productos, totalProductos: count }
  }

  async searchSuggestion (text) {
    debug('ProductService -> searchSuggestion')
    const queryString = `
      SELECT
        pt.prod_nombre AS "nombre",
        pt.prod_id AS "idProducto"
      FROM producto AS p
      INNER JOIN producto_translate AS pt
        ON p.prod_id = pt.prod_id
      WHERE
        p.prod_status = 1
        AND replace(replace(pt.prod_nombre,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h','')
        AND pt.idioma_id = 1
      LIMIT 5
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }

  async getRateProductByUser (producto, usuario) {
    debug('ProductService -> getRateProductByUser')
    const queryString = `
      SELECT *
      FROM producto_calif
      WHERE prod_id = ${producto}
      AND usu_id = ${usuario}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async rateProduct (producto, usuario, calificacion) {
    debug('ProductService -> rateProduct')
    const queryString = `INSERT INTO producto_calif (prod_id, usu_id, cal_numero, cal_fecha) VALUES (${producto}, ${usuario}, ${calificacion}, NOW())`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateRateProduct (producto, usuario, calificacion) {
    debug('ProductService -> updateRateProduct')
    const queryString = `UPDATE producto_calif SET cal_numero = ${calificacion}, cal_fecha = NOW() WHERE prod_id = ${producto} AND usu_id = ${usuario}`
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deleteRateProduct (producto, usuario) {
    debug('ProductService -> deleteRateProduct')
    const queryString = `
      DELETE FROM producto_calif
      WHERE prod_id = ${producto}
      AND usu_id = ${usuario}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductosEmpresa (empresa, limite) {
    debug('ProductService -> getProductosEmpresa')
    const queryString = `
      SELECT
        pt.prod_id,
        pt.prod_nombre
      FROM producto_translate AS pt
      JOIN producto AS p
        ON p.prod_id = pt.prod_id
      JOIN empresa AS e
        ON e.emp_id = p.emp_id
      WHERE
        e.emp_id = ${empresa}
        AND pt.idioma_id = 1
      ${limite ? `LIMIT ${limite}` : ''}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCommentProductByUser (producto, usuario) {
    debug('ProductService -> getCommentProductByUser')
    const queryString = `
       SELECT *
       FROM producto_comentario
       WHERE producto_id = ${producto}
       AND usuario_id = ${usuario}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCommentCreated (producto, usuario) {
    debug('ProductService -> getCommentCreated')
    const queryString = `
      SELECT
        pc.comentario,
        pc.fecha_creacion AS 'fecha_creacion',
        pca.cal_numero AS 'calificacion'
      FROM producto_comentario AS pc
      JOIN producto_calif AS pca
      ON pca.prod_id = pc.producto_id
      WHERE pc.producto_id = ${producto}
      AND pc.usuario_id = ${usuario}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async commentProduct (producto, usuario, comentario) {
    debug('ProductService -> commentProduct')
    const queryString = `
      INSERT INTO producto_comentario
      (producto_id, usuario_id, comentario)
      VALUES
      (${producto}, ${usuario}, '${comentario}')
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async editCommentProduct (producto, usuario, comentario) {
    debug('ProductService -> editCommentProduct')
    const queryString = `
      UPDATE producto_comentario
      SET
        comentario = '${comentario}'
      WHERE producto_id = ${producto}
      AND usuario_id = ${usuario}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async deleteCommentProduct (producto, usuario) {
    debug('ProductService -> editCommentProduct')
    const queryString = `
      DELETE FROM producto_comentario
      WHERE producto_id = ${producto}
      AND usuario_id = ${usuario}
      LIMIT 1
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCommentsProduct (producto) {
    debug('ProductService -> getCommentsProduct')
    const queryString = `
      SELECT
        pc.comentario,
        pc.fecha_creacion,
        pc.fecha_actualizacion,
        pca.cal_numero,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_foto,
        u.usu_tipo,
        e.emp_id,
        e.emp_nombre,
        e.emp_logo
      FROM producto_comentario AS pc
      JOIN producto_calif AS pca
      ON pca.prod_id = pc.producto_id
      JOIN usuario AS u
      ON u.usu_id = pc.usuario_id
      JOIN empresa_usuario AS eu
      ON eu.usu_id = u.usu_id
      JOIN empresa AS e
      ON e.emp_id = eu.emp_id
      WHERE pc.producto_id = ${producto}
      AND pca.usu_id = pc.usuario_id
      ORDER BY IF (pc.fecha_actualizacion IS NULL, pc.fecha_creacion, pc.fecha_actualizacion) DESC
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductsCompany (company) {
    debug('ProductService -> getProductsCompany')
    const queryString = `
    SELECT
    p.prod_id AS "producto_id",
    p.emp_id AS "empresa_id",
    e.emp_nombre AS "nombre_empresa",
    p.prod_nuevo AS "producto_nuevo",
    p.prod_clearance AS "producto_clearance",
    p.cmon_id AS "moneda_id",
    p.prod_precio_lista AS "precio_lista",
    p.prod_precio_promo AS "precio_promo",
    p.prod_precio_envio AS "precio_envio",
    p.prod_compra_minima AS "compra_minima",
    p.cuni_id AS "unidad_id",
    p.cmetodo_id AS "metodo_pago_id",
    p.prod_cobertura_loc AS "cobertura_local",
    p.prod_cobertura_nac AS "cobertura_nacional",
    p.prod_cobertura_int AS "cobertura_internacional",
    p.cenvio_id AS "envio_id",
    p.prod_disponible AS "disponible",
    p.prod_marca AS "marca",
    p.prod_status AS "estatus",
    p.prod_update AS "update",
    p.prod_precio_envio_nacional AS "precio_envio_nacional",
    p.prod_precio_envio_internacional AS "precio_envio_internacional",
    cu.cuni_desc_esp AS "unidad_esp",
    cu.cuni_desc_ing AS "unidad_ing",
    cm.cmon_desc_esp AS "moneda_esp",
    cm.cmon_desc_ing AS "moneda_ing",
    ce.cenvio_desc_esp AS "envio_esp",
    ce.cenvio_desc_ing AS "envio_ing"
FROM producto AS p
JOIN cat_unidad AS cu ON cu.cuni_id = p.cuni_id
INNER JOIN cat_moneda AS cm ON cm.cmon_id = p.cmon_id
LEFT JOIN cat_envio AS ce ON ce.cenvio_id = p.cenvio_id
LEFT JOIN cat_metodo_pago AS mp ON mp.cmetodo_id = p.cmetodo_id
JOIN empresa AS e ON e.emp_id = p.emp_id
WHERE p.emp_id = ${company};

    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductsCategories () {
    debug('ProductService -> getProductsCategories')
    const queryString = `
      SELECT * FROM producto_categoria
      ORDER BY nombre ASC
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductsCategory (id) {
    debug('ProductService -> getProductsCategory')
    const queryString = `
      SELECT * FROM producto_categoria
      WHERE categoria_id = ${id}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async updateProductCategory (product, category) {
    debug('ProductService -> updateProductCategory')
    const queryString = `
      UPDATE ${this.table}
      SET prod_categoria_id = ${category}
      WHERE prod_id = ${product}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getCompanyByTaxId () {
    let queryString = `
    SELECT
      e.emp_id AS "empresa_id",
      e.cin_id,
      e.emp_nombre AS "nombre",
      e.emp_razon_social AS "razon_social",
      e.emp_rfc AS "rfc",
      e.emp_logo AS "logo",
      e.emp_banner AS "banner",
      e.emp_certificada AS "certificada",
      et.emp_desc AS "descripcion",
      ${user ? `(SELECT IF(COUNT(*) > 0, true, false) FROM empresa_usuario_favorito WHERE usu_id = ${user} AND emp_id = e.emp_id)` : `${null}`} AS "favorita"
    FROM empresa as e
    LEFT JOIN empresa_translate AS et ON et.emp_id = e.emp_id
    WHERE
      REPLACE(REPLACE(e.emp_nombre,'z','s'),'h','') LIKE REPLACE(REPLACE('%${texto}%','z','s'),'h','')
      AND (
        et.idioma_id = 1
        OR et.idioma_id IS NULL
      )
    ${limitCondition}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
  }

  async isThisProductMyFavorite (product, user) {
    debug('ProductService -> isThisProductMyFavorite')
    if (!user) return []
    const queryString = `
      SELECT * FROM favorito WHERE prod_id = ${product} AND usu_id = ${user}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async totalSalesOfProduct (product) {
    debug('ProductService -> totalSalesOfProduct')
    const queryString = `
      SELECT
        COUNT(*) AS 'total'
      FROM cotizacion AS c
      JOIN cot_productos AS cp USING (cot_id)
      WHERE c.cot_status = 2
      AND cp.prod_id = ${product}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductReviewByIDs (user, product) {
    debug('ProductService -> getProductReviewByIDs')
    const queryString = `
      SELECT *
      FROM producto_review
      WHERE usu_id = ${user} AND prod_id = ${product}
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async createProductReview (user, product, quality, price, delivery, title, comment) {
    debug('ProductService -> createProductReview')
    const queryString = `
      INSERT INTO producto_review
        (usu_id, prod_id, calidad, precio, entrega, titulo, cuerpo)
      VALUES
      (${user}, ${product}, ${quality}, ${price}, ${delivery},
        ${title ? `'${title}'` : `${null}`},
        ${comment ? `'${comment}'` : `${null}`}
      )
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertProductReviewPhotos (review, photos) {
    debug('ProductService -> insertProductReviewPhotos')
    const queryString = `
      INSERT INTO producto_review_foto
        (review_id, foto)
      VALUES ${photos.map(p => `(${review}, '${p}')`)}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductReviewPhotos (review) {
    debug('ProductService -> getProductReviewPhotos')
    const queryString = `
      SELECT foto FROM producto_review_foto
      WHERE review_id = ${review}
    `
    debug(queryString)
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getProductReviewByID (product) {
    debug('ProductService -> getProductReviewByID')
    const queryString = `
      SELECT
        pr.review_id,
        pr.calidad,
        pr.precio,
        pr.entrega,
        pr.titulo,
        pr.cuerpo,
        pr.fecha_creacion,
        pr.fecha_actualizacion,
        u.usu_id,
        u.usu_nombre,
        u.usu_app,
        u.usu_puesto,
        u.usu_foto,
        u.usu_tipo,
        e.emp_id,
        e.emp_nombre,
        e.emp_razon_social,
        e.emp_website,
        e.emp_logo,
        e.emp_banner,
        e.emp_certificada
      FROM producto_review AS pr
      JOIN usuario AS u USING(usu_id)
      JOIN empresa_usuario AS eu USING(usu_id)
      JOIN empresa AS e USING(emp_id)
      WHERE pr.prod_id = ${product}
      ORDER BY pr.fecha_creacion DESC
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async insertProductVisit (product, user) {
    debug('ProductService -> insertProductVisit')
    const queryString = `
    INSERT INTO ${this.visitsTable}
    (usu_id, prod_id)
    VALUES
    (${user}, ${product})
    `
    const { result } = await mysqlLib.query(queryString)
    return result
  }

  async getTotalSells (product) {
    debug('ProductService -> getTotalSells')
    const queryString = `
      SELECT
      COUNT(*) AS 'total'
      FROM cot_productos AS cp
      JOIN cotizacion AS c using(cot_id)
      WHERE c.cot_status = 2
      AND cp.prod_id = ${product}
    `
    const { result: resultRaw } = await mysqlLib.query(queryString)
    const [result] = resultRaw
    const { total } = result
    return total
  }

  async getProductosBusqueda (text) {
    debug('ProductService -> searchSuggestion')
    const queryString = `
      SELECT
        pt.prod_nombre AS "nombre",
        pt.prod_id AS "idProducto"
      FROM producto AS p
      INNER JOIN producto_translate AS pt
        ON p.prod_id = pt.prod_id
      WHERE
        p.prod_status = 1
        AND 
        (
        replace(replace(pt.prod_nombre,'z','s'),'h','') LIKE replace(replace('%${text}%','z','s'),'h','')
        OR CAST(pt.prod_id AS CHAR) LIKE '%${text}%'
        )
        AND pt.idioma_id = 1
      LIMIT 5
    `
    debug(queryString)

    const { result } = await mysqlLib.query(queryString)

    return result
  }
}

const inst = new ProductService()
Object.freeze(inst)

module.exports = inst
