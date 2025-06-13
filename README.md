# MC-API

REST API of Market Choice

Así que llegaste a la API de MC.

Creo que tengo que ponerte en el contexto.

El proyecto fue mandado a hacer con una consultora externa, consultura que realizó un trabajo "peculiar", por no decir otra cosa. Se tomaron algunas decisiones administrativas de no reescribir el código de la empresa ni mejorarlo, sino trabajar con lo que ya se tenía y sobre la marcha ir "terminando la aplicación". Esta aplicación fue creciendo conforme las necesidades y solicitudes de arriba.

Desafortunadamente el legacy code de la consultora nos dejó con la base de la REST API y muchas de las funcionalidades que hasta ese momento se tenían en las aplicaciones. Esta base de la REST API era en su momento todo el proceso de registro de empresas y usuarios, de alta de productos, alta de eventos, certificación de empresas, etc.

Se tuvo que trabajar con lo que se tenía sin hacer modificaciones que afectaran a las aplicaciones móviles, lo que resultó en no poder incluir un proceso de autenticación para los endpoints como JWT...

Después de un tiempo el modelo de negocio cambió, lo que nos permitió el poder rehacer el proceso de registro de una empresa y de usuarios. Para este nuevo proceso no pudimos cambiar el método de inicio de sesión, por lo que continuamos sin JWT...

Durante meses se mantuvo una rama para eliminar código fuente de la consultora, se eliminaron más de 6000 líneas de código para poder reducir la deuda técnica, pero no es suficiente.

Lo más preocupante y el punto a atacar sobre el legacy code es desaparecer por completo lo hecho por la consultora, ya que **casi toda** la REST API está declarada en un solo endpoint llamado `process-request`.

Este endpoint recibe por body un objeto como este:

```json
{
  "palabra": "lkasjdlkasjdlkasjdklsjasljsal"
}
```

Donde `palabra` es una cadena de texto cifrada del lado de las aplicaciones. Se descifra del lado del servidor y nos deja un arreglo como el siguiente:

```javascript
[1, 2, 3, 'Producto']
```

Donde la posición 0 del arreglo es la instrucción a ejecutar y el resto de son los datos que necesita la instrucción para ser ejecutada. Por poner un ejemplo:

```javascript
if (palabraDescifrada[0] == 214) {
  var nombreproducto = palabraDescifrada[1]
  var precio = palabraDescifrada[2]
  var promocion = palabraDescifrada[3]
  crearProducto(nombreproducto, precio, promocion).then(result => {
    return res.json("Todo bien")
  }).catch(error => {
    return res.json("Todo mal")
  })
}
```

Como puedes notar utilizan `var` en lugar de `const` o `let` , `then` y `catch` en lugar de `async` y `await`. Y todas las respuestas HTTP de la API son de estatus 200, ya que es el estatus default de express... Esto sin importar si hubo algún error, siempre regresa un 200

Además de que esta función de `process-request` originalmente ocupaba más de 8000 líneas de código. Prácticamente aquí se encontraban todas las funciones de la API.

Todo el legacy code de la consultora es de este estilo. Lo mejor que se puede hacer es ir reemplazando estas funcionalidades y eliminar las originales por completo del proyecto. Esto claro modificando las aplicaciones móviles para que tengan las funcionalidades y no pierdan compatibilidad.

La estructura del proyecto es la siguiente:

| Directorio/Archivo | Info |
|---|---|
| app.js | Aquí está declarado el servidor de express y se utilizan las rutas y los middlewares de express como `cors` |
| config | Módulo para poder cargar las variables de entorno utilizando un archivo .env y el paquete de dotenv |
| controllers | Aquí se define la lógica de los endpoints de la API, estas funciones consultan los servicios para poder acceder a la base de datos |
| lib | Implementaciones de bibliotecas y paquetes tales como AWS, MySQL, etc. |
| media | La API originalmente guardaba las imágenes de productos y empresas dentro de este directorio, actualmente sólo contiene un archivo JSON utilizado por iOS para poder mostrar textos en sus botones y formularios... Esto porque la aplicación de iOS también tiene sus defectos a su manera gracias a la consultora. Es importante conservarlo en lo que iOS deja de utiliar este archivo. |
| models | Las consultas SQL realizadas por la consultora |
| modules | Realiza las consultar SQL de la consultora |
| routes | Endpoint de la REST API agrupados por ruta base, una mezcla entre consultora y MC, algunos endpoints también implemntan su controlador dentro del mismo archivo de routes, basta con crear un archivo dentro de controllers y exportar las funciones para usarlas en las rutas, como debería de hacerse normalmente. |
| services | Consultas SQL realizadas en MC, cada servicio es una clase |
| utils | Funciones de utilidad, middlewares, varias implementaciones de multer, compresión de imágenes, subir archivos a AWS, etc. Se trata de que estas funciones fueran funciones puras (Programación funcional). |
| utils/schemas | Aquí se encuentran los esquemas de joi, estos esquemas se validad principalmente en los middlewares de las rutas para validar los datos que los usuarios envían. Estos schemas son, obviamente, para los endpoints "nuevos", es decir, los hechos en Arcsa. Hay algunos que por alguna razón muy particular se ejecuten dentro del controlador, pero no hay mayor problema por eso. |

Este proyecto utiliza [standard](https://standardjs.com/) como guía de estilo.

Existen plugins para diferentes editores de texto [que puedes encontrar en su sitio](https://standardjs.com/#install). Yo particularmente utilicé [Ale](https://github.com/dense-analysis/ale), pero existen alternativas para VSCode o similares. Es importante que el estilo del código esté unificado y seguir guías de estilo bien definidas.

Se utiliza el paquete de boom para los mensajes de error de http, favor de seguir con este patrón para seguir teniendo la api con un mismo diseño, donde

Errores:

```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Wrong user"
}
```

Respuestas de exito

```json
{
    "error": false,
    "results": {
        "foo": "bar",
        "bar": "foo"
    }
}
```

Mucho éxito. Espero puedas reparar todas las deficiencias y no dejes que la deuda ténica te coma.
