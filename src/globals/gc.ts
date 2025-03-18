import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

setFlagsFromString('--expose_gc')
const gc = runInNewContext('gc')

export function tryGC() {
  if (process.memoryUsage().arrayBuffers > 32 * 1024 * 1024) {
    gc()
  }
}
