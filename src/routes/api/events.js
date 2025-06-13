'use strict'

const express = require('express')
const { createInvitation, editInvitation, deleteInvitation, createGroup, editGroup, editGroupMembers, adOrRemoveFavorite } = require('../../utils/schemas/events')
const validation = require('../../utils/middlewares/validationHandler')
const multerGuardar = require('../../utils/multer')
const eventsController = require('../../controllers/api/events')
const authMiddleware = require('../../utils/middlewares/authMiddleware')
const router = express.Router()

// TODO: Delete events

router.get('/', authMiddleware, eventsController.getEvents)
router.post('/', authMiddleware, multerGuardar('imagen'), eventsController.createEvent)
router.get('/:eventoID', authMiddleware, eventsController.getEventDetails)
router.put('/:eventoID', authMiddleware, multerGuardar('imagen'), eventsController.editEvent)
router.delete('/:eventID', authMiddleware, eventsController.deleteEvent)
router.post('/:eventoID/invitations', authMiddleware, validation(createInvitation), eventsController.createInvitation)
router.post('/:eventoID/favorite', authMiddleware, validation(adOrRemoveFavorite), eventsController.addOrRemoveFavorite)
router.delete('/:eventoID/schedules/:scheduleID', authMiddleware, eventsController.removeSchedule)
router.put('/:eventoID/invitations/:usuarioID', authMiddleware, validation(editInvitation), eventsController.editInvitation)
router.delete('/:eventoID/invitations/:usuarioID', authMiddleware, validation(deleteInvitation), eventsController.deleteInvitation)
router.post('/groups', authMiddleware, validation(createGroup), eventsController.createGroup)
router.get('/groups/company/:empresaID', authMiddleware, eventsController.getCompanyGroups)
router.delete('/groups/:groupID', authMiddleware, eventsController.deleteGroup)
router.put('/groups/:groupID', authMiddleware, validation(editGroup), eventsController.editGroup)
router.put('/groups/:groupID/members', authMiddleware, validation(editGroupMembers), eventsController.editGroupMembers)

module.exports = router
