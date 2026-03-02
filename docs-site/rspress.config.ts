import { defineConfig } from 'rspress/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mermaid from './plugins/mermaid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsBase = process.env.DOCS_BASE_PATH || '/';
const coreFunctionItems = [
  { text: 'cell', link: '/api/core/functions/cell' },
  { text: 'computed', link: '/api/core/functions/computed' },
  { text: 'event', link: '/api/core/functions/event' },
  { text: 'effect', link: '/api/core/functions/effect' },
  { text: 'createStore', link: '/api/core/functions/create-store' },
  { text: 'getRegisteredCellById', link: '/api/core/functions/get-registered-cell-by-id' },
  { text: 'listRegisteredCells', link: '/api/core/functions/list-registered-cells' },
];

const coreTypeItems = [
  { text: 'Scope', link: '/api/core/types/scope' },
  { text: 'StableId', link: '/api/core/types/stable-id' },
  { text: 'Priority', link: '/api/core/types/priority' },
  { text: 'UnitMeta', link: '/api/core/types/unit-meta' },
  { text: 'UpdateOptions', link: '/api/core/types/update-options' },
  { text: 'EffectContext', link: '/api/core/types/effect-context' },
  { text: 'ScopeListener', link: '/api/core/types/scope-listener' },
  { text: 'Unsubscribe', link: '/api/core/types/unsubscribe' },
  { text: 'Cell<T>', link: '/api/core/types/cell-type' },
  { text: 'Computed<T, D>', link: '/api/core/types/computed-type' },
  { text: 'ComputedDeps', link: '/api/core/types/computed-deps' },
  { text: 'ComputedArgs<D>', link: '/api/core/types/computed-args' },
  { text: 'Event<P>', link: '/api/core/types/event-type' },
  { text: 'Effect<P, R>', link: '/api/core/types/effect-type' },
  { text: 'AnyCell', link: '/api/core/types/any-cell' },
  { text: 'AnyComputed', link: '/api/core/types/any-computed' },
  { text: 'SetChange', link: '/api/core/types/set-change' },
  { text: 'EventChange', link: '/api/core/types/event-change' },
  { text: 'EffectChange', link: '/api/core/types/effect-change' },
  { text: 'Change', link: '/api/core/types/change' },
  { text: 'CommitEvent', link: '/api/core/types/commit-event' },
  { text: 'SeedInput', link: '/api/core/types/seed-input' },
  { text: 'Store', link: '/api/core/types/store' },
];

const reactFunctionItems = [
  { text: 'StoreProvider', link: '/api/react/functions/store-provider' },
  { text: 'useUnit', link: '/api/react/functions/use-unit' },
  { text: 'useBufferedUnit', link: '/api/react/functions/use-buffered-unit' },
  { text: 'useCellAction', link: '/api/react/functions/use-cell-action' },
  { text: 'useCell', link: '/api/react/functions/use-cell' },
  { text: 'useFlushBuffered', link: '/api/react/functions/use-flush-buffered' },
  { text: 'useAction', link: '/api/react/functions/use-action' },
  { text: 'useEffectAction', link: '/api/react/functions/use-effect-action' },
];

const reactTypeItems = [
  { text: 'StoreProviderProps', link: '/api/react/types/store-provider-props' },
];

const schedulerFunctionItems = [
  { text: 'createScheduler', link: '/api/scheduler/functions/create-scheduler' },
];

const schedulerTypeItems = [
  { text: 'Scheduler', link: '/api/scheduler/types/scheduler-class' },
  { text: 'PendingBufferedUpdate', link: '/api/scheduler/types/pending-buffered-update' },
  { text: 'SchedulerOptions', link: '/api/scheduler/types/scheduler-options' },
];

const serializerFunctionItems = [
  { text: 'serialize', link: '/api/serializer/functions/serialize' },
  { text: 'hydrate', link: '/api/serializer/functions/hydrate' },
  { text: 'escapeJsonForHtml', link: '/api/serializer/functions/escape-json-for-html' },
];

