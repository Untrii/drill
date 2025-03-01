import { List } from '#lib/list'
import { type Socket } from 'node:net'
import { decodeCommand } from '../commands/command'
import { eventToAsyncGenerator } from '#lib/event-to-async-generator'
import { readSocketData } from './read-socket-data'

const MAX_READING_COMMAND_SIZE = Number(process.env.MAX_READING_COMMAND_SIZE || 8192)

export function createCommandReader(socket: Socket) {
  const incomingCommand = new List()

  const socketData = readSocketData(socket)

  const readCommand = async () => {
    try {
      const { command, size } = decodeCommand(incomingCommand.toArrayBuffer())
      incomingCommand.shift(size)
      return command
    } catch {}

    while (!socket.closed) {
      const data = await socketData.next()
      incomingCommand.push(data.buffer)

      try {
        const { command, size } = decodeCommand(incomingCommand.toArrayBuffer())
        incomingCommand.shift(size)
        return command
      } catch {}
    }

    throw new Error('Socket closed')
  }

  const readCommands = async function* () {
    while (true) {
      yield await readCommand()
    }
  }

  return {
    readCommand,
    readCommands,
  }
}
