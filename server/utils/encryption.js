const crypto = require('crypto');

// Use an environment variable or fallback for the 32-byte key
const getSecretKey = () => {
    let key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'supersecretkey12345678901234567890';
    // Ensure key is exactly 32 bytes for AES-256
    if (key.length !== 32) {
        key = crypto.createHash('sha256').update(String(key)).digest('base64').substring(0, 32);
    }
    return Buffer.from(key);
};

const ENCRYPTION_KEY = getSecretKey();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const PREFIX = 'ENC:';

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Format: ENC:iv:authTag:encryptedText
        return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        return text;
    }
}

function decrypt(text) {
    if (!text || !text.startsWith(PREFIX)) return text; // Not encrypted or empty
    
    try {
        const parts = text.substring(PREFIX.length).split(':');
        if (parts.length !== 3) return text;
        
        const [ivHex, authTagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        return "⚠️ [Message could not be decrypted]";
    }
}

module.exports = { encrypt, decrypt };
