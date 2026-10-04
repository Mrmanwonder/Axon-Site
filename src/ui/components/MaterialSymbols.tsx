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

/* Scanner strip glyphs (4 Oct 2026), same source and weight: @material-symbols/svg-400 0.47.6, outlined. */
const CHECK = "M378-246 154-470l43-43 181 181 384-384 43 43-427 427Z";
const CROP_FREE = "M180-120q-24 0-42-18t-18-42v-172h60v172h172v60H180Zm428 0v-60h172v-172h60v172q0 24-18 42t-42 18H608ZM120-608v-172q0-24 18-42t42-18h172v60H180v172h-60Zm660 0v-172H608v-60h172q24 0 42 18t18 42v172h-60Z";
const INFO = "M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z";

export const CheckSymbol = (p: Props) => <Glyph d={CHECK} {...p} />;
export const CropFreeSymbol = (p: Props) => <Glyph d={CROP_FREE} {...p} />;
export const InfoSymbol = (p: Props) => <Glyph d={INFO} {...p} />;
