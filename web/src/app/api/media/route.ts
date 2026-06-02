import { NextResponse } from "next/server";

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const HTTP_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

function resolveMediaUrl(raw: string) {
  if (raw.startsWith("ipfs://")) {
    return {
      url: `https://ipfs.io/ipfs/${raw.replace("ipfs://", "")}`,
      immutable: true,
    };
  }
  if (raw.startsWith("ar://")) {
    return {
      url: `https://arweave.net/${raw.replace("ar://", "")}`,
      immutable: true,
    };
  }
  if (raw.startsWith("https://ipfs.io/ipfs/") || raw.startsWith("https://arweave.net/")) {
    return { url: raw, immutable: true };
  }
  return { url: raw, immutable: false };
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function htmlBaseHref(responseUrl: string, fallbackUrl: string) {
  const href = responseUrl || fallbackUrl;
  try {
    const parsed = new URL(href);
    const lastPathPart = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const looksLikeFile = /\.[a-z0-9]{2,8}$/i.test(lastPathPart);
    if (!looksLikeFile && !parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch (_err) {
    return href;
  }
}

function injectHtmlBase(html: string, baseHref: string) {
  const base = `<base href="${baseHref.replace(/"/g, "&quot;")}">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  return `${base}${html}`;
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (source.startsWith("data:")) {
    return NextResponse.json({ error: "Data URLs should not be proxied" }, { status: 400 });
  }

  const resolved = resolveMediaUrl(source);
  let target: URL;
  try {
    target = new URL(resolved.url);
  } catch (_err) {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
  }
  if (target.protocol !== "https:" || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "Unsupported media URL" }, { status: 400 });
  }

  const response = await fetch(target, {
    headers: { Accept: "image/*,video/*,text/html,application/xhtml+xml,*/*;q=0.8" },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Media fetch failed" }, { status: response.status || 502 });
  }

  const headers = new Headers();
  headers.set("Cache-Control", resolved.immutable ? IMMUTABLE_CACHE : HTTP_CACHE);
  headers.set("X-Content-Type-Options", "nosniff");
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentType?.toLowerCase().includes("html")) {
    const html = await response.text();
    const withBase = injectHtmlBase(html, htmlBaseHref(response.url, target.toString()));
    headers.set("Content-Type", contentType);
    return new Response(withBase, { status: 200, headers });
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(response.body, { status: 200, headers });
}
