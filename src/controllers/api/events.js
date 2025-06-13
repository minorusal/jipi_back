'use strict'

const boom = require('boom')
const debug = require('debug')('old-api:events-router')
const moment = require('moment')
const uuid = require('uuid-base62')
const { email } = require('../../config')
const sendgrid = require('../../lib/sendgrid')
const eventsService = require('../../services/events')
const userService = require('../../services/users')
const companiesService = require('../../services/companies')
const { regexHorario } = require('../../utils/regex')
const { createEvent: createEventSchema, editEvent: editEventSchema } = require('../../utils/schemas/events')
const uploadImageS3 = require('../../utils/uploadImageS3')
const { newEventTemplate, eventInvitationTemplate } = require('../../utils/templates/emails')

const getEvents = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    let { number, page, user } = query

    number = number ? Math.abs(number) : 10
    page = page ? Math.abs(page) : 1
    user = user ? Math.abs(user) : null

    if (isNaN(number) || isNaN(page)) return next(boom.badRequest('Bad query'))

    const eventosPublicos = await eventsService.getEvents(page, number)
    if (eventosPublicos.length !== 0) {
      for (let i = 0; i < eventosPublicos.length; i++) {
        const eventoID = eventosPublicos[i].evento_id
        // Obtener detalles de host usuario
        const hosts = {}
        const [hostUsuario] = await userService.getById(eventosPublicos[i].host_usuario)
        hosts.usuario = hostUsuario
        // Obtener detalles de host empresa
        const [hostEmpresa] = await companiesService.getEmpresa(eventosPublicos[i].host_empresa)
        hosts.empresa = hostEmpresa
        eventosPublicos[i].hosts = hosts
        // Obtener lista de invitados
        const usuariosInvitados = await eventsService.getInvitations(eventoID)
        // Filtrarlos
        const asistir = 3
        const asistiran = usuariosInvitados.filter(u => u.tipo === asistir)
        eventosPublicos[i].asistiran = asistiran.length
        // Obtener fotos
        let fotos = []
        const fotosEvento = await eventsService.getPhotos(eventoID)
        fotos = [...fotosEvento]
        eventosPublicos[i].fotos = fotos
        // Obtener horarios
        let horarios = []
        const horariosEvento = await eventsService.getSchedule(eventoID)
        horarios = [...horariosEvento]
        eventosPublicos[i].horarios = horarios
        const [primerHorario] = horarios
        const { fecha: horarioFecha } = primerHorario
        eventosPublicos[i].horario_principal = horarioFecha
        // Checar si es un evento guardado en favoritos
        eventosPublicos[i].favorito = false
        if (user) {
          const [esFavorito] = await eventsService.checkIfIsFavorite(eventoID, user)
          if (esFavorito) eventosPublicos[i].favorito = true
        }
      }
    }
    const dateNow = moment().format('YYYY-MM-DD')
    const eventosProximos = eventosPublicos.filter(e => {
      const { horario_principal: schedule } = e
      if (moment(schedule).isAfter(dateNow)) return e
    })

    return res.json({
      error: false,
      results: eventosProximos
    })
  } catch (err) {
    next(err)
  }
}

