# Client fragments

The host serves `client.js` as **one module**, with no bundler between the
package and the browser. It cannot use `import`, so these files are not ES
modules: `scripts/build-client.mjs` concatenates them in filename order inside
the `factory(require)` wrapper, and `client.js` is the single shipped artifact.

Edit here, never in `client.js`:

```bash
npm run build          # regenerate client.js
npm run check          # also fails when client.js is stale
```

Rules:

- Keep the numeric order; later fragments can use names declared earlier.
- No `import` / `export` in a fragment — the runtime has no loader.
- The generated `client.js` is committed, so installing or packing needs no
  build step.
- `test/client.test.js` evaluates the generated file, applies it to a fake
  host, and renders both views. It catches syntax errors and names that do not
  exist on the render path before a reload can take down the plugin (and, in
  this DSH version, the other plugins in the same client bundle).
