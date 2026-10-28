function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`
  });
}

function errorHandler(err, req, res, next) {
  console.error("Request failed:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  const status = Number(err.status) || 500;

  res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "An internal server error occurred."
        : err.message
  });
}

module.exports = { notFound, errorHandler };