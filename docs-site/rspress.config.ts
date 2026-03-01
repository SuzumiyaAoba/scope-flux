import { defineConfig } from 'rspress/config';
import mermaid from './plugins/mermaid';

export default defineConfig({
  root: '../website',
  ssg: false,
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
      { text: 'API', link: '/api/index.html' }
    ],
    sidebar: {
      '/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Tutorial (Todo App)', link: '/tutorial-todo' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Plan', link: '/plan' },
            { text: 'API Reference', link: '/api-reference' }
          ]
        },
        {
          text: 'API',
          items: [
            { text: 'Core', link: '/core-api' },
            { text: 'React', link: '/react-api' },
            { text: 'Scheduler', link: '/scheduler-api' },
            { text: 'Serializer', link: '/serializer-api' },
            { text: 'Inspect', link: '/inspect-api' }
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
