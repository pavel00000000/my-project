import axios from 'axios';
import { writeFileSync } from 'fs';
import open from 'open';
import path from 'path';
import express from 'express';

// Создаем Express приложение
const app = express();

// Константы для API
const API_KEY = 'f25c73c9-5808-4e99-99fe-8553a9650c5c';
const encodedKey = Buffer.from(API_KEY).toString('base64');
const telegramBotToken = '7994007891:AAGpWidV5nMzpIPBhNEfx-xaR0cY1qwQRtc';
const TelegramChatId = '-1002322975978';

// GraphQL запрос
const query = `
  query providerPorfolioQuery($addresses: [Address!]!, $networks: [Network!]!) {
    portfolio(addresses: $addresses, networks: $networks) {
      tokenBalances {
        address
        network
        token {
          balance
          balanceUSD
          baseToken {
            name
            symbol
          }
        }
      }
    }
  }
`;

// Функция для получения данных портфеля
async function fetchPortfolio() {
  try {
    const response = await axios({
      url: 'https://public.zapper.xyz/graphql',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodedKey}`,
      },
      data: {
        query,
        variables: {
          addresses: ['0xf977814e90da44bfa03b6295a0616a897441acec'],
          networks: ['ETHEREUM_MAINNET'],
        },
      },
    });

    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Error fetching portfolio:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Преобразование данных в HTML
function generateHTML(data) {
  let html = `
  <html>
    <head>
      <title>Portfolio</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          background-color: #f4f4f9;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #4CAF50;
          color: white;
        }
        tr:hover {
          background-color: #f5f5f5;
        }
      </style>
    </head>
    <body>
      <h1>Portfolio Details</h1>
      <table>
        <thead>
          <tr>
            <th>Address</th>
            <th>Network</th>
            <th>Token Name</th>
            <th>Token Symbol</th>
            <th>Balance</th>
            <th>Balance (USD)</th>
          </tr>
        </thead>
        <tbody>`;

  // Заполняем таблицу данными
  data.portfolio.tokenBalances.forEach(item => {
    html += `
      <tr>
        <td>${item.address}</td>
        <td>${item.network}</td>
        <td>${item.token.baseToken.name}</td>
        <td>${item.token.baseToken.symbol}</td>
        <td>${item.token.balance}</td>
        <td>${item.token.balanceUSD}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
  </html>`;

  return html;
}

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(message) {
  try {
    const maxMessageLength = 4000; // Максимальная длина сообщения Telegram
    while (message.length > maxMessageLength) {
      const part = message.substring(0, maxMessageLength);
      await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        chat_id: TelegramChatId,
        text: part,
      });
      message = message.substring(maxMessageLength);
    }
    // Отправка оставшейся части
    await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      chat_id: TelegramChatId,
      text: message,
    });
  } catch (error) {
    console.error('Error sending message to Telegram:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Основная функция мониторинга портфеля
async function monitorPortfolio() {
  try {
    // Получаем данные о портфеле
    const portfolio = await fetchPortfolio();
    const resultHtml = generateHTML(portfolio);

    // Сохранение в файл portfolio.html в текущей папке
    const filePath = path.join(process.cwd(), 'portfolio.html');
    writeFileSync(filePath, resultHtml);

    // Генерация URL и открытие файла с помощью системного браузера
    const fileUrl = `file://${filePath}`;
    await open(fileUrl);
    console.log('Portfolio file opened in default browser.');

    // Формирование сообщения для Telegram
    let telegramMessage = 'Portfolio Balances:\n';
    portfolio.portfolio.tokenBalances.forEach(item => {
      telegramMessage += `${item.token.baseToken.name} (${item.token.baseToken.symbol}): ${item.token.balance} - $${item.token.balanceUSD}\n`;
    });

    // Отправка данных в Telegram
    await sendTelegramMessage(telegramMessage);
  } catch (error) {
    console.error('Failed to fetch portfolio:', error.message);
  }
}

// Запуск мониторинга каждые 5 минут
setInterval(monitorPortfolio, 5 * 60 * 1000); // каждые 5 минут

// Запуск мониторинга сразу
monitorPortfolio();

// Устанавливаем порт для сервера, который будет использоваться на Render
const port = process.env.PORT || 4000;

// Настройка роута
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Запуск сервера на указанном порту
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
