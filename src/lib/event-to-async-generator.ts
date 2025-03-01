import type { EventEmitter } from 'node:events'

export function eventToAsyncGenerator<EventMap extends Record<string, any[]>, EventName extends keyof EventMap>(
  eventEmitter: EventEmitter<EventMap>,
  eventName: EventName
) {
  type EventPayload = EventMap[EventName]
  type Resolver = (payload: EventPayload) => void

  const resolvers: Resolver[] = []
  const queue: EventPayload[] = []

  // @ts-ignore
  eventEmitter.on(eventName as any, (...payload: any[]) => {
    if (resolvers.length) {
      resolvers.shift()!(payload as EventPayload)
    } else {
      queue.push(payload as EventPayload)
    }
  })

  return async function* () {
    while (true) {
      if (queue.length) {
        yield queue.shift()!
      } else {
        yield await new Promise<EventPayload>((resolve) => {
          resolvers.push(resolve)
        })
      }
    }
  }
}
