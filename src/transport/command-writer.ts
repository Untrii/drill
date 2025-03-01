import { encodeCommand, type AnyCommand } from '#commands/command'
import type { Socket } from 'node:net'

export function createCommandWriter(socket: Socket) {
  const writeCommand = (command: AnyCommand) => {
    const encodedCommand = encodeCommand(command)
    return new Promise<void>((resolve, reject) => {
      if (socket.closed) reject(new Error('Socket is closed'))

      socket.write(new Uint8Array(encodedCommand), (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  return { writeCommand }
}
