'use strict'

// Esta utilidad permite saber qué elemento de un array es el más repetido y cuántas ocurrencias tiene
// Se utiliza en el servicio de statistics para poder determinar el país y ciudad que más visita un producto

const mostRepeated = collection => {
  if (collection.length === 0) {
    return { mostRepeated: null, total: 0 }
  }

  const myMap = new Map()
  myMap.set('mostRepeated', '')
  collection.forEach(v => {
    if (!myMap.has(v)) {
      myMap.set(v, 1)
    } else {
      const currentValue = myMap.get(v)
      myMap.set(v, currentValue + 1)
    }

    if (myMap.get('mostRepeated') === '') {
      myMap.set('mostRepeated', v)
    }

    const mostRepeated = myMap.get('mostRepeated')
    const current = myMap.get(v)

    if (current > myMap.get(mostRepeated)) {
      myMap.set('mostRepeated', v)
    }
  })

  const mostRepeated = myMap.get('mostRepeated')
  const total = myMap.get(mostRepeated)
  const data = {
    mostRepeated,
    total
  }
  return data
}

module.exports = mostRepeated
