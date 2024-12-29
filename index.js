import axios from 'axios';
import { writeFileSync } from 'fs';
import open from 'open';

const API_KEY = 'f25c73c9-5808-4e99-99fe-8553a9650c5c';
const encodedKey = Buffer.from(API_KEY).toString('base64');
const telegramBotToken = '7994007891:AAGpWidV5nMzpIPBhNEfx-xaR0cY1qwQRtc';
const TelegramChatId = '-1002322975978';

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

async function sendTelegramMessage(message) {
  try {
    // Разделяем сообщение на части, если оно слишком длинное
    const maxMessageLength = 4000; // Максимальная длина сообщения Telegram
    while (message.length > maxMessageLength) {
      const part = message.substring(0, maxMessageLength);
      await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        chat_id: TelegramChatId,
        text: part,
      });
      message = message.substring(maxMessageLength);
    }
    // Отправляем оставшуюся часть
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

async function monitorPortfolio() {
  try {
    const portfolio = await fetchPortfolio();
    const resultHtml = generateHTML(portfolio);

    // Сохранение в файл portfolio.html
    writeFileSync('portfolio.html', resultHtml);

    // Открытие HTML файла в браузере
    await open('file:///C:/Users/User/my-project/portfolio.html', { app: { name: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } });


    // Отправка данных о балансе в Telegram
    let telegramMessage = 'Portfolio Balances:\n';
    portfolio.portfolio.tokenBalances.forEach(item => {
      telegramMessage += `${item.token.baseToken.name} (${item.token.baseToken.symbol}): ${item.token.balance} - $${item.token.balanceUSD}\n`;
    });

    await sendTelegramMessage(telegramMessage);
  } catch (error) {
    console.error('Failed to fetch portfolio:', error.message);
  }
}

// Запуск мониторинга каждые 5 минут
setInterval(monitorPortfolio, 5 * 60 * 1000); // каждые 5 минут

// Запуск приложения сразу
monitorPortfolio();
