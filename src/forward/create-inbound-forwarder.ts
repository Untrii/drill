import { createServer, Server, Socket } from 'node:net'
import { createEstablishConnectionCommand } from '#commands/establish-connection-command'
import { readSocketData } from 'src/transport/read-socket-data'
import { createSendDataCommand } from '#commands/send-data-command'
import type { AnyCommand } from '#commands/command'
import { console } from 'node:inspector'
import { createCloseConnectionCommand } from '#commands/close-connetion-command'

interface AllocatedPortContext {
  server: Server
  nodeId: string
  allocatedAt: number
  port: number
}

const PORT_ALLOCATION_LIFETIME_MS = 15000

export function createInboundForwarder(writeCommandTo: (nodeId: string, command: AnyCommand) => Promise<void>) {
  const contextByPort = new Map<number, AllocatedPortContext>()
  const connectionById = new Map<string, Socket>()

  setInterval(() => {
    for (const [port, context] of contextByPort) {
      if (Date.now() - context.allocatedAt > PORT_ALLOCATION_LIFETIME_MS) {
        deallocatePort(port)
      }
    }
  }, 1000)

  const allocatePort = (port: number, nodeId: string) => {
    const context = contextByPort.get(port)

    if (context?.nodeId === nodeId) {
      context.allocatedAt = Date.now()
      return
    }

    if (context) {
      return
    }

    console.log('Forwarder: Allocated port', port)
    const server = createServer(async (socket) => {
      const connectionId = crypto.randomUUID()
      console.log(`Forwarder: Client connected to allocated port ${port}, assigned connection id: ${connectionId}`)

      const establishConnectionCommand = createEstablishConnectionCommand(connectionId, port)
      connectionById.set(establishConnectionCommand.connectionId, socket)

      let keepAliveIntervalId: Timer | null = setInterval(() => {
        writeCommandTo(nodeId, establishConnectionCommand).catch(() => {})
      }, 1000)

      socket.on('close', () => {
        console.log(`Forwarder: Client disconnected from allocated port ${port}, connection id: ${connectionId}`)

        if (keepAliveIntervalId) clearInterval(keepAliveIntervalId)
        keepAliveIntervalId = null
      })

      socket.on('error', () => {
        if (keepAliveIntervalId) clearInterval(keepAliveIntervalId)
        keepAliveIntervalId = null
      })

      try {
        await writeCommandTo(nodeId, establishConnectionCommand)
      } catch {
        console.log('Forwarder: Failed to write establish connection command')
        socket.destroy()
        return
      }

      const socketData = readSocketData(socket)

      while (!socket.closed) {
        const data = await socketData.next()
        const sendDataCommand = createSendDataCommand(connectionId, data.buffer)

        try {
          await writeCommandTo(nodeId, sendDataCommand)
        } catch {
          socket.destroy()
          return
        }
      }

      const closeConnectionCommand = createCloseConnectionCommand(connectionId, port)

      try {
        await writeCommandTo(nodeId, closeConnectionCommand)
      } catch {}
    })

    server.listen(port)

    contextByPort.set(port, {
      allocatedAt: Date.now(),
      nodeId: nodeId,
      port: port,
      server: server,
    })
  }

  const deallocatePort = (port: number) => {
    console.log('Forwarder: Deallocating port', port)
    const context = contextByPort.get(port)
    context?.server.close()
    contextByPort.delete(port)
  }

  const closeConnection = (id: string) => {
    console.log('Forwarder: Closing connection')
    const socket = connectionById.get(id)
    socket?.destroy()
    connectionById.delete(id)
  }

  const writeToConnection = (id: string, data: ArrayBufferLike) => {
    const connection = connectionById.get(id)
    connection?.write(new Uint8Array(data))
  }

  return {
    allocatePort,
    deallocatePort,
    closeConnection,
    writeToConnection,
  }
}

export type InboundForwarder = ReturnType<typeof createInboundForwarder>
