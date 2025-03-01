export class List {
  #buffer = new ArrayBuffer(16)
  #length = 0

  push(data: ArrayBufferLike) {
    const newLength = this.#length + data.byteLength

    if (newLength > this.#buffer.byteLength) {
      const newBufferCapacity = 2 ** Math.ceil(Math.log2(newLength))

      const newBuffer = new ArrayBuffer(newBufferCapacity)
      new Uint8Array(newBuffer).set(new Uint8Array(this.#buffer, 0, this.#length))
      this.#buffer = newBuffer
    }

    new Uint8Array(this.#buffer, this.#length).set(new Uint8Array(data))
    this.#length = newLength
  }

  shift(size: number) {
    const newBuffer = new ArrayBuffer(this.#buffer.byteLength)

    new Uint8Array(newBuffer).set(new Uint8Array(this.#buffer, size, this.#length - size))

    this.#buffer = newBuffer
    this.#length -= size
  }

  clear() {
    this.#buffer = new ArrayBuffer(16)
    this.#length = 0
  }

  toArrayBuffer() {
    return this.#buffer.slice(0, this.#length)
  }

  get length() {
    return this.#length
  }
}
