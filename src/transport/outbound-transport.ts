import type { NormalizedAddress } from '#schemas/config.schema'
import { Socket } from 'node:net'
import { createCommandWriter } from './command-writer'
import { createAuthCommand } from '#commands/auth-command'
import { createClientHelloCommand } from '#commands/client-hello-command'
import { createPool } from './pool'
import type { AnyCommand } from '#commands/command'
import { createCommandReader } from './command-reader'
import { EventEmitter } from 'node:events'

const SOCKET_POOL_SIZE = 4
const SOCKET_CREATION_INTERVAL_MS = 500

interface Context {
  socket: Socket
}

interface CommandEventMap {
  command: [AnyCommand, Context]
}

export function createOutboundTransport(clientId: string, address: NormalizedAddress, password?: string | null) {
  password ??= ''

  const createSocket = async () => {
    console.log(`Client: Connecting to ${address.host}:${address.port}`)
    const socket = new Socket()

    await new Promise<void>((resolve, reject) => {
      socket.connect(address.port, address.host, () => resolve())
    })

    const commandWriter = createCommandWriter(socket)

    const authCommand = await createAuthCommand(password)
    await commandWriter.writeCommand(authCommand)
    console.log(`Client: Sent auth command to ${address.host}:${address.port}`)

    const clientHelloCommand = createClientHelloCommand(clientId)
    await commandWriter.writeCommand(clientHelloCommand)
    console.log(`Client: Sent client hello command to ${address.host}:${address.port}`)

    return socket
  }

  const eventEmitter = new EventEmitter<CommandEventMap>()

  const createSocketPool = () => {
    const pool = createPool(
      async () => createSocket(),
      (socket) => socket.closed,
      async (socket) => {
        const commandReader = createCommandReader(socket)

        const context = { socket }

        try {
          for await (const command of commandReader.readCommands()) {
            eventEmitter.emit('command', command, context)
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
    await socketPool.use(async (socket) => {
      const commandWriter = createCommandWriter(socket)
      await commandWriter.writeCommand(command)
    })
  }

  const readCommand = async () => {
    return new Promise<[AnyCommand, Context]>((resolve, reject) => {
      eventEmitter.once('command', (command, context) => {
        resolve([command, context])
      })
    })
  }

  const readCommands = async function* () {
    while (true) {
      const commandInfo = await readCommand()
      yield commandInfo
    }
  }

  return {
    writeCommand,
    readCommand,
    readCommands,
    get host() {
      return address.host
    },
  }
}
