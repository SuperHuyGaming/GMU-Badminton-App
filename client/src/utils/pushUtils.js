// client/src/utils/pushUtils.js

/**
 * Converts a base64 or base64url string to a Uint8Array suitable for PushManager subscription keys.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export const urlB64ToUint8Array = (base64String) => {
    if (!base64String || typeof base64String !== 'string') {
        return new Uint8Array(0);
    }
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};
