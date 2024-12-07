require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const app = express();
app.use(express.json());

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN não encontrado no arquivo .env');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;

  // Check user subscription status
  try {
    const { data: statusData } = await axios.get(`${process.env.BACKEND_URL}/plans/status/${telegramId}`);
    
    // Welcome message with subscription status
    if (statusData.isActive) {
      return ctx.reply(
        `Bem-vindo ao Subs Gvip!\nSua assinatura está ativa por mais ${statusData.daysRemaining} dias.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
        ])
      );
    }
  } catch (error) {
    console.error('Erro ao verificar status:', error);
  }

  // Default welcome message
  ctx.reply(
    'Bem-vindo ao Subs Gvip! Escolha uma opção:',
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
    ])
  );
});

// Handler para mostrar planos
bot.action('show_plans', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    
    // Verifica se já tem assinatura ativa
    const statusResponse = await axios.get(`${process.env.BACKEND_URL}/plans/status/${telegramId}`);
    if (statusResponse.data.isActive) {
      return ctx.reply(
        `Você já possui uma assinatura ativa!\nDias restantes: ${statusResponse.data.daysRemaining}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
        ])
      );
    }

    const response = await axios.get(`${process.env.BACKEND_URL}/plans`);
    const plans = response.data;
    
    let msg = '📋 *Planos disponíveis:*\n\n';
    plans.forEach((p, i) => {
      const priceInReais = (p.price / 100).toFixed(2);
      msg += `${i+1}. *${p.name}*\nPreço: R$ ${priceInReais}\n\n`;
    });
    
    await ctx.answerCbQuery();
    ctx.replyWithMarkdown(
      msg,
      Markup.inlineKeyboard([
        [Markup.button.callback('💳 Assinar Plano', 'subscribe_plan_1')],
        [Markup.button.callback('❌ Cancelar', 'cancel_subscription')]
      ])
    );
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    await ctx.answerCbQuery();
    ctx.reply(
      'Desculpe, ocorreu um erro ao buscar os planos. Tente novamente mais tarde.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Tentar Novamente', 'show_plans')]
      ])
    );
  }
});

// Handler para verificar status
bot.action('check_status', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const { data } = await axios.get(`${process.env.BACKEND_URL}/plans/status/${telegramId}`);
    
    await ctx.answerCbQuery();
    if (data.isActive) {
      ctx.reply(
        `✅ Sua assinatura está ativa!\nDias restantes: ${data.daysRemaining}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Atualizar Status', 'check_status')]
        ])
      );
    } else {
      ctx.reply(
        '❌ Você não possui uma assinatura ativa.',
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans')]
        ])
      );
    }
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    await ctx.answerCbQuery();
    ctx.reply(
      'Desculpe, ocorreu um erro ao verificar seu status. Tente novamente mais tarde.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Tentar Novamente', 'check_status')]
      ])
    );
  }
});

// Handler para assinar plano
bot.action('subscribe_plan_1', async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    // Verifica se já tem assinatura ativa
    const statusResponse = await axios.get(`${process.env.BACKEND_URL}/plans/status/${telegramId}`);
    if (statusResponse.data.isActive) {
      await ctx.answerCbQuery();
      return ctx.reply(
        `Você já possui uma assinatura ativa!\nDias restantes: ${statusResponse.data.daysRemaining}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
        ])
      );
    }
    
    const { data } = await axios.post(`${process.env.BACKEND_URL}/plans/pay`, { planId: 1, telegramId });
    await ctx.answerCbQuery();
    await ctx.reply(
      '💳 *Pagamento Iniciado*\n\nClique no link abaixo para realizar o pagamento. Você receberá uma notificação assim que o pagamento for confirmado.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Realizar Pagamento', url: data.paymentUrl }],
            [{ text: '📊 Verificar Status', callback_data: 'check_status' }]
          ]
        }
      }
    );
  } catch (error) {
    await ctx.answerCbQuery();
    if (error.response?.data?.message) {
      ctx.reply(
        error.response.data.message,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
        ])
      );
    } else {
      console.error('Erro ao processar assinatura:', error);
      ctx.reply(
        'Desculpe, ocorreu um erro ao processar sua assinatura. Tente novamente mais tarde.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Tentar Novamente', 'subscribe_plan_1')]
        ])
      );
    }
  }
});

// Handler para cancelar operação
bot.action('cancel_subscription', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(
    'Operação cancelada. Como posso ajudar?',
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
    ])
  );
});

// Tratamento de erros global
bot.catch((err, ctx) => {
  console.error('Erro no bot:', err);
  ctx.reply(
    'Desculpe, ocorreu um erro inesperado. Tente novamente mais tarde.',
    Markup.inlineKeyboard([
      [Markup.button.callback('📋 Ver Planos', 'show_plans'), Markup.button.callback('📊 Meu Status', 'check_status')]
    ])
  );
});

bot.launch();
console.log('Bot rodando...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Endpoint para receber notificações do backend
app.post('/payment-notification', async (req, res) => {
  const { telegramId, status } = req.body;

  try {
    // Enviar mensagem ao usuário com base no status do pagamento
    if (status === 'completed') {
      await bot.telegram.sendMessage(
        telegramId,
        '✅ *Pagamento confirmado!*\n\nSua assinatura VIP foi ativada com sucesso.\n\nUse o comando /status para ver os detalhes da sua assinatura.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Ver Status', callback_data: 'check_status' }]
            ]
          }
        }
      );
    } else if (status === 'expired') {
      await bot.telegram.sendMessage(
        telegramId,
        '❌ *Sessão de pagamento expirada*\n\nSua sessão de pagamento expirou. Por favor, tente novamente se ainda desejar assinar.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Ver Planos', callback_data: 'show_plans' }]
            ]
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao enviar mensagem ao usuário:', error.response ? error.response.data : error);
    res.sendStatus(500);
  }
});

// Iniciar o servidor HTTP do bot
app.listen(3001, () => {
  console.log('Servidor HTTP do bot rodando na porta 3001');
});
