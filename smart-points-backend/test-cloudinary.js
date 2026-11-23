
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const required = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    "Missing Cloudinary credentials:",
    missing.join(", ")
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function testUpload() {
  try {
    // A temporary image generated entirely in memory.
    // No localhost upload files are accessed.
    const imageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
      "base64"
    );

    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${imageBuffer.toString("base64")}`,
      {
        folder: "citipoints/test",
        resource_type: "image",
        public_id: `storage-test-${Date.now()}`,
        overwrite: false
      }
    );

    console.log("CLOUDINARY UPLOAD SUCCESS");
    console.log("Secure URL:", result.secure_url);
    console.log("Public ID:", result.public_id);
  } catch (error) {
    console.error("CLOUDINARY TEST FAILED:", error.message);
    process.exitCode = 1;
  }
}

testUpload();