const createEvent = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req
    const { usuario, horarios: horariosRaw } = body

    let horarios = null
    if (!Array.isArray(horariosRaw)) {
      horarios = JSON.parse(horariosRaw)
    } else {
      horarios = horariosRaw
    }
    body.horarios = horarios

    const { error: schemaError } = createEventSchema.validate(body)
    if (schemaError) return next(boom.badRequest(schemaError))

    const fechaActual = moment().format('YYYY-MM-DD')

    // Obtener ID de empresa
    const [datosEmpresa] = await userService.getEmpresaByUserId(usuario)
    if (!datosEmpresa) return next(boom.badRequest(`No existe el usuario ${usuario}`))
    const { emp_id: empresaId } = datosEmpresa

    // Revisar cada uno de los objetos de horarios
    for (let i = 0; i < Object.keys(horarios).length; i++) {
      const { fecha, apertura, cierre } = horarios[i]
      // ¿Los horarios de apertura y cierre son válidos?
      // Si alguno es inválido 400
      await regexHorario(apertura).catch(error => next(boom.badRequest(error)))
      await regexHorario(cierre).catch(error => next(boom.badRequest(error)))
      // La fecha es futura?
      // Si es fecha pasado 400
      if (!moment(fecha).isAfter(fechaActual)) return next(boom.badRequest(`Ya pasó la fecha: ${fecha}`))
    }
    let eventoId = null
    // Agregar el uuid al horario
    const horariosCompletos = horarios.map(h => {
      h.uuid = uuid.v4()
      return h
    })
    const { file } = req
    if (file) {
      const Location = await uploadImageS3.uploadImageS3(file)
      body.imagen = Location
      const { insertId } = await eventsService.createEvent(body, empresaId)
      eventoId = insertId
      // Crear horarios usando el ID del evento
      await eventsService.createSchedule(eventoId, horariosCompletos)

      // Obtener detalles del evento creado
      const [evento] = await eventsService.getEvent(eventoId)

      const horariosEvento = await eventsService.getSchedule(eventoId)
      evento.horarios = horariosEvento

      const [userDetails] = await userService.getById(usuario)
      const { usu_nombre: userName, usu_email: userEmail } = userDetails

      const msg = {
        to: `${userName} <${userEmail}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Creación de evento en Market Choice B2B',
        text: 'Has creado un evento dentro de Market Choice B2B',
        html: newEventTemplate(userName, body.nombre)
      }
      await sendgrid(msg)

      return res.json({
        error: false,
        results: evento
      })
    } else {
      body.imagen = null
      const { insertId } = await eventsService.createEvent(body, empresaId)
      eventoId = insertId
      // Crear horarios usando el ID del evento
      await eventsService.createSchedule(eventoId, horariosCompletos)

      // Obtener detalles del evento creado
      const [evento] = await eventsService.getEvent(eventoId)

      const horariosEvento = await eventsService.getSchedule(eventoId)
      evento.horarios = horariosEvento

      const [userDetails] = await userService.getById(usuario)
      const { usu_nombre: userName, usu_email: userEmail } = userDetails

      const msg = {
        to: `${userName} <${userEmail}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Creación de evento en Market Choice B2B',
        text: 'Has creado un evento dentro de Market Choice B2B',
        html: newEventTemplate(userName, body.nombre)
      }
      await sendgrid(msg)

      return res.json({
        error: false,
        results: evento
      })
    }
  } catch (err) {
    next(err)
  }
}

const getEventDetails = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params, query } = req
    const { eventoID } = params
    let { user } = query

    user = user ? Math.abs(user) : null

    const [evento] = await eventsService.getEvent(eventoID)
    if (!evento) return next(boom.badRequest('Event does not exist'))

    // Obtener detalles de host usuario

    const hosts = {}

    const [hostUsuario] = await userService.getById(evento.host_usuario)
    hosts.usuario = hostUsuario

    // Obtener detalles de host empresa
    const [hostEmpresa] = await companiesService.getEmpresa(evento.host_empresa)
    hosts.empresa = hostEmpresa

    evento.hosts = hosts

    // Obtener lista de invitados
    const usuariosInvitados = await eventsService.getInvitations(eventoID)

    // Filtrarlos
    const [invitado, interesado, asistir] = [1, 2, 3]
    const noConfirmados = usuariosInvitados.filter(u => u.tipo === invitado)
    const interesados = usuariosInvitados.filter(u => u.tipo === interesado)
    const asistiran = usuariosInvitados.filter(u => u.tipo === asistir)

    const invitados = {
      total: usuariosInvitados.length,
      no_confirmados: {
        total: noConfirmados.length,
        usuarios: noConfirmados
      },
      interesados: {
        total: interesados.length,
        usuarios: interesados
      },
      asistiran: {
        total: asistiran.length,
        usuarios: asistiran
      }
    }

    evento.invitados = invitados

    // Obtener fotos
    let fotos = []
    const fotosEvento = await eventsService.getPhotos(eventoID)
    fotos = [...fotosEvento]
    evento.fotos = fotos

    let horarios = []
    const horariosEvento = await eventsService.getSchedule(eventoID)
    horarios = [...horariosEvento]
    evento.horarios = horarios

    evento.favorito = false
    if (user) {
      const [esFavorito] = await eventsService.checkIfIsFavorite(eventoID, user)
      if (esFavorito) evento.favorito = true
    }

    return res.json({
      error: false,
      results: evento
    })
  } catch (err) {
    next(err)
  }
}

