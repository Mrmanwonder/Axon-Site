# Google Material Symbols Outlined

Nine static SVG glyphs from Google's [Material Design Icons repository](https://github.com/google/material-design-icons/tree/master/symbols/web), obtained 3 October 2026. Licensed under Apache License 2.0; the complete upstream license is in [LICENSE](LICENSE). Copyright and source remain with Google and the upstream contributors.

Path geometry is embedded in the existing `src/ui/components/MaterialSymbols.tsx` renderer; `MaterialSymbol.tsx` only re-exports its generic API. Geometry and the 24px optical-size viewBox are unmodified. Axon's changes are a React wrapper, currentColor, 20/22/24px sizing, and decorative accessibility attributes. Parent controls provide visible labels and accessible names. No icon font, full library, sprite, or runtime network request is included. Existing navigation icons remain unchanged.

| Axon name | Upstream SVG | Git blob SHA |
| --- | --- | --- |
| share | [share_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/share/materialsymbolsoutlined/share_24px.svg) | `6876cd42dad6670f4d456b077f1352755017dfab` |
| delete | [delete_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/delete/materialsymbolsoutlined/delete_24px.svg) | `560d174b9b0f06200c5ab0a1baa7f579841d8ff3` |
| back | [arrow_back_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/arrow_back/materialsymbolsoutlined/arrow_back_24px.svg) | `cba0c8b2a8d7393e472c4940bf66c6338d0aa1a8` |
| chevron | [chevron_right_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/chevron_right/materialsymbolsoutlined/chevron_right_24px.svg) | `41004673651a63615c28ad0d31b652b0b6f291f3` |
| edit | [edit_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/edit/materialsymbolsoutlined/edit_24px.svg) | `cb81b1130264a29ad625f30082675fcf361cb6e1` |
| rescan | [document_scanner_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/document_scanner/materialsymbolsoutlined/document_scanner_24px.svg) | `9827e836b16ebb9cbf0b5d70477ad1e2371ccfa0` |
| zoom | [zoom_in_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/zoom_in/materialsymbolsoutlined/zoom_in_24px.svg) | `a09499ef45ac1abf7feaeead6079f44ef6711525` |
| confirmed | [check_circle_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/check_circle/materialsymbolsoutlined/check_circle_24px.svg) | `802ed5650ced040d78d04b123d277923228f91ac` |
| attention | [error_24px.svg](https://github.com/google/material-design-icons/blob/master/symbols/web/error/materialsymbolsoutlined/error_24px.svg) | `86c4555326886c711aa657b921eaf86b338e69c6` |

The `rescan` API name uses the `document_scanner` glyph; `confirmed` uses `check_circle`; `attention` uses `error`. Status meaning always also appears as text. Attention/Delete use Axon's existing amber role; no new red UI is introduced.


Integration addendum: the shared renderer reuses the scanner’s existing check_circle glyph from @material-symbols/svg-400 0.47.6 (outlined). The confirmed-row blob above records the original review asset, which is no longer embedded.
