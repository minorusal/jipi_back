
'use strict'
// const await mysqlLib = require('../modules/await mysqlLib')
const mysqlLib = require('../../lib/db')

async function getUsuarios () {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM usuario'
  )
}

async function getUsuarioByID (d) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM usuario where usu_id = @usu_id'
    , d)
}

async function AddUsuario (d) {
  return await mysqlLib.mysqlQuery('GET',

        `insert into usuario
    (usu_nombre,usu_app,usu_puesto,usu_email,usu_psw,usu_idioma,usu_status,usu_update, usu_boletin, usu_verificado, usu_foto, usu_card, usu_tipo) 
    values
    (@usu_nombre,@usu_app,@usu_puesto,@usu_email,@usu_psw,@usu_idioma,1,Now(),@usu_boletin,0,'','', @usu_tipo )`
        , d)
}

async function updateUsuario (d) {
  return await mysqlLib.mysqlQuery('GET',
        `update usuario
    set usu_status = 1
    where usu_id = @usu_id
    `
        , d)
}

async function getid_registro (d) {
  return await mysqlLib.mysqlQuery('GET',
        `Select max(usu_id) AS usu_id
    from usuario
    where usu_email=@usu_email`
        , d)
}

async function getUsuarioByMail (d) {
  return await mysqlLib.mysqlQuery('GET',
        `select eu.tipo, e.emp_id, e.emp_certificada, u.*, CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre
        from empresa_usuario eu, empresa e , usuario u
        where 
           u.usu_email = @usu_email and eu.usu_id  = u.usu_id and e.emp_id = eu.emp_id and u.usu_status != 0`
        , d)
}

async function getUsuarioByEmpresa (d) {
  return await mysqlLib.mysqlQuery('GET',
        `SELECT u.usu_id, u.usu_nombre, u.usu_app, u.usu_puesto, u.usu_email, u.usu_foto
        FROM empresa_usuario eu, usuario u WHERE eu.emp_id = @emp_id and eu.usu_id = u.usu_id`
        , d)
}

async function UsuarioPais (usu_paises) {
  return await mysqlLib.mysqlQuery('SET',
    'insert into usuario_paises_exporta(usu_id,pais_id)value(@usu_id,@pais_id)'
    , usu_paises)
}

async function UsuarioEmpresa (usu_emp) {
  if (usu_emp.existempresa) {
    return await mysqlLib.mysqlQuery('SET',
      'insert into empresa_usuario(emp_id,usu_id,tipo)value(@emp_id,@usu_id,0)'
      , usu_emp)
  } else {
    return await mysqlLib.mysqlQuery('SET',
      'insert into empresa_usuario(emp_id,usu_id,tipo)value(@emp_id,@usu_id,1)'
      , usu_emp)
  }
}

async function getVerificaCodigoUsuario (usuario) {
  return await mysqlLib.mysqlQuery('GET',
    'SELECT * FROM usuario where usu_id = @usu_id and  usu_psw LIKE \'%' + usuario.codigo_user + '%\' and usu_status= 1'
    , usuario)
}
async function Activar_Cuenta (usuario) {
  return await mysqlLib.mysqlQuery('SET',
     `update usuario
     set usu_verificado = 1 
     where usu_id = @usu_id `
     , usuario)
}

async function UpdatePwUser (datos) {
  return await mysqlLib.mysqlQuery('SET',
    `update usuario
    set  usu_psw = @usu_pw
    where usu_id = @usu_id and usu_verificado= 1  `

    , datos)
}

async function AddComentario (datos) {
  return await mysqlLib.mysqlQuery('SET',
        `insert comentario(cmt_titulo,cmt_desc,cmt_nombre,cmt_correo,cmt_status,cmt_update)
        values(@cmt_titulo,@cmt_desc,@cmt_nombre,@cmt_correo,1,Now()) `
        , datos)
}

async function AccionFavorito (datos) {
  if (datos.accion == 1) {
    return await mysqlLib.mysqlQuery('SET',
            `insert favorito(prod_id,usu_id)
            values(@prod_id,@usu_id) `
            , datos)
  } else if (datos.accion == 0) {
    return await mysqlLib.mysqlQuery('SET',
      'DELETE FROM favorito WHERE prod_id = @prod_id and usu_id = @usu_id'
      , datos)
  }
}

