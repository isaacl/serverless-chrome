import Cdp from 'chrome-remote-interface'
import config from '../config'
import { log } from '../utils'

export async function printPdfOfUrl (url) {
  const { chrome: {
    pageLoadTimeout: LOAD_TIMEOUT = 1000 * 60,
    ajaxLoadCheckTimeout: JS_REQUEST_TIMEOUT = 500,
  } } = config

  const tab = await Cdp.New({ host: '127.0.0.1' })
  const client = await Cdp({ host: '127.0.0.1', tab })
  const { Network, Page } = client

  const ajaxPageLoadCheck = new Promise((resolve) => {
    const pendingRequests = new Map()

    let emptyRequestCutoff
    Network.requestWillBeSent(({ requestId, request }) => {
      log('Requesting:', request.url)
      pendingRequests.set(requestId, request)
      emptyRequestCutoff = undefined
    })

    const onNetworkComplete = ({ requestId }) => {
      pendingRequests.delete(requestId)
      if (pendingRequests.size === 0) {
        emptyRequestCutoff = Date.now() + JS_REQUEST_TIMEOUT
      }
    }

    Network.loadingFinished(onNetworkComplete)
    Network.loadingFailed(onNetworkComplete)

    let pageLoaded = false
    Page.loadEventFired(() => { pageLoaded = true })

    const pageLoadCutoff = Date.now() + LOAD_TIMEOUT
    const loading = () => {
      const now = Date.now()
      if (pageLoaded && now > emptyRequestCutoff) {
        resolve()
      } else if (now > pageLoadCutoff) {
        log('Timeout!', pageLoaded, pendingRequests)
        resolve()
      } else {
        setTimeout(loading, 100)
      }
    }
    loading()
  })

  if (config.logging) {
    Cdp.Version((err, info) => {
      console.log('CDP version info', err, info)
    })
  }

  let result
  try {
    // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Network/#method-enable
    // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Page/#method-enable
    await Promise.all([Network.enable(), Page.enable()])
    await Page.navigate({ url }) // https://chromedevtools.github.io/debugger-protocol-viewer/tot/Page/#method-navigate
    await ajaxPageLoadCheck
    const pdf = await client.Page.printToPDF()
    result = pdf.data
  } catch (error) {
    console.error(error)
  }
  await client.close()
  return result
}

export default (async function printPdfHandler (event) {
  const { url: encodedUrl } = event
  let pdf

  const url = decodeURIComponent(encodedUrl)

  log('Processing screenshot capture for', url)

  try {
    pdf = await printPdfOfUrl(url)
  } catch (error) {
    console.error('Error capturing screenshot for', url, error)
    throw new Error('Unable to capture screenshot')
  }

  return pdf

  // This style of return would be really nice but
  // aws won't return binary unless it's requested with Accept header..

  // {
  //   isBase64Encoded: true,
  //   statusCode: 200,
  //   // it's not possible to send binary via AWS API Gateway as it expects JSON response from Lambda
  //   body: pdf,
  //   headers: {
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': "inline;filename='report.pdf'",
  //     'Content-Encoding': 'gzip',
  //   },
  // }
});
