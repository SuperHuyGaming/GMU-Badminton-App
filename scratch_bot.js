const API_URL = 'https://gmu-social-api-staging.onrender.com';

async function run() {
    console.log("Creating Bot 1...");
    let res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ firstName: "Alpha", lastName: "Bot", email: "botalpha2@example.com", password: "password123", skillLevel: "D Level" })
    });
    let data = await res.json();
    if (!res.ok) {
        if (data.message?.includes('already exists') || data.message?.includes('duplicate key')) {
            console.log("Bot 1 already exists, logging in...");
            res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: "botalpha2@example.com", password: "password123" })
            });
            data = await res.json();
        } else {
            return console.log("Bot 1 error", data);
        }
    }
    const token1 = data.accessToken || data.token;
    
    console.log("Creating Bot 2...");
    let res2 = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ firstName: "Beta", lastName: "Bot", email: "botbeta2@example.com", password: "password123", skillLevel: "D Level" })
    });
    let data2 = await res2.json();
    if (!res2.ok) {
        if (data2.message?.includes('already exists') || data2.message?.includes('duplicate key')) {
            console.log("Bot 2 already exists, logging in...");
            res2 = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: "botbeta2@example.com", password: "password123" })
            });
            data2 = await res2.json();
        } else {
            return console.log("Bot 2 error", data2);
        }
    }
    const token2 = data2.accessToken || data2.token;

    console.log("Searching for Huy using Bot 1...");
    res = await fetch(`${API_URL}/api/matchmaking/discover?search=Huy`, {
        headers: { 'Authorization': `Bearer ${token1}` }
    });
    data = await res.json();
    const huy = data.matches.find(m => m.name && m.name.includes("Huy Ngoc Minh Truong"));
    if (!huy) return console.log("Huy not found! Found:", data.matches.map(m => m.name));
    
    console.log("Found Huy! ID:", huy._id);
    
    console.log("Bot 1: Sending Friend Request...");
    res = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ recipientId: huy._id })
    });
    console.log("Bot 1 Friend Request response:", await res.json());

    console.log("Bot 1: Sending Message...");
    res = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({ receiverId: huy._id, content: "Hello Huy! This is Alpha Bot from the AI agent! We are testing the new Friend Request delay features and the messenger!" })
    });
    console.log("Bot 1 Message response:", await res.json());
    
    console.log("Bot 2: Sending Friend Request...");
    res2 = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
        body: JSON.stringify({ recipientId: huy._id })
    });
    console.log("Bot 2 Friend Request response:", await res2.json());

    console.log("Bot 2: Sending Message...");
    res2 = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
        body: JSON.stringify({ receiverId: huy._id, content: "Hi Huy, I am Beta Bot. Checking in from the backend script. Let me know if you get this!" })
    });
    console.log("Bot 2 Message response:", await res2.json());
}
run();