async function updateUsuarioPerfil (d) {
  if (d.usu_psw == '1') {
    return await mysqlLib.mysqlQuery('SET',
            `update usuario
        set usu_nombre = @usu_nombre,
            usu_app = @usu_app,
            usu_puesto = @usu_puesto,
            usu_boletin = @usu_boletin,
            usu_idioma = @usu_idioma,
            usu_status = 1
        where usu_id = @usu_id
        `
            , d)
  } else {
    return await mysqlLib.mysqlQuery('SET',
            `update usuario
        set usu_nombre = @usu_nombre,
            usu_app = @usu_app,
            usu_puesto = @usu_puesto,
            usu_boletin = @usu_boletin,
            usu_idioma = @usu_idioma,
            usu_psw = @usu_psw,
            usu_status = 1
        where usu_id = @usu_id
        `
            , d)
  }
}

async function uploadImgPerfil (usu_id) {
  return await mysqlLib.mysqlQuery('SET',
        `update usuario
        set usu_foto = @usu_foto 
        where usu_id = @usu_id`
        , usu_id)
}

async function getNetworkingByType (usuario) {
  return await mysqlLib.mysqlQuery('GET',
        `select n.*,  u.usu_nombre, u.usu_app, u.usu_puesto, u.usu_foto,
        (select CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre from empresa e, empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_nombre,
        (select emp_certificada from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_certificada,
        (select e.emp_id from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_id
    from network n, usuario u 
    where n.usu_id_origen = u.usu_id
    and n.usu_id_amigo = @usu_id
    and n.net_tipo in (` + usuario.net_tipo + `) and n.net_status = @net_status
    UNION
    select n.*,  u.usu_nombre, u.usu_app, u.usu_puesto, u.usu_foto,
        (select CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre from empresa e, empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_nombre,
        (select emp_certificada from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_certificada,
        (select e.emp_id from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_id
    from network n, usuario u 
    where n.usu_id_amigo = u.usu_id
    and n.usu_id_origen = @usu_id
    and n.net_tipo in (` + usuario.net_tipo + ') and n.net_status = @net_status '
        , usuario)
}

async function getNetworkingByTypeInvite (usuario) {
  return await mysqlLib.mysqlQuery('GET',
        `select n.*,  u.usu_nombre, u.usu_app, u.usu_puesto, u.usu_foto,
        (select CASE WHEN length(emp_razon_social) > 0 THEN CONCAT(coalesce(emp_nombre,''),", ",coalesce(emp_razon_social,'')) ELSE coalesce(emp_nombre,'') END as emp_nombre from empresa e, empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_nombre,
        (select emp_certificada from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_certificada,
        (select e.emp_id from empresa e,empresa_usuario eu where e.emp_id = eu.emp_id and eu.usu_id = u.usu_id LIMIT 1) as emp_id
    from network n, usuario u 
    where n.usu_id_origen = u.usu_id
    and n.usu_id_amigo = @usu_id
    and n.net_tipo in (` + usuario.net_tipo + ') and n.net_status = @net_status'
        , usuario)
}

async function uploadNetworkingUsuID (network) {
  // usu_id: usu_id_amigo, usu_id_amigo: usu_id, net_status: tipo
  return await mysqlLib.mysqlQuery('SET',
        `update network
        set net_status = @net_status
        where usu_id_origen = @usu_id and usu_id_amigo = @usu_id_amigo`
        , network)
}

async function addNetworking (network) {
  // usu_id: usu_id, usu_id_amigo: usu_id_amigo, net_status: tipo
  return await mysqlLib.mysqlQuery('SET',
        `insert network(usu_id_origen,usu_id_amigo,net_tipo,net_fecha,net_status)
        values(@usu_id,@usu_id_amigo,@net_status,now(),2) `
        , network)
}

async function checkNetwokring (search) {
  return await mysqlLib.mysqlQuery('GET',
        `SELECT count(*) as cuantos FROM network WHERE 
        (usu_id_origen = @usu_id and usu_id_amigo = @usu_id_amigo ) or (usu_id_origen = @usu_id_amigo and usu_id_amigo = @usu_id ) `
        , search)
}

async function getUsuarioBySearch (busca) {
  return await mysqlLib.mysqlQuery('GET',
        `SELECT u.*, CONCAT(e.emp_nombre,", ",e.emp_razon_social) as emp_nombre, e.emp_certificada
        FROM usuario u, empresa e, empresa_usuario eu
        WHERE UPPER(CONCAT(u.usu_nombre,' ',u.usu_app)) LIKE UPPER('%` + busca.busca + `%') and u.usu_status = 1
			and u.usu_id = eu.usu_id and e.emp_id = eu.emp_id `
  )
}

