'use strict'

const boom = require('boom')
const boletinajeService = require('../../services/boletinaje')
const Boom = require('@hapi/boom')

// No se usa una clase, se exportan las funciones directamente
// para mantener la consistencia con otros controladores como companies.js y auth.js

const getPreguntas = async (req, res, next) => {
  try {
    const preguntas = await boletinajeService.getPreguntas()
    res.status(200).json({ data: preguntas })
  } catch (error) {
    next(boom.internal(error))
  }
}

const guardarCuestionario = async (req, res, next) => {
  try {
    const { body: data } = req
    const resultado = await boletinajeService.guardarCuestionario(data)
    res.status(201).json({ data: resultado })
  } catch (error) {
    next(boom.internal(error))
  }
}

const guardarReporteImpago = async (req, res, next) => {
  try {
    const { body: data } = req
    const reporteGuardado = await boletinajeService.guardarReporteImpago(data)
    res.status(201).json({ data: reporteGuardado })
  } catch (error) {
    next(boom.internal(error))
  }
}

const updateReporteImpago = async (req, res, next) => {
  try {
    const { id } = req.params
    const { body: data } = req
    const reporteActualizado = await boletinajeService.updateReporteImpago(id, data)
    res.status(200).json({ data: reporteActualizado })
  } catch (error) {
    next(error)
  }
}

const guardarNotificacionSinImpago = async (req, res, next) => {
  try {
    const { body: data } = req
    const notificacionGuardada = await boletinajeService.guardarNotificacionSinImpago(data)
    res.status(201).json({
      data: notificacionGuardada,
      message: 'Notificación sin impago guardada exitosamente.',
    })
  } catch (error) {
    next(boom.internal(error))
  }
}

const getReporteImpagoById = async (req, res, next) => {
  try {
    const { id } = req.params
    const reporte = await boletinajeService.getReporteImpagoById(id)
    res.status(200).json({ data: reporte })
  } catch (error) {
    next(error)
  }
}

const getMisReportes = async (req, res, next) => {
  try {
    const { id_empresa } = req.user;
    const { page, limit } = req.query;

    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      id_empresa,
      tipo_busqueda: 'proveedor'
    };

    const result = await boletinajeService.getReportesImpagoList(options);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

const getReportesSobreMi = async (req, res, next) => {
  try {
    const { id_empresa } = req.user;
    const { page, limit } = req.query;

    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      id_empresa,
      tipo_busqueda: 'cliente'
    };

    const result = await boletinajeService.getReportesImpagoList(options);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPreguntas,
  guardarCuestionario,
  guardarReporteImpago,
  updateReporteImpago,
  guardarNotificacionSinImpago,
  getReporteImpagoById,
  getMisReportes,
  getReportesSobreMi
}