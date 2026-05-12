// ==========================================
// Vercel Serverless Function
// Redireccion a backend
// ==========================================

export default function handler(req, res) {
  if (req.url === '/api/health') {
    return res.status(200).json({
      status: 'healthy',
      service: 'safecity-frontend',
      timestamp: new Date().toISOString(),
    });
  }

  res.status(404).json({
    error: 'Not found',
    message: 'Use VITE_API_URL to connect to the backend',
  });
}