async function getFavoritosByUsuID (dato) {
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
          p.prod_disponible,
          p.prod_precio_envio,
          p.prod_compra_minima,
          p.prod_clearance,
          c.cmon_id,
          c.cmon_desc_esp as  cmon_desc,
          e.emp_certificada,
          ct_uni.cuni_desc_esp as cuni_desc,
          CONCAT(e.emp_nombre,", ",emp_razon_social) as emp_nombre,
          (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
          (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
          (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
          coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
        FROM
          producto_translate pt,
          producto p,
          cat_moneda c,
          empresa e,
          cat_unidad  ct_uni,
          favorito f
        WHERE pt.prod_id = p.prod_id
        AND pt.idioma_id = 1
        AND p.cmon_id  = c.cmon_id
        AND p.emp_id = e.emp_id
        AND p.prod_id = f.prod_id
        AND ct_uni.cuni_id = p.cuni_id
        AND p.prod_status = 1
        AND f.usu_id = @usu_id
        `
        , dato)
  } else if (dato.idioma_id == 2) {
    return await mysqlLib.mysqlQuery('GET',
        `         select  p.prod_id,pt.prod_nombre,pt.prod_desc,p.prod_precio_lista,p.prod_precio_promo,p.prod_precio_envio,p.prod_compra_minima,pt.prod_video,c.cmon_id,pai.cpaid_nombre_esp as cpaid_nombre ,ct_uni.cuni_desc_esp as cuni_desc ,e.emp_certificada,
        c.cmon_desc_esp as  cmon_desc , CONCAT(e.emp_nombre,", ",e.emp_razon_social) as emp_nombre, p.prod_disponible,p.prod_clearance,
         (SELECT count(*) FROM favorito WHERE prod_id = p.prod_id and usu_id = @usu_id) as favorito,
         (SELECT count(*) FROM producto_calif WHERE prod_id = p.prod_id) as numero,
          (SELECT round( coalesce(avg(cal_numero),0)) FROM producto_calif WHERE prod_id = p.prod_id) as calif,
         coalesce((SELECT foto_url FROM producto_foto WHERE prod_id = p.prod_id ORDER BY foto_num LIMIT 1),'') as foto_url
         from  producto_translate pt, producto p, cat_moneda c, empresa e, cat_pais pai , cat_unidad  ct_uni, favorito f
         where pt.prod_id = p.prod_id and pt.idioma_id = 2 and p.cmon_id  = c.cmon_id  and pai.cpais_id = e.cpais_id and p.emp_id = e.emp_id
             and p.prod_id = f.prod_id and ct_uni.cuni_id = p.cuni_id and p.prod_status = 1 and f.usu_id = @usu_id`
        , dato)
  }
}

async function GetFiendsNetwork (usuario) {
  return await mysqlLib.mysqlQuery('GET',
    `
    select * from network  where usu_id_origen =@usu_id_origen`
    , usuario)
}

async function updateUsuarioPerfilDatos (datos) {
  return await mysqlLib.mysqlQuery('SET',
    `update usuario
set usu_nombre = @usu_nombre,
    usu_app = @usu_app,
    usu_puesto = @usu_puesto,
    usu_boletin = @usu_boletin,
    usu_idioma = @usu_idioma,
    usu_psw = @usu_psw,
    usu_email = @usu_email,
    usu_status = 1
where usu_id = @usu_id
`
    , datos)
}

async function setOpinion (datos) {
  return await mysqlLib.mysqlQuery('SET',
            `insert opinion(opinion_titulo,opinion_texto,usu_id,opinion_tipo,opinion_status,opinion_update)
            values(@opinion_titulo,@opinion_texto,@usu_id,@opinion_tipo,1,now()) `
            , datos)
}

async function getEventosByUsuID (usuario) {
  return await mysqlLib.mysqlQuery('GET',
        ` SELECT e.*, CONCAT(emp.emp_nombre,", ",emp.emp_razon_social) as emp_nombre, emp.emp_razon_social FROM evento e, 
                (SELECT eve_id, count(*) as cuantos
                FROM pub_eve_accion pea
                WHERE pea.usu_id = @usu_id and pea.eve_id != 0 and pea.pea_tipo in (1,3)
                GROUP BY eve_id
                HAVING MOD(cuantos,2) = 1 ) as tmp, empresa emp
            WHERE e.eve_id = tmp.eve_id and e.emp_id = emp.emp_id
            and e.eve_status = 1
            ORDER BY eve_fecha DESC `
        , usuario)
}

async function getUsuarioEmpresa (d) {
  return await mysqlLib.mysqlQuery('GET',
            `select eu.tipo, CONCAT(e.emp_nombre,", ",e.emp_razon_social) as emp_nombre, e.emp_id, u.*
            from empresa_usuario eu, empresa e , usuario u
            where 
            u.usu_id = @usu_id and eu.usu_id  = u.usu_id and e.emp_id = eu.emp_id and u.usu_status != 0`
            , d)
}

async function getUsuarioBadges (d) {
  console.log(d)
  return await mysqlLib.mysqlQuery('GET',
            `SELECT 
            (SELECT count(*) FROM alerta WHERE alerta_status = 1 and usu_id = @usu_id) as num_alertas,
            (SELECT count(*) FROM network WHERE usu_id_amigo = @usu_id and net_status = 2 ) as num_network,
            (SELECT CASE WHEN usu_tipo = 1 THEN (
                                                    SELECT sum(cuantos) as cuantos
                                                    FROM (
                                                        SELECT count(*) as cuantos 
                                                        FROM (
                                                            SELECT cp.cot_id, count(*) as cuantos FROM cot_productos cp, producto p, empresa_usuario eu	
                                                            WHERE eu.usu_id = @usu_id and p.emp_id = eu.emp_id and cp.prod_id = p.prod_id and cp.cot_prod_status in (1)
                                                            GROUP BY cp.cot_id	
                                                            HAVING count(*) = 1 ) as tmp
                                                        UNION ALL
                                                        SELECT count(*) as cuantos
                                                            FROM cot_comentario cc
                                                            WHERE cc.cmt_visto = 0 and cc.usu_id not in (SELECT usu_id FROM empresa_usuario WHERE emp_id IN (SELECT emp_id FROM empresa_usuario WHERE usu_id = @usu_id)) 
                                                            and cc.cot_id  IN ( SELECT c.cot_id 
                                                                            FROM cotizacion c, cot_productos cp
                                                                            WHERE c.cot_status = 1 and cp.cot_prod_status = 1 
                                                                                and c.cot_id = cp.cot_id and cp.emp_id_vendedor IN (SELECT emp_id FROM empresa_usuario WHERE usu_id = @usu_id) ) 
                                                    ) as t
                                                )
                    ELSE (SELECT sum(cuantos) as cuantos
                            FROM (
                                SELECT count(*) as cuantos
                                FROM (
                                    SELECT cp.cot_id, cp.prod_id, max(cot_version) FROM cot_productos cp, cotizacion c
                                    WHERE c.usu_id_comprador = @usu_id  and cp.cot_visto = 0
                                    GROUP BY cp.cot_id, cp.prod_id
                                    ORDER BY 1, 2 ) 
                                as tmp
                                UNION ALL
                                SELECT count(*) as cuantos
                                FROM cot_comentario cc
                                WHERE cc.cmt_visto = 0 and cc.usu_id != @usu_id
                            ) as t ) 
                    END as cuantos  FROM usuario WHERE usu_id = @usu_id ) as num_deals;`
            , d)
}

module.exports = {
  getUsuarios,
  getUsuarioByID,
  AddUsuario,
  updateUsuario,
  getid_registro,
  getUsuarioByMail,
  UsuarioPais,
  UsuarioEmpresa,
  getVerificaCodigoUsuario,
  Activar_Cuenta,
  UpdatePwUser,
  AddComentario,
  AccionFavorito,
  updateUsuarioPerfil,
  uploadImgPerfil,
  getUsuarioByEmpresa,
  getNetworkingByType,
  uploadNetworkingUsuID,
  getUsuarioBySearch,
  addNetworking,
  getFavoritosByUsuID,
  checkNetwokring,
  GetFiendsNetwork,
  updateUsuarioPerfilDatos,
  setOpinion,
  getEventosByUsuID,
  getUsuarioEmpresa,
  getUsuarioBadges,
  getNetworkingByTypeInvite
}
