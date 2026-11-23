
const cloudinary = require("cloudinary").v2;

const storageProvider = (
  process.env.STORAGE_PROVIDER || "local"
).toLowerCase();

const useCloudinary = storageProvider === "cloudinary";

if (useCloudinary) {
  const requiredVariables = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ];

  const missing = requiredVariables.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing Cloudinary configuration: ${missing.join(", ")}`
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

module.exports = {
  cloudinary,
  useCloudinary
};
