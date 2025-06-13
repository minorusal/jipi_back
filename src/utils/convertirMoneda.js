'use strict'

// Básicamente esto se utilizó una vez para unos detalles de cotizaciones para
// Tener todos los precios en dólares

const moneyExchangeService = require('../services/moneyExchange')

const calcularTotal = async (productos) => {
  const query = {
    symbols: 'MXN',
    base: 'USD'
  }
  const moneda = await moneyExchangeService.latest(query)

  const productosDolares = productos.filter(p => p.moneda_id === 2)
  const productosPesos = productos.filter(p => p.moneda_id !== 2)

  // Convertir a dolares los productos de pesos
  const productosPrecioConvertido = productosPesos.map(p => {
    const nuevoProducto = { ...p }
    nuevoProducto.precio = p.precio / moneda.rates.MXN
    return nuevoProducto
  })

  // Agregar los productos
  const todosProductosDolares = [...productosDolares, ...productosPrecioConvertido]

  const total = todosProductosDolares.reduce((cv, p) => {
    return cv + (p.cantidad * p.precio)
  }, 0)

  return { total, moneda }
}

module.exports = calcularTotal
