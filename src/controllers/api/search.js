'use strict'

const boom = require('boom')
const debug = require('debug')('old-api:search-controller')
const companiesService = require('../../services/companies')
const productService = require('../../services/products')
const searchService = require('../../services/search')
const statisticService = require('../../services/statistics')
const userService = require('../../services/users')
const directoryService = require('../../services/directory')
const paginacion = require('../../utils/paginacion')

const buscador = async (req, res, next) => {
  try {
    const { toSearch } = req.query
    const { page = 1, pageSize = 10, user } = req.query
    if (!toSearch) return next(boom.badRequest('Search parameter must not be empty.'))

    let productos = []
    let usuarios = []
    let productos_by_empresa
    let usuarios_by_empresa
    const empresas = await companiesService.getEmpresasGeneral(toSearch, page, pageSize)
    if (empresas.length > 0) {
      for (let i in empresas) {
        const { emp_id } = empresas[i]
        productos_by_empresa = await companiesService.getProductosByEmpresaId(emp_id, toSearch, page, pageSize)
        usuarios_by_empresa = await companiesService.getUsuariosByEmpresaId(emp_id, toSearch, page, pageSize)

        for (let j in productos_by_empresa) {
          productos.push(productos_by_empresa[j])
        }

        for (let j in usuarios_by_empresa) {
          usuarios.push(usuarios_by_empresa[j])
        }
      }
    }

    const productosPorEmpresa = productos.reduce((map, producto) => {
      if (!map[producto.emp_id]) {
        map[producto.emp_id] = []
      }
      map[producto.emp_id].push({
        prod_nombre: producto.prod_nombre,
        prod_desc: producto.prod_desc
      })
      return map
    }, {})

    const usuariosPorEmpresa = usuarios.reduce((map, usuario) => {
      if (!map[usuario.emp_id]) {
        map[usuario.emp_id] = []
      }
      map[usuario.emp_id].push({
        usu_nombre: usuario.usu_nombre,
        usu_app: usuario.usu_app,
        usu_puesto: usuario.usu_puesto,
        usu_email: usuario.usu_email
      });
      return map
    }, {});

    const resultado = []

    empresas.forEach(empresa => {
      const productosDeEmpresa = productosPorEmpresa[empresa.emp_id] || []
      const usuariosDeEmpresa = usuariosPorEmpresa[empresa.emp_id] || []

      if (productosDeEmpresa.length > 0 || usuariosDeEmpresa.length > 0) {
        productosDeEmpresa.forEach(producto => {
          resultado.push({
            emp_razon_social: empresa.emp_razon_social || "",
            denominacion: empresa.denominacion || "",
            prod_nombre: producto.prod_nombre || "",
            prod_desc: producto.prod_desc || "",
            usu_nombre: "",
            usu_app: "",
            usu_puesto: "",
            usu_email: ""
          })
        })
        usuariosDeEmpresa.forEach(usuario => {
          resultado.push({
            emp_razon_social: empresa.emp_razon_social || "",
            denominacion: empresa.denominacion || "",
            prod_nombre: "",
            prod_desc: "",
            usu_nombre: usuario.usu_nombre || "",
            usu_app: usuario.usu_app || "",
            usu_puesto: usuario.usu_puesto || "",
            usu_email: usuario.usu_email || ""
          })
        })
      } else {
        resultado.push({
          emp_razon_social: empresa.emp_razon_social || "",
          denominacion: empresa.denominacion || "",
          prod_nombre: "",
          prod_desc: "",
          usu_nombre: "",
          usu_app: "",
          usu_puesto: "",
          usu_email: ""
        })
      }
    })

    return res.json({
      error: false,
      resultado
    })
  } catch (err) {
    next(err)
  }
}

