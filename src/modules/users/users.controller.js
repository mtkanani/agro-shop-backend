const userService = require('./users.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return successResponse(res, user, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetAllUsers(req, res, next) {
  try {
    const { users, pagination } = await userService.getAllUsers(req.query);
    return paginatedResponse(res, users, pagination, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    return successResponse(res, user, 'User profile fetched');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    return successResponse(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleToggleUserStatus(req, res, next) {
  try {
    const result = await userService.toggleUserStatus(req.params.id);
    return successResponse(res, result, `User status updated to ${result.status}`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateUser,
  handleGetAllUsers,
  handleGetUserById,
  handleUpdateUser,
  handleToggleUserStatus,
};
