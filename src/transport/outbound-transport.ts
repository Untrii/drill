import type { Address } from '#schemas/config.schema'
import { Socket } from 'node:net'
import { createCommandWriter } from './command-writer'
import { createAuthCommand } from '#commands/auth-command'
import { createHelloCommand } from '#commands/hello-command'
import { createPool } from './pool'
import { CommandType, type AnyCommand } from '#commands/command'
import { createCommandReader } from './command-reader'
import { normalizeAddress } from '#lib/normalize'

interface Context {
  socket: Socket
  nodeId: string
}

export function createOutboundTransport(
  currentNodeId: string,
  address: Address,
  password?: string | null,
  onCommand?: (command: AnyCommand, context: Context) => void
) {
  let connectedNodeId: string | null
  address = normalizeAddress(address)

  password ??= ''

  const createSocket = async () => {
    console.log(`Client: Connecting to ${address.host}:${address.port}`)
    const socket = new Socket()

    await new Promise<void>((resolve, reject) => {
      socket.connect(address.port, address.host, () => resolve())

      socket.once('error', (error) => reject(error))
    })

    const commandWriter = createCommandWriter(socket)
    const commandReader = createCommandReader(socket)

    const authCommand = await createAuthCommand(password)
    await commandWriter.writeCommand(authCommand)
    console.log(`Client: Sent auth command to ${address.host}:${address.port}`)

    const clientHelloCommand = createHelloCommand(currentNodeId)
    await commandWriter.writeCommand(clientHelloCommand)
    console.log(`Client: Sent client hello command to ${address.host}:${address.port}`)

    const serverHelloCommand = await commandReader.readCommand()
    if (serverHelloCommand.type !== CommandType.HELLO) {
      socket.destroy()
      throw new Error(`Expected server hello command, got ${serverHelloCommand.type}`)
    }
    console.log(`Client: Received server hello command from ${address.host}:${address.port}`)

    connectedNodeId = serverHelloCommand.nodeId

    return [socket, serverHelloCommand.nodeId] as const
  }

  const createSocketPool = () => {
    const pool = createPool(
      async () => createSocket(),
      ([socket]) => socket.closed,
      async ([socket, nodeId]) => {
        const commandReader = createCommandReader(socket)

        const context = { socket, nodeId }

        try {
          for await (const command of commandReader.readCommands()) {
            onCommand?.(command, context)
          }
        } catch {
          socket.destroy()
        }
      }
    )

    return pool
  }

  const socketPool = createSocketPool()

  const writeCommand = async (command: AnyCommand) => {
    await socketPool.use(async ([socket]) => {
      const commandWriter = createCommandWriter(socket)
      await commandWriter.writeCommand(command)
    })
  }

  return {
    writeCommand,
    get host() {
      return address.host
    },
    get nodeId() {
      return connectedNodeId
    },
  }
}

export type OutboundTransport = ReturnType<typeof createOutboundTransport>
