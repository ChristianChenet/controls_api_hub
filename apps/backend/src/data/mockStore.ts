import {
  ApiCadastrada,
  Cliente,
  ClienteConsumidor,
  ConexaoBanco,
  LogChamada,
  TokenAcesso,
  Usuario,
  UsuarioEmpresa
} from '../domain/types.js';
export const clientes: Cliente[] = [];
export const conexoes: ConexaoBanco[] = [];
export const apis: ApiCadastrada[] = [];
export const usuariosEmpresas: UsuarioEmpresa[] = [];
export const clientesConsumidores: ClienteConsumidor[] = [];
export const tokens: TokenAcesso[] = [];
export const logs: LogChamada[] = [];

export const usuarios: Usuario[] = [
  {
    id: 'usuario-admin-control-s',
    nome: 'Administrador Control S',
    email: 'admin@controlsconsultoria.com.br',
    perfil: 'admin',
    status: 'ativo',
    senhaHash: 'controls',
    primeiroAcesso: false,
    criadoEm: '2026-05-20T08:00:00.000Z'
  }
];
