import type { DevtoolsAdapter, DevtoolsMessage } from './index.js';

export interface ReduxDevtoolsLike {
  connect(options?: { name?: string }): {
    init(state: unknown): void;
    send(action: { type: string; payload?: unknown }, state: unknown): void;
    subscribe?: (listener: (message: unknown) => void) => (() => void) | void;
    unsubscribe?: () => void;
  };
}

export interface ReduxDevtoolsAdapterOptions {
  extension?: ReduxDevtoolsLike;
  name?: string;
}

export interface ReduxDevtoolsAdapter extends DevtoolsAdapter {
  disconnect(): void;
}

function readGlobalReduxDevtools(): ReduxDevtoolsLike | undefined {
  const g = globalThis as {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsLike;
  };

  return g.__REDUX_DEVTOOLS_EXTENSION__;
}

export function createReduxDevtoolsAdapter(
  options: ReduxDevtoolsAdapterOptions = {}
): ReduxDevtoolsAdapter {
  const extension = options.extension ?? readGlobalReduxDevtools();

  if (!extension || typeof extension.connect !== 'function') {
    return {
      init: () => {
        // no-op when extension is unavailable
      },
      send: () => {
        // no-op when extension is unavailable
      },
      disconnect: () => {
        // no-op when extension is unavailable
      },
    };
  }

  const connection = extension.connect({ name: options.name ?? 'scope-flux' });

  return {
    init(initialState: unknown): void {
      connection.init(initialState);
    },
    send(action: { type: string; payload?: unknown }, state: unknown): void {
      connection.send(action, state);
    },
    subscribe(listener: (message: DevtoolsMessage) => void): () => void {
      if (!connection.subscribe) {
        return () => {
          // no-op when subscribe is unavailable
        };
      }
      const unsubscribe = connection.subscribe((message) => {
        if (!message || typeof message !== 'object') {
          return;
        }
        const incoming = message as { type?: unknown; state?: unknown; nextLiftedState?: unknown };
        if (incoming.type !== 'jump_to_state' && incoming.type !== 'import_state') {
          return;
        }
        listener({
          type: incoming.type,
          state: incoming.state,
          nextLiftedState: incoming.nextLiftedState,
        });
      });
      return typeof unsubscribe === 'function'
        ? unsubscribe
        : () => {
            // no-op when extension does not provide explicit unsubscribe
          };
    },
    disconnect(): void {
      connection.unsubscribe?.();
    },
  };
}
