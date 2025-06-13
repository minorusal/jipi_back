'use strict'

const express = require('express')
const router = express.Router()
const processrequestCtrl = require('../../controllers/legacy/processrequest')

router.get('/processrequests', getProcess)
router.post('/processrequest-add', AddProcessRequest)

function getProcess (req, res) {
  processrequestCtrl.getProcess()
    .then(function (result) {
      res.json(result)
    })
}

function AddProcessRequest (req, res, next) {
  const d = req.body
  processrequestCtrl.AddProcessRequest(d, next)
    .then(function (result) {
      res.json(result)
    })
}

//
module.exports = router
