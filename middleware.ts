import { NextResponse, type NextRequest } from "next/server";

/** Porównanie odporne na pomiar czasu. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function decodePassword(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const bytes = Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const i = decoded.indexOf(":");
    return i === -1 ? null : decoded.slice(i + 1);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const given = decodePassword(req.headers.get("authorization"));
  if (given !== null && safeEqual(given, password)) return NextResponse.next();

  return new NextResponse("Wymagane hasło. Login dowolny, hasło = APP_PASSWORD.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Waga magazynowa", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
