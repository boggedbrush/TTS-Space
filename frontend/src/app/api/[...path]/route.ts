import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_BASE = process.env.BACKEND_URL || "http://localhost:8000";

const buildTargetUrl = (request: NextRequest, pathSegments: string[] = []) => {
    const target = new URL(`/api/${pathSegments.join("/")}`, BACKEND_BASE);
    const requestUrl = new URL(request.url);
    target.search = requestUrl.search;
    return target;
};

const buildHeaders = (request: NextRequest) => {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    return headers;
};

const proxyRequest = async (
    request: NextRequest,
    { params }: { params: { path?: string[] } },
) => {
    const targetUrl = buildTargetUrl(request, params.path);
    const headers = buildHeaders(request);

    const init: RequestInit & { duplex?: "half" } = {
        method: request.method,
        headers,
        redirect: "manual",
        signal: request.signal,
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        init.duplex = "half";
    }

    try {
        const response = await fetch(targetUrl, init);

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete("content-encoding");
        responseHeaders.delete("content-length");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: "Backend proxy failed", message }), {
            status: 502,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