const editEvent = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { usuario, horarios: horariosRaw } = body
    const { eventoID } = params

    let horarios = null
    if (!Array.isArray(horariosRaw)) {
      horarios = JSON.parse(horariosRaw)
    } else {
      horarios = horariosRaw
    }

    body.horarios = horarios

    const { error: errorSchema } = editEventSchema.validate(body)
    if (errorSchema) return next(boom.badRequest(errorSchema))

    const fechaActual = moment().format('YYYY-MM-DD')

    // ¿Existe evento?
    const [existeEvento] = await eventsService.getEvent(eventoID)
    // No existe 400
    if (!existeEvento) return next(boom.badRequest(`No existe el evento ${eventoID}`))

    // Obtener ID de empresa
    const [datosEmpresa] = await userService.getEmpresaByUserId(usuario)
    if (!datosEmpresa) return next(boom.badRequest(`No existe el usuario ${usuario}`))
    const { emp_id: empresaId } = datosEmpresa

    // ¿El evento es de esta empresa?
    // No lo es 400
    if (existeEvento.host_empresa !== empresaId) return next(boom.badRequest('No cuentas con los permisos necesarios'))

    // Revisar cada uno de los objetos de horarios
    for (let i = 0; i < Object.keys(horarios).length; i++) {
      const { fecha, apertura, cierre } = horarios[i]
      // ¿Los horarios de apertura y cierre son válidos?
      // Si alguno es inválido 400
      await regexHorario(apertura).catch(error => next(boom.badRequest(error)))
      await regexHorario(cierre).catch(error => next(boom.badRequest(error)))
      // La fecha es futura?
      // Si es fecha pasado 400
      if (!moment(fecha).isAfter(fechaActual)) return next(boom.badRequest(`Ya pasó la fecha: ${fecha}`))
    }

    const { file } = req
    if (file) {
      const Location = await uploadImageS3.uploadImageS3(file)
      body.imagen = Location
      const { affectedRows: eventoEditado } = await eventsService.editEvent(body, eventoID)
      if (eventoEditado !== 1) return next(boom.badRequest('No fue posible editar el evento'))
      // Editar los horarios
      for (let i = 0; i < Object.keys(horarios).length; i++) {
        if (horarios[i].id) {
          await eventsService.editSchedule(horarios[i])
        } else {
          horarios[i].uuid = uuid.v4()
          await eventsService.createSchedule(eventoID, [horarios[i]])
        }
      }

      // Obtener los detalles del evento
      const [evento] = await eventsService.getEvent(eventoID)
      evento.horarios = await eventsService.getSchedule(eventoID)

      return res.json({
        error: false,
        results: evento
      })
    } else {
      const { affectedRows: eventoEditado } = await eventsService.editEvent(body, eventoID)
      if (eventoEditado !== 1) return next(boom.badRequest('No fue posible editar el evento'))

      // Editar los horarios
      for (let i = 0; i < Object.keys(horarios).length; i++) {
        if (horarios[i].id) {
          await eventsService.editSchedule(horarios[i])
        } else {
          horarios[i].uuid = uuid.v4()
          await eventsService.createSchedule(eventoID, [horarios[i]])
        }
      }

      // Obtener los detalles del evento
      const [evento] = await eventsService.getEvent(eventoID)
      evento.horarios = await eventsService.getSchedule(eventoID)

      return res.json({
        error: false,
        results: evento
      })
    }
  } catch (err) {
    next(err)
  }
}

const deleteEvent = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    let { body: { user: userID, company: companyID }, params: { eventID } } = req
    eventID = Math.abs(eventID) || null
    if (!eventID) return next(boom.badRequest('Wrong event'))

    const [event] = await eventsService.getEvent(eventID)
    if (!event) return next(boom.badRequest('Event does not exist.'))
    if (event.host_usuario !== userID) return next(boom.badRequest(`User:${userID} does not match with host user.`))
    if (event.host_empresa !== companyID) return next(boom.badRequest(`Company:${companyID} does not match with host company.`))

    const deleted = await eventsService.deleteEvent(eventID, userID, companyID)

    return res.json({
      error: false,
      results: {
        deleted
      }
    })
  } catch (err) {
    next(err)
  }
}

const createInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { invitaciones } = body
    const { eventoID } = params

    // Existe evento?
    const [existeEvento] = await eventsService.getEvent(eventoID)
    if (!existeEvento) return next(boom.badRequest('No existe el evento'))

    // Obtener usuarios que sí existen??
    const usuariosExistentes = await userService.getUsersIds(invitaciones)
    const usuarios = usuariosExistentes.map(u => u.id)
    if (usuarios.length === 0) return next(boom.badRequest('Ninguna persona por invitar'))

    const usuariosYaInvitados = await eventsService.getUsersAlreadyInvited(eventoID, usuarios)
    const yaInvitados = usuariosYaInvitados.map(u => u.id)

    const porInvitar = usuarios.filter(u => yaInvitados.indexOf(u) < 0)
    if (porInvitar.length === 0) return next(boom.badRequest('Ninguna persona por invitar'))

    // ¿La capacidad del evento permite que sean invitados?
    const { capacidad } = existeEvento
    if (capacidad < (yaInvitados.length + porInvitar.length)) return next(boom.badRequest(`Alcanzaste el límite de invitaciones para este evento (${capacidad})`))

    // Insertar usuarios
    const { affectedRows: usuariosInvitados } = await eventsService.createInvitations(eventoID, porInvitar)

    // Enviar correo electronico de invitaciones
    const { fecha, apertura } = await eventsService.getFirstSchedule(eventoID)
    for (let i = 0; i < porInvitar.length; i++) {
      const [userDetails] = await userService.getById(porInvitar[i])
      const { usu_nombre: userName, usu_email: userEmail } = userDetails

      const msg = {
        to: `${userName} <${userEmail}>`,
        from: `${email.sender.name} <${email.sender.email}>`,
        replyTo: `${email.sender.email}`,
        subject: 'Invitación a evento',
        text: 'Has sido invitado a un evento dentro de Market Choice B2B',
        html: eventInvitationTemplate(userName, fecha, apertura)
      }
      await sendgrid(msg)
    }

    return res.json({
      error: false,
      results: {
        total: usuariosInvitados,
        mensaje: `Se enviaron ${usuariosInvitados} invitaciones`
      }
    })
  } catch (err) {
    next(err)
  }
}

const addOrRemoveFavorite = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { usuario: usuarioID } = body
    let { eventoID } = params
    eventoID = Number(eventoID)

    // Existe evento
    const [evento] = await eventsService.getEvent(eventoID)
    if (!evento) return next(boom.badRequest('No existe el evento'))
    // Obtener tipo de evento
    const privado = 2
    const { privacidad: tipoEvento } = evento

    // ¿Existe usuario?
    const [usuario] = await userService.getAllDataById(usuarioID)
    if (!usuario) return next(boom.badRequest('No existe usuario'))

    // ¿El evento es privado?
    if (tipoEvento === privado) {
      // ¿El usuario fue invitado al evento?
      const [fueInvitado] = await eventsService.getIsUserInvitedToPrivateEvent(usuarioID, eventoID)
      // Si no fue invitado 400
      if (!fueInvitado) return next(boom.badRequest('Usuario no invitado'))
    }

    // Revisar si el usuario ya había marcado como favorito el evento
    const [esFavorito] = await eventsService.getFavoriteStatusByUser(usuarioID, eventoID)

    let added = null
    let removed = null

    if (!esFavorito) {
      // ¿No existe registro de favorito? Marcar como favorito
      await eventsService.createFavoriteStatusByUser(usuarioID, eventoID)
      added = true
      removed = false
    } else {
      // ¿Ya existe registro de favorito? Quitar como favorito
      await eventsService.removeFavoriteStatusByUser(usuarioID, eventoID)
      added = false
      removed = true
    }

    return res.json({
      error: false,
      results: {
        added,
        removed
      }
    })
  } catch (err) {
    next(err)
  }
}

