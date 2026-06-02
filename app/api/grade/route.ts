import { NextResponse } from 'next/server';
import { decrypt, getHmacHeaders } from '@/lib/crypto-utils';

function decodeJWT(token: string) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        return decoded;
    } catch (e) {
        return null;
    }
}

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '').trim() || '';
        const decodedToken = decodeJWT(token);
        const studentId = decodedToken?.StudentId || decodedToken?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        
        if (!studentId) {
            return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
        }

        const hmac = getHmacHeaders("GET");

        const res = await fetch(`https://citu-prd-x7k2q-enr-01.azurewebsites.net/api/studentgradefile/student/${studentId}/department/10000`, {
            method: 'GET',
            headers: { 
                "Accept": "application/json, text/plain, */*",
                "Authorization": authHeader || '', 
                ...hmac,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0",
                "Origin": "https://student.cituwits.com",
                "Referer": "https://student.cituwits.com/"
            }
        });

        const rawText = await res.text();
        const decrypted = decrypt(rawText);

        if (!decrypted) return NextResponse.json({ error: "Failed to decrypt response" }, { status: 500 });
        return NextResponse.json(decrypted);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}