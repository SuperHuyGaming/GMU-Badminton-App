import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from './imageUtils';

describe('imageUtils: compressImage', () => {
	const originalCreateElement = document.createElement.bind(document);
	const originalURL = window.URL;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		document.createElement = originalCreateElement;
		window.URL = originalURL;
	});

	it('returns non-image or null file as-is without crashing', async () => {
		expect(await compressImage(null)).toBeNull();
		expect(await compressImage(undefined)).toBeUndefined();
		expect(await compressImage('')).toBe('');
		expect(await compressImage(12345)).toBe(12345);
		expect(await compressImage(true)).toBe(true);

		const textFile = new File(['hello world'], 'notes.txt', { type: 'text/plain' });
		const result = await compressImage(textFile);
		expect(result).toBe(textFile);
	});

	it('safely handles objects with non-string, missing, or corrupted type properties', async () => {
		const numberType = { type: 123, name: 'photo.jpg' };
		const booleanType = { type: true, name: 'photo.jpg' };
		const nullType = { type: null, name: 'photo.jpg' };
		const missingType = { name: 'photo.jpg', size: 1000 };

		expect(await compressImage(numberType)).toBe(numberType);
		expect(await compressImage(booleanType)).toBe(booleanType);
		expect(await compressImage(nullType)).toBe(nullType);
		expect(await compressImage(missingType)).toBe(missingType);
	});

	it('preserves animated GIFs under maxSizeMB ceiling', async () => {
		const gifFile = new File(['GIF89a-fake-binary'], 'animation.gif', { type: 'image/gif' });
		const result = await compressImage(gifFile, { maxSizeMB: 1.0 });
		expect(result).toBe(gifFile);
	});

	it('gracefully returns original file in environments without canvas 2D or toBlob', async () => {
		// Mock createElement to return canvas without toBlob or getContext
		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') {
				return {
					getContext: () => null,
					toBlob: undefined
				};
			}
			return originalCreateElement(tagName);
		});

		const jpgFile = new File(['fake-jpg'], 'photo.jpg', { type: 'image/jpeg' });
		const result = await compressImage(jpgFile);
		expect(result).toBe(jpgFile);
	});

	it('bypasses compression when image is already <= maxSizeMB and dimensions <= maxWidthOrHeight', async () => {
		const fakeBlob = new Blob(['small-file'], { type: 'image/jpeg' });
		const smallFile = new File([fakeBlob], 'already_small.jpg', { type: 'image/jpeg' });

		// Mock URL.createObjectURL and URL.revokeObjectURL
		window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
		window.URL.revokeObjectURL = vi.fn();

		// Mock canvas and 2d context
		const mockContext = {
			drawImage: vi.fn(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		};
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn()
		};

		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		// Mock Image class where onload fires with dimensions <= 1600
		const OriginalImage = window.Image;
		class MockSmallImage {
			constructor() {
				this.width = 800;
				this.height = 600;
				setTimeout(() => {
					if (this.onload) this.onload();
				}, 10);
			}
		}
		window.Image = MockSmallImage;

		try {
			const result = await compressImage(smallFile, { maxSizeMB: 1.0, maxWidthOrHeight: 1600 });
			expect(result).toBe(smallFile);
			expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
			expect(mockContext.drawImage).not.toHaveBeenCalled();
		} finally {
			window.Image = OriginalImage;
		}
	});

	it('downscales dimensions and compresses large images to JPEG File', async () => {
		const largeFile = new File(['very-large-raw-camera-bytes'.repeat(100)], 'camera_photo.png', {
			type: 'image/png'
		});

		window.URL.createObjectURL = vi.fn(() => 'blob:mock-large-url');
		window.URL.revokeObjectURL = vi.fn();

		const mockContext = {
			drawImage: vi.fn(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		};
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((callback) => {
				const compressedBlob = new Blob(['compressed-binary-data'], { type: 'image/jpeg' });
				callback(compressedBlob);
			})
		};

		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		const OriginalImage = window.Image;
		class MockLargeImage {
			constructor() {
				// High-resolution iPhone dimensions
				this.width = 4032;
				this.height = 3024;
				setTimeout(() => {
					if (this.onload) this.onload();
				}, 10);
			}
		}
		window.Image = MockLargeImage;

		try {
			const result = await compressImage(largeFile, {
				maxSizeMB: 1.0,
				maxWidthOrHeight: 1600,
				initialQuality: 0.8
			});

			expect(result).toBeInstanceOf(File);
			expect(result.type).toBe('image/jpeg');
			expect(result.name).toBe('camera_photo.jpg');
			expect(mockCanvas.width).toBe(1600);
			expect(mockCanvas.height).toBe(1200); // 3024 * (1600 / 4032) = 1200
			expect(mockContext.drawImage).toHaveBeenCalled();
			expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
		} finally {
			window.Image = OriginalImage;
		}
	});

	it('gracefully falls back to original file if image fails to load', async () => {
		const corruptedFile = new File(['corrupt'], 'corrupt.jpg', { type: 'image/jpeg' });

		window.URL.createObjectURL = vi.fn(() => 'blob:corrupt-url');
		window.URL.revokeObjectURL = vi.fn();

		const mockCanvas = {
			getContext: vi.fn(() => ({})),
			toBlob: vi.fn()
		};
		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		const OriginalImage = window.Image;
		class MockErrorImage {
			constructor() {
				setTimeout(() => {
					if (this.onerror) this.onerror(new Error('Decode error'));
				}, 10);
			}
		}
		window.Image = MockErrorImage;

		try {
			const result = await compressImage(corruptedFile);
			expect(result).toBe(corruptedFile);
			expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:corrupt-url');
		} finally {
			window.Image = OriginalImage;
		}
	});

	it('steps down quality if output blob is larger than maxSizeMB', async () => {
		const highResFile = new File(['large-image'], 'portrait.jpg', { type: 'image/jpeg' });

		window.URL.createObjectURL = vi.fn(() => 'blob:portrait-url');
		window.URL.revokeObjectURL = vi.fn();

		let callCount = 0;
		const mockContext = {
			drawImage: vi.fn(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		};
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((callback) => {
				callCount++;
				if (callCount === 1) {
					// First attempt: return oversized blob (1.5MB)
					const bigBlob = { size: 1.5 * 1024 * 1024, type: 'image/jpeg' };
					callback(bigBlob);
				} else {
					// Second attempt: return compliant blob (400KB)
					const okBlob = new Blob(['compliant-bytes'], { type: 'image/jpeg' });
					callback(okBlob);
				}
			})
		};

		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		const OriginalImage = window.Image;
		class MockTallImage {
			constructor() {
				this.width = 2000;
				this.height = 3000;
				setTimeout(() => {
					if (this.onload) this.onload();
				}, 10);
			}
		}
		window.Image = MockTallImage;

		try {
			const result = await compressImage(highResFile, {
				maxSizeMB: 1.0,
				maxWidthOrHeight: 1600,
				initialQuality: 0.8
			});

			expect(callCount).toBe(2);
			expect(result).toBeInstanceOf(File);
			expect(result.type).toBe('image/jpeg');
		} finally {
			window.Image = OriginalImage;
		}
	});

	it('safely handles non-string file.name and defaults to compressed-photo.jpg', async () => {
		const weirdNameFile = new File(['image-bytes-raw'], 'raw', { type: 'image/jpeg' });
		Object.defineProperty(weirdNameFile, 'name', { value: 12345, writable: true });

		window.URL.createObjectURL = vi.fn(() => 'blob:weird-name-url');
		window.URL.revokeObjectURL = vi.fn();

		const mockContext = {
			drawImage: vi.fn(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		};
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((cb) => cb(new Blob(['compressed'], { type: 'image/jpeg' })))
		};
		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		const OriginalImage = window.Image;
		class MockImg {
			constructor() {
				this.width = 2000;
				this.height = 1000;
				setTimeout(() => { if (this.onload) this.onload(); }, 10);
			}
		}
		window.Image = MockImg;

		try {
			const result = await compressImage(weirdNameFile);
			expect(result).toBeInstanceOf(File);
			expect(result.name).toBe('compressed-photo.jpg');
		} finally {
			window.Image = OriginalImage;
		}
	});

	it('preserves aspect ratios for wide banners and tall screenshots, and supports positional signatures', async () => {
		const file = new File(['data'], 'banner.jpg', { type: 'image/jpeg' });
		window.URL.createObjectURL = vi.fn(() => 'blob:banner-url');
		window.URL.revokeObjectURL = vi.fn();

		const mockContext = {
			drawImage: vi.fn(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		};
		let lastWidth = 0;
		let lastHeight = 0;
		const mockCanvas = {
			set width(val) { lastWidth = val; },
			get width() { return lastWidth; },
			set height(val) { lastHeight = val; },
			get height() { return lastHeight; },
			getContext: vi.fn(() => mockContext),
			toBlob: vi.fn((cb) => cb(new Blob(['blob'], { type: 'image/jpeg' })))
		};
		document.createElement = vi.fn((tagName) => {
			if (tagName === 'canvas') return mockCanvas;
			return originalCreateElement(tagName);
		});

		const OriginalImage = window.Image;

		// 1. Wide banner (5000x500)
		class MockWideImage {
			constructor() {
				this.width = 5000;
				this.height = 500;
				setTimeout(() => { if (this.onload) this.onload(); }, 5);
			}
		}
		window.Image = MockWideImage;
		await compressImage(file, { maxWidthOrHeight: 1600 });
		expect(lastWidth).toBe(1600);
		expect(lastHeight).toBe(160);

		// 2. Tall screenshot (500x5000)
		class MockTallImage {
			constructor() {
				this.width = 500;
				this.height = 5000;
				setTimeout(() => { if (this.onload) this.onload(); }, 5);
			}
		}
		window.Image = MockTallImage;
		await compressImage(file, { maxWidthOrHeight: 1600 });
		expect(lastWidth).toBe(160);
		expect(lastHeight).toBe(1600);

		// 3. Positional signature compressImage(file, 800, 0.6)
		class MockPositionalImage {
			constructor() {
				this.width = 1600;
				this.height = 800;
				setTimeout(() => { if (this.onload) this.onload(); }, 5);
			}
		}
		window.Image = MockPositionalImage;
		await compressImage(file, 800, 0.6);
		expect(lastWidth).toBe(800);
		expect(lastHeight).toBe(400);

		window.Image = OriginalImage;
	});
});