const removeSchedule = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { eventoID, scheduleID } = params

    // Existe evento?
    const [existeEvento] = await eventsService.getEvent(eventoID)
    if (!existeEvento) return next(boom.badRequest('No existe el evento'))

    // Obtener horarios
    // Si sólo queda un horario a eliminar 400
    // No puede haber eventos sin horario
    const horarios = await eventsService.getSchedule(eventoID)
    if (horarios.length === 1) return next(boom.badRequest('Un evento debe tener por lo menos un horario'))

    // Eliminar horario
    const { affectedRows: horarioEliminado } = await eventsService.deleteSchedule(scheduleID, eventoID)

    if (horarioEliminado === 0) return next(boom.badRequest('No se pudo eliminar el horario'))

    return res.json({
      error: false,
      results: {
        total: horarioEliminado,
        mensaje: 'Horario eliminado'
      }
    })
  } catch (err) {
    next(err)
  }
}

const editInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body: { tipo }, params: { eventoID, usuarioID } } = req
    // Existe evento?
    const [existeEvento] = await eventsService.getEvent(eventoID)
    if (!existeEvento) return next(boom.badRequest('No existe el evento'))
    const { privacidad } = existeEvento
    if (privacidad === 1) {
      // El evento es publico
      // Revisar asistencia previa
      const previa = await eventsService.checkPreviousInvitation(eventoID, usuarioID)
      if (!previa) {
        // No hay invitacion previa, crearla
        const cambios = await eventsService.assistPublicEvent(tipo, eventoID, usuarioID)
        if (!cambios) return next(boom.badRequest('Error al editar asistencia'))
        return res.json({
          error: false,
          results: {
            total: 1,
            message: `Se cambió el tipo de invitación para el usuario ${usuarioID}`
          }
        })
      } else {
        // Hay invitacion previa, se tiene que editar
        const edicion = await eventsService.editPreviousInvitation(tipo, eventoID, usuarioID)
        return res.json({
          error: false,
          results: {
            total: 1,
            message: `Se cambió el tipo de invitación para el usuario ${usuarioID}`
          }
        })
      }
    } else {
      // El evento es privado
      // Cambiar tipo de invitación
      const { affectedRows: cambios } = await eventsService.editInvitation(tipo, eventoID, usuarioID)
      if (cambios === 0) return next(boom.badRequest('Este usuario no se encuntra en el evento'))
      return res.json({
        error: false,
        results: {
          total: cambios,
          message: `Se cambió el tipo de invitación para el usuario ${usuarioID}`
        }
      })
    }
  } catch (err) {
    next(err)
  }
}

const deleteInvitation = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req
    const { empresa } = body
    const { eventoID, usuarioID } = params

    // Existe evento?
    const [existeEvento] = await eventsService.getEvent(eventoID)
    if (!existeEvento) return next(boom.badRequest('No existe el evento'))

    // Evento es de la empresa?
    if (existeEvento.host_empresa != empresa) return next(boom.badRequest('El evento no pertenece a empresa'))

    // Eliminar invitacion
    const { affectedRows: eliminadas } = await eventsService.deleteInvitation(eventoID, usuarioID)

    if (eliminadas === 0) return next(boom.badRequest('Este usuario no se encuntra en el evento'))

    return res.json({
      error: false,
      results: {
        total: eliminadas,
        message: `Se eliminó la invitación para el usuario ${usuarioID}`
      }
    })
  } catch (err) {
    next(err)
  }
}

const createGroup = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body } = req

    // ¿Existe la empresa?
    const { empresa_id: empresaID } = body
    const [empresa] = await companiesService.getEmpresa(empresaID)
    if (!empresa) return next(boom.badRequest('No existe la empresa'))

    // ¿La empresa ya cuenta con un grupo con este nombre?
    const { nombre } = body
    const [existeGrupo] = await eventsService.getGroupByName(empresaID, nombre)
    if (existeGrupo) return next(boom.badRequest('Ya existe un grupo con este nombre'))

    // Crear uuid
    const uuidGenerado = `${uuid.v4()}${uuid.v4()}`

    // Crear grupo
    const { affectedRows: grupoCreado } = await eventsService.createGroup(uuidGenerado, body)
    if (grupoCreado !== 1) return next(boom.badRequest('No fue posible crear el grupo'))

    // Insertar miembros de grupo
    const { miembros } = body
    const usuarios = [...new Set(miembros)]
    const usuariosExistentesRaw = await userService.getUsersIds(usuarios)
    const usuariosExistentes = usuariosExistentesRaw.map(u => u.id)
    if (usuariosExistentes.length != 0) {
      await eventsService.createGroupMembers(uuidGenerado, usuariosExistentes)
    }

    return res.json({
      error: false,
      results: {
        uuid: uuidGenerado,
        ...body,
        miembros: usuariosExistentes
      }
    })
  } catch (err) {
    next(err)
  }
}

