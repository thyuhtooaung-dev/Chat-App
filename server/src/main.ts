import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const val = valueParts
            .join('=')
            .trim()
            .replace(/^["']|["']$/g, '');
          process.env[key.trim()] = val;
        }
      }
    });
  }
}

async function bootstrap() {
  loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`NestJS Auth Server running on http://localhost:${port}`);
}
void bootstrap();
