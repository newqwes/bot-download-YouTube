import fs from 'fs';
import { Telegraf } from 'telegraf';
import ytdl from 'ytdl-core';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { spawn } from 'child_process';

import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const outputFileName = 'videoInfo.mp4';

const deleteFile = filePath => {
  fs.unlink(filePath, error => {
    if (error) {
      console.error(`Ошибка удаления файла: ${error}`);
    } else {
      console.log('Файл удален');
    }
  });
};

const handleStart = ctx => ctx.reply('Привет! Отправьте мне ссылку на видео с YouTube, и я скачаю и отправлю его вам.');
const handleHelp = ctx => ctx.reply('Отправьте мне ссылку на видео с YouTube, и я скачаю и отправлю его вам.');

const handleText = async ctx => {
  const url = ctx.message.text;

  try {
    ctx.reply('Скачиваю видео...');

    const info = await ytdl.getInfo(url);
    const videoFormat = info.formats
      .filter(format => format.container === 'mp4')
      .find(format => format.qualityLabel === '480p' ||
      parseInt(format.height, 10) <= 480);

    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

    if (videoFormat && audioFormat) {
      const videoStream = ytdl.downloadFromInfo(info, { format: videoFormat });
      const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });

      const ffmpegArgs = [
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-movflags', 'frag_keyframe+empty_moov',
        outputFileName
      ];

      const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
        stdio: [
          'pipe', 'pipe', 'pipe',
          'pipe', 'pipe',
        ],
      });

      videoStream.pipe(ffmpeg.stdio[3]);
      audioStream.pipe(ffmpeg.stdio[4]);

      ffmpeg.on('exit', async (code, signal) => {
        if (code === 0) {
          console.log(`Video with audio has been downloaded and saved as ${outputFileName}`);
          ctx.reply('Видео скачено, отправляю вам...');
          await ctx.replyWithVideo({ source: fs.createReadStream(outputFileName) });
          await deleteFile(outputFileName);
        } else {
          ctx.reply('Возникла ошибка');
          console.error(`FFmpeg
          exited with an error: code ${code}, signal ${signal}`);
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg stderr: ${data}`);
      });
    } else {
      ctx.reply('No suitable format found');
      console.error('No suitable format found');
    }
  } catch (error) {
    console.error(`Ошибка: ${error}`);
    ctx.reply(
      'Произошла ошибка при скачивании видео. Пожалуйста, убедитесь, что вы отправили правильную ссылку.'
    );
  }
};

bot.start(handleStart);
bot.help(handleHelp);
bot.on('text', handleText);

bot.launch();
