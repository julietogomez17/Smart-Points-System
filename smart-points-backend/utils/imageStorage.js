
const fs = require("fs");
const path = require("path");
const { cloudinary, useCloudinary } = require("../config/cloudinary");

// Upload a locally saved file to Cloudinary when enabled.
// On localhost, preserve the existing local image path.
const saveImage = async (file, options = {}) => {
  if (!file) return null;

  const {
    folder,
    localFolder,
    privateImage = false
  } = options;

  if (!folder || !localFolder) {
    throw new Error("Image storage folders are required.");
  }

  if (!useCloudinary) {
    return `/uploads/${localFolder}/${file.filename}`;
  }

  const result = await cloudinary.uploader.upload(file.path, {
    folder: `citipoints/${folder}`,
    resource_type: "image",
    type: privateImage ? "authenticated" : "upload",
    overwrite: false,
    unique_filename: true
  });

  return privateImage
    ? `cloudinary-auth:${result.public_id}`
    : result.secure_url;
};

// Remove temporary disk uploads after successful cloud storage.
// Keep local files untouched when using localhost storage.
const cleanupTemporaryImage = async (file) => {
  if (!file || !useCloudinary) return;

  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("TEMP IMAGE CLEANUP ERROR:", error);
    }
  }
};

/**
 * Delete a newly uploaded Cloudinary image when
 * saving its database record fails.
 *
 * Localhost images are NEVER deleted by this function.
 */
const rollbackUploadedImage = async (imageUrl) => {
  if (!useCloudinary || !imageUrl) return;

  // Only handle public Cloudinary URLs.
  // Private participation proofs will use separate handling.
  if (
    typeof imageUrl !== "string" ||
    !imageUrl.startsWith("https://res.cloudinary.com/")
  ) {
    return;
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    const parsedUrl = new URL(imageUrl);

    if (
      parsedUrl.hostname !== "res.cloudinary.com" ||
      !parsedUrl.pathname.startsWith(
        `/${cloudName}/image/upload/`
      )
    ) {
      return;
    }

    const imagePath = parsedUrl.pathname.split(
      "/image/upload/"
    )[1];

    // Remove the Cloudinary version prefix.
    const withoutVersion = imagePath.replace(
      /^v\d+\//,
      ""
    );

    // Remove the file extension to get public_id.
    const publicId = withoutVersion.replace(
      /\.[^.]+$/,
      ""
    );

    // Only allow deletion within our own folders.
    if (!publicId.startsWith("citipoints/")) return;

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "upload",
      invalidate: true
    });
  } catch (error) {
    console.error(
      "CLOUDINARY IMAGE ROLLBACK ERROR:",
      error
    );
  }
};

module.exports = {
  saveImage,
  cleanupTemporaryImage,
  rollbackUploadedImage,
  useCloudinary
};
