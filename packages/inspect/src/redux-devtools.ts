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

function parseMaybeJsonObject(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
        const incoming = message as {
          type?: unknown;
          state?: unknown;
          payload?: { type?: unknown; nextLiftedState?: unknown };
          nextLiftedState?: unknown;
        };

        if (incoming.type === 'DISPATCH') {
          const dispatchType = incoming.payload?.type;
          if (
            dispatchType === 'JUMP_TO_STATE' ||
            dispatchType === 'JUMP_TO_ACTION' ||
            dispatchType === 'ROLLBACK' ||
            dispatchType === 'REVERT' ||
            dispatchType === 'COMMIT' ||
            dispatchType === 'RESET' ||
            dispatchType === 'IMPORT_STATE'
          ) {
            listener({
              type: dispatchType.toLowerCase() as DevtoolsMessage['type'],
              state: parseMaybeJsonObject(incoming.state),
              nextLiftedState: parseMaybeJsonObject(incoming.payload?.nextLiftedState),
            });
          }
          return;
        }

        if (
          incoming.type === 'jump_to_state' ||
          incoming.type === 'jump_to_action' ||
          incoming.type === 'rollback' ||
          incoming.type === 'revert' ||
          incoming.type === 'commit' ||
          incoming.type === 'reset' ||
          incoming.type === 'import_state'
        ) {
          listener({
            type: incoming.type,
            state: parseMaybeJsonObject(incoming.state),
            nextLiftedState: parseMaybeJsonObject(incoming.nextLiftedState),
          });
        }
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
