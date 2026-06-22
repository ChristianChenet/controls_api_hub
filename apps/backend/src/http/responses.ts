export function sucesso<T>(dados: T, meta?: Record<string, unknown>) {
  return {
    sucesso: true,
    ...(meta ? { meta } : {}),
    dados
  };
}

export function erro(codigo: string, mensagem: string) {
  return {
    sucesso: false,
    erro: {
      codigo,
      mensagem
    }
  };
}
