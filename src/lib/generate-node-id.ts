import { networkInterfaces } from 'os'

export function generateNodeId() {
  const networkInterfacesList = networkInterfaces()

  const mac = networkInterfacesList.lo?.at(0)?.mac ?? '00:00:00:00:00:00'
}
