'use strict'
const mysqlLib = require('../../lib/db')

async function AddEmpresaRegistro(d) {
  return await mysqlLib.mysqlQuery('SET',

    `insert into empresa
    (emp_nombre,cind_id,emp_rfc,emp_website,emp_cp,cpais_id,emp_status,emp_update) 
    values
    (@emp_nombre,@cind_id,@emp_rfc,@emp_website,@emp_cp,@cpais_id,1,Now())`
    , d)
}

async function updateEmpresa(d) {
  // emp_nombre: nombre, cpais_id: pais, emp_cp: cp, emp_direccion: direccion, emp_telefono: telefono, emp_email: mail, emp_lat: lat, emp_lng: lng, emp_jv_nombre: jv_nombre,
  // emp_jv_email: jv_email, emp_ev_nombre: ev_nombre, emp_ev_email: ev_email, emp_jc_nombre: jc_nombre, emp_jc_email: jc_email, emp_horario1: horario1, emp_horario2: horario2, emp_id: emp_id,
  // emp_razon_social: rs, emp_rfc: rfc, cind_id: industria, emp_website: pagina, emp_fb: fb, emp_tw: tw, emp_in: linkedin, emp_marcas: marcas, emp_loc: loc, emp_nac: nac, emp_int: int, emp_credito: credito
  // emp_antiguedad: antiguedad, emp_empleados: empleados
  return await mysqlLib.mysqlQuery('SET',
    `de empresa
        set emp_nombre = @emp_nombre,
            cpais_id = @cpais_id,
            emp_cp = @emp_cp,
            emp_direccion = @emp_direccion,
            emp_telefono = @emp_telefono,
            emp_email = @emp_email,
            emp_lat = @emp_lat,
            emp_lng = @emp_lng,
            emp_jv_nombre = @emp_jv_nombre,
            emp_jv_email = @emp_jv_email,
            emp_ev_nombre = @emp_ev_nombre,
            emp_ev_email = @emp_ev_email,
            emp_jc_nombre = @emp_jc_nombre,
            emp_jc_email = @emp_jc_email,
            emp_horario1 = @emp_horario1,
            emp_horario2 = @emp_horario2,
            emp_razon_social = @emp_razon_social,
            emp_rfc = @emp_rfc,
            cind_id = @cind_id,
            emp_website = @emp_website,
            emp_fb = @emp_fb,
            emp_tw = @emp_tw,
            emp_in = @emp_in,
            emp_marcas = @emp_marcas,
            emp_loc = @emp_loc,
            emp_nac = @emp_nac,
            emp_int = @emp_int,
            emp_credito = @emp_credito,
            emp_antiguedad = @emp_antiguedad,
            emp_empleados = @emp_empleados
        where emp_id = @emp_id
        `
    , d)
}

async function deleteEmpresaTranslate(d) {
  return await mysqlLib.mysqlQuery('SET',
    'DELETE FROM empresa_translate WHERE emp_id = @emp_id and idioma_id = @idioma_id '
    , d)
}

async function addVideoEmpresa(d) {
  let regreso = ''
  if (d.ev_url == '') {
    regreso = await mysqlLib.mysqlQuery('GET',
      'SELECT 1;'
    )
  } else {
    const strEmpresa = { emp_id: d.emp_id }
    const regresoBorra = await mysqlLib.mysqlQuery('GET',
      'DELETE FROM empresa_video WHERE emp_id = @emp_id '
      , strEmpresa)

    if (!regresoBorra.err) {
      let videos = d.ev_url
      videos = videos.split('@@')
      videos.forEach(async function (element) {
        regreso = await mysqlLib.mysqlQuery('SET',
          `INSERT INTO empresa_video
                    (emp_id,ev_url) 
                    VALUES
                    (@emp_id,'` + element + '\')'
          , strEmpresa)
      })
    } else {
      regrso = regresoBorra
    }
  }
  return regreso
}

async function addZonaEmpresa(d) {
  let regreso = ''
  if (d.cedo_id == '') {
    regreso = await mysqlLib.mysqlQuery('GET',
      'SELECT 1;'
    )
  } else {
    const strEmpresa = { emp_id: d.emp_id }
    const regresoBorra = await mysqlLib.mysqlQuery('GET',
      'DELETE FROM empresa_zona WHERE emp_id = @emp_id '
      , strEmpresa)

    if (!regresoBorra.err) {
      let estados = d.cedo_id
      estados = estados.split('@@')
      estados.forEach(async function (element) {
        regreso = await mysqlLib.mysqlQuery('SET',
          `INSERT INTO empresa_zona
                    (emp_id,cedo_id) 
                    VALUES
                    (@emp_id,` + element + ')'
          , d)
      })
    } else {
      regrso = regresoBorra
    }
  }
  return regreso
}

