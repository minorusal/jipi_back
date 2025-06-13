'use strict'

const debug = require('debug')('old-api:suggestions-router')
const boom = require('boom')
const userService = require('../../services/users')
const supportService = require('../../services/support')
const { createSuggestion, createProblem } = require('../../utils/schemas/support')
const uploadImageS3 = require('../../utils/uploadImageS3')

const createSuggestions = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {

    const { user, suggestion, cover } = req.body;
    const [userExists] = await userService.getAllDataById(user)
    if (!userExists) return next(boom.notFound('User not found'))

    if (cover) {
      const pathBucket = 'suggestionImg';
      const Location = await uploadImageS3.uploadImage2(cover, pathBucket)
      await supportService.createSuggestion(user, suggestion, Location)
    } else {
      await supportService.createSuggestion(user, suggestion, null)
    }

    res.status(201).json({
      error: false,
      results: {
        created: true
      }
    })
  } catch (err) {
    next(err)
  }
}

const createProblems = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { user, problem, cover } = req.body;
    const [userExists] = await userService.getAllDataById(user)
    if (!userExists) return next(boom.notFound('User not found'))

    if (cover) {
      const pathBucket = 'problemImg';
      const Location = await uploadImageS3.uploadImage2(cover, pathBucket)
      await supportService.createProblem(user, problem, Location)
    } else {
      await supportService.createProblem(user, problem, null)
    }

    res.status(201).json({
      error: false,
      results: {
        created: true
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createSuggestions,
  createProblems
}
