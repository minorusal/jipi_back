// routes/api_arcsa_v2/portal.js

const express = require('express');
const router = express.Router();

router.post('/nueva-ruta', (req, res) => {
  const { title, content } = req.body;
  res.json({ success: true, message: 'nueva ruta a api', data: { title, content } });
});

module.exports = router;
