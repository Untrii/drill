import { createCloseConnectionCommand } from '#commands/close-connetion-command'
import type { AnyCommand } from '#commands/command'
import { createSendDataCommand } from '#commands/send-data-command'
import { Socket } from 'node:net'
import { readSocketData } from 'src/transport/read-socket-data'

interface ConnectionContext {
  socket: Socket
  nodeId: string
  connectionId: string
  updatedAt: number
}

const CONNECTION_LIFETIME_MS = 10000

export function createOutboundForwarder(writeCommandTo: (nodeId: string, command: AnyCommand) => Promise<void>) {
  const contextByConnectionId = new Map<string, ConnectionContext>()

  setInterval(() => {
    for (const [connectionId, context] of contextByConnectionId) {
      if (Date.now() - context.updatedAt > CONNECTION_LIFETIME_MS) {
        closeConnection(connectionId)
      }
    }
  }, 1000)

  const establishConnection = async (nodeId: string, connectionId: string, port: number) => {
    const context = contextByConnectionId.get(connectionId)

    if (context?.nodeId === nodeId) {
      context.updatedAt = Date.now()
    }

    if (context) return

    const socket = new Socket()

    contextByConnectionId.set(connectionId, {
      socket,
      nodeId,
      connectionId,
      updatedAt: Date.now(),
    })
    console.log('Forwarder: Recieved connection', connectionId)

    socket.connect(port, 'localhost')

    socket.on('close', () => {
      console.log('Forwarder: Connection closed', connectionId)
      contextByConnectionId.delete(connectionId)
    })

    socket.on('error', () => {
      contextByConnectionId.delete(connectionId)
    })

    const socketData = readSocketData(socket)

    while (!socket.closed) {
      const dataPart = await socketData.next()
      const command = createSendDataCommand(connectionId, dataPart.buffer)

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
    const context = contextByConnectionId.get(connectionId)
    context?.socket.write(new Uint8Array(data))
  }

  const closeConnection = (connectionId: string) => {
    const context = contextByConnectionId.get(connectionId)
    const socket = context?.socket
    socket?.destroy()
    contextByConnectionId.delete(connectionId)
  }

  return {
    establishConnection,
    writeToConnection,
    closeConnection,
  }
}

export type OutboundForwarder = ReturnType<typeof createOutboundForwarder>