async function addExportadoEmpresa(d) {
  let regreso = ''
  if (d.cpais_id == '') {
    regreso = await mysqlLib.mysqlQuery('GET',
      'SELECT 1;'
    )
  } else {
    const strEmpresa = { emp_id: d.emp_id }
    const regresoBorra = await mysqlLib.mysqlQuery('GET',
      'DELETE FROM empresa_exportado WHERE emp_id = @emp_id '
      , strEmpresa)

    if (!regresoBorra.err) {
      let paises = d.cpais_id
      paises = paises.split('@@')
      paises.forEach(async function (element) {
        regreso = await mysqlLib.mysqlQuery('SET',
          `INSERT INTO empresa_exportado
                    (emp_id,cpais_id) 
                    VALUES
                    (@emp_id,` + element + ')'
          , d)
      })
    } else {
      regrso = regresoBorra
    }
  }
  return regreso
}

async function getEmpresaByRFC(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa WHERE emp_rfc = @emp_rfc and emp_status = 1'
    , d)
}

async function getEmpresasCatalogo(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT emp_id, CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,\'\'),", ",coalesce(emp_razon_social,\'\')) ELSE coalesce(emp_nombre,\'\') END as emp_nombre, emp_rfc FROM empresa WHERE emp_status = 1')
}

async function getEmpresas() {
  return await mysqlLib.mysqlQuery('GET',
    'Select * from empresa where  emp_status = 1'
  )
}

async function getEmpresaByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaTranslateByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_translate WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaVideosByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_video WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaFotoByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_foto WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaExportaByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_exportado WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaEstadosByID(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_zona WHERE emp_id = @emp_id'
    , d)
}

async function getEmpresaDetalleByID(d) {
  if (d.idioma_id == '1') {
    return await mysqlLib.mysqlQuery('GET',
      `SELECT emp_id, ci.cind_id, cpais_id, emp_nombre, emp_razon_social, emp_rfc, emp_website, emp_cp, emp_logo, emp_banner, emp_direccion, 
                emp_telefono, emp_email, emp_lat, emp_lng, emp_fb, emp_tw, emp_in, crecup_id, emp_marcas, emp_ventas_gob, emp_ventas_credito, emp_ventas_contado, emp_loc, emp_nac,
                emp_int, emp_exportacion, emp_credito, emp_certificada, emp_jv_nombre, emp_jv_email, emp_ev_nombre, emp_ev_email, emp_jc_nombre, emp_jc_email, emp_horario1, emp_horario2, 
                emp_empleados, emp_status, emp_update, ci.cind_nombre_esp as industria, convert(YEAR(now()) - e.emp_antiguedad, SIGNED ) as emp_antiguedad,
                (SELECT cpaid_nombre_esp FROM cat_pais WHERE cpais_id = e.cpais_id ) as pais
                FROM empresa e, cat_industria ci
                WHERE e.cind_id = ci.cind_id and e.emp_id = @emp_id`
      , d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
      `SELECT emp_id, ci.cind_id, cpais_id, emp_nombre, emp_razon_social, emp_rfc, emp_website, emp_cp, emp_logo, emp_banner, emp_direccion, 
                emp_telefono, emp_email, emp_lat, emp_lng, emp_fb, emp_tw, emp_in, crecup_id, emp_marcas, emp_ventas_gob, emp_ventas_credito, emp_ventas_contado, emp_loc, emp_nac,
                emp_int, emp_exportacion, emp_credito, emp_certificada, emp_jv_nombre, emp_jv_email, emp_ev_nombre, emp_ev_email, emp_jc_nombre, emp_jc_email, emp_horario1, emp_horario2, 
                emp_empleados, emp_status, emp_update, ci.cind_nombre_esp as industria, convert(YEAR(now()) - e.emp_antiguedad, SIGNED ) as emp_antiguedad,
                (SELECT cpaid_nombre_ing FROM cat_pais WHERE cpais_id = e.cpais_id ) as pais
                FROM empresa e, cat_industria ci
                WHERE e.cind_id = ci.cind_id and e.emp_id = @emp_id`
      , d)
  }
}

