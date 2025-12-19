 (async () => {
  try {
    const res = await fetch('http://localhost:5000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@swadhaneats.com', password: 'Admin@123' }),
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    try { console.log(JSON.parse(text)); } catch (e) { console.log(text); }
  } catch (err) {
    console.error('Request error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