const serializerTypeItems = [
  { text: 'JsonValue', link: '/api/serializer/types/json-value' },
  { text: 'SerializedScope', link: '/api/serializer/types/serialized-scope' },
  { text: 'SerializeOptions', link: '/api/serializer/types/serialize-options' },
  { text: 'HydrateOptions', link: '/api/serializer/types/hydrate-options' },
];

const inspectFunctionItems = [
  { text: 'inspect', link: '/api/inspect/functions/inspect' },
  { text: 'connectDevtools', link: '/api/inspect/functions/connect-devtools' },
  { text: 'createReduxDevtoolsAdapter', link: '/api/inspect/functions/create-redux-devtools-adapter' },
];

const inspectTypeItems = [
  { text: 'TraceEvent', link: '/api/inspect/types/trace-event' },
  { text: 'StateDiff', link: '/api/inspect/types/state-diff' },
  { text: 'InspectRecord', link: '/api/inspect/types/inspect-record' },
  { text: 'InspectOptions', link: '/api/inspect/types/inspect-options' },
  { text: 'DevtoolsAdapter', link: '/api/inspect/types/devtools-adapter' },
  { text: 'ConnectDevtoolsOptions', link: '/api/inspect/types/connect-devtools-options' },
  { text: 'ReduxDevtoolsLike', link: '/api/inspect/types/redux-devtools-like' },
  { text: 'ReduxDevtoolsAdapterOptions', link: '/api/inspect/types/redux-devtools-adapter-options' },
  { text: 'ReduxDevtoolsAdapter', link: '/api/inspect/types/redux-devtools-adapter' },
];

export default defineConfig({
  root: '../website',
  base: docsBase,
  ssg: false,
  builderConfig: {
    resolve: {
      alias: {
        '@rspress/runtime': resolve(
          __dirname,
          './runtime/rspress-runtime-wrapper.tsx',
        ),
      },
    },
  },
  plugins: [
    mermaid({
      mermaidConfig: {
        theme: 'neutral',
      },
    }),
  ],
  title: 'scope-flux',
  description: 'State management library for modern React applications.',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Migration', link: '/migration/' },
      { text: 'API', link: '/api/' }
    ],
    sidebar: {
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Tutorial (Todo App)', link: '/tutorial-todo' },
            { text: 'Architecture', link: '/architecture' }
          ]
        },
        {
          text: 'API',
          items: [
            { text: 'API Home', link: '/api/' },
            {
              text: 'Core',
              items: [
                { text: 'Module', link: '/api/core' },
                { text: 'Functions', items: coreFunctionItems },
                { text: 'Types', items: coreTypeItems },
              ],
            },
            {
              text: 'React',
              items: [
                { text: 'Module', link: '/api/react' },
                { text: 'Functions', items: reactFunctionItems },
                { text: 'Types', items: reactTypeItems },
              ],
            },
            {
              text: 'Scheduler',
              items: [
                { text: 'Module', link: '/api/scheduler' },
                { text: 'Functions', items: schedulerFunctionItems },
                { text: 'Types', items: schedulerTypeItems },
              ],
            },
            {
              text: 'Serializer',
              items: [
                { text: 'Module', link: '/api/serializer' },
                { text: 'Functions', items: serializerFunctionItems },
                { text: 'Types', items: serializerTypeItems },
              ],
            },
            {
              text: 'Inspect',
              items: [
                { text: 'Module', link: '/api/inspect' },
                { text: 'Functions', items: inspectFunctionItems },
                { text: 'Types', items: inspectTypeItems },
              ],
            },
            { text: 'Typedoc', link: '/typedoc/index.html' }
          ]
        },
        {
          text: 'Migration',
          items: [
            { text: 'Index', link: '/migration/' },
            { text: 'Redux', link: '/migration/redux' },
            { text: 'Zustand', link: '/migration/zustand' },
            { text: 'Jotai', link: '/migration/jotai' },
            { text: 'Valtio / MobX', link: '/migration/valtio-mobx' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/SuzumiyaAoba/scope-flux' }
    ]
  }
});
