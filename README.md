# Pandoc Tools for node and js

Pandoc is the Cadillac of Markdown engines, and is amply served with npm modules.
This module, built primarily to support my [pandoc-svelte-components] library, plugs 
a few gaps.

Most importantly for me, it provides a *Rollup plugin* for importing markdown files directly inside a svelte-kit project *as JSON*. I can (and may) support html exports as well, but the JSON format is the place where pandoc allows really interesting things to happen.


Usage in a vite project with sveltekit.

```
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { pandoc_rollup_plugin } from 'pandoc-tools';

export default defineConfig({
	plugins: [pandoc_rollup_plugin({ cache_loc: 'posts_cache' }), sveltekit()]
});
```