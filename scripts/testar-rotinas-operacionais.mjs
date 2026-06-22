// Mantem o comando historico, mas agora executa somente a bateria isolada.
// Assim os testes operacionais nunca usam nem contaminam a base principal da instalacao.
await import('./testar-integracao-isolado.mjs');
