import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

const chave = () => {
  const configurada = env.credentialsMasterKey.trim();
  if (configurada) {
    const buffer = Buffer.from(configurada, 'base64');
    if (buffer.length === 32) return buffer;
  }
  return createHash('sha256').update(`control-s-cofre:${env.jwtSecret}:${env.tokenHashPepper}`).digest();
};

export function criptografarSegredo(valor: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(), iv);
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${cifrado.toString('base64url')}`;
}

export function descriptografarSegredo(valor: string) {
  const [versao, iv, tag, conteudo] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !conteudo) throw new Error('Credencial armazenada em formato invalido.');
  const decipher = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(conteudo, 'base64url')), decipher.final()]).toString('utf8');
}
