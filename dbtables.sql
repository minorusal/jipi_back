CREATE TABLE IF NOT EXISTS reporte_cotizacion (
	rep_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    cot_id INT NOT NULL UNIQUE,
    vigente INT NOT NULL DEFAULT 1,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pago_cotizacion (
	pago_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    reporte_id INT NOT NULL,
    monto FLOAT NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

###################################
###################################
###################################
###################################

CREATE TABLE IF NOT EXISTS idioma (
  idioma_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  iso VARCHAR(2) NOT NULL UNIQUE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS pais (
  pais_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  iso VARCHAR(3) NOT NULL UNIQUE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS pais_translate (
  pais_translate_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  pais_id INT NOT NULL,
  idioma_id INT NOT NULL,
  nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estado (
  estado_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  pais_id INT NOT NULL,
  iso VARCHAR(10) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estado_translate (
  estado_translate_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  estado_id INT NOT NULL,
  idioma_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS industria (
  industria_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  clave VARCHAR(20) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS industria_translate (
  industria_translate_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  industria_id INT NOT NULL,
  idioma_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS domicilio_tipo (
  domicilio_tipo_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  tipo VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

## Esta es la tabla vieja
## ya no usar
CREATE TABLE IF NOT EXISTS domicilio (
  domicilio_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  domicilio_tipo INT NOT NULL DEFAULT 2,
  emp_id INT NOT NULL,
  estado_id INT NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  calle VARCHAR(500) NOT NULL,
  num_ext VARCHAR(10) NOT NULL,
  num_int VARCHAR(10) DEFAULT NULL,
  colonia VARCHAR(500) NOT NULL,
  municipio VARCHAR(500) NOT NULL,
  cp VARCHAR(25) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS domicilio (
  domicilio_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  domicilio_tipo INT NOT NULL DEFAULT 2,
  emp_id INT NOT NULL,
  estado_id INT NOT NULL,
  direccion VARCHAR(5000) NOT NULL,
  google_id VARCHAR(5000) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telefono (
  telefono_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  domicilio_id INT NOT NULL,
  numero VARCHAR(50),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dia (
  dia_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(10) NOT NULL UNIQUE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS horario (
  horario_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  emp_id INT NOT NULL UNIQUE,
  lunes_apertura VARCHAR(5) DEFAULT NULL,
  lunes_cierre VARCHAR(5) DEFAULT NULL,
  martes_apertura VARCHAR(5) DEFAULT NULL,
  martes_cierre VARCHAR(5) DEFAULT NULL,
  miercoles_apertura VARCHAR(5) DEFAULT NULL,
  miercoles_cierre VARCHAR(5) DEFAULT NULL,
  jueves_apertura VARCHAR(5) DEFAULT NULL,
  jueves_cierre VARCHAR(5) DEFAULT NULL,
  viernes_apertura VARCHAR(5) DEFAULT NULL,
  viernes_cierre VARCHAR(5) DEFAULT NULL,
  sabado_apertura VARCHAR(5) DEFAULT NULL,
  sabado_cierre VARCHAR(5) DEFAULT NULL,
  domingo_apertura VARCHAR(5) DEFAULT NULL,
  domingo_cierre VARCHAR(5) DEFAULT NULL
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS empresa (
    emp_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    cin_id INT NOT NULL DEFAULT 0,
    horario_id INT DEFAULT NULL,
    emp_nombre VARCHAR(200) NOT NULL,
    emp_razon_social VARCHAR(200) NOT NULL,
    emp_rfc VARCHAR(50) NOT NULL,
    emp_website VARCHAR(255),
    emp_logo VARCHAR(100),
    emp_banner VARCHAR(100),
    emp_ventas_gob INT NOT NULL DETAULT 0,
    emp_ventas_credito INT NOT NULL DETAULT 0,
    emp_ventas_contado INT NOT NULL DETAULT 0,
    emp_loc INT NOT NULL DETAULT 0,
    emp_nac INT NOT NULL DETAULT 0,
    emp_int INT NOT NULL DETAULT 0,
    emp_exportacion INT NOT NULL DETAULT 0,
    emp_credito INT NOT NULL DETAULT 0,
    emp_certificada INT DEFAULT 0,
    emp_empleados INT DEFAULT 1,
    emp_status INT DEFAULT 0,
    emp_fecha_fundacion TIMESTAMP NULL,
    emp_fecha_creacion  TIMESTAMP NOT NULL DEFAULT NOW(),
    emp_update TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS empresa_translate (
  emp_id INT NOT NULL UNIQUE,
  idioma_id INT NOT NULL,
  emp_desc TEXT DEFAULT NULL,
  emp_lema TEXT DEFAULT NULL,
  emp_mision TEXT DEFAULT NULL,
  emp_vision TEXT DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS empresa_translate (
  emp_id INT NOT NULL UNIQUE,
  idioma_id INT NOT NULL,
  emp_desc TEXT DEFAULT NULL,
  emp_lema TEXT DEFAULT NULL,
  emp_mision TEXT DEFAULT NULL,
  emp_vision TEXT DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacion_tipo (
    tipo_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    tipo VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacion (
    alerta_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    usu_id INT NOT NULL,
    tipo_id INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notificacion_texto (
    alerta_id INT NOT NULL,
    idioma_id INT NOT NULL,
    texto VARCHAR(100)
) ENGINE=InnoDB;



CREATE TABLE IF NOT EXISTS comentario_cotizacion (
  comentario_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  cot_id INT NOT NULL,
  autor INT NOT NULL,
  texto TEXT NOT NULL,
  visto TINYINT NOT NULL DEFAULT 0,
  cot_origen INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuario_invitacion (
  emp_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  correo VARCHAR(100) NOT NULL UNIQUE,
  tipo TINYINT NOT NULL
) ENGINE=InnoDB;

### A la tabla de publicaciones
### se le editó el campo de actualización
### se puso por defecto un NULL

CREATE TABLE IF NOT EXISTS publicaciones_compartidas (
  publicacion_id INT NOT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS producto_comentario (
  producto_id INT NOT NULL,
  usuario_id INT NOT NULL,
  comentario TEXT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

### A la tabla de empresa
### se le agregó la columna emp_marcas VARCHAR(5000)
### se puso por defecto un NULL

## 13-01-2020

CREATE TABLE IF NOT EXISTS seguidores (
  usuario_origen INT NOT NULL,
  usuario_destino INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

## 21-01-2020

CREATE TABLE IF NOT EXISTS eventos (
  evento_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  alias VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  host_usuario INT NOT NULL,
  host_empresa INT NOT NULL,
  privacidad INT NOT NULL,
  capacidad INT NOT NULL,
  direccion VARCHAR(5000) NOT NULL,
  google_id VARCHAR(5000) NOT NULL,
  imagen VARCHAR(255) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS eventos_invitados (
  evento_id INT NOT NULL,
  usuario_id INT NOT NULL,
  tipo INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eventos_fotos (
  foto_uuid VARCHAR(25) NOT NULL,
  evento_id INT NOT NULL,
  usuario_id INT NOT NULL,
  url VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eventos_horarios (
  horario_uuid VARCHAR(25) NOT NULL,
  evento_id INT NOT NULL,
  fecha TIMESTAMP NOT NULL,
  apertura VARCHAR(5) DEFAULT NULL,
  cierre VARCHAR(5) DEFAULT NULL
) ENGINE=InnoDB;

## 28-01-2020

CREATE TABLE IF NOT EXISTS notificaciones (
  notificacion_uuid VARCHAR(50) NOT NULL,
  origen_id INT NOT NULL,
  destino_id INT NOT NULL,
  tipo INT NOT NULL,
  visto INT NOT NULL DEFAULT 0,
  data INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

## 12-02-2020

### Apple token 64

CREATE TABLE IF NOT EXISTS tokens (
  usuario_id INT NOT NULL,
  token VARCHAR(200) NOT NULL UNIQUE,
  tipo ENUM('Android', 'iOS') NOT NULL
) ENGINE=InnoDB;


### 19-02-2020

CREATE TABLE IF NOT EXISTS turnos (
  empresa_id INT NOT NULL UNIQUE,
  turno INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

## 02-02-2020

### Certificación


CREATE TABLE IF NOT EXISTS certificaciones (
  certificacion_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL UNIQUE,
  nrp VARCHAR(500) NOT NULL,
  herramienta_proteccion_id INT NOT NULL,
  capital_social INT NOT NULL,
  representante_legal VARCHAR(500) NOT NULL,
  empleados INT NOT NULL,
  periodo_activo FLOAT NOT NULL,
  periodo_pasivo FLOAT NOT NULL,
  ventas FLOAT NOT NULL,
  capital FLOAT NOT NULL,
  unidad_neta FLOAT NOT NULL,
  fecha  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificaciones_herramienta (
  herramienta_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  herramienta VARCHAR(500) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificaciones_referencias_comerciales (
  certificacion_id INT NOT NULL,
  empresa VARCHAR(500) NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  correo VARCHAR(500) NOT NULL,
  telefono VARCHAR(500) NOT NULL,
  pais_id INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificaciones_inmueble (
  certificacion_id INT NOT NULL,
  direccion VARCHAR(5000) NOT NULL,
  propio ENUM('0', '1') NOT NULL,
  comodato ENUM('0', '1') NOT NULL,
  renta ENUM('0', '1') NOT NULL,
  precio FLOAT,
  oficinas_administrativas ENUM('0', '1') NOT NULL,
  almacen ENUM('0', '1') NOT NULL,
  area_produccion ENUM('0', '1') NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificaciones_representantes (
  certificacion_id INT NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  directivo ENUM('0', '1') NOT NULL,
  consejo ENUM('0', '1') NOT NULL,
  inversionista ENUM('0', '1') NOT NULL,
  accionista ENUM('0', '1') NOT NULL,
  porcentaje FLOAT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificaciones_empresas_relacionadas (
  certificacion_id INT NOT NULL,
  nombre VARCHAR(500) NOT NULL,
  razon_social VARCHAR(100) NOT NULL,
  pais_id INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS  certificaciones_pais (
  pais_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  idioma_id INT NOT NULL,
  nombre VARCHAR(200) NOT NULL
) ENGINE=InnoDB;


# 09-03-2020

CREATE TABLE IF NOT EXISTS eventos_grupo (
  grupo_uuid VARCHAR(50) NOT NULL,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eventos_grupo_usuario (
  grupo_uuid VARCHAR(50) NOT NULL,
  usuario_id INT NOT NULL
) ENGINE=InnoDB;

# 25-03-2020

CREATE TABLE IF NOT EXISTS eventos_favorito_usuario (
  evento_id INT NOT NULL,
  usuario_id INT NOT NULL
) ENGINE=InnoDB;

# 31-03-2020

CREATE TABLE IF NOT EXISTS producto_categoria (
  categoria_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(500) NOT NULL
) ENGINE=InnoDB;

# 02-04-2020

CREATE TABLE IF NOT EXISTS usuario_visita (
  origen INT NOT NULL,
  destino INT NOT NULL,
  visitas INT NOT NULL DEFAULT 1,
  fecha TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;

# 06-04-2020

CREATE TABLE IF NOT EXISTS cotizacion_pago (
  foto_uuid VARCHAR(25) NOT NULL,
  cot_id INT NOT NULL,
  imagen VARCHAR(500) NOT NULL,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# 13-04-2020

CREATE TABLE IF NOT EXISTS empresa_usuario_favorito (
  usu_id INT NOT NULL,
  emp_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

### 17-04-2020

CREATE TABLE IF NOT EXISTS chat_empresa_turnos (
  empresa_id INT NOT NULL UNIQUE,
  turno INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_empresa_salas (
  sala_uuid VARCHAR(50) NOT NULL,
  usuario_comprador INT NOT NULL,
  usuario_vendedor INT NOT NULL,
  empresa_compradora INT NOT NULL,
  empresa_vendedora INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_empresa_mensajes (
  sala_uuid VARCHAR(50) NOT NULL,
  mensaje_uuid VARCHAR(50) NOT NULL,
  usuario INT NOT NULL,
  mensaje TEXT NOT NULL,
  visto INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# 04-05-2020

ALTER TABLE publicaciones
ADD origen ENUM('Personal', 'Corporativo') NOT NULL
DEFAULT 'Personal';


# 21-05-2020
CREATE TABLE IF NOT EXISTS usuario_tokens_pago (
  usuario INT NOT NULL,
  token VARCHAR(250) UNIQUE NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario, token)
) ENGINE=InnoDB;

# 01-06-2020
CREATE TABLE IF NOT EXISTS precios_plataforma (
  concepto VARCHAR(255) NOT NULL,
  precio DECIMAL NOT NULL,
  descuento DECIMAL(5, 2) NOT NULL DEFAULT 0,
  moneda VARCHAR(10) NOT NULL,
  PRIMARY KEY (concepto)
) ENGINE=InnoDB;

# 15-06-2020
CREATE TABLE IF NOT EXISTS producto_review (
  review_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  usu_id INT NOT NULL,
  prod_id INT NOT NULL,
  calidad DECIMAL(3, 1) NOT NULL,
  precio DECIMAL(3, 1) NOT NULL,
  entrega DECIMAL(3, 1) NOT NULL,
  titulo VARCHAR(100) DEFAULT NULL,
  cuerpo VARCHAR(100) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS producto_review_foto (
  review_id INT NOT NULL,
  foto VARCHAR(255) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# 30-06-2020

CREATE TABLE IF NOT EXISTS sugerencias (
  sugerencia_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  usu_id INT NOT NULL,
  sugerencia TEXT NOT NULL,
  imagen VARCHAR(255) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS problemas (
  problema_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  usu_id INT NOT NULL,
  problema TEXT NOT NULL,
  imagen VARCHAR(255) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# 03-06-2020

CREATE TABLE IF NOT EXISTS reporte_credito_solicitud (
  reporte_id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  cot_id INT NOT NULL,
  empresa_solicitante INT NOT NULL,
  empresa_destino INT NOT NULL,
  estatus ENUM('Pendiente', 'Rechazado', 'Aceptado', 'Investigando', 'Investigado') DEFAULT 'Pendiente',
  pago_id VARCHAR(500) DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP()
) ENGINE=InnoDB;


# Sub comentarios:
# Para poder comentar un comentario a una publicación, este subcomentario puede tener likes
CREATE TABLE IF NOT EXISTS publicaciones_subcomentarios (
  subcomentario_uuid VARCHAR(100) NOT NULL,
  usuario_id INT NOT NULL,
  comentario_id INT NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (subcomentario_uuid, comentario_id)
) ENGINE=InnoDB;

# Sub comentarios likes:
# Para poder contar los likes de un subcomentario y poder tener registro de quien le dio like
CREATE TABLE IF NOT EXISTS publicaciones_subcomentarios_likes (
  subcomentario_uuid VARCHAR(100) NOT NULL,
  usuario_id INT NOT NULL,
  valor ENUM('LIKE', 'EMPTY'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (subcomentario_uuid, usuario_id)
) ENGINE=InnoDB;

# Comentarios likes:
# Para poder contar los likes de un comentario y poder tener registro de quien le dio like
CREATE TABLE IF NOT EXISTS publicaciones_comentarios_likes (
  comentario_id INT NOT NULL,
  usuario_id INT NOT NULL,
  valor ENUM('LIKE', 'EMPTY'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (comentario_id, usuario_id)
) ENGINE=InnoDB;

# Metas de ventas
#Un administrador puede fijar una meta de ventas a un vendedor por un período de tiempo determinado
CREATE TABLE IF NOT EXISTS vendedores_metas (
  usuario_id INT NOT NULL,
  meta FLOAT NOT NULL,
  periodo DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (usuario_id, periodo)
) ENGINE=InnoDB;

# Esto va a permitir el poder contabilizar los follows y unfollows en un período de tiempo
ALTER TABLE seguidores
ADD estatus ENUM('Follow', 'Unfollow') DEFAULT 'Follow' NOT NULL AFTER usuario_destino,
ADD fecha_actualizacion TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP() AFTER fecha_creacion
;

# Esto permite referenciar un mensaje del chat de empresa
# con un producto
ALTER TABLE chat_empresa_mensajes
ADD producto_id INT DEFAULT NULL AFTER visto;

# Guardar historial de compras...
CREATE TABLE IF NOT EXISTS pagos (
  pago_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  usu_id INT NOT NULL,
  cargo DECIMAL(10, 2) NOT NULL,
  concepto ENUM('Certification', 'CreditReport') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# Almacenar las url de los reportes de credito
ALTER TABLE reporte_credito_solicitud
ADD url VARCHAR(1000) DEFAULT NULL AFTER pago_id;

# Poder eliminar las fotos de eventos
ALTER TABLE eventos_fotos
ADD PRIMARY KEY (foto_uuid);

# Almacenar las url de los reportes de credito
ALTER TABLE empresa
ADD emp_video VARCHAR(200) DEFAULT NULL AFTER emp_banner;

# Agrega columna de video a publicaciones para poder almacenar una url de AWS
ALTER TABLE publicaciones
ADD video VARCHAR(200) DEFAULT NULL AFTER imagen;

ALTER TABLE publicaciones_comentarios
ADD video VARCHAR(200) DEFAULT NULL AFTER imagen;

# Catalogo de nombres comerciales
CREATE TABLE IF NOT EXISTS cat_nombre_comercial (
  nombre_comercial_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  pais ENUM('MEX', 'USA') NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_busqueda (
  busqueda_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  usu_id INT NOT NULL,
  termino VARCHAR(200) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS producto_vistas (
  vista_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  usu_id INT NOT NULL,
  prod_id INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS publicaciones_vistas (
  vista_id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  usu_id INT NOT NULL,
  pub_id INT NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

# Añade empresa vendedora a la experiencia de cotización
CREATE TABLE IF NOT EXISTS cot_experiencia (
  cot_id INT NOT NULL,
  vendedor_id INT NOT NULL,
  comprador_id INT NOT NULL,
  tiempo FLOAT NOT NULL,
  calidad FLOAT NOT NULL,
  servicio FLOAT NOT NULL,
  comentario TEXT,
  estatus ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
) ENGINE=InnoDB;

ALTER TABLE empresa
MODIFY emp_logo VARCHAR(200),
MODIFY emp_banner VARCHAR(200);

ALTER TABLE usuario
MODIFY usu_foto VARCHAR(200);
