### Sección 1: Configuración Inicial, Validación y Carga de Parámetros

Esta sección es responsable de preparar todo el entorno necesario para la ejecución del algoritmo. Valida los datos de entrada, obtiene la certificación correcta y carga las configuraciones maestras que gobernarán el resto del proceso.

*   **Línea por línea:**
    1.  `const getAlgoritmoResult = async (req, res, next) => {`
        *   **Qué hace:** Define la función principal como asíncrona, lo que permite el uso de `await` para manejar operaciones que no se resuelven de inmediato (como las consultas a la base de datos).
    2.  `const fileMethod = ...`
        *   **Qué hace:** Define una constante de texto para ser usada en los logs. Ayuda a identificar rápidamente el origen de un mensaje de log cuando se revisan los archivos.
    3.  `const { id_cliente, ... } = body`
        *   **Qué hace:** Extrae las variables necesarias del cuerpo (`body`) de la solicitud HTTP. Estas son las entradas primarias para el proceso.
    4.  `if (!id_cliente || ...)`
        *   **Qué hace:** Realiza una validación crítica. Si alguna de las variables esenciales no viene en la solicitud, detiene la ejecución inmediatamente y retorna un error `400 Bad Request`, indicando que la solicitud del cliente está incompleta.
    5.  **`const id_certification = await certificationService.getLastIdCertification(id_cliente)`**
        *   **Propósito General:** Obtener el ID de la certificación creada más recientemente para un cliente específico, sin importar su estado.
        *   **Implementación Detallada (Código Fuente del Proyecto):** La lógica exacta, proporcionada para máxima precisión, se encuentra en `src/services/certification.js` y es la siguiente:

            ```javascript
            // file: src/services/certification.js
            async getLastIdCertification(id_cliente) {
                const queryString = `
                SELECT
                  c.id_certification
                FROM certification AS c
                WHERE c.id_empresa = ${id_cliente}
                ORDER BY
                c.id_certification DESC
                LIMIT 1;
                `
                try {
                  // ... (ejecución de query y manejo de resultado)
                  if (result.length > 0 && result[0]) {
                    return result[0].id_certification
                  }
                  return null
                } catch (error) {
                  // ... (manejo de error)
                }
            }
            ```
        *   **Desglose de la Lógica (SQL):** La consulta SQL ejecutada realiza las siguientes acciones:
            *   `FROM certification AS c`: La tabla objetivo es `certification`.
            *   `WHERE c.id_empresa = ${id_cliente}`: Filtra los registros para que coincidan con el ID del cliente proporcionado.
            *   `ORDER BY c.id_certification DESC`: Asumiendo que `id_certification` es autoincremental, esto ordena los resultados para que el más reciente aparezca primero.
            *   `LIMIT 1`: Selecciona únicamente el primer registro del resultado ordenado (es decir, el último ID creado).
        *   **Observación Funcional Importante:** A diferencia de otras lógicas, esta función **no valida el estado** de la certificación (por ejemplo, si es válida o si ha sido cancelada). Simplemente recupera la última que se creó.
        *   **Manejo de Resultados:**
            *   **Caso Exitoso:** Si se encuentra un registro, la función devuelve el `id_certification`.
            *   **Caso de Falla:** Si no se encuentra ninguna certificación para ese `id_empresa`, devuelve `null`.
    6.  `const customUuid = new Date().toISOString()...`
        *   **Qué hace:** Crea un Identificador Único Universal (UUID) basado en la fecha y hora actual. Este `customUuid` se adjuntará a todos los logs de esta ejecución específica, permitiendo rastrear y agrupar todos los pasos de una sola solicitud, lo cual es invaluable para la depuración.
    7.  `if (!id_certification) { ... }`
        *   **Qué hace:** Valida el resultado del paso 5. Si no se encontró ninguna certificación para el cliente, no se puede continuar. Se registra una advertencia (`logger.warn`) y se retorna un error `400 Bad Request`.
    8.  **`const parametrosAlgoritmo = await algorithmService.getGeneralSummary()`**
        *   **Propósito General:** Cargar en memoria la configuración maestra que contiene todas las tablas de puntuación para las 16 variables del algoritmo. Este objeto, `parametrosAlgoritmo`, es una pieza de información vital que se pasa como "libro de reglas" a casi todas las funciones de cálculo de score.

        *   **Desglose Funcional Línea por Línea (Método `getGeneralSummary`):**

            1.  **Revisión de Caché:** La función primero comprueba si ya tiene una copia de los parámetros guardada en una variable local (`cachedGeneralSummary`) y si esa copia tiene menos de 5 minutos de antigüedad. Si ambas condiciones son verdaderas, devuelve la copia local inmediatamente para optimizar el rendimiento y no consultar la base de datos.

            2.  **Consulta a la Base de Datos (`getAllAlgorithmRanges`):** Si no hay un caché válido, la lógica procede a llamar a la función `getAllAlgorithmRanges` del `certificationService`. Esta función es la responsable de obtener los datos crudos.
                *   **Acción:** Construye y ejecuta 18 consultas `SELECT * FROM [nombre_de_tabla]` de forma concurrente, una para cada una de las siguientes tablas de catálogo:
                    *   `cat_pais_algoritmo`
                    *   `cat_sector_riesgo_sectorial_algoritmo`
                    *   `cat_sector_clientes_finales_algoritmo`
                    *   `cat_tiempo_actividad_comercial_algoritmo`
                    *   `cat_plantilla_laboral_algoritmo`
                    *   `cat_ventas_anuales_algoritmo`
                    *   `cat_apalancamiento_algoritmo`
                    *   `cat_flujo_neto_caja_algoritmo`
                    *   `cat_capital_contable_algoritmo`
                    *   `cat_incidencias_legales_algoritmo`
                    *   `cat_influencia_controlante_algoritmo`
                    *   `cat_influencia_controlante`
                    *   `cat_resultado_referencias_proveedores_algoritmo`
                    *   `cat_payback_algoritmo`
                    *   `cat_rotacion_cuentas_cobrar_algoritmo`
                    *   `cat_tipo_cifras_algoritmo`
                    *   `cat_evolucion_ventas_algoritmo`
                    *   `cat_score_descripcion_algoritmo`
                *   **Resultado:** Esta función devuelve un objeto grande donde cada clave es el nombre de una de las tablas anteriores y su valor es un array de objetos, correspondiendo cada objeto a una fila de esa tabla.

            3.  **Mapeo y Formateo de Datos (`mapTable`):** De vuelta en `getGeneralSummary`, la función itera sobre los resultados de cada tabla y los transforma. Para cada fila obtenida de la base de datos, crea un nuevo objeto estandarizado.
                *   **Acción:** Lee los campos de la fila de la base de datos y los asigna a un nuevo objeto con nombres de clave consistentes.
                *   El campo `nombre` o `descripcion` de la tabla se mapea a una nueva clave llamada `nombre`.
                *   El campo `valor_algoritmo` se mapea a una nueva clave llamada `v1`.
                *   El campo `valor_algoritmo_v2` (si existe) se mapea a una nueva clave llamada `v2`. Si no existe, `v2` toma el valor de `valor_algoritmo`.
                *   El campo de ID de la tabla (ej. `id_pais_algoritmo`) se mapea a una nueva clave llamada `id`.
                *   Los campos `limite_inferior` y `limite_superior` se copian directamente si existen.

            4.  **Construcción del Objeto Final (`summary`):** Se crea el objeto final que se devolverá.
                *   **Acción:** Se define un objeto con claves predefinidas (ej. `paisScore`, `sectorRiesgoScore`, etc.). A cada una de estas claves se le asigna el array de objetos ya formateados del paso anterior, correspondiente a su tabla. Por ejemplo, la clave `paisScore` contendrá los datos procesados de la tabla `cat_pais_algoritmo`.

            5.  **Actualización del Caché:** Antes de devolver el resultado, el objeto `summary` recién construido se almacena en la variable local `cachedGeneralSummary` y se registra la hora actual.

            6.  **Retorno:** La función devuelve el objeto `summary` completo.
    9.  `const algoritmo_v = await obtienePartidasFinancieras(id_certification, customUuid)`
        *   **Qué hace:** Llama a la función `obtienePartidasFinancieras` para realizar la validación de integridad de los datos financieros. Como resultado, esta función retorna un objeto `{ v_alritmo: X }` (donde X es 1 o 2), determinando cuál de las dos versiones del algoritmo se usará. Esta es la segunda pieza de información crítica.
    10. `if (!id_certification || ...)`
        *   **Qué hace:** Realiza una segunda validación para asegurarse de que todas las variables críticas, incluyendo `algoritmo_v`, están definidas antes de proceder con el cálculo principal. 