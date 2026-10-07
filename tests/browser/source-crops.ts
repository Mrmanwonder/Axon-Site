export { cropStyles } from "../../src/scan/crops.js";
export async function pageImageUrl(_paper: string, page: number) {
  if (new URLSearchParams(location.search).get("scenario") === "source-missing") return null;
  return `/tests/browser/reading-page.svg?page=${page}`;
}
