import { Request, Response } from 'express';
import ProductQuestion from '../models/ProductQuestion';
import Product from '../models/Product';

// Create a question
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { product_id, questionText } = req.body;
    const customer_id = (req as any).user.id;

    // Verify product exists
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const question = await ProductQuestion.create({
      product_id,
      customer_id,
      questionText,
    });

    await question.populate('customer_id', 'name');

    res.status(201).json({
      message: 'Question posted successfully',
      question,
    });
  } catch (error: any) {
    console.error('Create question error:', error);
    res.status(500).json({ message: 'Failed to post question', error: error.message });
  }
};

// Get questions for a product
export const getProductQuestions = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const filter: any = { product_id: productId };
    if (status) {
      filter.status = status;
    }

    const questions = await ProductQuestion.find(filter)
      .populate('customer_id', 'name')
      .populate('answers.answeredBy', 'name role')
      .sort('-createdAt')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ProductQuestion.countDocuments(filter);

    res.status(200).json({
      questions,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Failed to fetch questions', error: error.message });
  }
};

// Answer a question
export const answerQuestion = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const { answerText } = req.body;
    const answeredBy = (req as any).user.id;
    const userRole = (req as any).user.role;

    const question = await ProductQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const answer = {
      answeredBy,
      answerText,
      isVendorAnswer: userRole === 'vendor' || userRole === 'admin',
      helpfulCount: 0,
      createdAt: new Date(),
    };

    question.answers.push(answer);
    question.status = 'answered';
    await question.save();

    await question.populate('answers.answeredBy', 'name role');

    res.status(200).json({
      message: 'Answer posted successfully',
      question,
    });
  } catch (error: any) {
    console.error('Answer question error:', error);
    res.status(500).json({ message: 'Failed to post answer', error: error.message });
  }
};

// Mark question as helpful
export const markQuestionHelpful = async (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    const question = await ProductQuestion.findByIdAndUpdate(
      questionId,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.status(200).json({
      message: 'Question marked as helpful',
      helpfulCount: question.helpfulCount,
    });
  } catch (error: any) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ message: 'Failed to mark question as helpful', error: error.message });
  }
};

// Mark answer as helpful
export const markAnswerHelpful = async (req: Request, res: Response) => {
  try {
    const { questionId, answerId } = req.params;

    const question = await ProductQuestion.findOneAndUpdate(
      { _id: questionId, 'answers._id': answerId },
      { $inc: { 'answers.$.helpfulCount': 1 } },
      { new: true }
    ).populate('answers.answeredBy', 'name role');

    if (!question) {
      return res.status(404).json({ message: 'Question or answer not found' });
    }

    res.status(200).json({
      message: 'Answer marked as helpful',
      question,
    });
  } catch (error: any) {
    console.error('Mark answer helpful error:', error);
    res.status(500).json({ message: 'Failed to mark answer as helpful', error: error.message });
  }
};

// Get customer's questions
export const getCustomerQuestions = async (req: Request, res: Response) => {
  try {
    const customer_id = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const questions = await ProductQuestion.find({ customer_id })
      .populate('product_id', 'name images')
      .populate('answers.answeredBy', 'name role')
      .sort('-createdAt')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ProductQuestion.countDocuments({ customer_id });

    res.status(200).json({
      questions,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get customer questions error:', error);
    res.status(500).json({ message: 'Failed to fetch questions', error: error.message });
  }
};
