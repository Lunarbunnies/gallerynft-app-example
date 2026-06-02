import { NextResponse } from "next/server";

function resolveMediaUrl(raw: string) {
  if (raw.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${raw.replace("ipfs://", "")}`;
  }
  if (raw.startsWith("ar://")) {
    return `https://arweave.net/${raw.replace("ar://", "")}`;
  }
  return raw;
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

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (source.startsWith("data:")) {
    const match = source.match(/^data:([^;,]+)/);
    return NextResponse.json({ contentType: match?.[1] || null });
  }

  let target: URL;
  try {
    target = new URL(resolveMediaUrl(source));
  } catch (_err) {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
  }
  if (target.protocol !== "https:" || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "Unsupported media URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    let response = await fetch(target, {
      method: "HEAD",
      headers: { Accept: "image/*,video/*,text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("content-type")) {
      response = await fetch(target, {
        headers: { Accept: "image/*,video/*,text/html,application/xhtml+xml,*/*;q=0.8" },
        redirect: "follow",
        signal: controller.signal,
      });
    }
    return NextResponse.json(
      {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Media info lookup failed" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
