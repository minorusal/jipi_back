const express = require('express')
const router = express.Router()
const IndustriaCtrl = require('../../controllers/legacy/industria')

router.get('/industrias/:idioma', getIndustrias)
router.get('/industria/:industria_id', getIndustriaByID)
router.post('/industria-add', AddIndustria)
router.post('/industria-update', UpdateIndustria)

function getIndustrias (req, res) {
  const idioma = req.params.idioma
  IndustriaCtrl.getIndustrias({ idioma: idioma })
    .then(function (result) {
      res.json(result)
    })
}

function getIndustriaByID (req, res) {
  const industria_id = require.params.industria_id
  IndustriaCtrl.getIndustriaByID({ industria_id: industria_id })
    .then(function (result) {
      res.json(result)
    })
}

function AddIndustria (req, res) {
  const industria = req.body
  IndustriaCtrl.AddIndustria(industria)
    .then(function (result) {
      res.json(result)
    })
}

function UpdateIndustria (req, res) {
  const industria = req.body
  IndustriaCtrl.UpdateIndustria(industria)
    .then(function (result) {
      res.json(result)
    })
}
module.exports = router
