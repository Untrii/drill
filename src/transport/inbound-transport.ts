import { createServer, Socket } from 'node:net'
import { createCommandReader } from 'src/transport/command-reader'
import { CommandType, type AnyCommand } from 'src/commands/command'
import { validateAuthCommand } from '#commands/auth-command'
import { createCommandWriter } from './command-writer'
import { createHelloCommand } from '#commands/hello-command'

const DEFAULT_NODE_PORT = Number(process.env.DEFAULT_NODE_PORT || 8035)

interface Context {
  socket: Socket
  nodeId: string
}

export async function createInboundTransport(
  currentNodeId: string,
  password: string | null = null,
  port: number = DEFAULT_NODE_PORT,
  onCommand?: (command: AnyCommand, context: Context) => void
) {
  password ??= ''

  const socketsById = new Map<string, Socket[]>()

  const server = createServer(async (socket) => {
    console.log('Server: Client connected')
    const commandReader = createCommandReader(socket)
    const commandWriter = createCommandWriter(socket)

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
    if (clientHelloCommand.type !== CommandType.HELLO) {
      console.log('Server: Client sent invalid client hello command')
      socket.destroy()
      return
    }
    console.log('Server: Client sent valid client hello command')

    const serverHelloCommand = createHelloCommand(currentNodeId)
    try {
      await commandWriter.writeCommand(serverHelloCommand)
    } catch {
      socket.destroy()
      return
    }
    console.log('Server: Sent server hello command')

    const nodeId = clientHelloCommand.nodeId
    if (!socketsById.has(nodeId)) {
      socketsById.set(nodeId, [])
    }

    socketsById.get(nodeId)!.push(socket)

    socket.once('close', () => {
      const newSocketsByCurrentId = socketsById.get(nodeId)?.filter((knownSocket) => knownSocket !== socket) ?? []
      socketsById.set(nodeId, newSocketsByCurrentId)
    })

    const context = {
      socket,
      nodeId,
    }

    try {
      while (!socket.closed) {
        const command = await commandReader.readCommand()
        onCommand?.(command, context)
      }
    } catch (error) {
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

  const writeCommandTo = async (clientId: string, command: AnyCommand) => {
    const sockets = socketsById.get(clientId)
    if (!sockets?.length) throw new Error('Missing connection')

    const socket = sockets[Math.floor(Math.random() * sockets.length)]
    const commandWriter = createCommandWriter(socket)

    await commandWriter.writeCommand(command)
  }

  return {
    destroy,
    writeCommandTo,
  }
}

type Depromisify<T> = T extends (...args: infer A) => Promise<infer R> ? (...args: A) => R : never

export type InboundTransport = ReturnType<Depromisify<typeof createInboundTransport>>
