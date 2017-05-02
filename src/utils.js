import ps from 'ps-node'
import config from './config'

export function log (...stuffToLog) {
  if (config.logging) console.log(...stuffToLog)
}

export function psLookup (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      console.log('2', error, result)
      if (error) {
        return reject(error)
      }
      return resolve(result)
    })
  })
}

export function psKill (options = { command: '' }) {
  return new Promise((resolve, reject) => {
    ps.lookup(options, (error, result) => {
      if (error) {
        return reject(error)
      }
      return resolve(result)
    })
  })
}

export function sleep (milliseconds = 1000) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
