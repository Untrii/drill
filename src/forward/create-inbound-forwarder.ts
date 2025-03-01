import { createServer, Server, Socket } from 'node:net'
import { createEstablishConnectionCommand } from '#commands/establish-connection-command'
import { readSocketData } from 'src/transport/read-socket-data'
import { createSendDataCommand } from '#commands/send-data-command'
import type { AnyCommand } from '#commands/command'
import { console } from 'node:inspector'
import { createCloseConnectionCommand } from '#commands/close-connetion-command'

export function createInboundForwarder(writeCommandTo: (nodeId: string, command: AnyCommand) => Promise<void>) {
  const serverByPort = new Map<number, Server>()
  const connectionById = new Map<string, Socket>()
  const allocatedAtByPort = new Map<number, number>()
  const nodeIdByPort = new Map<number, string>()

  setInterval(() => {
    for (const [port, allocatedAt] of allocatedAtByPort) {
      if (Date.now() - allocatedAt > 30000) {
        deallocatePort(port)
      }
    }
  }, 30000)

  const allocatePort = (port: number, nodeId: string) => {
    if (nodeIdByPort.get(port) === nodeId) {
      allocatedAtByPort.set(port, Date.now())
    }

    if (serverByPort.has(port)) {
      return
    }

    console.log('Allocated port', port)
    const server = createServer(async (socket) => {
      console.log('Client connected to allocated port', port)
      socket.on('close', () => {
        console.log('Client disconnected from allocated port', port)
      })

      const connectionId = crypto.randomUUID()
      const establishConnectionCommand = createEstablishConnectionCommand(connectionId, port)
      connectionById.set(establishConnectionCommand.connectionId, socket)

      try {
        await writeCommandTo(nodeId, establishConnectionCommand)
      } catch {
        console.log('Failed to write establish connection command')
        socket.destroy()
        return
      }

      const socketData = readSocketData(socket)

      while (!socket.closed) {
        const data = await socketData.next()
        const sendDataCommand = createSendDataCommand(connectionId, data.buffer)
        console.log(`Reading ${data.byteLength} bytes from connection ${connectionId}`)

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

    serverByPort.set(port, server)
  }

  const deallocatePort = (port: number) => {
    console.log('Deallocating port', port)
    const server = serverByPort.get(port)
    server?.close()

    allocatedAtByPort.delete(port)
    nodeIdByPort.delete(port)
    serverByPort.delete(port)
  }

  const closeConnection = (id: string) => {
    console.log('Closing connection')
    const socket = connectionById.get(id)
    socket?.destroy()
    connectionById.delete(id)
  }

  const writeToConnection = (id: string, data: ArrayBufferLike) => {
    console.log(`Writing ${data.byteLength} bytes to connection ${id}`)
    const connection = connectionById.get(id)
    if (!connection) console.warn('Connection not found!')
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
