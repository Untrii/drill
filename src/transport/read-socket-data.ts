import { Socket } from 'node:net'

export function readSocketData(socket: Socket, debug = false) {
  type Resolver = (payload: Buffer) => void

  const resolvers: Resolver[] = []
  const queue: Buffer[] = []

  socket.on('data', (data) => {
    if (debug) {
      console.log('Recieved data', data.byteLength)
      console.log(Buffer.from(data).toString('utf-8'))
    }
    try {
      if (resolvers.length) {
        resolvers.shift()!(data)
      } else {
        queue.push(data)
      }
    } catch (error) {
      console.log(error)
    }
  })

  const next = () => {
    if (queue.length) {
      return Promise.resolve(queue.shift()!)
    } else {
      return new Promise<Buffer>((resolve) => {
        resolvers.push(resolve)
      })
    }
  }

  return {
    next,
  }
}
