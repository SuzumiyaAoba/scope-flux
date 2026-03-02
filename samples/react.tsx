import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { cell, computed, createStore, event } from '@scope-flux/core';
import { StoreProvider, useAction, useCell, useUnit } from '@scope-flux/react';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const count = cell(0, { id: 'samples.react.count' });
const label = computed([count], (n) => `count:${n}`);
const incremented = event<number>({ debugName: 'incremented' });

const scope = createStore().fork();
scope.on(incremented, (delta, s) => {
  s.set(count, (prev) => prev + delta, { reason: 'event.incremented' });
});

// Enable React act environment for this Node-based sample runner.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function CounterView(): React.JSX.Element {
  const [value, setValue] = useCell(count, { reason: 'local.update' });
  const text = useUnit(label);
  const dispatchIncrement = useAction(incremented);

  return (
    <>
      <button id="set" onClick={() => setValue((prev) => prev + 1)}>
        set
      </button>
      <button id="event" onClick={() => dispatchIncrement(2)}>
        event
      </button>
      <span id="label">{text}</span>
      <span id="value">{value}</span>
    </>
  );
}

let root: TestRenderer.ReactTestRenderer;
await act(async () => {
  root = TestRenderer.create(
    <StoreProvider scope={scope}>
      <CounterView />
    </StoreProvider>
  );
});

const setButton = root!.root.findByProps({ id: 'set' });
const eventButton = root!.root.findByProps({ id: 'event' });

await act(async () => {
  setButton.props.onClick();
  eventButton.props.onClick();
});

const labelNode = root!.root.findByProps({ id: 'label' });
const valueNode = root!.root.findByProps({ id: 'value' });

console.log('[react] scope count=', scope.get(count));
console.log('[react] rendered label=', labelNode.children.join(''));
console.log('[react] rendered value=', valueNode.children.join(''));
