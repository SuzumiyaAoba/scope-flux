import { useEffect, useId, useState } from 'react';
import mermaid, { type MermaidConfig } from 'mermaid';

type MermaidRendererProps = {
  code: string;
  config?: MermaidConfig;
};

export default function MermaidRender(props: MermaidRendererProps): React.JSX.Element | null {
  const { code, config = {} } = props;
  const id = useId();
  const [svg, setSvg] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render(): Promise<void> {
      const hasDarkClass = document.documentElement.classList.contains('dark');
      const mermaidConfig: MermaidConfig = {
        securityLevel: 'loose',
        startOnLoad: false,
        theme: hasDarkClass ? 'dark' : 'default',
        ...config,
      };

      try {
        mermaid.initialize(mermaidConfig);
        const rendered = await mermaid.render(id.replace(/:/g, ''), code);
        if (!cancelled) {
          setSvg(rendered.svg);
          setHasError(false);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, config, id]);

  if (hasError) {
    return null;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
