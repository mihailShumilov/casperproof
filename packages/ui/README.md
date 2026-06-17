# @casperproof/ui

The shared **dark-theme design system** for CasperProof — _"Proof your agents can't fake."_
Consumed by both `apps/web` (the dApp dashboard) and `apps/marketing` (the landing site).

Dependency-light (only [`clsx`](https://github.com/lukeed/clsx) at runtime), strict TypeScript,
ESM, accessible-by-default, and fully tokenised so the whole surface can be re-themed from one place.

## Install / consume

This package is part of the monorepo workspace. Import the stylesheet once at your app root,
then use the components and tokens anywhere.

```ts
// app entry (once)
import '@casperproof/ui/styles.css';

// anywhere
import { Button, VerdictPill, HashDisplay, tokens } from '@casperproof/ui';
import { tokens } from '@casperproof/ui/tokens'; // tokens-only subpath
```

### Subpath exports

| Entry                         | Contents                                              |
| ----------------------------- | ----------------------------------------------------- |
| `@casperproof/ui`             | All components + token objects + token helpers        |
| `@casperproof/ui/tokens`      | The typed `tokens` object and `tokensToCssVars*` only |
| `@casperproof/ui/styles.css`  | Base reset, token CSS variables, component utilities  |

## Theming

The stylesheet declares every token as a CSS custom property under `:root` using the convention
`--cp-<group>-<key>` (e.g. `--cp-color-accent`, `--cp-space-lg`, `--cp-radius-md`). Components are
styled entirely against these variables, so re-theming is just overriding variables.

For isolated subtrees (Storybook, email previews, tests) or local overrides, wrap with
`ThemeProvider`, which injects the variables inline — no global stylesheet required:

```tsx
import { ThemeProvider, tokens } from '@casperproof/ui';

<ThemeProvider theme={{ ...tokens, colors: { ...tokens.colors, accent: '#00e5ff' } }}>
  <App />
</ThemeProvider>;
```

You can also generate the variables yourself:

```ts
import { tokensToCssVars, tokensToCssVarsString } from '@casperproof/ui';

tokensToCssVars(); // { '--cp-color-accent': '#ff2d2d', ... } — good for React style props
tokensToCssVarsString(); // "  --cp-color-accent: #ff2d2d;\n  ..." — drop inside a :root { } block
```

## Token reference

All tokens live in `src/tokens.ts` and are exported individually and as a single `tokens` object.

| Group         | Export         | Keys                                                                                        |
| ------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Colors        | `colors`       | `bg`, `surface`, `surfaceRaised`, `border`, `text`, `textMuted`, `textFaint`, `accent`, `accentHover`, `accentActive`, `proof`, `proofMuted`, `fail`, `failMuted`, `warn`, `warnMuted`, `info`, `infoMuted` |
| Spacing       | `spacing`      | `none`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`                                            |
| Radii         | `radii`        | `none`, `sm`, `md`, `lg`, `xl`, `full`                                                        |
| Font stacks   | `fonts`        | `sans`, `mono`                                                                               |
| Font sizes    | `fontSizes`    | `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`                                                    |
| Font weights  | `fontWeights`  | `regular`, `medium`, `semibold`, `bold`                                                      |
| Shadows       | `shadows`      | `none`, `sm`, `md`, `lg`, `glow`                                                             |
| Z-index       | `zIndex`       | `base`, `dropdown`, `sticky`, `overlay`, `modal`, `toast`                                    |

**Brand semantics:** `accent` is the Casper-red brand color; `proof` (green) / `fail` (red) are the
verified / tampered pair used by `VerdictPill` and the `pass` / `fail` `Badge` variants.

## Component catalog

Every component is a typed function component, extends the relevant native element props
(so `className`, `id`, `data-*`, event handlers, etc. pass through), uses semantic HTML, and
provides keyboard focus styles. Sizes/variants are spelled out below.

### `Button`

| Prop       | Type                                      | Default     | Notes                       |
| ---------- | ----------------------------------------- | ----------- | --------------------------- |
| `variant`  | `'primary' \| 'secondary' \| 'ghost'`     | `'primary'` |                             |
| `size`     | `'sm' \| 'md' \| 'lg'`                     | `'md'`      |                             |
| `block`    | `boolean`                                 | `false`     | Full-width                  |
| `type`     | `'button' \| 'submit' \| 'reset'`         | `'button'`  | Defaults to `button`        |
| …rest      | `ButtonHTMLAttributes<HTMLButtonElement>` |             | e.g. `onClick`, `disabled`  |

```tsx
<Button variant="primary" size="lg" onClick={launch}>Launch app</Button>
```

### `Card`

| Prop          | Type                              | Default | Notes                          |
| ------------- | --------------------------------- | ------- | ------------------------------ |
| `interactive` | `boolean`                         | `false` | Adds hover border + shadow     |
| …rest         | `HTMLAttributes<HTMLDivElement>`  |         |                                |

### `Badge`

Status pill for a claim's lifecycle / verdict.

| Prop      | Type                                                                          | Default                       |
| --------- | ----------------------------------------------------------------------------- | ----------------------------- |
| `status`  | `'active' \| 'challenged' \| 'slashed' \| 'finalized' \| 'pass' \| 'fail'`     | — (required)                  |
| `dot`     | `boolean`                                                                     | `true` (leading status dot)   |
| `children`| `ReactNode`                                                                   | capitalized status as label   |

```tsx
<Badge status="challenged" />        // ● Challenged
<Badge status="pass">Verified</Badge>
```

### `StatTile`

A labelled metric with an optional delta.

| Prop             | Type                              | Default     |
| ---------------- | --------------------------------- | ----------- |
| `label`          | `ReactNode`                       | — (required)|
| `value`          | `ReactNode`                       | — (required)|
| `delta`          | `ReactNode`                       | —           |
| `deltaDirection` | `'up' \| 'down' \| 'neutral'`     | `'neutral'` |

```tsx
<StatTile label="Total staked" value="184.2K CSPR" delta="+4.1%" deltaDirection="up" />
```

### `HashDisplay`

Middle-truncates a long hash (e.g. a 64-char hex digest), exposes the full value via `title`,
and offers a copy-to-clipboard button. The pure `truncateHash(hash, lead?, tail?)` helper is
exported separately.

| Prop        | Type      | Default | Notes                                                       |
| ----------- | --------- | ------- | ----------------------------------------------------------- |
| `hash`      | `string`  | —       | The full value                                              |
| `lead`      | `number`  | `6`     | Leading chars kept                                          |
| `tail`      | `number`  | `6`     | Trailing chars kept                                         |
| `prefix`    | `string`  | `''`    | Always shown in full (e.g. `0x`)                            |
| `copyable`  | `boolean` | `true`  | Renders the copy button                                     |

Short hashes that wouldn't benefit from truncation are shown unchanged.

```tsx
<HashDisplay hash={txHash} prefix="0x" />     // 0xaaaaaa…cccccc
truncateHash('a'.repeat(64), 4, 4);            // "aaaa…aaaa"
```

### `VerdictPill`

High-emphasis verification result. `pass` = proof green, `fail` = fail red. Has `role="status"`.

| Prop       | Type               | Default          |
| ---------- | ------------------ | ---------------- |
| `verdict`  | `'pass' \| 'fail'` | — (required)     |
| `children` | `ReactNode`        | `PASS` / `FAIL`  |

### `Tag`

Low-emphasis label chip for categories / metadata. Accepts `HTMLAttributes<HTMLSpanElement>`.

### `Spinner`

Accessible loading indicator (`role="status"` + visually hidden label, respects
`prefers-reduced-motion`).

| Prop    | Type                  | Default       |
| ------- | --------------------- | ------------- |
| `size`  | `'sm' \| 'md' \| 'lg'`| `'md'`        |
| `label` | `string`              | `'Loading'`   |

### `CodeBlock`

Monospaced, scrollable code with an optional language label and copy button.

| Prop        | Type      | Default | Notes                          |
| ----------- | --------- | ------- | ------------------------------ |
| `code`      | `string`  | —       | Whitespace preserved           |
| `language`  | `string`  | —       | Corner label (e.g. `bash`)     |
| `copyable`  | `boolean` | `true`  |                                |

### `ThemeProvider`

Wraps children in a `<div data-cp-theme>` that declares the token CSS variables inline.

| Prop     | Type        | Default                |
| -------- | ----------- | ---------------------- |
| `theme`  | `Tokens`    | the CasperProof tokens |
| `style`  | `CSSProperties` | —                  |

## Development

```bash
pnpm --filter @casperproof/ui build       # tsc -> dist
pnpm --filter @casperproof/ui typecheck    # tsc --noEmit
pnpm --filter @casperproof/ui test          # vitest run
pnpm --filter @casperproof/ui test:coverage # enforce >90% lines + branches
```

Tests render with `react-dom/client` against jsdom via a small in-repo helper
(`src/test-utils.ts`) — no extra testing-library dependency. The coverage gate is
**90% lines and branches** (currently 100%).
