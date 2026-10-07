import type { GlobalComponent } from '../compono/types'

export interface Example {
  id: string
  title: string
  source: string
  globals: GlobalComponent[]
  context: string
}

const lines = (...l: string[]) => l.join('\n')

export const examples: Example[] = [
  {
    id: 'components',
    title: 'Components',
    source: lines(
      '// Comment lines never reach the output.',
      '{{ GREETING name = "Compono" }}',
      '',
      'Compono is **Markdown** with *components*. Define them at the bottom,',
      'call them anywhere: {{ BADGE text = "reusable" }}.',
      '',
      '{{ PROFILE name = "Jane" age = 31 tags = ["writer", "editor"] }}',
      '',
      '~ GREETING name = "World"',
      '# Hello, {{ name }}!',
      '',
      '~ BADGE text = ""',
      '**{{ text }}**',
      '',
      '~ PROFILE name = "" age = 0 tags = []',
      '## {{ name }}',
      'Age: {{ age }}, first tag: *{{ tags[0] }}*',
    ),
    globals: [],
    context: '',
  },
  {
    id: 'globals-context',
    title: 'Globals and context',
    source: lines(
      '{{ BLOG_POST title = "Hello, Compono" content = BODY }}',
      '',
      '~ BODY',
      'Written by **{{ context(site).author }}** with Compono {{ context(app/version) }}.',
      'Global components are given to the conversion and context injects data at convert time.',
    ),
    globals: [
      {
        name: 'BLOG_POST',
        source: lines(
          'title = "" content = NO_MATTER',
          '# {{ title }}',
          '{{ content }}',
        ),
      },
    ],
    context: JSON.stringify({ 'app/version': '0.7.0', site: { author: 'Jane Doe' } }, null, 2),
  },
  {
    id: 'built-ins',
    title: 'Built-in components',
    source: lines(
      '# Built-in components',
      '',
      "Built-ins produce the semantic HTML that Markdown can't, like a link",
      'that opens in a new tab: {{ LINK text = "Compono on GitHub" url = "https://github.com/umono-cms/compono" new-tab = true }}',
      '',
      '{{ IMAGE media = {',
      '  url: "https://picsum.photos/id/1015/1600/900",',
      '  width: 1600,',
      '  height: 900,',
      '  mime-type: "image/jpeg",',
      '  variants: [',
      '    { url: "https://picsum.photos/id/1015/640/360.webp", width: 640, height: 360, mime-type: "image/webp" },',
      '    { url: "https://picsum.photos/id/1015/1280/720.webp", width: 1280, height: 720, mime-type: "image/webp" }',
      '  ]',
      '} alt = "A river between mountains" }}',
      '',
      'Images can be inline too: {{ IMAGE media = {',
      '  url: "https://picsum.photos/id/64/48/48",',
      '  width: 48,',
      '  height: 48,',
      '  mime-type: "image/jpeg"',
      '} alt = "Avatar" }} is ready.',
    ),
    globals: [],
    context: '',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics',
    source: lines(
      '// Each broken unit below is dropped from the output and reported',
      '// as a diagnostic. The rest of the output is still written.',
      '# Hello, {{ NAME }}!',
      '',
      '{{ CARD }}',
      '',
      'Version: {{ context(app/version) }}',
      '',
      '{{ SECTION title = "Links" }}',
      '',
      '{{ LOOP }}',
      '',
      '~ CARD title! = ""',
      '## {{ title }}',
      '',
      '~ LOOP',
      '{{ LOOP }}',
    ),
    globals: [
      {
        name: 'SECTION',
        source: lines(
          'title = ""',
          '## {{ title }}',
          '{{ LINK text = title url = "/links" new-tab = "yes" }}',
        ),
      },
    ],
    context: '',
  },
  {
    id: 'fatal',
    title: 'Fatal error',
    source: lines(
      '// Fatal errors stop the conversion and no output is written.',
      '// Compono has no floats, so the context below is rejected.',
      'Price: {{ context(price) }}',
    ),
    globals: [],
    context: JSON.stringify({ price: 9.99 }, null, 2),
  },
]
