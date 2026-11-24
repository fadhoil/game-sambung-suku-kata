/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // wasm-webp mengirim build ESM (dist/esm) tanpa penanda .mjs; tanpa aturan ini
    // webpack menganggapnya CommonJS sehingga `import` di dalamnya gagal di-minify.
    config.module.rules.push({
      test: /[\\/]node_modules[\\/]wasm-webp[\\/]dist[\\/]esm[\\/].*\.js$/,
      type: "javascript/esm",
    });
    // Glue wasm menyiapkan jalur Node (`await import('module')`) yang tidak pernah
    // dijalankan di browser; beri modul kosong agar webpack tidak gagal resolve.
    config.resolve.fallback = { ...config.resolve.fallback, module: false };
    return config;
  },
};

export default nextConfig;
