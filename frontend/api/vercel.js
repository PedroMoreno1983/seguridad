// ==========================================
// Vercel Serverless Function
// Redirección a backend o mock de datos
// ==========================================

export default function handler(req, res) {
  // Health check endpoint
  if (req.url === '/api/health') {
    return res.status(200).json({ 
      status: 'healthy',
      service: 'safecity-frontend',
      timestamp: new Date().toISOString()
    });
  }

  // Redirigir otras peticiones al backend
  res.status(404).json({ 
    error: 'Not found',
    message: 'Use VITE_API_URL to connect to the backend'
  });
}
