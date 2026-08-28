let counter = 0

/** Prototype-grade id generator: readable, unique within a session. */
export function newId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}
