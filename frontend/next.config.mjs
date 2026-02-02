const allowedDevOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_WEB_ORIGIN,
    process.env.NEXT_PUBLIC_URL,
    ...((process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)),
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    allowedDevOrigins,
};

export default nextConfig;
