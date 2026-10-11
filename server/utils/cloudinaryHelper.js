const { cloudinary } = require('../config/cloudinary');

/**
 * Uploads a remote flyer image URL to Cloudinary so images are permanently hosted.
 * If Cloudinary is not configured or fails, falls back gracefully to original URL.
 *
 * @param {string} remoteUrl - The remote image URL (from Instagram/web)
 * @returns {Promise<string>} Permanent Cloudinary URL or original URL
 */
const uploadFlyerToCloudinary = async (remoteUrl) => {
    if (!remoteUrl || typeof remoteUrl !== 'string' || !remoteUrl.startsWith('http')) {
        return remoteUrl || '';
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName || cloudName === 'mock_cloud') {
        // Cloudinary not configured in this environment; return original URL
        return remoteUrl;
    }

    try {
        const uploadResult = await cloudinary.uploader.upload(remoteUrl, {
            folder: 'gmu-badminton/tournaments',
            resource_type: 'image',
            transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
        });
        return uploadResult.secure_url || remoteUrl;
    } catch (err) {
        console.warn(`[Cloudinary] Could not upload remote flyer image (${remoteUrl}): ${err.message}`);
        return remoteUrl;
    }
};

/**
 * Uploads an array of flyer image URLs to Cloudinary.
 *
 * @param {string[]} urls - Array of remote image URLs
 * @returns {Promise<string[]>} Array of permanent or original URLs
 */
const uploadMultipleFlyers = async (urls) => {
    if (!Array.isArray(urls)) return [];
    return Promise.all(urls.map(u => uploadFlyerToCloudinary(u)));
};

module.exports = {
    uploadFlyerToCloudinary,
    uploadMultipleFlyers
};
