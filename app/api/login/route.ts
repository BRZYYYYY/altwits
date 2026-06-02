import { NextResponse } from 'next/server';
import { encrypt, decrypt, getHmacHeaders } from '@/lib/crypto-utils';

export async function POST(req: Request) {
    try {
        const { studentId, password } = await req.json();
        const hmac = getHmacHeaders("POST");

        const res = await fetch("https://citu-prd-r4t8n-mr-01.azurewebsites.net/api/User/student/login", {
            method: 'POST',
            headers: { 
                "Content-Type": "application/json;charset=UTF-8", 
                ...hmac,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0"
            },
            body: JSON.stringify({ 
                encrypted: encrypt({ userId: studentId, password, clientId: "001" }) 
            })
        });

        const rawText = await res.text();
        const decrypted = decrypt(rawText);

        if (!decrypted) return NextResponse.json({ error: "error" }, { status: 500 });
        return NextResponse.json(decrypted);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}