import { encodeCommand, type AnyCommand } from '#commands/command'
import type { Socket } from 'node:net'

export function createCommandWriter(socket: Socket) {
  const writeCommand = async (command: AnyCommand) => {
    const encodedCommand = encodeCommand(command)

    if (socket.closed) throw new Error('Socket is closed')

    const isFlushed = socket.write(new Uint8Array(encodedCommand))

    if (!isFlushed) {
      await new Promise((resolve) => socket.once('drain', resolve))
    }
  }

  return { writeCommand }
}
