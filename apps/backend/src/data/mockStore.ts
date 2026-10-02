import {
  ApiCadastrada,
  Cliente,
  ClienteConsumidor,
  ConexaoBanco,
  LogChamada,
  TokenAcesso,
  Usuario,
  UsuarioEmpresa
  ,PerfilAcesso
} from '../domain/types.js';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

const senhaSuperAdministrador = process.env.SUPER_ADMIN_PASSWORD ?? 'Christian2024@';
const hashSenhaSuperAdministrador = createHash('sha256')
  .update(`senha:${senhaSuperAdministrador}:${env.jwtSecret}`)
  .digest('hex');
export const clientes: Cliente[] = [];
export const conexoes: ConexaoBanco[] = [];
export const apis: ApiCadastrada[] = [];
export const usuariosEmpresas: UsuarioEmpresa[] = [];
export const clientesConsumidores: ClienteConsumidor[] = [];
export const tokens: TokenAcesso[] = [];
export const logs: LogChamada[] = [];
export const perfisAcesso: PerfilAcesso[] = [{ id:'perfil-admin', nome:'Admin', descricao:'Acesso administrativo completo.', menusPermitidos:['dashboard','clientes','conexoes','integracoes','apis','editor','consumidores','tokens','usuarios','perfis','logs','dominios','configuracoes'], permissoesAcoes:['integracao.visualizar','integracao.configurar','integracao.sincronizar','integracao.ver_token','integracao.resolver_alerta','integracao.excluir_pedido','notificacao.configurar','api.publicar','api.editar','api.excluir','cadastro.editar','cadastro.excluir'], tiposAlerta:['falha_integracao','divergencia_contrato','dados_incompletos'], padrao:true, ativo:true, criadoEm:'2026-05-20T08:00:00.000Z' }];

export const usuarios: Usuario[] = [
  {
    id: 'usuario-admin-control-s',
    nome: 'Christian - Super Administrador',
    email: process.env.SUPER_ADMIN_EMAIL ?? 'christian@controlsconsultoria.com.br',
    perfil: 'admin',
    status: 'ativo',
    senhaHash: hashSenhaSuperAdministrador,
    primeiroAcesso: false,
    criadoEm: '2026-05-20T08:00:00.000Z'
    ,perfilAcessoId: 'perfil-admin'
  }
];
