export default function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json({ ok: true });
  }
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
}
