import { getCustomRepository, getRepository, In} from 'typeorm';
import csvParse from 'csv-parse';
import path from 'path';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {

    const fullPathFileName  = path.resolve(__dirname, '..', '..', 'tmp', filePath);

    const contactsReadStream = fs.createReadStream(fullPathFileName);

    const parsers = csvParse({
      delimiter: ',',
      from_line: 2,
    });

    const parseCSV = contactsReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({title, type, value, category});
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoriesRepository = getRepository(Category);

    const categoriesInDatabase = await categoriesRepository.find({
      where: {
        title: In(categories),
      }
    });

    const categoriesInDatabaseTitle = categoriesInDatabase.map(
      (category: Category) => category.title
    );

    const newCategories = categories.filter(
      category => !categoriesInDatabaseTitle.includes(category),
    ).filter((value, index, self) => self.indexOf(value) === index);

    const addNewCategories = categoriesRepository.create(
      newCategories.map(title => ({
          title,
        })),
    );

    await categoriesRepository.save(addNewCategories);

    const allCategories = [...addNewCategories, ...categoriesInDatabase];

    const transactionRepository = getCustomRepository(TransactionsRepository);

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      }))
    );

    await transactionRepository.save(createdTransactions);
    await fs.promises.unlink(fullPathFileName);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
