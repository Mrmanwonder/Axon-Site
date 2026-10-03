/* Google Material Symbols (Outlined), 24px, static SVG subset: Apache-2.0.
   Source: https://github.com/google/material-design-icons/tree/master/symbols/web
   Licence and notice: third_party/material-design-icons/LICENSE.
   Modified only to fill with currentColor and to be decorative (the button carries the name).
   No icon font and no third-party request: the glyphs are inlined. Chosen by the owner
   (decision D7, 2026-10-03); Apple SF Symbols are licensed for Apple platforms, not the web. */

type Props = { size?: number };

function Glyph({ d, size = 24 }: Props & { d: string }) {
  return (
    <svg aria-hidden="true" focusable="false" fill="currentColor" xmlns="http://www.w3.org/2000/svg"
         height={size} width={size} viewBox="0 -960 960 960">
      <path d={d} />
    </svg>
  );
}

const SHARE = "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM240-440q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm480 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Zm0-600ZM240-480Zm480 280Z";
const DELETE = "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z";

export const ShareSymbol = (p: Props) => <Glyph d={SHARE} {...p} />;
export const DeleteSymbol = (p: Props) => <Glyph d={DELETE} {...p} />;
