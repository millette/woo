'use strict'

require('dotenv-safe').load()
const btcaverage = require('btcaverage')
const got = require('got')
const _ = require('lodash')

const insert = (doc) =>
  got.post(process.env.DB_URL, {
    json: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc)
  })
  .then((ret) => {
    if (doc.average) {
      return {
        ts: doc.datetime,
        avg: doc.average,
        cb: doc.usd.coinbase
      }
    }
    return {
      ts: doc.datetime,
      cad: doc.usd.CAD,
      btc: doc.usd.BTC
    }
  })

const makeDoc = (prices) => {
  const now = Date.now()
  const ts = new Date(now).toISOString()
  const doc = {
    _id: 'markets@' + Math.round(now / 1000),
    datetime: ts,
    usd: {},
    average: prices.average
  }
  let r
  for (r in prices.prices) { doc.usd[r.toLowerCase().replace(/[^a-z.-]/g, '')] = prices.prices[r] }
  return doc
}

const report = (() => {
  let lastAvg
  let lastCb
  return (xx) => {
    const out = _.padStart(lastAvg ? (xx.avg - lastAvg).toFixed(3) : '', 8)
    const out2 = _.padStart(lastCb ? (xx.cb - lastCb).toFixed(3) : '', 8)
    const avg = _.padStart(xx.avg.toFixed(3), 10)
    const cb = _.padStart(xx.cb.toFixed(3), 10)
    console.log(`#1 ${xx.ts} ${avg} ${out} ${cb} ${out2}`)
    lastAvg = xx.avg
    lastCb = xx.cb
  }
})()

const report2 = (() => {
  let lastCad
  let lastBtc
  return (xx) => {
    const out = _.padStart(lastCad ? (xx.cad - lastCad).toFixed(3) : '', 8)
    const out2 = _.padStart(lastBtc ? ((1 / xx.btc) - lastBtc).toFixed(3) : '', 8)
    const cad = _.padStart(xx.cad.toFixed(3), 10)
    const btc = _.padStart((1 / xx.btc).toFixed(3), 10)
    console.log(`#2 ${xx.ts} ${btc} ${out2} ${cad} ${out}`)
    lastCad = xx.cad
    lastBtc = 1 / xx.btc
  }
})()

const addPrices = () => btcaverage()
  .then(makeDoc)
  .then(insert)
  .then(report)
  .catch(console.error)

const xxx = (u) => got(u, { json: true })
  .then((x) => x.body)
  .then((body) => {
    const ts = body.timestamp
    const doc = {
      _id: 'currencies@' + ts,
      datetime: new Date(ts * 1000).toISOString()
    }
    doc[body.base.toLowerCase()] = body.rates
    return doc
  })
  .then(insert)
  .then(report2)
  .catch(console.error)

const xch = `https://openexchangerates.org/api/latest.json?app_id=${process.env.APP_ID}&show_experimental=1`

addPrices()
xxx(xch)
setInterval(addPrices, 300000)
setInterval(xxx, 3600000, xch)
