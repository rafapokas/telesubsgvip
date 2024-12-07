require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Bem-vindo ao Subs Gvip! Digite /planos para ver os planos disponíveis.'));

bot.command('planos', async (ctx) => {
  const response = await axios.get(`${process.env.BACKEND_URL}/plans`);
  const plans = response.data;
  
  let msg = 'Planos disponíveis:\n';
  plans.forEach((p, i) => {
    msg += `${i+1}. ${p.name} - R$${p.price}\n`;
  });
  msg += 'Use /assinar <numero_do_plano>';
  ctx.reply(msg);
});

bot.command('assinar', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const planNumber = args[1];
    if(!planNumber) return ctx.reply('Informe o ID do plano. Ex: /assinar 1');
  
    const telegramId = ctx.from.id;
  
    const { data } = await axios.post(`${process.env.BACKEND_URL}/plans/pay`, { planId: planNumber, telegramId });
    ctx.reply(`Para concluir sua assinatura, acesse: ${data.paymentUrl}`);
  });
  

bot.launch();
console.log('Bot rodando...');
