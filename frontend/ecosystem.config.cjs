module.exports = {
  apps: [
    {
      name: "aloha-shop",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        NEXT_PUBLIC_SHOP_ORIGIN: "https://alohathegioichaucay.com",
        SHOP_API_INTERNAL: "http://127.0.0.1:3000",
      },
    },
  ],
};
