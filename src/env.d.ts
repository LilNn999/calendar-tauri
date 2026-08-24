/// <reference types="vite/client" />

import type { IpcChannel } from '@shared/ipc-channels'

declare global {
  interface Window {
    electronAPI: {
      invoke(channel: IpcChannel, ...args: unknown[]): Promise<unknown>
      on(channel: IpcChannel, callback: (...args: unknown[]) => void): () => void
      removeAllListeners(channel: IpcChannel): void
    }
  }
}
