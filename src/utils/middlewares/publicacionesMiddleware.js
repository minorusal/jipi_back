const cipher = require('../cipherService')
const { globalAuth: { keyCipher } } = require('../../config')
const multer = require('multer')
const path = require('path')

const storage = multer.memoryStorage()

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif']
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg']

        if (file.fieldname === 'galeria' && !allowedImageTypes.includes(file.mimetype)) {
            return cb(new Error('Solo se permiten imágenes (jpeg, png, gif)'))
        }
        
        if (file.fieldname === 'video' && !allowedVideoTypes.includes(file.mimetype)) {
            return cb(new Error('Solo se permiten videos (mp4, webm, ogg)'))
        }

        if (file.fieldname === 'imagen' && !allowedImageTypes.includes(file.mimetype)) {
            return cb(new Error('Solo se permite una imagen para la propiedad "imagen" (jpeg, png, gif)'))
        }

        cb(null, true)
    }
}).fields([
    { name: 'galeria', maxCount: 20 },
    { name: 'video', maxCount: 1 },
    { name: 'imagen', maxCount: 1 }
])

const handleDataField = async (req, res, next) => {
    const data = req.body.data
    if (!data) {
        return res.status(400).json({ error: true, message: "'data' es un campo requerido." })
    }

    const decryptedData = await cipher.decryptData(data, keyCipher)
    req.decryptedData = decryptedData

    let galeria = req.files?.galeria || req.body.galeria || []

    if (typeof galeria === 'string' && galeria.trim().startsWith('[') && galeria.trim().endsWith(']')) {
        try {
            galeria = JSON.parse(galeria.replace(/'/g, '"'))
        } catch (e) {
            console.error("Error al convertir 'galeria' desde body:", e)
            galeria = []
        }
    }

    req.galeria = Array.isArray(galeria) ? galeria : [galeria]

    const video = req.files?.video ? req.files.video[0] : req.body.video || ''
    req.video = video

    const imagen = req.files?.imagen ? req.files.imagen[0] : req.body.imagen || ''
    req.imagen = imagen

    next()
}

const handleImageGaleriaPublicacion = async (req, res, next) => {
    const imagen = req.files?.imagen ? req.files.imagen[0] : req.body.imagen || ''
    req.imagen = imagen

    next()
}



module.exports = { upload, handleDataField, handleImageGaleriaPublicacion }
