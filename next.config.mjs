/** @type {import('next').NextConfig} */
const nextConfig = {
  // إنتاج ملفات ثابتة داخل مجلد out/ جاهزة للرفع مباشرة عبر Netlify Drop
  output: 'export',
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // منع أخطاء حزمة canvas الاختيارية عند استخدام pdfjs-dist في المتصفح
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