const globalSearch = async (req, res, next) => {
  try {

    // const { toSearch } = req.query
    // const { page = 1, pageSize = 10 } = req.query
    // if (!toSearch) return next(boom.badRequest('Search parameter must not be empty.'))

    // let productos = []
    // let usuarios = []
    // let productos_by_empresa
    // let usuarios_by_empresa
    // const empresas = await companiesService.getEmpresasGeneral(toSearch, page, pageSize)
    // if (empresas.length > 0) {
    //   for (let i in empresas) {
    //     const { emp_id } = empresas[i]
    //     productos_by_empresa = await companiesService.getProductosByEmpresaId(emp_id, toSearch, page, pageSize)
    //     usuarios_by_empresa = await companiesService.getUsuariosByEmpresaId(emp_id, toSearch, page, pageSize)

    //     for (let j in productos_by_empresa) {
    //       productos.push(productos_by_empresa[j])
    //     }

    //     for (let j in usuarios_by_empresa) {
    //       usuarios.push(usuarios_by_empresa[j])
    //     }
    //   }
    // }

    // productos_by_empresa = await companiesService.getProductosGeneralSearch(toSearch, page, pageSize)
    // usuarios_by_empresa = await companiesService.getUsuariosByGeneralSearch(toSearch, page, pageSize)

    // for (let j in productos_by_empresa) {
    //   productos.push(productos_by_empresa[j])
    // }

    // for (let j in usuarios_by_empresa) {
    //   usuarios.push(usuarios_by_empresa[j])
    // }

    // return res.json({
      // error: false,
      // empresas,
      // productos,
      // usuarios
      // paginacion: {
      //   directory: {
      //     totalRegistros: totalDirectory,
      //     totalPaginas: Math.ceil(totalDirectory / limit)
      //   },
      //   productos: {
      //     totalRegistros: totalProductos,
      //     totalPaginas: Math.ceil(totalProductos / limit)
      //   },
      //   empresas: {
      //     totalRegistros: totalEmpresas,
      //     totalPaginas: Math.ceil(totalEmpresas / limit)
      //   },
      //   eventos: {
      //     totalRegistros: totalEventos,
      //     totalPaginas: Math.ceil(totalEventos / limit)
      //   },
      //   usuarios: {
      //     totalRegistros: totalUsuarios,
      //     totalPaginas: Math.ceil(totalUsuarios / limit)
      //   }

      // },
      // results: {
      //   directory: searchType === 'directory' ? directory : null,
      //   productos: searchType === 'productos' ? productos : null,
      //   empresas: searchType === 'empresas' ? empresas : null,
      //   usuarios: searchType === 'usuarios' ? usuarios : null,
      //   eventos: searchType === 'eventos' ? eventos : null

      // }
    // })
    //******************** */

    const { query: { text, q: searchType } } = req
    let { query: { user, page, limit } } = req
    user = Math.abs(user) || null

    if (!text) return next(boom.badRequest('Search parameter must not be empty.'))
    if (!searchType) return next(boom.badRequest('Query needed.'))
    if (!['directory', 'productos', 'empresas', 'usuarios', 'eventos'].find(el => el === searchType)) return next(boom.badRequest('Bad query.'))
    if (!page) page = 1
    if (!limit) limit = 10

    await searchService.insertSearchHistory(text, user)

    const taxIds = (await companiesService.getAllTaxIds()).reduce((acc, curr) => {
      acc.push(curr.emp_rfc)
      return acc
    }, [])
    const { directory, totalDirectory } = await directoryService.searchDirectory(text, taxIds, { page, limit })
    const { productos, totalProductos } = await productService.search(text, { page, limit })
    const { empresas, totalEmpresas } = await searchService.getEmpresas(text, user, { page, limit })
    const eventosPublicos = await searchService.getEventos(text, user)
    const eventosPrivados = await searchService.getEventosPrivados(text, user)

    const [empresaUsuarioActual] = await userService.getEmpresaByUserId(user)

    if (user && !empresaUsuarioActual) return next(boom.badRequest('User does not exist'))

    const usuariosUnfilterd = await searchService.getUsuarios(text, user)
    const usuariosRaw = user ? usuariosUnfilterd.filter(usuario => empresaUsuarioActual.emp_id !== usuario.emp_id) : usuariosUnfilterd

    for (let i = 0; i < productos.length; i++) {
      const prodID = productos[i].prod_id
      const isFavorite = await productService.isThisProductMyFavorite(prodID, user)
      if (isFavorite.length !== 0) {
        productos[i].mi_favorito = true
      } else {
        productos[i].mi_favorito = false
      }
      const empresaID = productos[i].emp_id
      const domicilios = await companiesService.getEmpresaDomiciliosConPaises(empresaID)
      productos[i].domicilios = domicilios
      const [ventaTotalRaw] = await productService.totalSalesOfProduct(prodID)
      const { total } = ventaTotalRaw
      productos[i].ventas_totales = total
    }

    for (let i = 0; i < empresas.length; i++) {
      const empresaID = empresas[i].empresa_id
      empresas[i].productos = await productService.getProductosEmpresa(empresaID, 5)
      const [calificacion] = await statisticService.getPromediosExperienciaEmpresa(empresaID)
      const { tiempo } = calificacion
      empresas[i].calificacion = tiempo * 10 || null
      const [operaciones] = await statisticService.getCompanyMovements(empresaID)
      empresas[i].operaciones = operaciones.total || null
      const domicilios = await companiesService.getEmpresaDomiciliosConPaises(empresaID)
      empresas[i].domicilios = domicilios
    }

    const usuarios = paginacion(usuariosRaw, page, limit)
    const totalUsuarios = usuariosRaw.length

    for (let i = 0; i < usuarios.length; i++) {
      const empresaID = usuarios[i].emp_id
      const domicilios = await companiesService.getEmpresaDomiciliosConPaises(empresaID)
      usuarios[i].domicilios = domicilios
    }

    const eventosRaw = [...eventosPublicos, ...eventosPrivados].sort((a, b) => a.nombre > b.nombre ? 1 : -1)
    const eventos = paginacion(eventosRaw, page, limit)
    const totalEventos = eventosRaw.length

    for (let i = 0; i < eventos.length; i++) {
      const companyID = eventos[i].emp_id
      const domicilios = await companiesService.getEmpresaDomiciliosConPaises(companyID)
      eventos[i].domicilios = domicilios
    }

    return res.json({
      error: false,
      paginacion: {
        directory: {
          totalRegistros: totalDirectory,
          totalPaginas: Math.ceil(totalDirectory / limit)
        },
        productos: {
          totalRegistros: totalProductos,
          totalPaginas: Math.ceil(totalProductos / limit)
        },
        empresas: {
          totalRegistros: totalEmpresas,
          totalPaginas: Math.ceil(totalEmpresas / limit)
        },
        eventos: {
          totalRegistros: totalEventos,
          totalPaginas: Math.ceil(totalEventos / limit)
        },
        usuarios: {
          totalRegistros: totalUsuarios,
          totalPaginas: Math.ceil(totalUsuarios / limit)
        }

      },
      results: {
        directory: searchType === 'directory' ? directory : null,
        productos: searchType === 'productos' ? productos : null,
        empresas: searchType === 'empresas' ? empresas : null,
        usuarios: searchType === 'usuarios' ? usuarios : null,
        eventos: searchType === 'eventos' ? eventos : null

      }
    })
  } catch (err) {
    next(err)
  }
}

