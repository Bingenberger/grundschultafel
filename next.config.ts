import type {NextConfig} from 'next';
const nextConfig:NextConfig={output:'standalone',experimental:{cpus:1,proxyClientMaxBodySize:'24mb'},poweredByHeader:false,images:{unoptimized:true}};
export default nextConfig;
