import os from 'node:os'
import { v5 as uuidv5 } from 'uuid'

const emptyMac = '00:00:00:00:00:00'

export function getMachineId() {
  const networkInterfacesDict = os.networkInterfaces()

  let mac = emptyMac
  for (const networkInterfaceList of Object.values(networkInterfacesDict)) {
    if (!networkInterfaceList) continue

    for (const networkInterface of networkInterfaceList) {
      if (networkInterface.mac !== emptyMac) {
        mac = networkInterface.mac
        break
      }
    }
  }

  const cwd = process.cwd()
  const argv = process.argv.join(' ')

  return uuidv5(mac + cwd + argv, '00000000-0000-0000-0000-000000000000')
}
