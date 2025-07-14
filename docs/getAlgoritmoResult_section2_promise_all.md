### Sección 2: Ejecución Concurrente de los Scores

Esta sección es el corazón del algoritmo. Su objetivo es calcular los 18 componentes de score de manera simultánea (concurrente) para maximizar la eficiencia y reducir el tiempo total de respuesta del endpoint. A continuación, se detalla el funcionamiento de cada una de las funciones invocadas dentro del `Promise.all`.

---

#### **1. `getPaisScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Determinar el score asociado al país de la empresa que está siendo certificada. El riesgo-país es un factor macroeconómico fundamental.

*   **Parámetros de Entrada:**
    *   `id_certification`: El ID de la certificación que se está procesando.
    *   `algoritmo_v`: Objeto que contiene la versión del algoritmo a utilizar (ej. `{ v_algoritmo: 1 }`).
    *   `parametrosAlgoritmo`: El objeto de configuración maestra cargado en la Sección 1.
    *   `customUuid`: El identificador único para logging.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función primero invoca a `certificationService.getPaisAlgoritmoByIdCertification(id_certification)`.
        *   **Acción de la Sub-llamada:** Esta función del servicio ejecuta una consulta SQL para obtener el nombre del país y su ID directamente de la certificación.
        *   **Tabla Consultada:** `certification`.
        *   **Campos Relevantes:** Se une (`LEFT JOIN`) la tabla `certification` con `cat_pais_algoritmo` usando el campo `certification.id_pais`.
        *   **Filtro:** `WHERE certification.id_certification = [id_certification]`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el `id_pais` y el `nombre` del país (ej. `{ id_pais: 1, nombre: 'México' }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el `id_pais` devuelto por el servicio.
        *   **Acción:** Busca dentro del objeto `parametrosAlgoritmo` la entrada correspondiente. Específicamente, busca en `parametrosAlgoritmo.paisScore` (que contiene los datos formateados de la tabla `cat_pais_algoritmo`).
        *   **Criterio de Búsqueda:** Encuentra el objeto en el array `paisScore` donde el campo `id` coincida con el `id_pais` obtenido de la base de datos.

    3.  **Selección de la Versión del Score:** Una vez que encuentra la fila de configuración del país, determina qué score utilizar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_algoritmo`.
        *   Si es `1`, toma el valor del campo `v1` del objeto de configuración encontrado.
        *   Si es `2`, toma el valor del campo `v2`.

    4.  **Construcción del Objeto de Retorno:** Finalmente, la función ensambla y devuelve un objeto con el resultado.
        *   **Objeto devuelto:** `{ nombre: [nombre del país], valor_algoritmo: [score seleccionado] }`.
        *   **Ejemplo:** `{ nombre: 'México', valor_algoritmo: 1.25 }`.

---

#### **2. `getSectorRiesgoScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Determinar el score asociado al sector industrial de la empresa. Diferentes industrias tienen diferentes niveles de riesgo inherente.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getSectorRiesgoByIdCertification(id_certification, algoritmo_v)`.
        *   **Acción de la Sub-llamada:** Esta función ejecuta una consulta para obtener el sector de riesgo asociado a la certificación.
        *   **Tabla Consultada:** `certification`.
        *   **Campos Relevantes:** Se une (`LEFT JOIN`) la tabla `certification` con `cat_sector_riesgo_sectorial_algoritmo` usando el campo `certification.id_cat_sector_riesgo_sectorial`.
        *   **Filtro:** `WHERE certification.id_certification = [id_certification]`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el `id` del sector de riesgo y su `nombre` (ej. `{ id: 3, nombre: 'Construcción' }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el `nombre` del sector devuelto por el servicio.
        *   **Acción:** Busca dentro de `parametrosAlgoritmo.sectorRiesgoScore` la entrada cuyo campo `nombre` coincida con el obtenido.

    3.  **Selección de la Versión del Score:** Una vez encontrada la configuración para ese sector, determina qué score utilizar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_algoritmo`.
        *   Si es `1`, toma el valor del campo `v1`.
        *   Si es `2`, toma el valor del campo `v2`.

    4.  **Construcción del Objeto de Retorno:** Ensambla y devuelve un objeto con el resultado.
        *   **Objeto devuelto:** `{ nombre: [nombre del sector], valor_algoritmo: [score seleccionado] }`.
        *   **Ejemplo:** `{ nombre: 'Construcción', valor_algoritmo: -0.5 }`.

---

#### **3. `getScoreCapitalContableFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar la solidez financiera de la empresa a través de su capital contable, que es la diferencia entre sus activos y pasivos. Un capital contable saludable indica una buena capacidad para absorber pérdidas.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.capitalContableEBPA(id_certification)`. "EBPA" probablemente significa "Estado de Balance Periodo Anterior".
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener el valor del capital contable del periodo anterior.
        *   **Tabla Consultada:** `certification_partidas_estado_balance`.
        *   **Filtro:** `WHERE id_certification = [id_certification] AND tipo = 'anterior'`.
        *   **Campo Requerido:** `capital_contable`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el valor numérico del capital (ej. `{ capital_contable: 5000000 }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el valor numérico de `capital_contable` devuelto.
        *   **Acción:** Itera sobre el array `parametrosAlgoritmo.capitalContableScore`.
        *   **Criterio de Búsqueda:** Busca la primera entrada donde el valor de `capital_contable` se encuentre **entre** los campos `limite_inferior` y `limite_superior` de la tabla de configuración `cat_capital_contable_algoritmo`.

    3.  **Selección de la Versión del Score:** Una vez que encuentra el rango correcto, determina qué score aplicar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_algoritmo`.
        *   Si es `1`, toma el valor del campo `v1`.
        *   Si es `2`, toma el valor del campo `v2`.

    4.  **Construcción del Objeto de Retorno:** Ensambla un objeto detallado.
        *   **Objeto devuelto:** `{ score, descripcion, limite_inferior, limite_superior, capital_contable_estado_balance_PA }`.
        *   **Ejemplo:** `{ score: 1.5, descripcion: 'Solvente', limite_inferior: 1000000, limite_superior: 10000000, capital_contable_estado_balance_PA: 5000000 }`.

---

#### **4. `getScorePlantillaLaboralFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar el tamaño de la empresa en función de su número de empleados. Se asume que empresas más grandes pueden tener una estructura más estable.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getPlantillaCertification(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta simple para obtener el número de empleados registrado en la certificación.
        *   **Tabla Consultada:** `certification`.
        *   **Filtro:** `WHERE id_certification = [id_certification]`.
        *   **Campo Requerido:** `plantilla_laboral`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el número de empleados (ej. `{ plantilla_laboral: 150 }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el valor numérico de `plantilla_laboral`.
        *   **Acción:** Itera sobre el array `parametrosAlgoritmo.plantillaLaboralScore`.
        *   **Criterio de Búsqueda:** Busca la primera entrada donde el valor de `plantilla_laboral` esté **entre** los campos `limite_inferior` y `limite_superior` de la tabla `cat_plantilla_laboral_algoritmo`.

    3.  **Selección de la Versión del Score:** Una vez que encuentra el rango de tamaño de empresa, determina el score.
        *   **Acción:** Revisa `algoritmo_v.v_algoritmo`.
        *   Si es `1`, toma el valor del campo `v1`.
        *   Si es `2`, toma el valor del campo `v2`.

    4.  **Construcción del Objeto de Retorno:** Ensambla y devuelve un objeto detallado.
        *   **Objeto devuelto:** `{ score, descripcion, limite_inferior, limite_superior, plantilla_laboral }`.
        *   **Ejemplo:** `{ score: 0.75, descripcion: 'Mediana Empresa', limite_inferior: 101, limite_superior: 250, plantilla_laboral: 150 }`.

---

#### **5. `getScoreClienteFinalFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Asignar un score basado en el tipo de cliente final al que sirve la empresa (ej. gobierno, empresa privada, consumidor final). Esto ayuda a medir el riesgo asociado al mercado de la empresa.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getScoreClienteFinal(id_certification, algoritmo_v)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta que une la certificación con el catálogo de sectores de clientes finales.
        *   **Tablas Consultadas:** `certification` y `cat_sector_clientes_finales_algoritmo`.
        *   **Filtro:** `WHERE certification.id_certification = [id_certification]`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el `nombre` del sector del cliente final (ej. `{ nombre: 'Gobierno' }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el `nombre` devuelto por el servicio.
        *   **Acción:** Busca dentro de `parametrosAlgoritmo.sectorClienteFinalScore` la entrada cuyo campo `nombre` coincida con el obtenido. (Nota: Existe una redundancia aquí, ya que el servicio podría devolver el score directamente, pero la lógica actual prefiere buscarlo en el objeto de parámetros en memoria).

    3.  **Selección de la Versión del Score:** Una vez encontrada la configuración para ese sector, determina el score a utilizar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    4.  **Construcción del Objeto de Retorno:** Ensambla y devuelve el resultado.
        *   **Objeto devuelto:** `{ nombre: [nombre del sector], valor_algoritmo: [score seleccionado] }`.
        *   **Ejemplo:** `{ nombre: 'Gobierno', valor_algoritmo: -0.25 }`.

---

#### **6. `getScoreTiempoActividadFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar la antigüedad de la empresa. Una mayor trayectoria en el mercado suele interpretarse como un signo de estabilidad.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getScoreTiempoActividad(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener la categoría de antigüedad comercial de la empresa.
        *   **Tablas Consultadas:** `certification` y `cat_tiempo_actividad_comercial_algoritmo`.
        *   **Filtro:** `WHERE certification.id_certification = [id_certification]`.
        *   **Resultado de la Sub-llamada:** Devuelve un objeto con el `nombre` de la categoría de antigüedad (ej. `{ nombre: 'Más de 10 años' }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el `nombre` devuelto por el servicio.
        *   **Acción:** Busca dentro de `parametrosAlgoritmo.tiempoActividadScore` la entrada cuyo campo `nombre` coincida.

    3.  **Selección de la Versión del Score:** Determina el score a utilizar basado en la versión del algoritmo.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    4.  **Construcción del Objeto de Retorno:** Ensambla y devuelve el resultado.
        *   **Objeto devuelto:** `{ nombre: [categoría de antigüedad], valor_algoritmo: [score seleccionado] }`.
        *   **Ejemplo:** `{ nombre: 'Más de 10 años', valor_algoritmo: 1.0 }`.

---

#### **7. `getControlanteScoreFromSummary(id_certification, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Realizar una debida diligencia (due diligence) sobre el accionista controlante de la empresa. Se busca identificar riesgos reputacionales, legales o financieros asociados a la entidad que tiene el control efectivo de la compañía certificada. Esta función es una de las más complejas, ya que orquesta múltiples consultas a servicios externos. No depende de la versión del algoritmo (v1 o v2).

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Identificar al Accionista Controlante:**
        *   **Acción:** Invoca a `certificationService.getAccionistas(id_certification)` para obtener la lista de todos los accionistas.
        *   **Tabla Consultada:** `certification_accionistas`.
        *   **Lógica:** Itera sobre la lista y encuentra el primer accionista cuyo campo `controlante` sea `1`. Si no encuentra ninguno, el proceso continúa asumiendo que el controlante es desconocido.

    2.  **Consultar Demandas (si aplica):**
        *   **Condición:** Solo se ejecuta si se encontró un accionista controlante con `razon_social`.
        *   **Acción:** Invoca a la función interna `obtenerDemandas(nombreEmpresaControlante)`.
        *   **Acción de la Sub-llamada:** Esta función a su vez:
            *   Obtiene la URL de un servicio externo desde la configuración `block_demandas`.
            *   Realiza una llamada `HTTP GET` a dicho servicio para buscar demandas asociadas al nombre del controlante.
            *   Registra la transacción (petición y respuesta) en la tabla `bloc_responses` para auditoría.
            *   Filtra las demandas para quedarse solo con las de tipo `mercantil` o `penal` del último año.
        *   **Resultado:** Un objeto con una lista de demandas.

    3.  **Analizar Demandas:**
        *   **Acción:** Procesa la lista de demandas obtenida.
        *   **Lógica:** Determina si existe al menos una demanda de tipo `penal` y si existen dos o más demandas de tipo `mercantil` en el último año.

    4.  **Consultar Listas de Riesgo (BLOC - si aplica):**
        *   **Condición:** Solo se ejecuta si se encontró un accionista controlante.
        *   **Acción:** Invoca a la función interna `consultaBlocEmpresaControlanteData(nombreEmpresaControlante)`.
        *   **Acción de la Sub-llamada:** Esta función invoca a `blocService.callAll`, que realiza 4 consultas concurrentes a servicios externos para verificar si el controlante aparece en listas de riesgo:
            *   `block_lista_sat_69B_presuntos_inexistentes`: Lista de empresas que facturan operaciones simuladas (EFOS).
            *   `bloc_ofac`: Listas de sancionados de la Oficina de Control de Activos Extranjeros de EE.UU.
            *   `bloc_consursos_mercantiles`: Registros de quiebras o concursos mercantiles.
            *   `bloc_provedores_contratistas`: Listas de proveedores y contratistas gubernamentales (potencialmente para buscar inhabilitaciones).

    5.  **Determinar la Regla de Puntuación:**
        *   **Acción:** Basado en los resultados de los pasos anteriores, se determina una "regla" (`regla`) de negocio.
        *   **Lógica de decisión:**
            *   Si **no se encontró** un accionista controlante, la `regla` será la que contenga la palabra `Desconocido`.
            *   Si el controlante **no tiene demandas relevantes Y no aparece en ninguna lista de BLOC**, la `regla` será la que contenga la palabra `Positivo`.
            *   Si el controlante **tiene alguna demanda relevante O aparece en cualquier lista de BLOC**, la `regla` será la que contenga las palabras `AES`, `BLOC` o `Demanda`.

    6.  **Obtener el Score Final:**
        *   **Acción:** Invoca a `certificationService.getInfluenciaControlanteScore(regla)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para buscar la regla determinada en el paso anterior.
        *   **Tabla Consultada:** `cat_influencia_controlante_score_algoritmo`.
        *   **Filtro:** `WHERE nombre = [regla]`.
        *   **Resultado:** Obtiene el `valor_algoritmo` final asociado a esa regla.

    7.  **Construcción del Objeto de Retorno:**
        *   **Objeto devuelto:** Un objeto complejo que resume todos los hallazgos, incluyendo el score final, el resumen de demandas y los datos de BLOC.

---

#### **8. `getScoreVentasAnualesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar el volumen de negocio de la empresa a través de sus ventas anuales declaradas en el periodo anterior. Mayores ventas pueden indicar una mayor consolidación en el mercado.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getVentasAnualesAnioAnterior(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener las ventas anuales del periodo anterior.
        *   **Tabla Consultada:** `certification_partidas_estado_resultados_contables`.
        *   **Filtro:** `WHERE id_certification = [id_certification] AND tipo = 'anterior'`.
        *   **Campo Requerido:** `ventas_anuales`.
        *   **Resultado:** Un objeto con el monto de las ventas (ej. `{ ventas_anuales: 12000000 }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el valor numérico de `ventas_anuales`.
        *   **Acción:** Itera sobre el array `parametrosAlgoritmo.ventasAnualesScore`.
        *   **Criterio de Búsqueda:** Busca la primera entrada donde el valor de `ventas_anuales` se encuentre **entre** los campos `limite_inferior` y `limite_superior` de la tabla de configuración `cat_ventas_anuales_algoritmo`. El `limite_superior` nulo se trata como infinito.

    3.  **Selección de la Versión del Score:** Una vez que encuentra el rango correcto, determina el score a aplicar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    4.  **Construcción del Objeto de Retorno:** Ensambla un objeto detallado con el resultado.
        *   **Objeto devuelto:** `{ score, descripcion, limite_inferior, limite_superior, ventas_anuales, periodo_anterior_estado_resultados }`.
        *   **Ejemplo:** `{ score: 1.0, descripcion: 'Ventas Altas', limite_inferior: 10000001, limite_superior: null, ventas_anuales: 12000000, periodo_anterior_estado_resultados: '2022' }`.

---

#### **9. `getScoreTipoCifrasFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Asignar un score basado en la naturaleza de los estados financieros presentados por la empresa. No es lo mismo presentar cifras auditadas por un tercero que cifras internas no verificadas.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtener el ID del Tipo de Cifra:**
        *   **Acción:** Invoca a `certificationService.getTipoCifra(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener el ID que representa el tipo de cifra.
        *   **Tabla Consultada:** `certification_partidas_estado_balance`.
        *   **Filtro:** `WHERE id_certification = [id_certification] AND tipo = 'anterior'`.
        *   **Campo Requerido:** `id_tipo_cifra`.
        *   **Resultado:** Un ID numérico (ej. `3`).

    2.  **Obtener el Nombre del Tipo de Cifra:**
        *   **Acción:** Invoca a `certificationService.getScoreTipoCifra(tipoCifraId)` con el ID del paso anterior.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para "traducir" el ID a un nombre descriptivo.
        *   **Tabla Consultada:** `cat_tipo_cifras_algoritmo`.
        *   **Filtro:** `WHERE id_cat_tipo_cifras = [tipoCifraId]`.
        *   **Resultado:** Un objeto con el nombre (ej. `{ nombre: 'Auditadas' }`).

    3.  **Búsqueda del Score en Parámetros:** La función toma el `nombre` devuelto por el segundo servicio.
        *   **Acción:** Busca dentro de `parametrosAlgoritmo.tipoCifrasScore` la entrada cuyo campo `nombre` coincida con el obtenido. (Nota: Se repite el patrón de redundancia, buscando en memoria información que ya se obtuvo de la base de datos).

    4.  **Selección de la Versión del Score:** Una vez encontrada la configuración, determina el score.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    5.  **Construcción del Objeto de Retorno:** Ensambla y devuelve el resultado.
        *   **Objeto devuelto:** `{ id_tipo_cifra, descripcion, score }`.
        *   **Ejemplo:** `{ id_tipo_cifra: 3, descripcion: 'Auditadas', score: 1.5 }`.

---

#### **10. `getScoreIncidenciasLegalesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Penalizar a la empresa si tiene un historial de problemas legales significativos. A diferencia del score del controlante, esta función revisa las demandas directamente asociadas a la empresa que solicita la certificación.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getDemandas(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener todas las demandas registradas para la certificación.
        *   **Tabla Consultada:** `certification_demandas`.
        *   **Filtro:** `WHERE id_certification = [id_certification]`.
        *   **Resultado:** Una lista de objetos, donde cada uno representa una demanda con su tipo y fecha.

    2.  **Analizar y Clasificar las Demandas:**
        *   **Acción:** La función itera sobre la lista de demandas para clasificarlas según reglas de negocio específicas.
        *   **Lógica:**
            *   Identifica si existe al menos una demanda de tipo `penal` (sin importar la fecha).
            *   Cuenta cuántas demandas de tipo `mercantil` han ocurrido en los últimos 365 días.

    3.  **Determinar el "Caso" de Negocio:**
        *   **Acción:** Basado en el análisis, se asigna una cadena de texto (`caso`) que resume la situación legal.
        *   **Lógica de Asignación (en orden de precedencia):**
            1.  Si hay una o más demandas penales: `caso = '>= 1 INCIDENCIA PENAL ( no importando el año)'`.
            2.  Si hay exactamente 1 demanda mercantil reciente: `caso = '1 INCIDENCIA MERCANTIL <= 1 AÑO'`.
            3.  Si hay 2 o más demandas mercantiles recientes: `caso = '2 INCIDENCIAS MERCANTILES <= 1 AÑO'`.
            4.  Si no se cumple ninguna de las anteriores: `caso = 'NINGUNA'`.

    4.  **Búsqueda del Score en Parámetros:**
        *   **Acción:** Utiliza la cadena `caso` para encontrar una coincidencia exacta en el array `parametrosAlgoritmo.incidenciasLegalesScore`.
        *   **Criterio de Búsqueda:** `i.nombre === caso`.

    5.  **Selección de la Versión del Score:** Una vez encontrada la regla, determina el score.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    6.  **Construcción del Objeto de Retorno:** Ensambla y devuelve un objeto con el resultado.
        *   **Objeto devuelto:** `{ score, tipo, fecha, caso }`.
        *   **Ejemplo:** `{ score: -2.0, tipo: 'penal', fecha: '2022-01-15', caso: '>= 1 INCIDENCIA PENAL ( no importando el año)' }`.

---

#### **11. `getScoreEvolucionVentasFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar la tendencia de crecimiento de la empresa comparando las ventas de los dos últimos años. Un crecimiento positivo es un buen indicador, mientras que un decrecimiento puede ser una señal de alerta.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca dos servicios en paralelo para obtener las ventas de los dos periodos más recientes.
        *   `certificationService.getVentasAnualesAnioAnterior(id_certification)`
        *   `certificationService.getVentasAnualesAnioPrevioAnterior(id_certification)`
        *   **Acción de las Sub-llamadas:** Ambas ejecutan una consulta para obtener las ventas anuales.
        *   **Tabla Consultada:** `certification_partidas_estado_resultados_contables`.
        *   **Filtro:** `WHERE id_certification = [id_certification]` y el `tipo` correspondiente (`'anterior'` o `'previo_anterior'`).
        *   **Resultado:** Dos valores numéricos para las ventas.

    2.  **Cálculo de la Evolución:**
        *   **Acción:** Calcula el cambio porcentual en las ventas.
        *   **Fórmula:** `evolucion = ((ventas_año_anterior - ventas_año_previo) / ventas_año_previo) * 100`.
        *   **Manejo de Errores:** Si el cálculo resulta en un valor no finito (ej. por división entre cero si las ventas del año previo fueron 0), la función retorna un objeto de error con un score de '0' y no continúa.

    3.  **Búsqueda del Score en Parámetros:**
        *   **Acción:** Itera sobre `parametrosAlgoritmo.evolucionVentasScore` para encontrar el rango en el que cae el porcentaje de `evolucion`.
        *   **Lógica Auxiliar:** Utiliza la función `getLimits` de `utils/numberUtils.js` para interpretar los rangos de cada entrada, que pueden estar definidos por los campos `limite_inferior` y `limite_superior` o por un campo de texto `rango` (ej. `'(-10, 10]'`).
        *   **Criterio de Búsqueda:** `evolucion >= limite_inferior && evolucion <= limite_superior`.

    4.  **Selección de la Versión del Score:** Una vez encontrado el rango, determina el score.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    5.  **Construcción del Objeto de Retorno:** Ensambla y devuelve un objeto detallado.
        *   **Objeto devuelto:** `{ score, nombre, rango_numerico, ventas_anuales_periodo_anterior_estado_resultados, ... }`.
        *   **Ejemplo:** `{ score: 0.5, nombre: 'Crecimiento Moderado', rango_numerico: '(0, 20]', evolucion_ventas: 15.5, ... }`.

---

#### **12. `getScoreApalancamientoFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Medir el nivel de endeudamiento de la empresa en relación con su patrimonio (capital). Un alto nivel de apalancamiento (mucha deuda en comparación con el capital) indica un mayor riesgo financiero.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtención de Datos Financieros:**
        *   **Acción:** Realiza múltiples llamadas en paralelo al `certificationService` para recopilar todas las partidas necesarias del estado de balance del periodo anterior.
        *   **Funciones Invocadas:** `getEstadoBalanceData`, `pasivoLargoPlazoPCA`, `capitalContablePCA`.
        *   **Tabla Consultada Principalmente:** `certification_partidas_estado_balance`.

    2.  **Cálculo de Pasivo y Capital Total:**
        *   **Acción:** La función agrega manualmente varias partidas de los objetos devueltos por los servicios para obtener una cifra total de "Pasivo" y "Capital" del periodo anterior.
        *   **Ejemplo de Pasivo:** `total_pasivo_circulante` + `pasivo_largo_plazo` + `pasivo_diferido`.
        *   **Ejemplo de Capital:** `capital_social` + `resultado_ejercicios` + `otro_capital`.

    3.  **Cálculo del Ratio de Apalancamiento:**
        *   **Fórmula:** `apalancamiento = Pasivo Total / Capital Total`.
        *   El resultado se redondea a un decimal.

    4.  **Lógica de Puntuación por Casos:** Esta es la parte más compleja. La función evalúa varios escenarios en un orden específico:
        *   **Caso 1: Sin Deuda y Sin Capital:** Si tanto el pasivo como el capital son cero, la función busca la peor calificación (el score más negativo) disponible en todo el catálogo `parametrosAlgoritmo.apalancamientoScore` y la aplica como una penalización.
        *   **Caso 2: Sin Capital:** Si solo el capital es cero, busca una regla específica en el catálogo cuyo nombre contenga "capital" y "no" y aplica ese score.
        *   **Caso 3: Sin Deuda:** Si solo la deuda es cero, busca una regla cuyo nombre contenga "deuda" y "no" y aplica ese score.
        *   **Caso 4: Normal:** Si tanto la deuda como el capital son reportados y el ratio de apalancamiento es un número válido, busca el rango en el catálogo (`limite_inferior`, `limite_superior`) donde encaja el ratio y aplica el score correspondiente.
        *   **Caso 5: Desconocido:** Si ninguno de los casos anteriores se cumple, se aplica un score por defecto de "Desconocido".

    5.  **Selección de la Versión del Score:** Para el caso que haya sido seleccionado, determina el score final.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    6.  **Construcción del Objeto de Retorno:** Ensambla y devuelve un objeto muy detallado.
        *   **Objeto devuelto:** `{ score, descripcion_apalancamiento, deuda_total_estado_balance_periodo_anterior, capital_contable_estado_balance, apalancamiento, operacion, ... }`.
        *   **Ejemplo:** `{ score: -1.0, descripcion_apalancamiento: 'Apalancamiento Alto', apalancamiento: 3.5, operacion: '3500000 / 1000000', ... }`.

---

#### **13. `getScoreCajaBancosFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar la liquidez de la empresa a través de su saldo en "Caja y Bancos". Un saldo saludable indica capacidad para cubrir obligaciones a corto plazo.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.cajaBancoPCA(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener el saldo de la cuenta "Caja y Bancos" del periodo anterior.
        *   **Tabla Consultada:** `certification_partidas_estado_balance`.
        *   **Filtro:** `WHERE id_certification = [id_certification] AND tipo = 'anterior'`.
        *   **Campo Requerido:** `caja_bancos`.
        *   **Resultado:** Un objeto con el monto (ej. `{ caja_bancos: 250000 }`).

    2.  **Búsqueda del Score en Parámetros:** La función toma el valor numérico de `caja_bancos`.
        *   **Acción:** Itera sobre el array `parametrosAlgoritmo.flujoNetoScore`.
        *   **Observación Importante:** Existe una discrepancia en los nombres. La función se llama `...CajaBancos...` y usa el campo `caja_bancos`, pero busca en el catálogo de `flujoNetoScore` (Score de Flujo Neto). Esto debe tenerse en cuenta ya que el score aplicado está basado en las reglas de Flujo Neto, no de Caja y Bancos.
        *   **Criterio de Búsqueda:** Utiliza la función `getLimits` para encontrar el rango (`limite_inferior`, `limite_superior`) donde encaja el valor de `caja_bancos`.

    3.  **Selección de la Versión del Score:** Una vez encontrado el rango, determina el score a aplicar.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   De lo contrario, toma el valor del campo `v1`.

    4.  **Construcción del Objeto de Retorno:** Ensambla un objeto con el resultado.
        *   **Objeto devuelto:** `{ descripcion, score, caja_bancos_periodo_anterior, limite_inferior, limite_superior }`.
        *   **Ejemplo:** `{ descripcion: 'Liquidez Adecuada', score: 0.8, caja_bancos_periodo_anterior: 250000, limite_inferior: 100000, limite_superior: 500000 }`.

---

#### **14. `getScorePaybackFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Calcular el "periodo de recuperación" (Payback), que mide cuánto tiempo (en años) le tomaría a la empresa pagar su deuda a corto plazo utilizando su utilidad operativa. Un payback más corto es mejor.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtención de Datos Financieros:**
        *   **Acción:** Realiza llamadas en paralelo al `certificationService` para obtener dos cifras clave del periodo anterior.
        *   **Funciones Invocadas:**
            *   `totalPasivoCirculanteAnterior(id)`: Obtiene el pasivo total a corto plazo de la tabla `certification_partidas_estado_balance`.
            *   `utilidadOperativa(id)`: Obtiene la utilidad operativa de la tabla `certification_partidas_estado_resultados_contables`.

    2.  **Cálculo del Ratio de Payback:**
        *   **Fórmula:** `payback = Pasivo Total a Corto Plazo / Utilidad Operativa`.
        *   El resultado indica el número de años para pagar la deuda.

    3.  **Lógica de Puntuación por Casos:**
        *   **Caso 1: Utilidad Cero:** Si la `utilidadOperativa` es exactamente cero, el payback no se puede calcular. El score se establece en `'N/A'` y no se evalúa nada más.
        *   **Caso 2: Sin Deuda Reportada:** Si no se encuentra un valor para el pasivo a corto plazo, se busca una regla en `parametrosAlgoritmo.paybackScore` cuyo nombre indique que el payback es "indefinido" y se aplica ese score.
        *   **Caso 3: Payback Negativo:** Si el `payback` calculado es negativo (porque la utilidad fue negativa), se busca una regla para "Payback Negativo" y se aplica ese score.
        *   **Caso 4: Payback Normal:** Si el `payback` es un número positivo, se busca el rango (`limite_inferior`, `limite_superior`) en el catálogo donde encaja el valor y se aplica el score correspondiente.

    4.  **Selección de la Versión del Score:** Para el caso aplicable, se determina el score final.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo`.
        *   Si es `2`, toma el valor del campo `v2`.
        *   Si es `1`, toma el valor del campo `v1`.
        *   Si el score fue sobreescrito a `'N/A'`, este valor tiene precedencia.

    5.  **Construcción del Objeto de Retorno:** Ensambla un objeto detallado con el resultado del cálculo.
        *   **Objeto devuelto:** `{ score, descripcion, deuda_corto_plazo_periodo_anterior, utilida_operativa, payback, operacion, ... }`.
        *   **Ejemplo:** `{ score: 1.2, descripcion: 'Payback Óptimo', payback: 0.8, operacion: '800000 / 1000000', ... }`.

---

#### **15. `getScoreRotacionCtasXCobrasScoreFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Medir la eficiencia operativa de la empresa a través de dos indicadores clave: los días de rotación de cuentas por cobrar (DSO) y los días de rotación de inventario (DIO). El objetivo es tomar el "mejor de dos mundos": se evalúan ambos indicadores, pero el score final es el más favorable de los dos, evitando un castigo doble.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtención de Datos Financieros:**
        *   **Acción:** Realiza cuatro llamadas en paralelo al `certificationService` para obtener todas las cifras necesarias del periodo anterior.
        *   **Funciones Invocadas:**
            *   `saldoClienteCuentaXCobrar(id)`: Saldo de cuentas por cobrar (`certification_partidas_estado_balance`).
            *   `ventasAnuales(id)`: Ventas anuales (`certification_partidas_estado_resultados_contables`).
            *   `saldoInventarios(id)`: Saldo de inventarios (`certification_partidas_estado_balance`).
            *   `costoVentasAnuales(id)`: Costo de ventas (`certification_partidas_estado_resultados_contables`).

    2.  **Cálculo de Indicadores (DSO y DIO):**
        *   **Fórmula DSO (Días Cuentas por Cobrar):** `(Saldo Cuentas por Cobrar / Ventas Anuales) * 360`. Mide el tiempo promedio para cobrar el dinero de los clientes.
        *   **Fórmula DIO (Días de Inventario):** `(Saldo Inventarios / Costo de Ventas) * 360`. Mide el tiempo promedio que el inventario permanece en almacén.
        *   **Manejo de Errores:** Si las ventas o el costo de ventas son cero, el indicador correspondiente no se calcula.

    3.  **Evaluación Independiente de DIO:**
        *   **Acción:** La función itera sobre todo el catálogo `parametrosAlgoritmo.rotacionCtasXCobrarScore`.
        *   Para cada regla del catálogo, comprueba si el valor de **DIO** cae dentro del rango (`limite_inferior`, `limite_superior`).
        *   Si un rango coincide, se guarda el score. Si múltiples rangos coinciden, se queda con el **mejor score (el más alto/positivo)**.

    4.  **Evaluación Independiente de DSO:**
        *   **Acción:** Repite el mismo proceso, pero esta vez con el valor de **DSO**.
        *   Busca en el mismo catálogo el rango que aplique para el DSO y se queda con el **mejor score posible** para ese indicador.

    5.  **Manejo de Datos Faltantes:**
        *   Si al final de la evaluación no se encontró un score para DIO o DSO (usualmente por datos insuficientes), se busca una regla específica en el catálogo para "no reportar saldo en clientes" o "no reportar saldo en inventarios".

    6.  **Selección del Score Final:**
        *   **Acción:** Compara el mejor score obtenido para DIO y el mejor score obtenido para DSO.
        *   **Lógica Principal:** `score final = Math.max(score_dio, score_dso)`.
        *   El score final de esta sección es el más favorable de los dos, recompensando a la empresa si es eficiente en al menos una de las dos áreas.

    7.  **Construcción del Objeto de Retorno:** Ensambla un objeto extremadamente detallado.
        *   **Objeto devuelto:** `{ score, scoreDio, scoreDso, descripcionDio, descripcionDso, dso, dio, explicacion, ... }`.
        *   **Ejemplo:** `{ score: 1.0, scoreDio: 0.5, scoreDso: 1.0, dso: 45, dio: 80, ... }`. El `score` final es `1.0` porque es el máximo entre `0.5` y `1.0`.

---

#### **16. `getScoreReferenciasComercialesFromSummary(id_certification, algoritmo_v, parametrosAlgoritmo, customUuid)`**

*   **Propósito General:** Evaluar la calidad de la empresa como cliente/deudor basándose en las opiniones de sus propios proveedores (referencias comerciales).

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Llamada al Servicio:** La función invoca a `certificationService.getReferenciasComercialesByIdCertificationScore(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta compleja que busca todas las referencias comerciales que han sido contestadas, son válidas y no han vencido.
        *   **Tablas Consultadas:** `certification_referencia_comercial` (principal), con `JOIN` a `domicilio`, `certification` y `certification_referencia_comercial_external_invitation`.
        *   **Filtros Clave:** `crc.contestada = 'si'`, `crc.referencia_valida = 'true'`, `crcei.estatus_referencia <> 'vencida'`.
        *   **¡ERROR POTENCIAL GRAVE!** La consulta **NO selecciona** el campo `calificacion_referencia` de la tabla `certification_referencia_comercial`.

    2.  **Conteo de Calificaciones:**
        *   **Acción:** La función intenta iterar sobre los resultados y contar cuántas referencias son "Buenas" (1), "Regulares" (2) o "Malas" (3) basándose en el campo `r.calificacion_referencia`.
        *   **Impacto del Error:** Como el campo no fue seleccionado en la consulta, `r.calificacion_referencia` es siempre `undefined`. Por lo tanto, los contadores `countBuena`, `countRegular` y `countMala` **siempre permanecen en 0**.

    3.  **Lógica de Puntuación (`if-else if`):**
        *   **Acción:** La función entra en una cadena de `if-else if` para decidir qué regla aplicar.
        *   **Comportamiento Real Debido al Error:**
            *   Si no se devuelve ninguna referencia, se aplica correctamente la regla para "NINGUNA" (ID 6).
            *   Si se devuelven una o más referencias, como todos los contadores son 0, la lógica salta todas las condiciones de `countBuena` y `countMala`, cayendo siempre en la cláusula final `else`, que asigna la regla para "Referencias Mixtas" (ID 5).
        *   **Conclusión del Error:** El sistema es incapaz de diferenciar entre referencias buenas, malas o regulares. Cualquier certificación con al menos una referencia contestada recibirá el score de "Mixtas".

    4.  **Selección de la Versión del Score:** Para la regla incorrectamente seleccionada ("Mixtas" o "Ninguna"), se determina el score.
        *   **Acción:** Revisa el valor de `algoritmo_v.v_alritmo` y selecciona `v1` o `v2`.

    5.  **Construcción del Objeto de Retorno:** Ensambla el objeto con el resultado.
        *   **Objeto devuelto:** `{ score, referencias_comerciales, descripcion, id_cat_resultado_referencias_proveedores }`.
        *   **Ejemplo:** `{ score: 0.2, referencias_comerciales: 3, descripcion: 'Referencias Mixtas', id_cat_resultado_referencias_proveedores: 5 }`.

---

#### **17. `getAlertaEndeudamientoComercial(id_certification, customUuid)`**

*   **Propósito General:** Esta no es una función de *score*, sino de *alerta*. Su objetivo es calcular un ratio de endeudamiento específico con proveedores para determinar si la empresa está sobre-apalancada con ellos en relación a su tamaño de operación (medido por su costo de ventas).

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtención de Datos Financieros:**
        *   **Acción:** Realiza tres llamadas en paralelo al `certificationService`.
        *   **Funciones Invocadas:**
            *   `getCostoVentasAnualesPPAAlert(id)`: Obtiene el costo de ventas del año "previo-anterior".
            *   `getCostoVentasAnualesPAAlert(id)`: Obtiene el costo de ventas del año "anterior".
            *   `getLineasCredito(id)`: Obtiene una lista de **todas** las líneas de crédito que la empresa tiene con sus proveedores, registradas en `certification_referencia_comercial`.

    2.  **Cálculo del Numerador:**
        *   **Acción:** Suma todas las líneas de crédito obtenidas para obtener un monto total de endeudamiento con proveedores.

    3.  **Cálculo del Denominador:**
        *   **Acción:** Calcula un promedio ponderado del costo de ventas de los últimos dos años.
        *   **Fórmula:** `(CostoVentas_AñoAnterior + (CostoVentas_AñoPrevioAnterior / 2)) / 3`.

    4.  **Cálculo del Ratio:**
        *   **Fórmula:** `Ratio = Numerador / Denominador`.
        *   El resultado es un indicador de la presión del endeudamiento con proveedores sobre la operación.

    5.  **Determinación de la Alerta:**
        *   **Caso 1: Ratio > 100:** Si el ratio supera el 100%, se considera un endeudamiento extremo. La función devuelve un objeto con el porcentaje fijado en 100 y una descripción de "Endeudamiento al límite".
        *   **Caso 2: Ratio <= 100:** Si el ratio es manejable, la función invoca a `certificationService.getRangoEndeudamiento(Ratio)`.
            *   **Acción de la Sub-llamada:** Esta función busca en la tabla `cat_endeudamiento_alertas` el rango en el que cae el ratio y devuelve una descripción textual (ej. "Endeudamiento Saludable").

    6.  **Construcción del Objeto de Retorno:** Ensambla un objeto con la alerta.
        *   **Objeto devuelto:** `{ porcentaje, descripcion, texto_reporte }`. No incluye un "score".
        *   **Ejemplo:** `{ porcentaje: 45.5, descripcion: 'Endeudamiento Moderado', texto_reporte: 'DE ACUERDO A NUESTRAS BASES...' }`.

---

#### **18. `getAlertaPromedioPlazoCredito(id_certification, customUuid)`**

*   **Propósito General:** Al igual que la anterior, esta es una función de *alerta*, no de score. Su objetivo es calcular el plazo de crédito promedio (en días) que la empresa recibe de sus proveedores.

*   **Lógica de Ejecución (Paso a Paso):**
    1.  **Obtención de Datos:**
        *   **Acción:** Invoca a `certificationService.getPlazoCredito(id_certification)`.
        *   **Acción de la Sub-llamada:** Ejecuta una consulta para obtener una lista de todos los plazos de crédito (`plazo`) registrados para la empresa.
        *   **Tabla Consultada:** `certification_referencia_comercial`.
        *   **Filtro:** `WHERE id_certification = [id_certification]`.

    2.  **Cálculo del Promedio:**
        *   **Acción:** La función itera sobre la lista de plazos obtenidos.
        *   Suma todos los valores numéricos válidos y los divide por el número de entradas válidas para obtener un promedio simple.

    3.  **Construcción del Objeto de Retorno:** Ensambla un objeto con el resultado del promedio.
        *   **Objeto devuelto:** `{ dias, texto_reporte }`. No incluye un "score".
        *   `dias` contiene el promedio calculado.
        *   `texto_reporte` contiene una cadena de texto fija que se usará en el reporte final, la cual incluye una recomendación de no exceder ese plazo promedio por más de 7 días.
        *   **Ejemplo:** `{ dias: 35.5, texto_reporte: 'DE ACUERDO A NUESTRAS BASES DE INFORMACIÓN...' }`.

--- 