async function getEmpresaByIDIdioma(d) {
  if (d.idioma_id == 1) {
    return await mysqlLib.mysqlQuery('GET',
      `
SELECT
  emp_id,
  cin_id,
  CASE
    WHEN length(emp_razon_social) > 0 
    THEN CONCAT(coalesce(emp_nombre,''), coalesce('',emp_razon_social)) 
  ELSE coalesce(emp_nombre,'') END as emp_nombre, 
  CASE
    WHEN length(emp_razon_social) > 0 
    THEN CONCAT(coalesce('', emp_nombre), coalesce(emp_razon_social,'')) 
  ELSE
    coalesce(emp_nombre,'') 
  END as emp_razon_social,
  emp_rfc,
  emp_website,
  emp_logo,
  emp_banner,
  emp_ventas_gob,
  emp_ventas_credito,
  emp_ventas_contado,
  emp_loc,
  emp_nac,
  emp_int,
  emp_exportacion,
  emp_credito,
  emp_certificada,
  emp_empleados,
  emp_status,
  emp_update
FROM empresa e
WHERE emp_id = @emp_id
`
      , d)
  } else {
    return await mysqlLib.mysqlQuery('GET',
      `SELECT emp_id, cind_id, cpais_id, CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre, CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_razon_social, emp_rfc, emp_website, emp_cp, emp_logo, emp_banner, emp_direccion, 
                    emp_telefono, emp_email, emp_lat, emp_lng, emp_fb, emp_tw, emp_in, crecup_id, emp_marcas, emp_ventas_gob, emp_ventas_credito, 
                    emp_ventas_contado, emp_loc, emp_nac, emp_int, emp_exportacion, emp_credito, emp_certificada, emp_jv_nombre, emp_jv_email, 
                    emp_ev_nombre, emp_ev_email, emp_jc_nombre, emp_jc_email, emp_horario1, emp_horario2, emp_antiguedad, emp_empleados, emp_status, emp_update,
                        (SELECT cind_nombre_ing FROM cat_industria WHERE cind_id = e.cind_id ) as industria,
                        (SELECT cpaid_nombre_ing FROM cat_pais WHERE cpais_id = e.cpais_id ) as pais,
                        (SELECT crecup_desc_ing FROM cat_rec_vencidos WHERE crecup_id = e.crecup_id ) as rec_vencidos
                    FROM empresa e
                WHERE emp_id = @emp_id`
      , d)
  }
}

/* Publicaciones empresa */

async function addPublicacionEmpresa(d) {
  return await mysqlLib.mysqlQuery('SET',
    `insert into publicacion
        (emp_id,usu_id,pub_id_padre,pub_fecha,pub_desc,pub_url) 
        values
        (@emp_id,@usu_id,@pub_id_padre,now(),@pub_desc,@pub_url)`
    , d)
}

async function getPublicacionEmpresa(d) {
  return await mysqlLib.mysqlQuery('GET',
    `SELECT p.*, u.usu_nombre, u.usu_app, u.usu_foto,
            (SELECT count(*) FROM pub_eve_accion WHERE pub_id = p.pub_id and pea_tipo = 1) as pub_like,
            (SELECT count(*) FROM pub_eve_accion WHERE pub_id = p.pub_id and pea_tipo = 2) as pub_compartir,
            (SELECT CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre FROM empresa e, empresa_usuario eu WHERE e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as empresa,
            (select count(*) as cuantos from pub_eve_accion WHERE usu_id = @usu_id and pub_id = p.pub_id and pea_tipo in ( 1, 3 ) ) as num_like
           FROM publicacion p, usuario u 
           WHERE (
           p.emp_id IN (
           select empusu.emp_id
            from network n, usuario u,  empresa_usuario empusu
            where n.usu_id_amigo = u.usu_id
            and empusu.usu_id=u.usu_id
            and n.usu_id_origen = @usu_id
            and n.net_status = 1
           ) OR p.emp_id =@emp_id)
            and u.usu_id = p.usu_id
           ORDER BY p.pub_fecha DESC;
       `
    , d)
}

async function addAccionPublicacion(d) {
  return await mysqlLib.mysqlQuery('SET',
    `insert into pub_eve_accion
        (usu_id,emp_id,pub_id,eve_id,pea_tipo,pea_fecha) 
        values
        (@usu_id,@emp_id,@pub_id,@eve_id,@pea_tipo,now())`
    , d)
}

async function uploadEmpresaRequiere(empresa) {

  const queryString = `
  INSERT INTO empresa_foto
  (emp_id,ef_url)
  VALUES
  (${empresa.emp_id}, '${empresa.ef_url}')
`
  const { result } = await mysqlLib.query(queryString)
  return  result 
}

// async function uploadLogoEmpresaRequiere (evento) {
//   return await mysqlLib.mysqlQuery('SET',
//         `update empresa
//         set emp_logo = @emp_logo
//         where emp_id = @emp_id `
//         , evento)
// }

async function uploadLogoEmpresaRequiere(emp_id, Location) {
  const queryString = `
  UPDATE empresa
  SET emp_logo = '${Location}'
  WHERE emp_id = ${emp_id}
`;
  const result = await mysqlLib.query(queryString);
  return result;
}

async function DeleteEmpresaFoto(empresa) {
  return await mysqlLib.mysqlQuery('SET',
    'DELETE FROM empresa_foto WHERE ef_id in (' + empresa.empresa_foto_id + ') '
  )
}

