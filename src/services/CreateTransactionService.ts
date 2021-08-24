
import { getCustomRepository, getRepository } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import AppError from '../errors/AppError';

interface Request {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class CreateTransactionService {
  public async execute({title, value, type, category}:Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);
    const { total } = await transactionRepository.getBalance();

    if (type === "outcome" && total < value)
    {
      throw new AppError("You don't have enough balance");
    }

    let categoryTransaction =  await categoryRepository.findOne({
      where: { title: category }
    });

    if (!categoryTransaction)
      {
        categoryTransaction = categoryRepository.create({
          title: category
        });

        await categoryRepository.save(categoryTransaction);
      }

    const transaction = transactionRepository.create({
      title,
      value, 
      type,
      category: categoryTransaction,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
