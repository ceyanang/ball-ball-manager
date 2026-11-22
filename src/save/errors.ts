export class SaveImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveImportError'
  }
}
