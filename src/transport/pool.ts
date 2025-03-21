interface PoolOptions {
  size?: number
  creationIntervalMs?: number
  timeoutMs?: number
}

export function createPool<T>(
  create: () => Promise<T>,
  shouldRemove: (item: T) => boolean,
  onCreated?: (item: T) => void,
  options?: PoolOptions
) {
  const { size = 8, creationIntervalMs = 1000, timeoutMs = 5000 } = options || {}

  const usedItems = new Set<T>()
  const availableItems = new Set<T>()
  const pendingItems = new Set<Promise<T>>()

  setInterval(() => {
    console.log(
      `Transport: Pool size: pending - ${pendingItems.size}, used - ${usedItems.size}, available - ${availableItems.size}`
    )
  }, 5000)

  let lastCreationTime = Date.now()

  const tryCreateItem = () => {
    if (lastCreationTime + creationIntervalMs > Date.now()) {
      return
    }

    lastCreationTime = Date.now()

    if (usedItems.size + availableItems.size + pendingItems.size < size) {
      const pendingItem = create()
      pendingItems.add(pendingItem)

      pendingItem
        .then((item) => {
          availableItems.add(item)
          pendingItems.delete(pendingItem)
          onCreated?.(item)
        })
        .catch(() => {
          pendingItems.delete(pendingItem)
        })
    }
  }

  const cleanup = () => {
    for (const item of availableItems) {
      if (shouldRemove(item)) availableItems.delete(item)
    }
  }

  const use = async (action: (item: T) => Promise<void>) => {
    let startedAt = Date.now()
    cleanup()

    while (availableItems.size === 0) {
      const timeElapsed = Date.now() - startedAt
      if (timeElapsed > timeoutMs) {
        throw new Error('Timeout')
      }

      tryCreateItem()

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1)
      })
    }

    const item = availableItems.values().next().value!
    availableItems.delete(item)
    usedItems.add(item)

    try {
      await action(item)
    } finally {
      if (usedItems.has(item)) {
        usedItems.delete(item)
        availableItems.add(item)
      }
    }
  }

  const deleteItem = (item: T) => {
    if (usedItems.has(item)) {
      usedItems.delete(item)
      availableItems.add(item)
    }
  }

  return {
    use,
    deleteItem,
  }
}
