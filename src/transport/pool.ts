interface PoolOptions {
  size?: number
  creationIntervalMs?: number
}

export function createPool<T>(
  create: () => Promise<T>,
  shouldRemove: (item: T) => boolean,
  onCreated?: (item: T) => void,
  options?: PoolOptions
) {
  const { size = 4, creationIntervalMs = 500 } = options || {}

  const usedItems = new Set<T>()
  const availableItems = new Set<T>()
  const pendingItems = new Set<Promise<T>>()

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
    cleanup()
    while (availableItems.size === 0) {
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
