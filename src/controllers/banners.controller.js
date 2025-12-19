// Basic banner controller placeholders to satisfy admin routes.
// Replace with real implementations as needed.

const getBanners = async (req, res) => {
	return res.json([]);
};

const getActiveBanners = async (req, res) => {
	// Return only active banners in a real implementation
	return res.json([]);
};

const createBanner = async (req, res) => {
	// In a full impl this would save to DB and return created banner
	return res.status(201).json({ message: 'banner created' });
};

const updateBanner = async (req, res) => {
	return res.json({ message: 'banner updated' });
};

const deleteBanner = async (req, res) => {
	return res.status(204).send();
};

const toggleBannerStatus = async (req, res) => {
	return res.json({ message: 'banner status toggled' });
};

module.exports = {
	getBanners,
	getActiveBanners,
	createBanner,
	updateBanner,
	deleteBanner,
	toggleBannerStatus,
};
