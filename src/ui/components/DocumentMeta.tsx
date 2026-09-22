import { useEffect } from "react";

const DEFAULT_ORIGIN = "https://axonstudy.online";
const SOCIAL_IMAGE = "/og-image.svg";

type Props = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, key);
    document.head.append(node);
  }
  node.content = content;
}

/** Keeps metadata correct across both direct loads and client-side navigation. */
export default function DocumentMeta({ title, description, path, noIndex = false }: Props) {
  useEffect(() => {
    const configured = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "");
    const origin = configured || (location.hostname === "localhost" ? location.origin : DEFAULT_ORIGIN);
    const canonical = new URL(path, `${origin}/`).href;
    const image = new URL(SOCIAL_IMAGE, `${origin}/`).href;

    document.title = title;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="robots"]', "name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setMeta('meta[property="og:image"]', "property", "og:image", image);
    setMeta('meta[property="og:image:width"]', "property", "og:image:width", "1200");
    setMeta('meta[property="og:image:height"]', "property", "og:image:height", "630");
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.append(link);
    }
    link.href = canonical;
  }, [description, noIndex, path, title]);

  return null;
}
