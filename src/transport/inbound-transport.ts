import { createServer, Socket } from 'node:net'
import { createCommandReader } from 'src/transport/command-reader'
import { CommandType, type AnyCommand } from 'src/commands/command'
import { validateAuthCommand } from '#commands/auth-command'
import { createCommandWriter } from './command-writer'

const DEFAULT_NODE_PORT = Number(process.env.DEFAULT_NODE_PORT || 8035)

interface Context {
  socket: Socket
  clientId: string
}

interface CommandInfo {
  command: AnyCommand
  context: Context
}

export async function createInboundTransport(password: string | null = null, port: number = DEFAULT_NODE_PORT) {
  password ??= ''

  const commandQueue: CommandInfo[] = []

  const socketsById = new Map<string, Socket[]>()

  const server = createServer(async (socket) => {
    console.log('Server: Client connected')
    const commandReader = createCommandReader(socket)

    socket.on('close', (hadError) => {
      console.log('Server: Client disconnected', hadError)
    })

    let authCommand: AnyCommand
    try {
      authCommand = await commandReader.readCommand()
    } catch {
      console.log('Failed to read auth command')
      socket.destroy()
      return
    }
    if (authCommand.type !== CommandType.AUTH) {
      socket.destroy()
      return
    }

    try {
      await validateAuthCommand(password, authCommand)
    } catch (error) {
      console.log('Failed to validate auth command')
      if (error instanceof Error) console.warn(error.message)

      socket.destroy()
      return
    }
    console.log('Server: Client sent valid auth command')

    let clientHelloCommand: AnyCommand
    try {
      clientHelloCommand = await commandReader.readCommand()
    } catch {
      console.log('Failed to read client hello command')
      socket.destroy()
      return
    }
    if (clientHelloCommand.type !== CommandType.CLIENT_HELLO) {
      console.log('Server: Client sent invalid client hello command')
      socket.destroy()
      return
    }
    console.log('Server: Client sent valid client hello command')

    const clientId = clientHelloCommand.id
    if (!socketsById.has(clientId)) {
      socketsById.set(clientId, [])
    }

    socketsById.get(clientId)!.push(socket)

    socket.once('close', () => {
      const newSocketsByCurrentId = socketsById.get(clientId)?.filter((knownSocket) => knownSocket !== socket) ?? []
      socketsById.set(clientId, newSocketsByCurrentId)
    })

    const context = {
      socket,
      clientId,
    }

    try {
      while (!socket.closed) {
        const command = await commandReader.readCommand()
        commandQueue.push({ command, context })
      }
    } catch (error) {
      console.log('Probably socket closed here', error)
      socket.destroy()
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)

    server.listen(port, () => {
      resolve()
      server.off('error', reject)
    })
  })

  const destroy = () => {
    return new Promise<void>((resolve) => {
      server.close()
      server.once('close', resolve)
    })
  }

  const readCommand = async () => {
    while (commandQueue.length === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1))
    }

    return commandQueue.shift()!
  }

  const readCommands = async function* () {
    while (true) {
      const commandInfo = await readCommand()
      yield commandInfo
    }
  }

  const writeCommandTo = (clientId: string, command: AnyCommand) => {
    const sockets = socketsById.get(clientId)
    if (!sockets?.length) throw new Error('Missing connection')

    const socket = sockets[Math.floor(Math.random() * sockets.length)]
    const commandWriter = createCommandWriter(socket)

    commandWriter.writeCommand(command)
  }

  return {
    destroy,
    readCommand,
    readCommands,
    writeCommandTo,
  }
}
