/**
 * Standard API response helpers.
 * All responses follow the shape:
 *   { success: boolean, message: string, data?: any, pagination?: any, errors?: any[] }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message]
 * @param {number} [statusCode]
 * @param {object} [extra] - Additional top-level fields (e.g. pagination)
 */
const successResponse = (
  res,
  data = null,
  message = "Success",
  statusCode = 200,
  extra = {},
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode]
 * @param {any[]} [errors]
 */
const errorResponse = (
  res,
  message = "An error occurred",
  statusCode = 500,
  errors = [],
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { successResponse, errorResponse };
