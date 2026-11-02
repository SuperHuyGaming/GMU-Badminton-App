// server/tests/uploadMedia.test.js
require("dotenv").config();
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cloudinary = require("cloudinary").v2;

const uploadRoutes = require("../routes/upload");

const JWT_SECRET = process.env.JWT_SECRET || "gmu_badminton_super_secret_key_2026";
const testUserId = "650000000000000000000088";
const testUserToken = jwt.sign(
	{ id: testUserId, userId: testUserId, role: "user", username: "MediaTester", email: "media@gmu.edu" },
	JWT_SECRET
);

const app = express();
app.use(express.json());
app.use("/api/upload", uploadRoutes);

describe("Media Upload Routes (Disk-Storage Video & Audio Streaming)", () => {
	const uploadDir = path.join(os.tmpdir(), "gmu_badminton_uploads");
	const savedEnv = { ...process.env };

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		process.env = { ...savedEnv };
		jest.restoreAllMocks();
	});

	describe("Authentication Guards", () => {
		it("rejects unauthenticated POST /api/upload/video with 401", async () => {
			const res = await request(app).post("/api/upload/video");
			expect(res.status).toBe(401);
		});

		it("rejects unauthenticated POST /api/upload/audio with 401", async () => {
			const res = await request(app).post("/api/upload/audio");
			expect(res.status).toBe(401);
		});
	});

	describe("POST /api/upload/video", () => {
		it("returns 400 if no video file is provided", async () => {
			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("No video provided");
		});

		it("returns 400 if invalid video MIME type is uploaded", async () => {
			const textBuffer = Buffer.from("plain text instead of video", "utf-8");
			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("video", textBuffer, "document.txt");

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Invalid file format");
		});

		it("successfully uploads valid MP4 video and cleans up disk file", async () => {
			const dummyVideoBuffer = Buffer.from("fake-mp4-video-stream-content-bytes", "utf-8");

			const unlinkSpy = jest.spyOn(fs.promises, "unlink");

			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("video", dummyVideoBuffer, {
					filename: "badminton_smash.mp4",
					contentType: "video/mp4",
				});

			expect(res.status).toBe(200);
			expect(res.body.message).toContain("Video uploaded successfully");
			expect(res.body.videoUrl).toBeDefined();
			expect(typeof res.body.videoUrl).toBe("string");
			expect(res.body.videoThumbnail).toBeDefined();

			// Guaranteed resource cleanup: unlink must have been called
			expect(unlinkSpy).toHaveBeenCalled();
			unlinkSpy.mockRestore();
		});

		it("successfully uploads valid WebM video file", async () => {
			const dummyWebmBuffer = Buffer.from("fake-webm-video-bytes", "utf-8");

			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("video", dummyWebmBuffer, {
					filename: "rally_clip.webm",
					contentType: "video/webm",
				});

			expect(res.status).toBe(200);
			expect(res.body.videoUrl).toBeDefined();
		});

		it("invokes Cloudinary upload when configured and extracts media metadata", async () => {
			const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
			process.env.CLOUDINARY_CLOUD_NAME = "real_cloud_prod";

			const uploadSpy = jest.spyOn(cloudinary.uploader, "upload").mockResolvedValueOnce({
				secure_url: "https://res.cloudinary.com/real_cloud_prod/video/upload/v1234/videos/smash.mp4",
				duration: 15.4,
				width: 1920,
				height: 1080,
			});

			const dummyVideoBuffer = Buffer.from("production-video-sample", "utf-8");
			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("video", dummyVideoBuffer, {
					filename: "match_final.mp4",
					contentType: "video/mp4",
				});

			expect(res.status).toBe(200);
			expect(uploadSpy).toHaveBeenCalledWith(
				expect.stringContaining(uploadDir),
				expect.objectContaining({ resource_type: "video" })
			);
			expect(res.body.videoUrl).toBe("https://res.cloudinary.com/real_cloud_prod/video/upload/v1234/videos/smash.mp4");
			expect(res.body.videoDuration).toBe(15.4);
			expect(res.body.videoWidth).toBe(1920);

			process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
			uploadSpy.mockRestore();
		});

		it("returns 500 and cleans up disk if Cloudinary upload throws", async () => {
			const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
			process.env.CLOUDINARY_CLOUD_NAME = "real_cloud_prod";

			const uploadSpy = jest.spyOn(cloudinary.uploader, "upload").mockRejectedValueOnce(
				new Error("Cloudinary connection timeout")
			);
			const unlinkSpy = jest.spyOn(fs.promises, "unlink");

			const dummyVideoBuffer = Buffer.from("video-timeout-test", "utf-8");
			const res = await request(app)
				.post("/api/upload/video")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("video", dummyVideoBuffer, {
					filename: "timeout.mp4",
					contentType: "video/mp4",
				});

			expect(res.status).toBe(500);
			expect(res.body.message).toContain("Server error during video upload");
			expect(unlinkSpy).toHaveBeenCalled();

			process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
			uploadSpy.mockRestore();
			unlinkSpy.mockRestore();
		});
	});

	describe("POST /api/upload/audio", () => {
		it("returns 400 if no audio file is provided", async () => {
			const res = await request(app)
				.post("/api/upload/audio")
				.set("Authorization", `Bearer ${testUserToken}`);

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("No audio provided");
		});

		it("returns 400 if invalid audio MIME type is uploaded", async () => {
			const textBuffer = Buffer.from("not audio content", "utf-8");
			const res = await request(app)
				.post("/api/upload/audio")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("audio", textBuffer, "sound.exe");

			expect(res.status).toBe(400);
			expect(res.body.message).toContain("Invalid file format");
		});

		it("successfully uploads MP3 audio and returns audioUrl & duration", async () => {
			const dummyAudioBuffer = Buffer.from("fake-mp3-audio-bytes-content", "utf-8");
			const unlinkSpy = jest.spyOn(fs.promises, "unlink");

			const res = await request(app)
				.post("/api/upload/audio")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("audio", dummyAudioBuffer, {
					filename: "coach_memo.mp3",
					contentType: "audio/mpeg",
				});

			expect(res.status).toBe(200);
			expect(res.body.message).toContain("Audio uploaded successfully");
			expect(res.body.audioUrl).toBeDefined();
			expect(typeof res.body.audioUrl).toBe("string");
			expect(res.body.audioDuration).toBeDefined();

			expect(unlinkSpy).toHaveBeenCalled();
			unlinkSpy.mockRestore();
		});

		it("successfully uploads WAV audio file with Cloudinary streaming", async () => {
			const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
			process.env.CLOUDINARY_CLOUD_NAME = "real_cloud_prod";

			const uploadSpy = jest.spyOn(cloudinary.uploader, "upload").mockResolvedValueOnce({
				secure_url: "https://res.cloudinary.com/real_cloud_prod/video/upload/v1234/audio/note.wav",
				duration: 6.5,
			});

			const dummyAudioBuffer = Buffer.from("fake-wav-stream-bytes", "utf-8");
			const res = await request(app)
				.post("/api/upload/audio")
				.set("Authorization", `Bearer ${testUserToken}`)
				.attach("audio", dummyAudioBuffer, {
					filename: "court_announcement.wav",
					contentType: "audio/wav",
				});

			expect(res.status).toBe(200);
			expect(uploadSpy).toHaveBeenCalledWith(
				expect.stringContaining(uploadDir),
				expect.objectContaining({ resource_type: "video" })
			);
			expect(res.body.audioUrl).toBe("https://res.cloudinary.com/real_cloud_prod/video/upload/v1234/audio/note.wav");
			expect(res.body.audioDuration).toBe(6.5);

			process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
			uploadSpy.mockRestore();
		});
	});
});
