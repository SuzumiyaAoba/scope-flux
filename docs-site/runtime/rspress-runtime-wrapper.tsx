import { BrowserRouter as BaseBrowserRouter } from '../node_modules/@rspress/runtime/dist/index.js';
import type { ComponentProps } from 'react';

export * from '../node_modules/@rspress/runtime/dist/index.js';

type BaseBrowserRouterProps = ComponentProps<typeof BaseBrowserRouter>;

export function BrowserRouter({ future, ...props }: BaseBrowserRouterProps) {
  return (
    <BaseBrowserRouter
      {...props}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
        ...future,
      }}
    />
  );
}
