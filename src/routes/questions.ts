import express from 'express';
import {
  createQuestion,
  getProductQuestions,
  answerQuestion,
  markQuestionHelpful,
  markAnswerHelpful,
  getCustomerQuestions,
} from '../controllers/questionController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Customer routes
router.post('/', verifyToken, checkRole('customer'), createQuestion);
router.get('/my-questions', verifyToken, checkRole('customer'), getCustomerQuestions);

// Public routes
router.get('/product/:productId', getProductQuestions);
router.post('/:questionId/helpful', markQuestionHelpful);
router.post('/:questionId/answers/:answerId/helpful', markAnswerHelpful);

// Authenticated routes (any user can answer)
router.post('/:questionId/answer', verifyToken, answerQuestion);

export default router;
