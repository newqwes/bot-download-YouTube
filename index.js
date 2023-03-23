import fs from 'fs';
import path from 'path';
import { Telegraf } from 'telegraf';
import youtubedl from 'youtube-dl-exec';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import dotenv from 'dotenv';

dotenv.config();
const ffmpegPath = ffmpeg.path;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const getInfo = (url, flags) => youtubedl(url, { dumpSingleJson: true, ...flags });

const fromInfo = (infoFile, flags) => youtubedl.exec('', { loadInfoJson: infoFile, ...flags });

const downloadVideo = async url => {
  const info = await getInfo(url);

  // write the info to a file for youtube-dl to read it
  fs.writeFileSync('videoInfo.json', JSON.stringify(info));

  // the info the we retrive can be read directly or passed to youtube-dl
  console.log(info.description);
  console.log((await fromInfo('videoInfo.json', { listThumbnails: true })).stdout);

  // and finally we can download the video
  await fromInfo('videoInfo.json', { output: 'path/to/output' });

  return 'path/to/output';
};

const deleteFile = filePath => {
  fs.unlink(filePath, error => {
    if (error) {
      console.error(`Ошибка удаления файла: ${error}`);
    } else {
      console.log('Файл удален');
    }
  });
};

bot.start(ctx =>
  ctx.reply('Привет! Отправьте мне ссылку на видео с YouTube, и я скачаю и отправлю его вам.')
);
bot.help(ctx =>
  ctx.reply('Отправьте мне ссылку на видео с YouTube, и я скачаю и отправлю его вам.')
);

bot.on('text', async ctx => {
  const url = ctx.message.text;

  try {
    ctx.reply('Скачиваю видео...');
    const videoPath = await downloadVideo(url);
    ctx.replyWithVideo({ source: fs.createReadStream(videoPath) });
    deleteFile(videoPath);
  } catch (error) {
    console.error(`Ошибка: ${error}`);
    ctx.reply(
      'Произошла ошибка при скачивании видео. Пожалуйста, убедитесь, что вы отправили правильную ссылку.'
    );
  }
});

bot.launch();
