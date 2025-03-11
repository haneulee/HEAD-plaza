/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // api: {
  //   bodyParser: {
  //     sizeLimit: "50mb",
  //   },
  //   responseLimit: "50mb",
  // },
  images: {
    domains: ["res.cloudinary.com"],
  },
};

module.exports = nextConfig;