const sugerenciasBusqueda = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    const { text } = query


    const productos = await productService.getProductosBusqueda(text)
    const empresas = await searchService.getEmpresasBusqueda(text)
    // const usuarios = await searchService.getSugerenciasUsuarios(text, user)
    // const eventos = await searchService.getSugerenciasEventos(text)
    // const eventosPrivados = await searchService.getSugerenciasEventosPrivados(text, user)

    const results = {
      productos,
      empresas
    }

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const suggestions = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    const { text, user } = query

    const taxIds = (await companiesService.getAllTaxIds()).reduce((acc, curr) => {
      acc.push(curr.emp_rfc)
      return acc
    }, [])

    const directorio = await searchService.getSugerenciasDirectorio(text, taxIds)
    const productos = await productService.searchSuggestion(text)
    const empresas = await searchService.getSugerenciasEmpresas(text)
    const usuarios = await searchService.getSugerenciasUsuarios(text, user)
    const eventos = await searchService.getSugerenciasEventos(text)
    const eventosPrivados = await searchService.getSugerenciasEventosPrivados(text, user)

    const results = {
      directorio: directorio.map(p => p.nombre).sort(),
      productos: productos.map(p => p.nombre).sort(),
      iDsProductos: productos.map(p => p.idProducto.toString()).sort(),
      empresas: empresas.map(e => e.nombre).sort(),
      rfcs: empresas.map(rfc => rfc.rfc).sort(),
      usuarios: usuarios.map(e => e.nombre).sort(),
      eventos: [...eventos, ...eventosPrivados].map(e => e.nombre).sort()
    }

    return res.json({
      error: false,
      results
    })
  } catch (err) {
    next(err)
  }
}

const taxIdComplete = async (req, res, next) => {
  try {
    const { taxId } = req.params

    const [empresas] = await companiesService.searchByTaxIEqual(taxId)
    const productos = await productService.getProductosByEmpresaId(empresas.ID)

    return res.json({
      error: false,
      results: {
        empresas,
        productos
      }
    })
  } catch (error) {
    next(err)
  }
}

const taxId = async (req, res, next) => {
  try {
    const { taxId } = req.params

    const empresas = await companiesService.searchByTaxId(taxId)
    return res.json({
      error: false,
      results: {
        empresas: empresas.result
      }
    })
  } catch (error) {
    next(err)
  }
}

const category = async (req, res, next) => {
  debug(`[${req.method}] ${req.originalUrl}`)
  try {
    const { query } = req
    const { category } = query
    const productos = await productService.searchByCategoryId(category)

    return res.json({
      error: false,
      results: {
        productos
      }
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  globalSearch,
  suggestions,
  sugerenciasBusqueda,
  category,
  taxId,
  taxIdComplete,
  buscador
}
