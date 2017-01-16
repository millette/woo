'use strict'

require('dotenv-safe').load()
const btcaverage = require('btcaverage')
const got = require('got')
const chalk = require('chalk')
const _ = require('lodash')

const xch = `https://openExchangeRates.org/api/latest.json?app_id=${process.env.APP_ID}&show_experimental=1`
const ulbtc = `https://localbitcoins.com/buy-bitcoins-with-cash/${process.env.ADS}/.json`
const minms = 60 * 1000
const pricesInterval = 4 * minms
const openExchangeRatesInterval = 60 * minms
const lbtcInterval = 12 * minms

const insert = (doc) =>
  got.post(process.env.DB_URL, {
    json: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(doc)
  })
  .then((ret) => {
    if (doc.ads) { return }
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

const arrowed = (n) => {
  if (n === 0) return '0.000'
  let ret
  const a = Math.abs(n).toFixed(3)
  if (n > 0) {
    if (a > 1) {
      ret = '⇈' + a
    } else {
      ret = '↑' + a
    }
  } else {
    if (a > 1) {
      ret = '⇊' + a
    } else {
      ret = '↓' + a
    }
  }

  return ret
}

const report = (() => {
  let lastAvg
  let lastCb
  return (xx) => {
    // let out
    // let out2
    const outa = xx.avg - lastAvg
    const out2a = xx.cb - lastCb
    const avg = _.padStart(xx.avg.toFixed(3), 10)
    const cb = _.padStart(xx.cb.toFixed(3), 10)
    // console.log(`#1 ${xx.ts} ${avg} ${out} ${cb} ${out2}`)
    const out = _.padStart(lastAvg ? arrowed(outa) : '', 8)
    const out2 = _.padStart(lastCb ? arrowed(out2a) : '', 8)
    if (out2a < 0 && outa < 0) {
      console.log(chalk.red(`#1 ${xx.ts} ${avg} ${out} ${cb} ${out2}`))
    } else if (out2a > 0 && outa > 0) {
      console.log(chalk.green(`#1 ${xx.ts} ${avg} ${out} ${cb} ${out2}`))
    } else {
      console.log(chalk.yellow(`#1 ${xx.ts} ${avg} ${out} ${cb} ${out2}`))
    }
    lastAvg = xx.avg
    lastCb = xx.cb
  }
})()

const report2 = (() => {
  let lastCad
  let lastBtc
  return (xx) => {
    const out = _.padStart(lastCad ? arrowed((xx.cad - lastCad)) : '', 8)
    const out2a = (1 / xx.btc) - lastBtc
    const out2 = _.padStart(lastBtc ? arrowed(out2a) : '', 8)
    const cad = _.padStart(xx.cad.toFixed(3), 10)
    const btc = _.padStart((1 / xx.btc).toFixed(3), 10)
    if (out2a < 0) {
      console.log(chalk.red.bold(`#2 ${xx.ts} ${btc} ${out2} ${cad} ${out}`))
    } else {
      console.log(chalk.green.bold(`#2 ${xx.ts} ${btc} ${out2} ${cad} ${out}`))
    }
    lastCad = xx.cad
    lastBtc = 1 / xx.btc
  }
})()

const addPrices = () => btcaverage()
  .then(makeDoc)
  .then(insert)
  .then(report)
  .catch(console.error)

const openExchangeRates = (u) => got(u, { json: true })
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

const wha = (x) => got(x, { json: true })
  .then((res) =>
    res.body.data.ad_list
      .filter((ad) => parseFloat(ad.data.temp_price))
      .map((ad) => ad.data)
      .map((ad) => {
        ad.temp_price = parseFloat(ad.temp_price)
        ad.temp_price_usd = parseFloat(ad.temp_price_usd)
        return _.pick(ad, ['temp_price', 'temp_price_usd', 'profile', 'ad_id'])
      })
  )

const addLbtc = (x) => wha(x)
  .then((qq) => {
    const now = Date.now()
    const dt = new Date(now).toISOString()
    return {
      _id: 'lbtc@' + Math.round(now / 1000),
      ts: dt,
      datetime: dt,
      ads: qq
    }
  })
  .then(insert)
  .catch(console.error)

openExchangeRates(xch)
addPrices()
addLbtc(ulbtc)

setInterval(addPrices, pricesInterval)
setInterval(openExchangeRates, openExchangeRatesInterval, xch)
setInterval(addLbtc, lbtcInterval, ulbtc)

