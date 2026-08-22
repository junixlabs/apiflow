import express from 'express';

const router = express.Router();

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.delete('/users/:id', removeUser);

export default router;
