import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
Object.defineProperty(window, "matchMedia", { value: vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) });
