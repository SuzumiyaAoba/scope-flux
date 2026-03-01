import { useEffect, useMemo } from 'react';
import { cell, computed, createStore, getRegisteredCellById, type Cell } from '@scope-flux/core';
import { StoreProvider, useBufferedUnit, useCellAction, useFlushBuffered, useUnit } from '@scope-flux/react';
import './TodoTutorialDemo.css';

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

const CELL_ID_TODOS = 'tutorial_embed_todos';
const CELL_ID_DRAFT = 'tutorial_embed_draft';
const CELL_ID_FILTER = 'tutorial_embed_filter';
const STORAGE_KEY = 'scope-flux:tutorial-embed';

function getOrCreateCell<T>(id: string, init: T): Cell<T> {
  const existing = getRegisteredCellById(id) as Cell<T> | undefined;
  if (existing) {
    return existing;
  }
  return cell(init, { id });
}

const todosCell = getOrCreateCell<Todo[]>(CELL_ID_TODOS, []);
const draftCell = getOrCreateCell<string>(CELL_ID_DRAFT, '');
const filterCell = getOrCreateCell<'all' | 'active' | 'done'>(CELL_ID_FILTER, 'all');

const visibleTodos = computed([todosCell, filterCell], (todos, filter) => {
  if (filter === 'active') return todos.filter((todo) => !todo.done);
  if (filter === 'done') return todos.filter((todo) => todo.done);
  return todos;
});

const scope = createStore().fork();
let hydrated = false;

type PersistedState = {
  todos: Todo[];
  draft: string;
  filter: 'all' | 'active' | 'done';
};

function hydrateOnce(): void {
  if (hydrated || typeof window === 'undefined') {
    return;
  }
  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw) as Partial<PersistedState>;
    if (Array.isArray(data.todos)) {
      scope.set(todosCell, data.todos, { reason: 'tutorial.hydrate' });
    }
    if (typeof data.draft === 'string') {
      scope.set(draftCell, data.draft, { reason: 'tutorial.hydrate' });
    }
    if (data.filter === 'all' || data.filter === 'active' || data.filter === 'done') {
      scope.set(filterCell, data.filter, { reason: 'tutorial.hydrate' });
    }
  } catch {
    // ignore invalid local payload for tutorial demo
  }
}

function persist(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const payload: PersistedState = {
    todos: scope.get(todosCell),
    draft: scope.get(draftCell),
    filter: scope.get(filterCell),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function resetDemo(): void {
  scope.set(todosCell, [], { reason: 'tutorial.reset' });
  scope.set(draftCell, '', { reason: 'tutorial.reset' });
  scope.set(filterCell, 'all', { reason: 'tutorial.reset' });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function TodoAppBody(): React.JSX.Element {
  const draft = useBufferedUnit(draftCell);
  const setDraft = useCellAction(draftCell, { priority: 'transition', reason: 'tutorial.typing' });
  const flush = useFlushBuffered();

  const filter = useUnit(filterCell);
  const setFilter = useCellAction(filterCell, { reason: 'tutorial.filter' });

  const allTodos = useUnit(todosCell);
  const todos = useUnit(visibleTodos);
  const setTodos = useCellAction(todosCell, { reason: 'tutorial.todos' });

  const summary = useMemo(() => {
    const done = allTodos.filter((todo) => todo.done).length;
    return { total: allTodos.length, done, active: allTodos.length - done };
  }, [allTodos]);

  const onAdd = () => {
    flush();
    const text = draft.trim();
    if (!text) {
      return;
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
    setTodos((prev) => [...prev, { id, text, done: false }]);
    setDraft('');
    flush();
  };

  const toggle = (id: string) => {
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  };

  const remove = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  return (
    <div className="todo-demo">
      <h3 className="todo-demo__title">Embedded Todo Demo</h3>
      <p className="todo-demo__lead">
        This demo uses <code>cell</code>, <code>computed</code>, <code>StoreProvider</code>, and React hooks from scope-flux.
      </p>

      <div className="todo-demo__input-row">
        <input
          className="todo-demo__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => flush()}
          placeholder="Add todo..."
        />
        <button className="todo-demo__button todo-demo__button--primary" onClick={onAdd}>Add</button>
      </div>

      <div className="todo-demo__filter-row">
        {(['all', 'active', 'done'] as const).map((value) => (
          <button
            className="todo-demo__button"
            key={value}
            disabled={filter === value}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
        <button className="todo-demo__button todo-demo__button--ghost" onClick={resetDemo}>Reset</button>
      </div>

      <div className="todo-demo__summary">
        <span className="todo-demo__badge">Total: {summary.total}</span>
        <span className="todo-demo__badge">Active: {summary.active}</span>
        <span className="todo-demo__badge">Done: {summary.done}</span>
      </div>

      {todos.length === 0 ? (
        <p className="todo-demo__empty">No todos yet.</p>
      ) : (
        <ul className="todo-demo__list">
          {todos.map((todo) => (
            <li className="todo-demo__item" key={todo.id}>
              <label className="todo-demo__label">
                <input className="todo-demo__checkbox" type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
                <span className={todo.done ? 'todo-demo__text todo-demo__text--done' : 'todo-demo__text'}>
                  {todo.text}
                </span>
              </label>
              <button className="todo-demo__button todo-demo__button--danger" onClick={() => remove(todo.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TodoTutorialDemo(): React.JSX.Element {
  useEffect(() => {
    hydrateOnce();
    persist();
    const unsubscribe = scope.subscribe(() => {
      persist();
    });
    return unsubscribe;
  }, []);

  return (
    <StoreProvider scope={scope}>
      <TodoAppBody />
    </StoreProvider>
  );
}
