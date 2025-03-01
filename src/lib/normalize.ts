import type { Address as Address, NormalizedAddress, Port, PortRange } from '#schemas/config.schema'

export function normalizePortRange(portOrPortRange: Port | PortRange) {
  if (Array.isArray(portOrPortRange)) {
    return portOrPortRange
  }
  return [portOrPortRange, portOrPortRange]
}

export function normalizeAddress(destination: string | Address, defaultPort = 8080): NormalizedAddress {
  if (typeof destination === 'string') {
    // Checling if protocol is missing
    if (!destination.match(/^[a-z]+:\/\/[\w|\d|\.]+(:\d+)?$/gm)) {
      destination = 'tcp://' + destination
    }

    const url = new URL(destination)
    const host = url.hostname
    const port = Number(url.port) || defaultPort

    return {
      host,
      port,
    }
  }

  return destination
}
