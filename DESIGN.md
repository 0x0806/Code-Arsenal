# Design

Replacement world: **the workshop bench**. The previous look (matrix rain, neon green glass,
floating shapes) is retained only as an anti-reference.

## Idea
Warm paper chrome, ink-black actions, one signal-orange marker. Code surfaces are dark inset
panels set into the paper like a tool in a tray. Status colours (pass / fail) are reserved for
results and never decorate.

## Tokens
| Role | Light | Dark |
|---|---|---|
| paper (page) | `#F2EFE7` | `#121110` |
| surface | `#FAF8F3` | `#1A1917` |
| ink (text) | `#1B1A17` | `#EDE9DF` |
| muted text | `#5E5A4F` | `#A39E91` |
| line | `#D9D4C5` | `#2E2C27` |
| signal (marker) | `#E4572E` | `#F2764F` |
| pass | `#1B7A4F` | `#4CC38A` |
| fail | `#B42318` | `#FF8A7E` |
| code panel | `#14130F` | `#0C0B09` |

No violet. No gradients on text. Shadows have offset and blur; depth is mostly hairlines.

## Type
- Display: Bricolage Grotesque 600–800, tight tracking (-0.02em to -0.035em).
- Body/UI: Instrument Sans 400–600.
- Code and data: JetBrains Mono, tabular numerals.

## Shape and spacing
Radius scale 4 / 8 / 12. 4px base spacing grid. Lists are rows, not card grids. Cards are used
only where an item is a self-contained object (a problem in the daily slot).

## Icons
One inline SVG set, 1.75 stroke, 24px viewBox, `currentColor`. No icon font, no emoji.

## Motion
One authored entrance per page. Hover and press states on every control. Everything rests under
`prefers-reduced-motion`.
