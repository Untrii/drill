import { Socket } from 'node:net'

export interface TransportContext {
  socket: Socket
  nodeId: string
}
