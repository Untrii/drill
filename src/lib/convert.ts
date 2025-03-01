export function uuidStringToBuffer(uuid: string) {
  const hexValue = uuid.replaceAll('-', '')
  const buffer = Buffer.from(hexValue, 'hex')
  return buffer.buffer.slice(0, 16)
}

export function uuidBufferToString(uuid: ArrayBufferLike) {
  const buffer = Buffer.from(uuid)
  const hexValue = buffer.toString('hex')

  const parts = [
    hexValue.slice(0, 8),
    hexValue.slice(8, 12),
    hexValue.slice(12, 16),
    hexValue.slice(16, 20),
    hexValue.slice(20, 32),
  ]

  return parts.join('-')
}

export function createBinaryWriter() {
  const parts: ArrayBufferLike[] = []

  const write = (data: ArrayBufferLike) => {
    parts.push(data)
  }

  const writeBlank = (size: number) => {
    write(new ArrayBuffer(size))
  }

  const writeUint8 = (value: number) => {
    write(new Uint8Array([value]).buffer)
  }

  const writeUint16 = (value: number) => {
    write(new Uint16Array([value]).buffer)
  }

  const writeUint32 = (value: number) => {
    write(new Uint32Array([value]).buffer)
  }

  const writeUint64 = (value: number | bigint) => {
    write(new BigUint64Array([BigInt(value)]).buffer)
  }

  const writeArray = (array: ArrayBufferLike) => {
    writeUint32(array.byteLength)
    write(array)
  }

  const toArrayBuffer = () => {
    const arrayBuffer = new ArrayBuffer(parts.reduce((totalLength, part) => totalLength + part.byteLength, 0))

    let position = 0
    for (const part of parts) {
      const partView = new Uint8Array(arrayBuffer, position)
      partView.set(new Uint8Array(part))
      position += part.byteLength
    }

    return arrayBuffer
  }

  return {
    write,
    writeBlank,
    writeUint8,
    writeUint16,
    writeUint32,
    writeUint64,
    toArrayBuffer,
    writeArray,
  }
}

export class OutOfBoundsReadError extends Error {
  constructor() {
    super('Out of bounds read')
  }
}
export function createBinaryReader<Buffer extends ArrayBufferLike>(buffer: Buffer) {
  let position = 0

  const read = <T>(size: number, mapper: (data: ArrayBuffer | SharedArrayBuffer) => T) => {
    if (position + size > buffer.byteLength) {
      throw new OutOfBoundsReadError()
    }

    const data = buffer.slice(position, position + size)
    position += size

    return mapper(data)
  }

  const readUint8 = () => read(1, (data) => new Uint8Array(data).at(0)!)
  const readUint16 = () => read(2, (data) => new Uint16Array(data).at(0)!)
  const readUint32 = () => read(4, (data) => new Uint32Array(data).at(0)!)
  const readUint64 = () => read(8, (data) => new BigUint64Array(data).at(0)!)
  const readArrayLength = () => readUint32()
  const readArray = () => read(readArrayLength(), (data) => data)

  const skip = (size: number) => {
    if (position + size > buffer.byteLength) {
      throw new OutOfBoundsReadError()
    }
    position += size
  }

  return {
    read,
    readArray,
    readArrayLength,
    readUint8,
    readUint16,
    readUint32,
    readUint64,
    skip,
    get position() {
      return position
    },
  }
}