async function getEventoByEmpUsu(d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM evento WHERE emp_id = @emp_id and usu_id = @usu_id ORDER BY 1 DESC LIMIT 1',
    d)
}

async function DeleteImgCaruselEmpresaPerfil(ef_id) {
  return await mysqlLib.mysqlQuery('SET',
    'Delete from empresa_foto where  ef_id= @ef_id'
    , ef_id)
}

async function addCalificacionEmpresa(calificacion) {
  // usu_id: usu_id, emp_id: emp_id, calif: calif, calif_desc: calif_desc
  return await mysqlLib.mysqlQuery('GET',
    'call  add_CalificacionEmpresa(@usu_id,@emp_id,@calif,@calif_desc)'
    , calificacion)
}

async function getEmpresaContadores(empresa) {
  return await mysqlLib.mysqlQuery('GET',
    `SELECT * FROM 
        (
            select count(*) as leads
            from cot_productos cp, producto p 
            where p.emp_id = @emp_id and cp.prod_id = p.prod_id and cp.cot_prod_status = 1
        ) as leads,
        (
            select count(*) as deals
            from cot_productos cp, producto p 
            where p.emp_id = @emp_id and cp.prod_id = p.prod_id and cp.cot_prod_status = 2
        ) as deals,
        (
            SELECT count(*) as followers 
            FROM 
            (
                SELECT * 
                    FROM pub_eve_accion
                    WHERE emp_id = @emp_id and pea_tipo = 1 and pub_id = 0 and eve_id = 0
                    and usu_id not in (select usu_id from pub_eve_accion WHERE emp_id = @emp_id and pea_tipo = 3 and pub_id = 0 and eve_id = 0)
                    group by usu_id 
            ) as followers
        ) as followers,
        (
            SELECT count(*) as customers
            FROM 
                ( 
                    SELECT c.usu_id_comprador
                    FROM cotizacion c, cot_productos cp, producto p where p.emp_id = @emp_id and cp.prod_id = p.prod_id and c.cot_id = cp.cot_id and cp.cot_prod_status in (1,2)
                    group by c.usu_id_comprador 
                ) as customers
        ) as customers,
        (
            SELECT 
            (
                SELECT count(*) 
                FROM pub_eve_accion
                WHERE emp_id = @emp_id and pea_tipo = 1
            ) -  (
                SELECT count(*) 
                FROM pub_eve_accion
                WHERE emp_id = @emp_id and pea_tipo = 3
            ) as likes
        ) as likes
        `
    , empresa)
}

async function getEmpresaVideobyID(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM empresa_video  WHERE emp_id=@emp_id'
    , emp_id)
}
async function DeleteVideo(emp_id) {
  return await mysqlLib.mysqlQuery('SET',
    'DELETE FROM empresa_video WHERE ev_id = @ev_id'
    , emp_id)
}
async function getIndustria(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select * from cat_industria where cind_id = @cind_id'
    , emp_id)
}

async function NumeroEmpleados(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    'select count(*) as numero_empleado from empresa_usuario where emp_id = @emp_id'
    , emp_id)
}
async function Productos(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM producto where emp_id = @emp_id AND (prod_marca IS NOT NULL and trim(coalesce(prod_marca, \'\')) <>\'\'  ) GROUP BY prod_marca ;'
    , emp_id)
}
async function getImagenPublicaciones(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM publicacion where emp_id= @emp_id'
    , emp_id)
}

async function getImagenProducto(emp_id) {
  return await mysqlLib.mysqlQuery('GET',
    `select p.* , pf.*
        from   producto_foto  pf , producto p 
        where p.emp_id = @emp_id and p.prod_id = pf.prod_id `
    , emp_id)
}

module.exports = {

  AddEmpresaRegistro,
  getEmpresaByRFC,
  getEmpresasCatalogo,
  getEmpresas,
  updateEmpresa,
  deleteEmpresaTranslate,
  addVideoEmpresa,
  addPublicacionEmpresa,
  getPublicacionEmpresa,
  addAccionPublicacion,
  getEmpresaByID,
  getEmpresaTranslateByID,
  getEmpresaVideosByID,
  getEmpresaFotoByID,
  getEmpresaByIDIdioma,
  uploadEmpresaRequiere,
  DeleteEmpresaFoto,
  getEventoByEmpUsu,
  uploadLogoEmpresaRequiere,
  addZonaEmpresa,
  addExportadoEmpresa,
  getEmpresaExportaByID,
  getEmpresaEstadosByID,
  getEmpresaDetalleByID,
  DeleteImgCaruselEmpresaPerfil,
  addCalificacionEmpresa,
  getEmpresaContadores,
  getEmpresaVideobyID,
  DeleteVideo,
  getIndustria,
  NumeroEmpleados,
  Productos,
  getImagenPublicaciones,
  getImagenProducto
}
