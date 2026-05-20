const express = require('express');

const { HTTP_STATUS, ERROR_MESSAGES, PAGINATION } = require('../constants');
const userService = require('../services/userService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );

    const result = userService.getUsers(page, limit);
    res.json(result);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});

router.get('/search', (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        message: 'Name query parameter is required',
      });
    }

    const users = userService.searchUsers(name);
    res.json({ users });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        message: 'Invalid user ID',
      });
    }

    const user = userService.getUserById(id);
    res.json(user);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, email } = req.body;
    const user = userService.createUser(name, email);

    res.status(HTTP_STATUS.CREATED).json(user);
  } catch (error) {
    const status = error.message.includes('required') || error.message.includes('Invalid')
      ? HTTP_STATUS.BAD_REQUEST
      : HTTP_STATUS.INTERNAL_ERROR;

    res.status(status).json({
      error: status === HTTP_STATUS.BAD_REQUEST
        ? ERROR_MESSAGES.INVALID_INPUT
        : ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});

module.exports = router;
