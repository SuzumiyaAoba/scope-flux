import path from 'node:path';
import { PresetConfigMutator, RemarkCodeBlockToGlobalComponentPluginFactory, type RspressPlugin } from 'rspress-plugin-devkit';

type MermaidPluginOptions = {
  mermaidConfig?: Record<string, unknown>;
};

export default function mermaidPlugin(options: MermaidPluginOptions = {}): RspressPlugin {
  const { mermaidConfig = {} } = options;

  const remarkMermaid = new RemarkCodeBlockToGlobalComponentPluginFactory({
    components: [
      {
        lang: 'mermaid',
        componentPath: path.join(__dirname, '../components', 'MermaidRender.tsx'),
        childrenProvider() {
          return [];
        },
        propsProvider(code) {
          return {
            code,
            config: mermaidConfig,
          };
        },
      },
    ],
  });

  return {
    name: 'scope-flux-local-mermaid-plugin',
    config(config) {
      return new PresetConfigMutator(config).disableMdxRs().toConfig();
    },
    markdown: {
      remarkPlugins: [remarkMermaid.remarkPlugin],
      globalComponents: remarkMermaid.mdxComponents,
    },
    builderConfig: remarkMermaid.builderConfig,
  };
}
