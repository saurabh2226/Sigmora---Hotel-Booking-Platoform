const ApiError = require('../../../src/utils/ApiError');

describe('ApiError', () => {
  it('should create an error with statusCode and message', () => {
    const error = new ApiError(404, 'Not Found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not Found');
    expect(error.success).toBe(false);
    expect(error.errors).toEqual([]);
    expect(error.stack).toBeDefined();
  });

  it('should be an instance of Error', () => {
    const error = new ApiError(500, 'Server Error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('should accept custom errors array', () => {
    const validationErrors = [
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password too short' },
    ];
    const error = new ApiError(400, 'Validation Error', validationErrors);
    expect(error.errors).toEqual(validationErrors);
    expect(error.errors).toHaveLength(2);
  });

  it('should use provided stack trace', () => {
    const customStack = 'custom stack trace';
    const error = new ApiError(400, 'Bad Request', [], customStack);
    expect(error.stack).toBe(customStack);
  });

  it('should snapshot common error structures', () => {
    const error400 = new ApiError(400, 'Bad Request');
    const error401 = new ApiError(401, 'Unauthorized');
    const error403 = new ApiError(403, 'Forbidden');
    const error404 = new ApiError(404, 'Not Found');
    const error500 = new ApiError(500, 'Internal Server Error');

    // Snapshot-style assertions
    expect({ statusCode: error400.statusCode, message: error400.message, success: error400.success }).toMatchSnapshot();
    expect({ statusCode: error401.statusCode, message: error401.message, success: error401.success }).toMatchSnapshot();
    expect({ statusCode: error403.statusCode, message: error403.message, success: error403.success }).toMatchSnapshot();
    expect({ statusCode: error404.statusCode, message: error404.message, success: error404.success }).toMatchSnapshot();
    expect({ statusCode: error500.statusCode, message: error500.message, success: error500.success }).toMatchSnapshot();
  });
});
