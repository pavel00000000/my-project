import axios from 'axios';

const API_KEY = 'f25c73c9-5808-4e99-99fe-8553a9650c5c';
const encodedKey = Buffer.from(API_KEY).toString('base64');

// Ваши данные для Telegram бота
const TelegramBotToken = '7994007891:AAGpWidV5nMzpIPBhNEfx-xaR0cY1qwQRtc';
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

// Сопоставление адресов с именами кошельков
const walletNames = {
  '9hgPjBuWp28Zy8H9Kx1Dj7GtSTP4JNhhCjnA7qva3KYQ': 'К1',
  '8PSHkoEHyYx3zx5fCBoRXwDkrGzCGkerhgP6Q3o1JJow': 'К2',
  '7odtY8kEfmARXjS3wuMiDNNrKf3NKrhgLNCMCbkGhFS7': 'К3',
  '3jgub3P9KP3XA9Dwh7XpKu35BiQNTZZXbPmfBAJMsroL': 'К4'
};

// Хранение предыдущих балансов
const previousBalances = {};

// Функция для проверки и отправки уведомлений о пополнении/снятии
async function checkForBalanceChanges() {
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
          addresses: Object.keys(walletNames), // Все адреса из walletNames
          networks: ['SOLANA_MAINNET'], // Используем Solana как сеть
        },
      },
    });

    console.log('API Response:', JSON.stringify(response.data, null, 2)); // Логируем полный ответ

    if (response.data.errors) {
      throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
    }

    const smzaiTokens = response.data.data.portfolio.tokenBalances.filter(balance =>
      balance.token.baseToken.symbol === 'SMZAI'
    );

    console.log('Filtered SMZAI Tokens:', smzaiTokens); // Логируем отфильтрованные токены

    let changesDetected = false; // Переменная для отслеживания изменений

    smzaiTokens.forEach(token => {
      const walletName = walletNames[token.address] || token.address; // Используем имя кошелька или сам адрес
      const currentBalance = token.token.balance;

      // Проверка на изменение баланса
      if (previousBalances[token.address] !== currentBalance) {
        const balanceChange = previousBalances[token.address] ? currentBalance - previousBalances[token.address] : currentBalance;
        const changeMessage = balanceChange > 0 ? `Пополнение на ${balanceChange}` : `Снятие на ${Math.abs(balanceChange)}`;

        let message = `Изменение на кошельке ${walletName}:\n`;
        message += `Баланс: ${currentBalance} ${token.token.baseToken.symbol}\n`;
        message += `Баланс в USD: $${token.token.balanceUSD}\n`;
        message += `${changeMessage}\n\n`;

        // Отправка уведомления в Telegram
        sendTelegramMessage(message);
        changesDetected = true; // Отметим, что изменения были
      }

      // Обновляем предыдущий баланс
      previousBalances[token.address] = currentBalance;
    });

    // Если изменений не было, отправляем уведомление
    if (!changesDetected) {
      sendTelegramMessage('Все в порядке, изменений на кошельках не обнаружено.');
    }

  } catch (error) {
    console.error('Error checking balance changes:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(message) {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${TelegramBotToken}/sendMessage`, {
      chat_id: TelegramChatId,
      text: message,
    });
    console.log('Message sent to Telegram:', response.data); // Логируем успешную отправку
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}
// Функция для периодической проверки баланса (каждые 10 минут)
setInterval(checkForBalanceChanges, 10 * 60 * 1000); // Проверка каждые 10 минут

// Включение начальной проверки сразу при запуске
checkForBalanceChanges();