const getCompanyGroups = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req
    const { empresaID } = params

    const grupos = await eventsService.getGroupsByCompany(empresaID)
    const total = grupos.length
    if (total !== 0) {
      // Obtener usuarios y fotos
      for (let i = 0; i < total; i++) {
        const uuid = grupos[i].grupo_uuid
        const usuarios = await eventsService.getGroupMembers(uuid, empresaID)
        grupos[i].miembros = {
          total: usuarios.length,
          usuarios
        }
      }
    }

    return res.json({
      error: false,
      results: {
        total,
        grupos
      }
    })
  } catch (err) {
    next(err)
  }
}

const deleteGroup = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { params } = req

    // ¿Existe el grupo?
    const { groupID } = params
    const [existeGrupo] = await eventsService.getGroupByID(groupID)
    if (!existeGrupo) return next(boom.badRequest('No existe el grupo'))

    // Eliminar el evento
    const { affectedRows: grupoEliminado } = await eventsService.deleteGroup(groupID)
    if (grupoEliminado === 0) return next(boom.badRequest('No fue posible eliminar el grupo'))

    // Eliminar referencias de miembros del grupo
    const { affectedRows: miembrosEliminados } = await eventsService.deleteGroupMembers(groupID)

    return res.json({
      error: false,
      results: {
        deleted: true,
        uuid: groupID,
        members: miembrosEliminados
      }
    })
  } catch (err) {
    next(err)
  }
}

const editGroup = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req

    // ¿Existe el grupo?
    const { groupID } = params
    const [existeGrupo] = await eventsService.getGroupByID(groupID)
    if (!existeGrupo) return next(boom.badRequest('No existe el grupo'))

    // Editar el evento
    const { affectedRows: grupoEditado } = await eventsService.editGroup(groupID, body)
    if (grupoEditado === 0) return next(boom.badRequest('No fue posible editar el grupo'))

    return res.json({
      error: false,
      results: {
        edited: true
      }
    })
  } catch (err) {
    next(err)
  }
}

const editGroupMembers = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { body, params } = req

    // ¿Existe el grupo?
    const { groupID } = params
    const [existeGrupo] = await eventsService.getGroupByID(groupID)
    if (!existeGrupo) return next(boom.badRequest('No existe el grupo'))

    // Insertar miembros de grupo
    const { agregados } = body
    let usuarios = [...new Set(agregados)]
    const usuariosExistentesRaw = await userService.getUsersIds(usuarios)
    const usuariosExistentes = usuariosExistentesRaw.map(u => u.id)
    const usuariosYaAgregadosRaw = await eventsService.getGroupMembersAlready(groupID, usuariosExistentes)
    const usuariosYaAgregados = usuariosYaAgregadosRaw.map(u => u.id)
    const usuariosPorAgregar = usuariosExistentes.filter(u => !usuariosYaAgregados.includes(u))
    let totalAgregados = 0
    if (usuariosPorAgregar.length != 0) {
      const { affectedRows: total } = await eventsService.createGroupMembers(groupID, usuariosPorAgregar)
      totalAgregados = total
    }

    // Eliminar miembros de grupo
    const { eliminados } = body
    usuarios = [...new Set(eliminados)]
    let totalEliminados = 0
    if (usuarios.length !== 0) {
      const { affectedRows: totalEliminadosRaw } = await eventsService.deleteGroupMembersByID(groupID, usuarios)
      totalEliminados = totalEliminadosRaw
    }

    return res.json({
      error: false,
      results: {
        deleted: totalEliminados,
        added: totalAgregados
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  getEvents,
  createEvent,
  getEventDetails,
  editEvent,
  deleteEvent,
  createInvitation,
  addOrRemoveFavorite,
  removeSchedule,
  editInvitation,
  deleteInvitation,
  createGroup,
  getCompanyGroups,
  deleteGroup,
  editGroup,
  editGroupMembers
}
