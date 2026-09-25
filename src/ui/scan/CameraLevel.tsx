import { useEffect, useRef } from "react";
import { cameraLevelFrame, horizonLevelAngle } from "../../scan/level.js";

type OrientationPermissionCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function currentScreenAngle() {
  const modern = window.screen.orientation?.angle;
  if (typeof modern === "number") return modern;
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

export default function CameraLevel({ active }: { active: boolean }) {
  const levelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const level = levelRef.current;
    if (!level) return;

    level.dataset.visible = "false";
    level.dataset.aligned = "false";
    level.style.setProperty("--scan-level-opacity", "0");
    level.style.setProperty("--scan-level-rotation", "0deg");

    if (!active || typeof window.DeviceOrientationEvent === "undefined") return;

    let frameHandle = 0;
    let latest: { beta: number; gamma: number } | null = null;
    let permissionResolved = false;
    const Orientation = window.DeviceOrientationEvent as OrientationPermissionCtor;

    const render = () => {
      frameHandle = 0;
      const angle = latest
        ? horizonLevelAngle(latest.beta, latest.gamma, currentScreenAngle())
        : null;
      const frame = cameraLevelFrame(angle);
      level.dataset.visible = frame.visible ? "true" : "false";
      level.dataset.aligned = frame.aligned ? "true" : "false";
      level.style.setProperty("--scan-level-opacity", frame.opacity.toFixed(3));
      level.style.setProperty("--scan-level-rotation", `${frame.rotationDeg.toFixed(2)}deg`);
    };

    const schedule = () => {
      if (!frameHandle) frameHandle = requestAnimationFrame(render);
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      permissionResolved = true;
      latest = { beta: event.beta, gamma: event.gamma };
      schedule();
    };

    const onScreenOrientation = () => {
      if (latest) schedule();
    };

    window.addEventListener("deviceorientation", onOrientation, { capture: true });
    window.screen.orientation?.addEventListener("change", onScreenOrientation);

    // Safari requires a user gesture before exposing motion/orientation data.
    // Never put that permission in the camera startup path: the scanner remains
    // fully usable when permission is absent or denied. A tap on the empty
    // viewfinder requests it; scanner buttons are deliberately excluded.
    const surface = level.closest(".scanhero");
    const requestPermission = (event: Event) => {
      if (permissionResolved) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea, select")) return;
      if (typeof Orientation.requestPermission !== "function") return;

      permissionResolved = true;
      void Orientation.requestPermission().then((result) => {
        if (result !== "granted") level.dataset.visible = "false";
      }).catch(() => {
        // A denied/blocked sensor must never affect scanner capture.
        level.dataset.visible = "false";
      });
    };

    if (typeof Orientation.requestPermission === "function") {
      surface?.addEventListener("pointerup", requestPermission);
    }

    return () => {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      window.removeEventListener("deviceorientation", onOrientation, { capture: true });
      window.screen.orientation?.removeEventListener("change", onScreenOrientation);
      surface?.removeEventListener("pointerup", requestPermission);
      level.dataset.visible = "false";
    };
  }, [active]);

  return (
    <div className="scanlevel" ref={levelRef} aria-hidden="true">
      <span className="scanlevel-reference" />
      <span className="scanlevel-moving" />
    </div>
  );
}
