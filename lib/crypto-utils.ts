import * as crypto from 'crypto';

const HMAC_SECRET = Buffer.from("ourSuperSecretKeyEnrollmentAdmin123");
const AES_TEXT_KEY = "anotherUniqueSuperSecretKeyEnrollmentAdmin123";
const H_VALUE = "aP9!vB7@kL3#xY5$zQ2^mN8&dR1*oW6%uJ4(eT0)";

const AES_KEY = crypto.createHash('sha256').update(AES_TEXT_KEY).digest();
const AES_IV = Buffer.from(AES_TEXT_KEY.substring(0, 16));

export function encrypt(data: object): string {
    const rawJson = JSON.stringify(data);
    const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
    let encrypted = cipher.update(rawJson, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

export function decrypt<T>(b64: string): T | null {
    if (!b64) return null;
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
        let decrypted = decipher.update(b64.trim(), 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted) as T;
    } catch (e) { return null; }
}

export function getHmacHeaders(method: string) {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const salt = crypto.randomBytes(16).toString('base64');
    const message = `${nonce}:studentportal:${method.toUpperCase()}:${salt}:${H_VALUE}`;
    const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
    return {
        "X-HMAC-Signature": signature,
        "X-HMAC-Nonce": nonce,
        "X-HMAC-Salt": salt,
        "X-Origin": "studentportal"
    };
}