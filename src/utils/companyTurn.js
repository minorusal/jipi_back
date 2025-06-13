'use strict'

// Hay algunas situaciones en las cotizaciones donde para darle la venta a
// alguien se tienen que tomar un turno, para que cada vendedor de una empresa
// tenga trabajo de manera "automática", estos turnos se guardan en la base de
// datos y van indicando el usuario en turno, una vez que se realice una nueva
// cotización ese turno cambia al siguiente vendedor y regresa al primero
// cuando no hay más vendedores en espera.

const companiesService = require('../services/companies')
const turnsService = require('../services/turns')

const getCompanyTurn = async (company) => {
  // Vendedores son de tipo 1, administradores son de tipo 3
  const [seller, admin] = [1, 3]
  let sellersRaw = await companiesService.getCompanyEmployeesByType(company, seller)
  if (sellersRaw.length === 0) {
    sellersRaw = await companiesService.getCompanyEmployeesByType(company, admin)
  }
  // Saca los IDs de sellersRaw
  const sellers = sellersRaw.map(s => s.id)

  const [turnExists] = await turnsService.getCompanyChatTurns(company)
  if (!turnExists) {
    await turnsService.createCompanyChatTurns(company)
  } else {
    const currentTurn = turnExists.turno
    const numberOfSellers = sellers.length
    if (currentTurn >= numberOfSellers) {
      await turnsService.editCompanyChatTurns(company, 1)
    } else {
      await turnsService.editCompanyChatTurns(company, currentTurn + 1)
    }
  }

  const [currentTurnRaw] = await turnsService.getCompanyChatTurns(company)
  const currentTurn = currentTurnRaw.turno
  const userSeller = sellers[currentTurn - 1]

  return userSeller
}

module.exports = getCompanyTurn
