import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

setFlagsFromString('--expose_gc')
const gc = runInNewContext('gc')

const GC_TRESHOLD = 32 * 1024 * 1024
const GC_INTERVAL = 5000

let lastGcTimestamp = 0

export function tryGC() {
  if (process.memoryUsage().arrayBuffers > GC_TRESHOLD && Date.now() - lastGcTimestamp > GC_INTERVAL) {
    lastGcTimestamp = Date.now()
    gc()
  }
}
