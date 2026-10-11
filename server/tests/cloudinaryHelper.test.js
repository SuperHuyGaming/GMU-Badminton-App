const { uploadFlyerToCloudinary, uploadMultipleFlyers } = require("../utils/cloudinaryHelper");
const { cloudinary } = require("../config/cloudinary");

describe("Cloudinary Helper Utility", () => {
    const originalEnv = process.env.CLOUDINARY_CLOUD_NAME;

    afterEach(() => {
        process.env.CLOUDINARY_CLOUD_NAME = originalEnv;
        jest.restoreAllMocks();
    });

    it("returns empty string if url is falsy or invalid", async () => {
        expect(await uploadFlyerToCloudinary(null)).toBe("");
        expect(await uploadFlyerToCloudinary("")).toBe("");
        expect(await uploadFlyerToCloudinary("not-a-url")).toBe("not-a-url");
    });

    it("returns original URL without network call when CLOUDINARY_CLOUD_NAME is mock_cloud", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "mock_cloud";
        const spy = jest.spyOn(cloudinary.uploader, "upload");

        const result = await uploadFlyerToCloudinary("https://example.com/flyer.jpg");
        expect(result).toBe("https://example.com/flyer.jpg");
        expect(spy).not.toHaveBeenCalled();
    });

    it("uploads to Cloudinary and returns secure_url when configured", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "real_cloud_name";
        jest.spyOn(cloudinary.uploader, "upload").mockResolvedValueOnce({
            secure_url: "https://res.cloudinary.com/real_cloud_name/image/upload/v1/tournaments/flyer.jpg"
        });

        const result = await uploadFlyerToCloudinary("https://example.com/flyer.jpg");
        expect(result).toBe("https://res.cloudinary.com/real_cloud_name/image/upload/v1/tournaments/flyer.jpg");
    });

    it("falls back gracefully to original URL if Cloudinary upload throws an error", async () => {
        process.env.CLOUDINARY_CLOUD_NAME = "real_cloud_name";
        jest.spyOn(cloudinary.uploader, "upload").mockRejectedValueOnce(new Error("Network timeout"));

        const result = await uploadFlyerToCloudinary("https://example.com/flyer.jpg");
        expect(result).toBe("https://example.com/flyer.jpg");
    });

    it("handles uploadMultipleFlyers correctly", async () => {
        expect(await uploadMultipleFlyers(null)).toEqual([]);
        const list = ["https://example.com/1.png", "https://example.com/2.png"];
        const res = await uploadMultipleFlyers(list);
        expect(res).toHaveLength(2);
    });
});
