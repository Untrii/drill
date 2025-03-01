import { createCloseConnectionCommand } from '#commands/close-connetion-command'
import type { AnyCommand } from '#commands/command'
import { createSendDataCommand } from '#commands/send-data-command'
import { Socket } from 'node:net'
import { readSocketData } from 'src/transport/read-socket-data'

export function createOutboundForwarder(writeCommandTo: (nodeId: string, command: AnyCommand) => Promise<void>) {
  const connectionById = new Map<string, Socket>()
  const establishConnection = async (nodeId: string, connectionId: string, port: number) => {
    const socket = new Socket()

    connectionById.set(connectionId, socket)
    console.log('Added connection', connectionId)

    socket.connect(port, 'localhost')

    socket.on('close', () => {
      connectionById.delete(connectionId)
    })

    socket.on('error', () => {
      connectionById.delete(connectionId)
    })

    const socketData = readSocketData(socket)

    while (!socket.closed) {
      const dataPart = await socketData.next()
      const command = createSendDataCommand(connectionId, dataPart.buffer)
      console.log(`Reading ${dataPart.buffer.byteLength} bytes from connection ${connectionId}`)

      try {
        await writeCommandTo(nodeId, command)
      } catch {
        socket.destroy()
        return
      }
    }

    const closeConnectionCommand = createCloseConnectionCommand(connectionId, port)
    try {
      await writeCommandTo(nodeId, closeConnectionCommand)
    } catch {}
  }

  const writeToConnection = (connectionId: string, data: ArrayBufferLike) => {
    console.log(`Writing ${data.byteLength} bytes to connection ${connectionId}`)
    const connection = connectionById.get(connectionId)
    if (!connection) console.warn('Connection not found!')
    connection?.write(new Uint8Array(data))
  }

  const closeConnection = (connectionId: string) => {
    const socket = connectionById.get(connectionId)
    socket?.destroy()
    connectionById.delete(connectionId)
  }

  return {
    establishConnection,
    writeToConnection,
    closeConnection,
  }
}

export type OutboundForwarder = ReturnType<typeof createOutboundForwarder>
