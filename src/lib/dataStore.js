import { DB_NAME, DB_STORE, DB_VERSION } from './constants'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore(mode, work) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode)
        const store = tx.objectStore(DB_STORE)
        const result = work(store)

        tx.oncomplete = () => {
          db.close()
          resolve(result)
        }

        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      })
  )
}

export function getAllStoredVersions() {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly')
        const store = tx.objectStore(DB_STORE)
        const request = store.getAll()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => db.close()
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      })
  )
}

export function saveVersion(payload) {
  return withStore('readwrite', (store) =>
    store.put({
      id: payload.translation.id,
      savedAt: new Date().toISOString(),
      payload
    })
  )
}

export function deleteVersion(id) {
  return withStore('readwrite', (store) => store.delete(id))
}
