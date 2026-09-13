/**
 * Utilities for optimizing Cloudinary image URLs.
 * By injecting transformation parameters, we offload image cropping and compression to Cloudinary.
 */

const optimizeCloudinaryUrl = (url, transformations) => {
	if (!url || typeof url !== 'string') return url;
	if (!url.includes('res.cloudinary.com')) return url;

	// Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567/image.jpg
	// We want to insert transformations after "upload/"
	const parts = url.split('/upload/');
	if (parts.length === 2) {
		return `${parts[0]}/upload/${transformations}/${parts[1]}`;
	}
	return url;
};

export const getOptimizedAvatar = (url, size = 150) => {
	// w_size, h_size, c_fill (crop to fit square), q_auto (auto quality), f_webp (force webp), g_face (focus on face)
	const transformations = `w_${size},h_${size},c_fill,g_face,q_auto,f_webp`;
	return optimizeCloudinaryUrl(url, transformations);
};

export const getOptimizedCover = (url, width = 800, height = 300) => {
	// c_fill (crop to cover), q_auto, f_webp
	const transformations = `w_${width},h_${height},c_fill,q_auto,f_webp`;
	return optimizeCloudinaryUrl(url, transformations);
};
