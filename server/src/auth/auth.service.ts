import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ChatTokenBuilder } from 'agora-token';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  private async registerAgoraUser(username: string): Promise<void> {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) return;

    try {
      const appToken = ChatTokenBuilder.buildAppToken(
        appId,
        appCertificate,
        86400,
      );
      const hosts = [
        'a41.chat.agora.io',
        'a61.chat.agora.io',
        'a1.chat.agora.io',
      ];

      for (const host of hosts) {
        try {
          const res = await fetch(`https://${host}/v2/${appId}/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${appToken}`,
            },
            body: JSON.stringify({
              username: username,
              password: `Pass_${username}_123`,
            }),
          });
          if (res.ok) {
            console.log(
              `Successfully registered user '${username}' on Agora Chat REST API (${host})`,
            );
            break;
          }
        } catch {
          // ignore and try next host region
        }
      }
    } catch (err) {
      console.warn('Agora Chat auto-registration note:', err);
    }
  }

  async register(username: string, passwordPlain: string) {
    if (!username || !passwordPlain) {
      throw new BadRequestException('Username and password are required');
    }
    const user = await this.usersService.createUser(
      username.trim(),
      passwordPlain,
    );

    // Automatically register user in Agora Chat server using App Token
    await this.registerAgoraUser(user.username);

    const tokenObj = this.getAgoraToken(user.username);
    return {
      user,
      agoraToken: tokenObj.token,
    };
  }

  async login(username: string, passwordPlain: string) {
    if (!username || !passwordPlain) {
      throw new BadRequestException('Username and password are required');
    }

    const user = await this.usersService.findByUsernameWithPassword(
      username.trim(),
    );
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    delete user.password;

    // Ensure user exists on Agora Chat server
    await this.registerAgoraUser(user.username);

    const tokenObj = this.getAgoraToken(user.username);

    return {
      user,
      agoraToken: tokenObj.token,
    };
  }

  getAgoraToken(userId: string): { token: string } {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new BadRequestException(
        'Agora App ID or Certificate is missing in environment configuration',
      );
    }

    // Expiration time set to 24 hours (86400 seconds)
    const expirationInSeconds = 24 * 60 * 60;

    const token = ChatTokenBuilder.buildUserToken(
      appId,
      appCertificate,
      userId,
      expirationInSeconds,
    );

    return { token };
  }
}
